import { weekStartOf } from '../../core/dates'
import { formatDay, useHolidays, useNotice, usePrefs, useTasks, useToday, useWeek } from './hooks'
import { TaskList } from './components/TaskList'
import { QuickAdd } from './components/QuickAdd'
import { ChevronIcon, CloseIcon, ExpandIcon, PinIcon } from './components/Icons'

/** 항상 위 위젯: 오늘 날짜, 오늘 할 일, 빠른 입력. 완료 항목은 접힌 상태로 둔다. */
export function Widget() {
  const today = useToday()
  const prefs = usePrefs()
  const notice = useNotice()
  const holidays = useHolidays()
  const [tasks, setTasks] = useTasks(today)
  const week = useWeek(today && weekStartOf(today))
  if (!today || !prefs) return null

  const { md, weekday } = formatDay(today)
  const holiday = holidays.find((h) => h.date === today)
  const left = tasks?.filter((t) => !t.done).length ?? 0

  return (
    <div className="widget">
      <header className="widget-head" onDoubleClick={() => void window.api.setPrefs({ widgetCollapsed: !prefs.widgetCollapsed })}>
        <span className="mono date">{md}</span>
        <span className="weekday">{weekday}</span>
        {holiday && <span className="tag">{holiday.name}</span>}
        {prefs.widgetCollapsed && <span className="muted count">{left}개 남음</span>}
        <span className="spacer" />
        <button
          className="icon"
          title={prefs.widgetPinned ? '항상 위 끄기' : '항상 위 켜기'}
          data-on={prefs.widgetPinned || undefined}
          onClick={() => void window.api.setPrefs({ widgetPinned: !prefs.widgetPinned })}
        >
          <PinIcon on={prefs.widgetPinned} />
        </button>
        <button
          className="icon"
          title={prefs.widgetCollapsed ? '펼치기' : '접기'}
          onClick={() => void window.api.setPrefs({ widgetCollapsed: !prefs.widgetCollapsed })}
        >
          <ChevronIcon open={!prefs.widgetCollapsed} />
        </button>
        <button className="icon" title="메인 창 열기" onClick={() => void window.api.openMain()}>
          <ExpandIcon />
        </button>
        <button className="icon" title="숨기기 (Ctrl+Alt+Space)" onClick={() => void window.api.hideWidget()}>
          <CloseIcon />
        </button>
      </header>

      {!prefs.widgetCollapsed && (
        <>
          {week?.theme && <p className="theme-line" title="이번 주 테마">{week.theme}</p>}
          {notice && <p className="notice">{notice}</p>}
          <div className="widget-body">{tasks && <TaskList tasks={tasks} setTasks={setTasks} />}</div>
          <footer className="widget-foot">
            <QuickAdd date={today} today={today} />
          </footer>
        </>
      )}
    </div>
  )
}
