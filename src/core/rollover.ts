import { addDays, isWeekend, type Ymd } from './dates'

/** from을 포함해 가장 가까운 평일. 토·일요일과 holidays에 든 날은 건너뛴다. */
export function nextBusinessDay(from: Ymd, holidays: ReadonlySet<Ymd>): Ymd {
  let d = from
  for (let i = 0; i < 366; i++) {
    if (!isWeekend(d) && !holidays.has(d)) return d
    d = addDays(d, 1)
  }
  throw new Error(`평일을 찾지 못했습니다: ${from} 이후 1년`)
}

export interface MovingTask {
  id: number
  date: Ymd
  sortOrder: number
}

export interface TaskMove {
  id: number
  date: Ymd
  sortOrder: number
}

/**
 * moving을 target 날짜 목록의 맨 위에 원래 순서(날짜 → 순서)대로 쌓는다.
 * targetMinOrder는 target 날짜에 이미 있는 미완료 할 일 중 가장 작은 sort_order(없으면 null).
 */
export function stackOnTop(moving: readonly MovingTask[], targetMinOrder: number | null, target: Ymd): TaskMove[] {
  const sorted = [...moving].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sortOrder - b.sortOrder))
  const n = sorted.length
  const base = targetMinOrder ?? n
  return sorted.map((t, i) => ({ id: t.id, date: target, sortOrder: base - n + i }))
}
