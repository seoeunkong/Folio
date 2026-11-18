import type { DatabaseSync } from 'node:sqlite'
import type { DaySummary, Goal, GoalPatch, Holiday, HolidayKind, Task, TaskPatch, Week } from '../shared/types'
import { addDays, type Ymd } from '../core/dates'
import { nextBusinessDay, stackOnTop, type MovingTask } from '../core/rollover'
import { gapTooSmall, orderBetween } from '../core/ordering'
import { setSetting, transaction } from './db'

interface TaskRow {
  id: number
  title: string
  note: string
  date: string
  sort_order: number
  done: number
  done_at: string | null
  first_date: string
  carry_count: number
  goal_id: number | null
  goal_title: string | null
  goal_no: number | null
  source: 'local' | 'asana'
  asana_gid: string | null
  sync_state: string | null
}

/**
 * 할 일을 읽는 모든 쿼리의 앞부분. 연결된 목표의 제목과 번호(그 주 목표 중 몇 번째인지, 1부터)를 함께 가져온다.
 * 번호는 주간 화면의 01, 02와 같은 기준(sort_order, id 순)이다.
 */
const TASK_SELECT = `SELECT t.*, g.title AS goal_title,
  (SELECT COUNT(*) FROM goals g2 WHERE g2.week_start = g.week_start
     AND (g2.sort_order < g.sort_order OR (g2.sort_order = g.sort_order AND g2.id <= g.id))) AS goal_no
  FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id`
/** 미완료(sort_order 순) 다음에 완료(완료 시각 순) */
const TASK_ORDER = 't.done, CASE WHEN t.done = 0 THEN t.sort_order END, t.done_at, t.id'

const GOAL_SELECT = 'SELECT id, week_start AS weekStart, title, sort_order AS sortOrder FROM goals'

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  note: r.note,
  date: r.date,
  sortOrder: r.sort_order,
  done: r.done === 1,
  doneAt: r.done_at,
  firstDate: r.first_date,
  carryCount: r.carry_count,
  goalId: r.goal_id,
  goalTitle: r.goal_title,
  goalNo: r.goal_id === null ? null : r.goal_no,
  source: r.source,
  asanaGid: r.asana_gid,
  syncState: r.sync_state,
})

/**
 * 할 일·휴일 규칙이 모이는 곳. 화면(IPC)과 이후의 Asana·AI 서비스는 모두 여기를 거쳐 DB를 바꾼다.
 * now는 테스트에서 시각을 고정하려고 주입한다.
 */
export class TaskService {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── 할 일 ────────────────────────────────────────────

  listTasks(date: Ymd): Task[] {
    const rows = this.db.prepare(`${TASK_SELECT} WHERE t.date = ? ORDER BY ${TASK_ORDER}`).all(date)
    return (rows as unknown as TaskRow[]).map(toTask)
  }

  /** from~to(포함). 날짜순, 같은 날 안에서는 listTasks와 같은 순서 */
  listTasksRange(from: Ymd, to: Ymd): Task[] {
    const rows = this.db.prepare(`${TASK_SELECT} WHERE t.date BETWEEN ? AND ? ORDER BY t.date, ${TASK_ORDER}`).all(from, to)
    return (rows as unknown as TaskRow[]).map(toTask)
  }

  getTask(id: number): Task | undefined {
    const row = this.db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as unknown as TaskRow | undefined
    return row && toTask(row)
  }

  addTask(date: Ymd, title: string): Task {
    const t = title.trim()
    if (!t) throw new Error('제목이 비어 있습니다')
    const max = this.undoneOrderBound(date, 'MAX')
    const r = this.db
      .prepare('INSERT INTO tasks(title, date, first_date, sort_order) VALUES (?, ?, ?, ?)')
      .run(t, date, date, orderBetween(max, null))
    return this.getTask(Number(r.lastInsertRowid))!
  }

  updateTask(id: number, patch: TaskPatch) {
    if (patch.title !== undefined) {
      const t = patch.title.trim()
      if (!t) throw new Error('제목이 비어 있습니다')
      this.db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run(t, id)
    }
    if (patch.note !== undefined) this.db.prepare('UPDATE tasks SET note = ? WHERE id = ?').run(patch.note, id)
  }

