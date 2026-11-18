import { useEffect, useRef, useState } from 'react'
import { formatDay } from '../hooks'
import { CloseIcon } from './Icons'

interface Props {
  /** 지금 보고 있는 목록의 날짜. 날짜를 따로 고르지 않으면 여기에 넣는다. */
  date: string
  today: string
}

/**
 * Enter로 추가. 창 어디서든 Ctrl+N으로 이 칸에 포커스한다.
 * 오른쪽 날짜 버튼으로 다른 날짜를 고르면 ✕로 지울 때까지 그 날짜에 넣는다.
 */
export function QuickAdd({ date, today }: Props) {
  const [value, setValue] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const target = picked ?? date

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

  // 보던 날짜가 바뀌어 고른 날짜와 같아지면 따로 표시할 필요가 없다
  useEffect(() => {
    if (picked === date) setPicked(null)
  }, [date, picked])

  const add = () => {
    if (!value.trim()) return
    void window.api.addTask(target, value)
    setValue('')
    if (target !== date) {
      const { md, weekday } = formatDay(target)
      setFlash(`${md}(${weekday})에 추가했습니다`)
    }
  }

  const label = (() => {
    if (target === today) return '오늘'
    const { md, weekday } = formatDay(target)
    return `${md} ${weekday}`
  })()

  return (
    <div className="quick-add">
      <input
        ref={inputRef}
        className="quick-add-input"
        placeholder="할 일 추가  (Ctrl+N)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
          else if (e.key === 'Escape') {
            setValue('')
            inputRef.current?.blur()
          }
        }}
      />
      {flash && <span className="quick-add-flash">{flash}</span>}
      <span className="date-chip" data-picked={picked ? true : undefined}>
        <button title="날짜 고르기" onClick={() => pickerRef.current?.showPicker()}>
          {label}
        </button>
        {picked && (
          <button className="clear" title="날짜 선택 해제" onClick={() => setPicked(null)}>
            <CloseIcon />
          </button>
        )}
        <input
          ref={pickerRef}
          type="date"
          className="hidden-picker"
          tabIndex={-1}
          min={today}
          value={target}
          onChange={(e) => {
            const v = e.target.value
            if (!v) return
            setPicked(v === date ? null : v)
            inputRef.current?.focus()
          }}
        />
      </span>
    </div>
  )
}
