import { useState } from 'react'
import { dayOfWeek, WEEKDAY_KO } from '../../core/dates'
import type { ThemeSource } from '../../shared/types'
import { useHolidays, usePrefs, useToday } from './hooks'

const THEMES: [ThemeSource, string][] = [
  ['system', '시스템'],
  ['light', '라이트'],
  ['dark', '다크'],
]

export function Settings() {
  const prefs = usePrefs()
  if (!prefs) return null
  return (
    <div className="settings">
      <section>
        <h2 className="section-label">화면</h2>
        <div className="field">
          <span>테마</span>
          <div className="segmented">
            {THEMES.map(([value, label]) => (
              <button key={value} data-active={prefs.theme === value || undefined} onClick={() => void window.api.setPrefs({ theme: value })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <input
            type="checkbox"
            checked={prefs.showWeekends}
            onChange={(e) => void window.api.setPrefs({ showWeekends: e.target.checked })}
          />
          <span>캘린더에 주말 표시</span>
        </label>
        <p className="hint">끄면 월간·주간 화면에 월~금만 보이고, 주말 할 일은 금요일 칸에 개수로 알려 줍니다.</p>
      </section>
      <section>
        <h2 className="section-label">위젯</h2>
        <label className="field">
          <span>투명도</span>
          <input
            type="range"
            min={30}
            max={100}
            value={Math.round(prefs.widgetOpacity * 100)}
            onChange={(e) => void window.api.setPrefs({ widgetOpacity: Number(e.target.value) / 100 })}
          />
          <span className="num">{Math.round(prefs.widgetOpacity * 100)}%</span>
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={prefs.widgetPinned}
            onChange={(e) => void window.api.setPrefs({ widgetPinned: e.target.checked })}
          />
          <span>항상 위에 표시</span>
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={prefs.openAtLogin}
            onChange={(e) => void window.api.setPrefs({ openAtLogin: e.target.checked })}
          />
          <span>Windows 시작 시 실행</span>
        </label>
        <p className="hint">전역 단축키 Ctrl+Alt+Space로 위젯을 보이거나 숨깁니다.</p>
      </section>
      <HolidayManager />
    </div>
  )
}

function HolidayManager() {
  const today = useToday()
  const holidays = useHolidays()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const add = async () => {
    if (!date || !name.trim() || !today) return
    const undone = await window.api.addHoliday(date, name)
    setDate('')
    setName('')
    setMessage(null)
    if (undone > 0 && confirm(`${date}에 미완료 할 일 ${undone}개가 있습니다. 다음 평일로 옮길까요?`)) {
      const r = await window.api.moveTasksOffHoliday(date)
      setMessage(`${r.moved}개를 ${r.target}(${WEEKDAY_KO[dayOfWeek(r.target)]})로 옮겼습니다.`)
    }
  }

  const years = [...new Set(holidays.map((h) => h.date.slice(0, 4)))]
  const thisYear = today?.slice(0, 4)
  const [openYear, setOpenYear] = useState<string | undefined>(undefined)
  const shownYear = openYear ?? thisYear

  return (
    <section>
      <h2 className="section-label">휴일 관리</h2>
      <p className="hint">
        토·일요일과 여기 있는 날은 평일에서 빠지고, 미완료 할 일은 다음 평일로 이월됩니다. 전사 휴일과 임시공휴일을 추가하세요.
      </p>
      <div className="holiday-form">
        <input className="line-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="line-input"
          placeholder="이름 (예: 창립기념일)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void add()}
        />
        <button className="primary" onClick={() => void add()} disabled={!date || !name.trim()}>
          추가
        </button>
      </div>
      {message && <p className="notice">{message}</p>}

      <div className="years">
        {years.map((y) => (
          <button key={y} data-active={y === shownYear || undefined} onClick={() => setOpenYear(y)}>
            {y}
          </button>
        ))}
      </div>
      <table className="holidays">
        <tbody>
          {holidays
            .filter((h) => h.date.startsWith(shownYear ?? ''))
            .map((h) => (
              <tr key={h.date} data-past={(today && h.date < today) || undefined}>
                <td className="num">{h.date.slice(5).replace('-', '.')}</td>
                <td>{WEEKDAY_KO[dayOfWeek(h.date)]}</td>
                <td>{h.name}</td>
                <td>
                  {h.kind === 'public' ? '공휴일' : '전사'}
                </td>
                <td>
                  <button className="link" onClick={() => void window.api.removeHoliday(h.date)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  )
}
