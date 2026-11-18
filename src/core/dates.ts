/** 날짜는 모두 로컬 시간 기준 'YYYY-MM-DD' 문자열로 다룬다. 시각은 다루지 않는다. */
export type Ymd = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toYmd(d: Date): Ymd {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseYmd(s: Ymd): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: Ymd, n: number): Ymd {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}

/** 0 = 일요일 … 6 = 토요일 */
export function dayOfWeek(s: Ymd): number {
  return parseYmd(s).getDay()
}

export function isWeekend(s: Ymd): boolean {
  const w = dayOfWeek(s)
  return w === 0 || w === 6
}

/** 그 날이 속한 주의 월요일 */
export function weekStartOf(s: Ymd): Ymd {
  return addDays(s, -((dayOfWeek(s) + 6) % 7))
}

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']
