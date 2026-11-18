import { describe, expect, it } from 'vitest'
import { nextBusinessDay } from '../src/core/rollover'
import { KR_PUBLIC_HOLIDAYS } from '../src/core/holidaysKR'

const publicHolidays = new Set(Object.values(KR_PUBLIC_HOLIDAYS).flat().map(([d]) => d))

// 설계안 "이월되는 날" 표. 이월은 미완료가 생긴 다음 날(= 이월 실행일 today)부터 찾는다.
describe('nextBusinessDay: 설계안 이월 표', () => {
  it.each([
    ['월요일 미완료 → 화요일', '2026-11-17', publicHolidays, '2026-11-17'],
    ['금요일 미완료 → 다음 주 월요일', '2026-11-21', publicHolidays, '2026-11-23'],
    ['금요일 미완료, 다음 월요일 공휴일(3/2 대체공휴일) → 화요일', '2026-02-28', publicHolidays, '2026-03-03'],
    ['목요일 미완료, 금요일 전사 휴일 → 다음 주 월요일', '2026-11-20', new Set([...publicHolidays, '2026-11-20']), '2026-11-23'],
    ['토요일에 열었을 때 → 바로 다음 주 월요일', '2026-11-21', publicHolidays, '2026-11-23'],
  ])('%s', (_, today, holidays, expected) => {
    expect(nextBusinessDay(today, holidays)).toBe(expected)
  })
})