  deleteTask(id: number) {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  /** 체크하면 완료 구역으로, 체크를 풀면 미완료 목록의 맨 아래로 간다. */
  setDone(id: number, done: boolean) {
    transaction(this.db, () => {
      const task = this.getTask(id)
      if (!task || task.done === done) return
      if (done) {
        this.db.prepare('UPDATE tasks SET done = 1, done_at = ? WHERE id = ?').run(this.now().toISOString(), id)
      } else {
        const max = this.undoneOrderBound(task.date, 'MAX')
        this.db
          .prepare('UPDATE tasks SET done = 0, done_at = NULL, sort_order = ? WHERE id = ?')
          .run(orderBetween(max, null), id)
      }
    })
  }

  /** 같은 날 미완료 목록 안에서 prevId와 nextId 사이로 옮긴다(null이면 맨 위/맨 아래). */
  moveTask(id: number, prevId: number | null, nextId: number | null) {
    transaction(this.db, () => {
      const task = this.getTask(id)
      if (!task || task.done) return
      const neighbor = (nid: number | null) => {
        if (nid === null) return null
        const n = this.getTask(nid)
        if (!n || n.done || n.date !== task.date) throw new Error('같은 날의 미완료 할 일 사이로만 옮길 수 있습니다')
        return n
      }
      let prev = neighbor(prevId)?.sortOrder ?? null
      let next = neighbor(nextId)?.sortOrder ?? null
      if (gapTooSmall(prev, next)) {
        this.renumber(task.date)
        prev = prevId === null ? null : this.getTask(prevId)!.sortOrder
        next = nextId === null ? null : this.getTask(nextId)!.sortOrder
      }
      this.db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?').run(orderBetween(prev, next), id)
    })
  }

  /**
   * 다른 날짜로 옮긴다(월 달력 끌어 놓기). 그날 미완료 목록의 맨 아래로 가며, 직접 옮긴 것이므로 이월 횟수는 그대로다.
   * 지난 날짜로는 옮기지 않는다(다음 이월 때 바로 밀려나 이월 횟수만 올라간다). 완료한 할 일은 기록으로 남긴다.
   */
  moveTaskToDate(id: number, date: Ymd, today: Ymd) {
    if (date < today) throw new Error('지난 날짜로는 옮길 수 없습니다')
    transaction(this.db, () => {
      const task = this.getTask(id)
      if (!task || task.done || task.date === date) return
      const max = this.undoneOrderBound(date, 'MAX')
      this.db.prepare('UPDATE tasks SET date = ?, sort_order = ? WHERE id = ?').run(date, orderBetween(max, null), id)
    })
  }

  /** from~to(포함) 날짜별 전체·완료 개수. 할 일이 없는 날은 빠진다. */
  daySummaries(from: Ymd, to: Ymd): DaySummary[] {
    return this.db
      .prepare(
        'SELECT date, COUNT(*) AS total, SUM(done) AS done FROM tasks WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date',
      )
      .all(from, to) as unknown as DaySummary[]
  }

  // ── 주간 테마·목표 ────────────────────────────────────

  getWeek(weekStart: Ymd): Week {
    const row = this.db.prepare('SELECT theme FROM weeks WHERE week_start = ?').get(weekStart) as { theme: string } | undefined
    const goals = this.db.prepare(`${GOAL_SELECT} WHERE week_start = ? ORDER BY sort_order, id`).all(weekStart) as unknown as Goal[]
    const ids = goals.map((g) => g.id)
    const linked = ids.length
      ? (this.db
          .prepare(`${TASK_SELECT} WHERE t.goal_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.date, ${TASK_ORDER}`)
          .all(...ids) as unknown as TaskRow[]).map(toTask)
      : []
    return {
      weekStart,
      theme: row?.theme ?? '',
      goals: goals.map((g) => ({ ...g, tasks: linked.filter((t) => t.goalId === g.id) })),
    }
  }

  setWeekTheme(weekStart: Ymd, theme: string) {
    this.db
      .prepare('INSERT INTO weeks(week_start, theme) VALUES (?, ?) ON CONFLICT(week_start) DO UPDATE SET theme = excluded.theme')
      .run(weekStart, theme.trim())
  }

  addGoal(weekStart: Ymd, title: string): Goal {
    const t = title.trim()
    if (!t) throw new Error('목표가 비어 있습니다')
    const { v } = this.db.prepare('SELECT MAX(sort_order) AS v FROM goals WHERE week_start = ?').get(weekStart) as { v: number | null }
    const r = this.db
      .prepare('INSERT INTO goals(week_start, title, sort_order) VALUES (?, ?, ?)')
      .run(weekStart, t, orderBetween(v, null))
    return this.db.prepare(`${GOAL_SELECT} WHERE id = ?`).get(Number(r.lastInsertRowid)) as unknown as Goal
  }

  updateGoal(id: number, patch: GoalPatch) {
    if (patch.title !== undefined) {
      const t = patch.title.trim()
      if (!t) throw new Error('목표가 비어 있습니다')
      this.db.prepare('UPDATE goals SET title = ? WHERE id = ?').run(t, id)
    }
  }

  /** 같은 주 목표 안에서 prevId와 nextId 사이로 옮긴다. 할 일 순서(moveTask)와 같은 방식이다. */
  moveGoal(id: number, prevId: number | null, nextId: number | null) {
    const get = (gid: number) => this.db.prepare(`${GOAL_SELECT} WHERE id = ?`).get(gid) as unknown as Goal | undefined
    transaction(this.db, () => {
      const goal = get(id)
      if (!goal) return
      const neighbor = (nid: number | null) => {
        if (nid === null) return null
        const n = get(nid)
        if (!n || n.weekStart !== goal.weekStart) throw new Error('같은 주의 목표 사이로만 옮길 수 있습니다')
        return n.sortOrder
      }
      let prev = neighbor(prevId)
      let next = neighbor(nextId)
      if (gapTooSmall(prev, next)) {
        const ids = this.db.prepare('SELECT id FROM goals WHERE week_start = ? ORDER BY sort_order, id').all(goal.weekStart) as { id: number }[]
        const update = this.db.prepare('UPDATE goals SET sort_order = ? WHERE id = ?')
        ids.forEach((r, i) => update.run(i, r.id))
        prev = prevId === null ? null : get(prevId)!.sortOrder
        next = nextId === null ? null : get(nextId)!.sortOrder
      }
      this.db.prepare('UPDATE goals SET sort_order = ? WHERE id = ?').run(orderBetween(prev, next), id)
    })
  }

  /** 목표를 지워도 할 일은 남기고 연결만 푼다. */
  deleteGoal(id: number) {
    transaction(this.db, () => {
      this.db.prepare('UPDATE tasks SET goal_id = NULL WHERE goal_id = ?').run(id)
      this.db.prepare('DELETE FROM goals WHERE id = ?').run(id)
    })
  }

  /** 다른 주로 이월된 할 일도 원래 목표와의 연결을 유지한다(주간 평가에서 그 목표의 일로 센다). */
  setTaskGoal(taskId: number, goalId: number | null) {
    this.db.prepare('UPDATE tasks SET goal_id = ? WHERE id = ?').run(goalId, taskId)
  }

  // ── 자동 이월 ────────────────────────────────────────

  /**
   * 오늘보다 이전 날짜의 미완료 할 일을 "오늘을 포함해 가장 가까운 평일"의 맨 위로 옮긴다.
   * 한 트랜잭션이고, 옮긴 뒤에는 이전 날짜의 미완료가 남지 않으므로 다시 실행해도 아무 일도 없다.
   * 반환값은 옮긴 개수.
   */
  runRollover(today: Ymd): number {
    return transaction(this.db, () => {
      const overdue = this.db
        .prepare('SELECT id, date, sort_order AS sortOrder FROM tasks WHERE done = 0 AND date < ?')
        .all(today) as unknown as MovingTask[]
      if (overdue.length > 0) {
        const target = nextBusinessDay(today, this.holidayDates())
        this.applyMoves(overdue, target, true)
      }
      setSetting(this.db, 'last_rollover', today)
      return overdue.length
    })
  }

  // ── 휴일 ─────────────────────────────────────────────

  listHolidays(): Holiday[] {
    return this.db.prepare('SELECT date, name, kind FROM holidays ORDER BY date').all() as unknown as Holiday[]
  }

  /** 반환값은 그날의 미완료 할 일 수(오늘 이후 날짜만 센다. 지난 날은 자동 이월이 처리한다). */
  addHoliday(date: Ymd, name: string, kind: HolidayKind, today: Ymd): number {
    const n = name.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !n) throw new Error('날짜와 이름을 입력해 주세요')
    this.db
      .prepare(
        'INSERT INTO holidays(date, name, kind) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name, kind = excluded.kind',
      )
      .run(date, n, kind)
    if (date < today) return 0
    const { c } = this.db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE date = ? AND done = 0').get(date) as { c: number }
    return c
  }

