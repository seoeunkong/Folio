import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { addDays, dayOfWeek, weekStartOf, type Ymd } from '../../core/dates'
import type { Goal, Task, Week } from '../../shared/types'
import { formatDay, useHolidays, useLive, usePrefs, useToday } from './hooks'
import { restrictToParent } from './components/dndModifiers'
import { CheckIcon, CloseIcon } from './components/Icons'
import { GoalMark, goalNoText } from './components/GoalMark'

const enter = (e: KeyboardEvent<HTMLElement>) => e.key === 'Enter' && !e.nativeEvent.isComposing

/** 이번 주 테마·진행 현황, 번호 붙은 목표와 연결된 할 일, 날짜별 열. initialWeek가 있으면 그 주(월요일)부터 연다. */
export function WeekView({ initialWeek }: { initialWeek?: Ymd }) {
  const today = useToday()
  const prefs = usePrefs()
  const holidays = useHolidays()
  const [ws, setWs] = useState<Ymd>()
  useEffect(() => {
    if (today && !ws) setWs(initialWeek ?? weekStartOf(today))
  }, [today, ws, initialWeek])
  const [week, setWeek] = useLive<Week | undefined>(() => (ws ? window.api.getWeek(ws) : Promise.resolve(undefined)), [ws])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [tasks] = useLive<Task[]>(() => (ws ? window.api.listTasksRange(ws, addDays(ws, 6)) : Promise.resolve([])), [ws])
  if (!today || !ws || !week || !tasks || !prefs) return null

  const days = Array.from({ length: prefs.showWeekends ? 7 : 5 }, (_, i) => addDays(ws, i))
  const weekendTasks = prefs.showWeekends ? [] : tasks.filter((t) => t.date > addDays(ws, 4))
  const holidayOf = new Map(holidays.map((h) => [h.date, h]))
  const isThisWeek = ws === weekStartOf(today)
  const doneCount = tasks.filter((t) => t.done).length

  /** 목표를 끌어 우선순위를 바꾼다. 화면은 먼저 바꾸고(깜박임 방지) 메인에는 이웃 id만 보낸다. */
  const onGoalDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = week.goals.findIndex((g) => g.id === active.id)
    const to = week.goals.findIndex((g) => g.id === over.id)
    const next = arrayMove(week.goals, from, to)
    setWeek({ ...week, goals: next })
    void window.api.moveGoal(Number(active.id), next[to - 1]?.id ?? null, next[to + 1]?.id ?? null)
  }

  return (
    <div className="week">
      <header className="week-head">
        <button className="icon nav" onClick={() => setWs(addDays(ws, -7))} aria-label="지난 주">
          ◀
        </button>
        <h2 className="display">
          {formatDay(ws).md} – {formatDay(addDays(ws, 6)).md}
        </h2>
        <button className="icon nav" onClick={() => setWs(addDays(ws, 7))} aria-label="다음 주">
          ▶
        </button>
        <span className="spacer" />
        <span className="week-summary">
          할 일 <b className="num">{doneCount}</b>
          <span className="num">/{tasks.length}</span> 완료 · 목표 <span className="num">{week.goals.length}</span>개
        </span>
        {/* 주 이동(◀ ▶)과 떨어뜨려 둔다. 이번 주를 보고 있으면 숨긴다. */}
        {!isThisWeek && (
          <button className="text-btn" onClick={() => setWs(weekStartOf(today))}>
            이번 주로
          </button>
        )}
      </header>

      <ThemeLine key={ws} week={week} />

      <section className="goals">
        <h3 className="section-label">목표</h3>
        {week.goals.length === 0 && <p className="hint">이번 주에 이루고 싶은 것을 2~3개 정해 보세요.</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParent]} onDragEnd={onGoalDragEnd}>
          <SortableContext items={week.goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ol className="goal-list">
              {week.goals.map((g, i) => (
                <GoalRow key={g.id} no={i + 1} goal={g} weekTasks={tasks} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        <AddGoal weekStart={ws} />
      </section>

      <section className="days" style={{ '--cols': days.length } as CSSProperties}>
        {days.map((d, i) => (
          <DayColumn
            key={d}
            date={d}
            today={today}
            holidayName={holidayOf.get(d)?.name}
            tasks={tasks.filter((t) => t.date === d)}
            weekendCount={i === 4 ? weekendTasks.length : 0}
          />
        ))}
      </section>
    </div>
  )
}

/** 테마는 한 줄로 보여 주고, 누르면 그 자리에서 고친다. */
function ThemeLine({ week }: { week: Week }) {
  const [editing, setEditing] = useState(false)
  const [theme, setTheme] = useState(week.theme)
  useEffect(() => setTheme(week.theme), [week.theme])
  const save = () => {
    setEditing(false)
    if (theme.trim() !== week.theme) void window.api.setWeekTheme(week.weekStart, theme)
  }
  if (editing)
    return (
      <input
        className="theme-edit"
        autoFocus
        placeholder="이번 주 테마 (예: 마감 집중 주간)"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (enter(e)) e.currentTarget.blur()
          else if (e.key === 'Escape') {
            setTheme(week.theme)
            setEditing(false)
          }
        }}
      />
    )
  return week.theme ? (
    <p className="theme-line-week">
      <span className="theme-text">{week.theme}</span>
      <button className="link reveal" onClick={() => setEditing(true)}>
        편집
      </button>
    </p>
  ) : (
    <p className="theme-line-week" data-empty>
      <button className="link" onClick={() => setEditing(true)}>
        + 이번 주 테마
      </button>
    </p>
  )
}

