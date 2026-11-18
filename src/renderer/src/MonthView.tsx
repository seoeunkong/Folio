import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { addDays, dayOfWeek, WEEKDAY_KO, type Ymd } from '../../core/dates'
import type { DaySummary, Holiday, Task, Week } from '../../shared/types'
import { formatDay, useHolidays, useLive, usePrefs, useTasks, useToday } from './hooks'
import { dropOnTask, TaskList } from './components/TaskList'
import { GoalMark } from './components/GoalMark'
import { QuickAdd } from './components/QuickAdd'

const DAY = 'day:' // 달력 칸 droppable id 접두사. 할 일 id(숫자)와 구분한다.
const HEAD = ['월', '화', '수', '목', '금', '토', '일']

/** month('YYYY-MM')를 담는 월요일 시작 주 단위 날짜 목록 */
function monthGrid(month: string): Ymd[] {
  const first = `${month}-01`
  const offset = (dayOfWeek(first) + 6) % 7
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const weeks = Math.ceil((offset + days) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i - offset))
}

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 포인터 아래가 달력 칸이면 그 칸(지난 날짜 칸이면 아무 데도 아님), 목록 위면 가장 가까운 할 일, 그 밖이면 아무 데도 아님.
 * 달력 칸은 드래그 시작 때 재어 둔 사각형 대신 지금 화면에서 포인터 아래 요소를 찾는다.
 * 재어 둔 사각형이 때때로 어긋나 엉뚱한 칸에 놓이는 문제가 있었다.
 */
const collision: CollisionDetection = (args) => {
  const p = args.pointerCoordinates
  if (!p) return []
  const under = document.elementsFromPoint(p.x, p.y)
  const cell = under.find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.date !== undefined)
  if (cell) {
    const container = args.droppableContainers.find((c) => c.id === DAY + cell.dataset.date)
    return container ? [{ id: container.id, data: { droppableContainer: container, value: 0 } }] : []
  }
  if (!under.some((el) => el.closest('.day-panel'))) return []
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => !String(c.id).startsWith(DAY)) })
}

export function MonthView() {
  const today = useToday()
  const prefs = usePrefs()
  const holidays = useHolidays()
  const [month, setMonth] = useState<string>()
  const [selected, setSelected] = useState<Ymd>()
  useEffect(() => {
    if (today && !month) {
      setMonth(today.slice(0, 7))
      setSelected(today)
    }
  }, [today, month])

  const cells = useMemo(() => (month ? monthGrid(month) : []), [month])
  const [from, to] = [cells[0], cells[cells.length - 1]]
  const [summaries] = useLive<DaySummary[]>(
    () => (from ? window.api.getDaySummaries(from, to) : Promise.resolve([])),
    [from, to],
  )
  const weekStarts = useMemo(() => cells.filter((_, i) => i % 7 === 0), [cells])
  const [weeks] = useLive<Week[]>(() => Promise.all(weekStarts.map((ws) => window.api.getWeek(ws))), [from, to])
  const [tasks, setTasks] = useTasks(selected)
  const [dragging, setDragging] = useState<Task | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  if (!today || !month || !selected || !prefs) return null

  const showWeekends = prefs.showWeekends
  const cols = showWeekends ? 7 : 5
  const summaryOf = new Map(summaries?.map((s) => [s.date, s]))
  const holidayOf = new Map(holidays.map((h) => [h.date, h]))
  const select = (d: Ymd) => {
    setSelected(d)
    if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    if (!over || !tasks) return
    const id = Number(active.id)
    const overId = String(over.id)
    if (overId.startsWith(DAY)) {
      const date = overId.slice(DAY.length)
      if (date === selected || date < today) return
      setTasks(tasks.filter((t) => t.id !== id))
      void window.api.moveTaskToDate(id, date)
    } else dropOnTask(tasks, setTasks, id, Number(overId))
  }

  const [y, m] = month.split('-')
  const sel = formatDay(selected)
  const selHoliday = holidayOf.get(selected)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setDragging(tasks?.find((t) => t.id === Number(active.id)) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="month">
        <section className="calendar">
          <header className="month-head">
            <button className="icon nav" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
              ◀
            </button>
            <h2 className="display">
              {y}.{m}
            </h2>
            <button className="icon nav" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달">
              ▶
            </button>
            {month !== today.slice(0, 7) && (
              <button className="link" onClick={() => select(today)}>
                이번 달
              </button>
            )}
          </header>
          <div className="grid" style={{ '--cols': cols } as CSSProperties}>
            {HEAD.slice(0, cols).map((h, i) => (
              <div key={h} className="head" data-off={i >= 5 || undefined}>
                {h}
              </div>
            ))}
            {weekStarts.map((ws, w) => {
              const week = weeks?.find((x) => x.weekStart === ws)
              const days = cells.slice(w * 7, w * 7 + 7)
              // 주말을 숨기면 금요일 칸에 주말 할 일 수를 알려 할 일이 보이지 않게 묻히지 않도록 한다
              const weekendCount = showWeekends ? 0 : days.slice(5).reduce((n, d) => n + (summaryOf.get(d)?.total ?? 0), 0)
              return (
              <div key={ws} className="week-row" data-cols={cols} data-strip={hasStrip(week) || undefined}>
                {days.slice(0, cols).map((d, i) => (
                  <DayCell
                    key={d}
                    date={d}
                    inMonth={d.slice(0, 7) === month}
                    today={today}
                    selected={d === selected}
                    summary={summaryOf.get(d)}
                    holiday={holidayOf.get(d)}
                    weekendCount={i === 4 ? weekendCount : 0}
                    onSelect={select}
                  />
                ))}
                {/* 칸 위에 겹쳐 그리는 막대. 클릭·드롭은 아래 칸이 받는다(pointer-events: none). */}
                <WeekStrip week={week} />
              </div>
              )
            })}
          </div>
          <p className="hint">할 일을 달력의 날짜 칸으로 끌어 놓으면 그날로 옮겨집니다. 지난 날짜로는 옮길 수 없습니다.</p>
        </section>

        <section className="day-panel">
          <header className="panel-head">
            <span className="display date">{sel.md}</span>
            <span className="weekday">{sel.weekday}요일</span>
            {selHoliday && <span className="tag">{selHoliday.name}</span>}
          </header>
          <QuickAdd date={selected} today={today} />
          {tasks && <TaskList tasks={tasks} setTasks={setTasks} bare />}
        </section>
      </div>

      <DragOverlay dropAnimation={null}>{dragging && <div className="drag-ghost">{dragging.title}</div>}</DragOverlay>
    </DndContext>
  )
}

