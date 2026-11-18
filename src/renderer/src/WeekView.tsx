import { useEffect, useState, type KeyboardEvent } from 'react'
import { addDays, weekStartOf, type Ymd } from '../../core/dates'
import type { Goal, Task, Week } from '../../shared/types'
import { formatDay, useHolidays, useLive, useToday, useWeek } from './hooks'
import { CheckIcon, CloseIcon } from './components/Icons'

/** 이번 주 테마와 목표, 목표별 연결된 할 일, 월~일 7일 열 */
export function WeekView() {
  const today = useToday()
  const holidays = useHolidays()
  const [ws, setWs] = useState<Ymd>()
  useEffect(() => {
    if (today && !ws) setWs(weekStartOf(today))
  }, [today, ws])
  const week = useWeek(ws)
  const [tasks] = useLive<Task[]>(() => (ws ? window.api.listTasksRange(ws, addDays(ws, 6)) : Promise.resolve([])), [ws])
  if (!today || !ws || !week || !tasks) return null

  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const holidayOf = new Map(holidays.map((h) => [h.date, h]))
  const isThisWeek = ws === weekStartOf(today)

  return (
    <div className="week">
      <header className="week-head">
        <button className="icon nav" onClick={() => setWs(addDays(ws, -7))} aria-label="지난 주">
          ◀
        </button>
        <h2 className="mono">
          {formatDay(ws).md} – {formatDay(days[6]).md}
        </h2>
        <button className="icon nav" onClick={() => setWs(addDays(ws, 7))} aria-label="다음 주">
          ▶
        </button>
        {!isThisWeek && (
          <button className="link" onClick={() => setWs(weekStartOf(today))}>
            이번 주
          </button>
        )}
      </header>

      <ThemeInput key={ws} week={week} />

      <section className="goals">
        <h3 className="mono">목표</h3>
        {week.goals.length === 0 && <p className="hint">이번 주에 이루고 싶은 것을 2~3개 정해 보세요.</p>}
        <div className="goal-grid">
          {week.goals.map((g) => (
            <GoalCard key={g.id} goal={g} weekTasks={tasks} />
          ))}
        </div>
        <AddGoal weekStart={ws} />
      </section>

      <section className="days">
        {days.map((d) => {
          const { md, weekday } = formatDay(d)
          const dayTasks = tasks.filter((t) => t.date === d)
          return (
            <div key={d} className="day-col" data-today={d === today || undefined} data-off={holidayOf.has(d) || undefined}>
              <header>
                <span className="weekday">{weekday}</span> <span className="mono">{md}</span>
                {holidayOf.get(d) && <span className="hname">{holidayOf.get(d)!.name}</span>}
              </header>
              <ul>
                {dayTasks.map((t) => (
                  <MiniTask key={t.id} task={t} />
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function ThemeInput({ week }: { week: Week }) {
  const [theme, setTheme] = useState(week.theme)
  const save = () => theme.trim() !== week.theme && void window.api.setWeekTheme(week.weekStart, theme)
  return (
    <input
      className="theme-input"
      placeholder="이번 주 테마 (예: 마감 집중 주간)"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
    />
  )
}

function GoalCard({ goal, weekTasks }: { goal: Goal & { tasks: Task[] }; weekTasks: Task[] }) {
  const [title, setTitle] = useState(goal.title)
  useEffect(() => setTitle(goal.title), [goal.title])

  const done = goal.tasks.filter((t) => t.done).length
  const linkable = weekTasks.filter((t) => t.goalId !== goal.id && !t.done)
  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) =>
    e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()

  return (
    <article className="goal-card">
      <div className="goal-top">
        <input
          className="goal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={blurOnEnter}
          onBlur={() => {
            if (!title.trim()) setTitle(goal.title)
            else if (title.trim() !== goal.title) void window.api.updateGoal(goal.id, { title })
          }}
        />
        <span className="mono progress" title="연결된 할 일 완료/전체">
          {done}/{goal.tasks.length}
        </span>
        <button
          className="icon"
          title="목표 삭제 (할 일은 남습니다)"
          onClick={() => confirm(`"${goal.title}" 목표를 지울까요? 연결된 할 일은 남습니다.`) && void window.api.deleteGoal(goal.id)}
        >
          <CloseIcon />
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
              {t.goalTitle ? ` (현재: ${t.goalTitle})` : ''}
            </option>
          ))}
        </select>
      )}
    </article>
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
      <input
        placeholder="새 목표"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && add()}
      />
      <button onClick={add} disabled={!title.trim()}>
        추가
      </button>
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
        {!showDate && task.goalTitle && <span className="goal-tag">◆</span>}
      </span>
      {showDate && <span className="mono date">{formatDay(task.date).md}</span>}
      {onUnlink && (
        <button className="icon unlink" title="목표 연결 해제" onClick={onUnlink}>
          <CloseIcon />
        </button>
      )}
    </li>
  )
}
