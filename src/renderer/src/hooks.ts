import { useEffect, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react'
import type { Holiday, Prefs, Task, Week } from '../../shared/types'
import { dayOfWeek, WEEKDAY_KO } from '../../core/dates'

/** load 결과를 상태로 들고, 메인 프로세스가 변경을 알릴 때마다 다시 불러온다. */
export function useLive<T>(load: () => Promise<T>, deps: DependencyList): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let alive = true
    const run = () => void load().then((v) => alive && setValue(v))
    run()
    const off = window.api.onChanged(run)
    return () => {
      alive = false
      off()
    }
  }, deps)
  return [value, setValue]
}

export const useToday = () => useLive(() => window.api.getToday(), [])[0]
export const useTasks = (date: string | undefined) =>
  useLive<Task[]>(() => (date ? window.api.listTasks(date) : Promise.resolve([])), [date])
export const usePrefs = () => useLive<Prefs>(() => window.api.getPrefs(), [])[0]
export const useHolidays = () => useLive<Holiday[]>(() => window.api.listHolidays(), [])[0] ?? []
export const useWeek = (weekStart: string | undefined) =>
  useLive<Week | undefined>(() => (weekStart ? window.api.getWeek(weekStart) : Promise.resolve(undefined)), [weekStart])[0]
export const useNotice =() => useLive(() => window.api.getNotice(), [])[0] ?? null

export function formatDay(date: string) {
  const [, m, d] = date.split('-')
  return { md: `${m}.${d}`, weekday: WEEKDAY_KO[dayOfWeek(date)] }
}
