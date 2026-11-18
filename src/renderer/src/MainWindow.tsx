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
  // 월간 화면의 주간 목표 묶음에서 '주간 화면에서 보기'를 누르면 그 주를 연다. 옆 메뉴로 열면 이번 주.
  const [weekTarget, setWeekTarget] = useState<string>()
  const openTab = (t: Tab) => {
    setWeekTarget(undefined)
    setTab(t)
  }
  return (
    <div className="main">
      <nav className="side">
        <h1 className="brand">Folio</h1>
        <button data-active={tab === 'today' || undefined} onClick={() => openTab('today')}>
          오늘
        </button>
        <button data-active={tab === 'week' || undefined} onClick={() => openTab('week')}>
          주간
        </button>
        <button data-active={tab === 'month' || undefined} onClick={() => openTab('month')}>
          월간
        </button>
        <button data-active={tab === 'settings' || undefined} onClick={() => openTab('settings')}>
          설정
        </button>
      </nav>
      <main className="content">
        {tab === 'today' && <DayView />}
        {tab === 'week' && <WeekView key={weekTarget} initialWeek={weekTarget} />}
        {tab === 'month' && (
          <MonthView
            onOpenWeek={(ws) => {
              setWeekTarget(ws)
              setTab('week')
            }}
          />
        )}
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
        {holiday && <span className="tag">{holiday.name}</span>}
        <span className="spacer" />
        {/* 날짜 이동(◀ ▶)과 떨어뜨려 둔다. 오늘을 보고 있으면 숨긴다. */}
        {date !== today && (
          <button className="text-btn" onClick={() => setDate(today)}>
            오늘로
          </button>
        )}
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