  removeHoliday(date: Ymd) {
    this.db.prepare('DELETE FROM holidays WHERE date = ?').run(date)
  }

  /** 휴일이 된 날의 미완료 할 일을 다음 평일 맨 위로 옮긴다. 사용자가 미룬 것이 아니므로 이월 횟수는 그대로 둔다. */
  moveTasksOffHoliday(date: Ymd): { target: Ymd; moved: number } {
    return transaction(this.db, () => {
      const target = nextBusinessDay(addDays(date, 1), this.holidayDates())
      const moving = this.db
        .prepare('SELECT id, date, sort_order AS sortOrder FROM tasks WHERE done = 0 AND date = ?')
        .all(date) as unknown as MovingTask[]
      this.applyMoves(moving, target, false)
      return { target, moved: moving.length }
    })
  }

  /** 위젯에 띄울 안내. 올해(12월부터는 내년) 공휴일 데이터가 없으면 확인을 요청한다. */
  holidayNotice(today: Ymd): string | null {
    const year = Number(today.slice(0, 4))
    const has = (y: number) =>
      (this.db.prepare(`SELECT COUNT(*) AS c FROM holidays WHERE kind = 'public' AND date LIKE ?`).get(`${y}-%`) as { c: number }).c > 0
    if (!has(year)) return `${year}년 공휴일을 확인해 주세요 (설정 › 휴일 관리)`
    if (today.slice(5, 7) === '12' && !has(year + 1)) return `내년 공휴일을 확인해 주세요 (설정 › 휴일 관리)`
    return null
  }