function GoalRow({ no, goal, weekTasks }: { no: number; goal: Goal & { tasks: Task[] }; weekTasks: Task[] }) {
  const [title, setTitle] = useState(goal.title)
  useEffect(() => setTitle(goal.title), [goal.title])

  const done = goal.tasks.filter((t) => t.done).length
  const linkable = weekTasks.filter((t) => t.goalId !== goal.id && !t.done)
  // 번호(01)를 손잡이로 끌어 순서를 바꾼다. 제목 입력·선택 상자에서는 드래그가 시작되지 않는다.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id })

  return (
    <li
      ref={setNodeRef}
      className="goal-row"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-dragging={isDragging || undefined}
    >
      <span ref={setActivatorNodeRef} className="goal-no display" title="끌어서 순서 바꾸기" {...attributes} {...listeners}>
        {goalNoText(no)}
      </span>
      <div className="goal-body">
        <div className="goal-top">
          {/* 긴 목표도 자르지 않고 줄바꿈해 모두 보여 준다(내용만큼 높이가 늘어나는 textarea). 줄바꿈 문자는 넣지 않는다. */}
          <textarea
            className="goal-title"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!e.nativeEvent.isComposing) e.currentTarget.blur()
              }
            }}
            onBlur={() => {
              if (!title.trim()) setTitle(goal.title)
              else if (title.trim() !== goal.title) void window.api.updateGoal(goal.id, { title })
            }}
          />
          <span className="progress">
            연결된 할 일{' '}
            <span className="num">
              {done}/{goal.tasks.length}
            </span>{' '}
            완료
          </span>
          <button
            className="link reveal"
            onClick={() => confirm(`"${goal.title}" 목표를 지울까요? 연결된 할 일은 남습니다.`) && void window.api.deleteGoal(goal.id)}
          >
            삭제
          </button>
        </div>
        <ul>
          {goal.tasks.map((t) => (
            <MiniTask key={t.id} task={t} showDate onUnlink={() => void window.api.setTaskGoal(t.id, null)} />
          ))}
        </ul>
        {linkable.length > 0 && (
          <select
            className="link-task"
            value=""
            onChange={(e) => e.target.value && void window.api.setTaskGoal(Number(e.target.value), goal.id)}
          >
            <option value="">+ 이번 주 할 일 연결</option>
            {linkable.map((t) => (
              <option key={t.id} value={t.id}>
                {formatDay(t.date).weekday} · {t.title}
                {t.goalTitle ? ` (현재 ${goalNoText(t.goalNo)})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>
    </li>
  )
}

function AddGoal({ weekStart }: { weekStart: Ymd }) {
  const [title, setTitle] = useState('')
  const add = () => {
    if (!title.trim()) return
    void window.api.addGoal(weekStart, title)
    setTitle('')
  }
  return (
    <div className="add-goal">
      <input className="line-input" placeholder="새 목표" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => enter(e) && add()} />
      <button className="primary" onClick={add} disabled={!title.trim()}>
        추가
      </button>
    </div>
  )
}

/** 날짜 열. 머리줄에 마우스를 올리면 +가 보이고, 누르면 그 날짜에 바로 추가한다. */
function DayColumn({
  date,
  today,
  holidayName,
  tasks,
  weekendCount,
}: {
  date: Ymd
  today: Ymd
  holidayName: string | undefined
  tasks: Task[]
  weekendCount: number
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { md, weekday } = formatDay(date)
  const add = () => {
    if (title.trim()) void window.api.addTask(date, title)
    setTitle('')
    inputRef.current?.focus()
  }
  return (
    <div
      className="day-col"
      data-today={date === today || undefined}
      data-holiday={holidayName ? true : undefined}
      data-sun={(dayOfWeek(date) === 0 && !holidayName) || undefined}
    >
      <header>
        <span className="weekday">{weekday}</span> <span className="num">{md}</span>
        <button className="icon add-day" title={`${md}에 할 일 추가`} onClick={() => setAdding(true)}>
          +
        </button>
        {holidayName && <span className="hname">{holidayName}</span>}
      </header>
      <ul>
        {tasks.map((t) => (
          <MiniTask key={t.id} task={t} />
        ))}
      </ul>
      {adding && (
        <input
          ref={inputRef}
          className="day-add"
          autoFocus
          placeholder="할 일"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim()) void window.api.addTask(date, title)
            setTitle('')
            setAdding(false)
          }}
          onKeyDown={(e) => {
            if (enter(e)) add()
            else if (e.key === 'Escape') {
              setTitle('')
              setAdding(false)
            }
          }}
        />
      )}
      {weekendCount > 0 && <p className="weekend-note">주말 할 일 {weekendCount}개 (설정에서 주말 표시)</p>}
    </div>
  )
}

function MiniTask({ task, showDate = false, onUnlink }: { task: Task; showDate?: boolean; onUnlink?: () => void }) {
  return (
    <li className="mini-task" data-done={task.done || undefined}>
      <button className="check" aria-label={task.done ? '완료 취소' : '완료'} onClick={() => void window.api.setDone(task.id, !task.done)}>
        {task.done && <CheckIcon />}
      </button>
      <span className="title">
        {task.title}
        {!showDate && task.goalId !== null && (
          <>
            {' '}
            <GoalMark no={task.goalNo} title={task.goalTitle} />
          </>
        )}
      </span>
      {showDate && <span className="num date">{formatDay(task.date).md}</span>}
      {onUnlink && (
        <button className="icon unlink" title="목표 연결 해제" onClick={onUnlink}>
          <CloseIcon />
        </button>
      )}
    </li>
  )
}
