import { useEffect, useRef, useState } from 'react'
import { addDays } from '../../core/dates'
import { formatDay, useHolidays, useNotice, useTasks, useToday } from './hooks'
import { TaskList } from './components/TaskList'
import { QuickAdd } from './components/QuickAdd'
import { Settings } from './Settings'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'

type Tab = 'today' | 'week' | 'month' | 'settings'

export function MainWindow() {
  const [tab, setTab] = useState<Tab>('today')
  return (
    <div className="main">
      <nav className="side">
        <h1 className="brand">Folio</h1>
        <button data-active={tab === 'today' || undefined} onClick={() => setTab('today')}>
          오늘
        </button>
        <button data-active={tab === 'week' || undefined} onClick={() => setTab('week')}>
          주간
        </button>
        <button data-active={tab === 'month' || undefined} onClick={() => setTab('month')}>
          월간
        </button>
        <button data-active={tab === 'settings' || undefined} onClick={() => setTab('settings')}>
          설정
        </button>
      </nav>
      <main className="content">
        {tab === 'today' && <DayView />}
        {tab === 'week' && <WeekView />}
        {tab === 'month' && <MonthView />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}

/** 하루 목록. 기본은 오늘이고 ◀ ▶로 다른 날짜의 할 일을 미리 넣거나 지난 기록을 본다. */
function DayView() {
  const today = useToday()
  const notice = useNotice()
  const holidays = useHolidays()
  const [date, setDate] = useState<string>()
  // 자정이 지나 today가 바뀌면, 오늘을 보고 있던 경우에만 새 오늘로 따라간다
  const lastToday = useRef<string>(undefined)
  useEffect(() => {
    if (!today) return
    setDate((d) => (d === undefined || d === lastToday.current ? today : d))
    lastToday.current = today
  }, [today])
  const [tasks, setTasks] = useTasks(date)
  const jumpRef = useRef<HTMLInputElement>(null)
  if (!today || !date) return null

  const { md, weekday } = formatDay(date)
  const holiday = holidays.find((h) => h.date === date)

  return (
    <div className="day">
      <header className="day-head">
        <button className="icon nav" onClick={() => setDate(addDays(date, -1))} aria-label="전날">
          ◀
        </button>
        <span className="date-jump">
          <button className="display" title="날짜로 이동" onClick={() => jumpRef.current?.showPicker()}>
            {md}
          </button>
          <input
            ref={jumpRef}
            type="date"
            className="hidden-picker"
            tabIndex={-1}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </span>
        <span className="weekday">{weekday}요일</span>
        <button className="icon nav" onClick={() => setDate(addDays(date, 1))} aria-label="다음 날">
          ▶
        </button>
        {date !== today && (
          <button className="link" onClick={() => setDate(today)}>
            오늘로
          </button>
        )}
        {holiday && <span className="tag">{holiday.name}</span>}
      </header>
      {notice && <p className="notice">{notice}</p>}
      <QuickAdd date={date} today={today} />
      {tasks && <TaskList tasks={tasks} setTasks={setTasks} withNotes doneOpenByDefault />}
      <p className="hint">
        Space 체크 · Alt+↑/↓ 순서 이동 · Enter 제목 수정 · 제목 클릭 시 메모·목표
      </p>
    </div>
  )
}