interface CellProps {
  date: Ymd
  inMonth: boolean
  today: Ymd
  selected: boolean
  summary: DaySummary | undefined
  holiday: Holiday | undefined
  /** 주말을 숨겼을 때 금요일 칸에 보여 줄 그 주 주말 할 일 수 */
  weekendCount: number
  onSelect: (d: Ymd) => void
}

function DayCell({ date, inMonth, today, selected, summary, holiday, weekendCount, onSelect }: CellProps) {
  const droppable = date >= today
  const { setNodeRef, isOver } = useDroppable({ id: DAY + date, disabled: !droppable })
  const dow = dayOfWeek(date)
  return (
    <button
      ref={setNodeRef}
      className="cell"
      data-date={date}
      title={`${date} (${WEEKDAY_KO[dow]})${holiday ? ` ${holiday.name}` : ''}`}
      data-out={!inMonth || undefined}
      data-past={date < today || undefined}
      data-today={date === today || undefined}
      data-selected={selected || undefined}
      data-off={dow === 0 || dow === 6 || holiday ? true : undefined}
      data-over={(isOver && droppable) || undefined}
      onClick={() => onSelect(date)}
    >
      <span className="day-num display">{Number(date.slice(8))}</span>
      {holiday && <span className="hname">{holiday.name}</span>}
      {(summary || weekendCount > 0) && (
        <span className="cell-foot">
          {summary && <Dots summary={summary} />}
          {weekendCount > 0 && (
            <span className="weekend-note" title="주말 할 일. 설정에서 주말 표시를 켜면 볼 수 있습니다">
              주말 {weekendCount}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

const hasStrip = (week: Week | undefined) => !!week && (week.theme !== '' || week.goals.length > 0)

/**
 * 주 행 안에서 월~금 평일 칸에만 걸쳐 그리는 막대: 그 주의 테마와 목표(연결된 할 일 완료).
 * 여러 날에 걸친 일정처럼 막대가 덮는 칸이 곧 적용 기간이다. 아무것도 없으면 그리지 않는다.
 */
function WeekStrip({ week }: { week: Week | undefined }) {
  if (!week || !hasStrip(week)) return null
  return (
    <div className="week-strip">
      {week.theme && <span className="strip-theme">{week.theme}</span>}
      {week.goals.map((g, i) => (
        <span key={g.id} className="strip-goal" title={`연결된 할 일 ${g.tasks.filter((t) => t.done).length}/${g.tasks.length} 완료`}>
          <GoalMark no={i + 1} /> {g.title}{' '}
          <span className="num">
            {g.tasks.filter((t) => t.done).length}/{g.tasks.length}
          </span>
        </span>
      ))}
    </div>
  )
}

/** 완료는 채운 점, 미완료는 빈 점. 많으면 숫자로 */
function Dots({ summary: { total, done } }: { summary: DaySummary }) {
  if (total > 6)
    return (
      <span className="dots num" title={`완료 ${done} / 전체 ${total}`}>
        {done}/{total}
      </span>
    )
  return (
    <span className="dots" title={`완료 ${done} / 전체 ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} data-done={i < done || undefined} />
      ))}
    </span>
  )
}