  // ── 내부 ─────────────────────────────────────────────

  private holidayDates(): Set<Ymd> {
    const rows = this.db.prepare('SELECT date FROM holidays').all() as { date: string }[]
    return new Set(rows.map((r) => r.date))
  }

  private undoneOrderBound(date: Ymd, fn: 'MIN' | 'MAX'): number | null {
    const row = this.db.prepare(`SELECT ${fn}(sort_order) AS v FROM tasks WHERE date = ? AND done = 0`).get(date) as {
      v: number | null
    }
    return row.v
  }

  private applyMoves(moving: MovingTask[], target: Ymd, countAsCarry: boolean) {
    if (moving.length === 0) return
    const ids = new Set(moving.map((m) => m.id))
    // target에 이미 있는 할 일 중 옮기는 대상이 아닌 것의 맨 위 값
    const existing = this.db
      .prepare('SELECT id, sort_order AS v FROM tasks WHERE date = ? AND done = 0')
      .all(target) as { id: number; v: number }[]
    const mins = existing.filter((r) => !ids.has(r.id)).map((r) => r.v)
    const minOrder = mins.length ? Math.min(...mins) : null
    const update = this.db.prepare(
      `UPDATE tasks SET date = ?, sort_order = ?, carry_count = carry_count + ? WHERE id = ?`,
    )
    for (const m of stackOnTop(moving, minOrder, target)) update.run(m.date, m.sortOrder, countAsCarry ? 1 : 0, m.id)
  }

  /** 그 날 미완료 목록의 sort_order를 현재 순서대로 0, 1, 2…로 다시 매긴다. */
  private renumber(date: Ymd) {
    const ids = this.db
      .prepare('SELECT id FROM tasks WHERE date = ? AND done = 0 ORDER BY sort_order, id')
      .all(date) as { id: number }[]
    const update = this.db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?')
    ids.forEach((r, i) => update.run(i, r.id))
  }
}
