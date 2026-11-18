import { describe, expect, it } from 'vitest'
import { openDb } from '../src/main/db'
import { TaskService } from '../src/main/taskService'

function setup() {
  let clock = new Date('2026-11-18T09:00:00')
  const svc = new TaskService(openDb(':memory:'), () => clock)
  const tick = () => (clock = new Date(clock.getTime() + 60_000))
  const titles = (date: string) => svc.listTasks(date).map((t) => t.title)
  return { svc, tick, titles }
}

describe('자동 이월', () => {
  it('여러 날 밀린 미완료를 다음 평일 맨 위로 원래 순서대로 한 번만 옮긴다', () => {
    const { svc, titles } = setup()
    // 목·금에 남은 일, 금요일 완료한 일, 월요일에 미리 넣어 둔 일
    svc.addTask('2026-11-19', '목1')
    svc.addTask('2026-11-19', '목2')
    svc.addTask('2026-11-20', '금1')
    svc.setDone(svc.addTask('2026-11-20', '금-완료').id, true)
    svc.addTask('2026-11-23', '월-기존')

    // 일요일에 PC를 켬
    expect(svc.runRollover('2026-11-22')).toBe(3)
    expect(titles('2026-11-23')).toEqual(['목1', '목2', '금1', '월-기존'])
    expect(titles('2026-11-20')).toEqual(['금-완료'])
    const moved = svc.listTasks('2026-11-23').filter((t) => t.title !== '월-기존')
    expect(moved.map((t) => [t.carryCount, t.firstDate])).toEqual([
      [1, '2026-11-19'],
      [1, '2026-11-19'],
      [1, '2026-11-20'],
    ])

    // 같은 날 다시 실행해도 그대로
    expect(svc.runRollover('2026-11-22')).toBe(0)
    expect(svc.listTasks('2026-11-23').map((t) => t.carryCount)).toEqual([1, 1, 1, 0])
  })
})

describe('주간 목표 연결', () => {
  it('다음 주로 이월돼도 목표 연결이 남고, 목표를 지우면 할 일은 남고 연결만 풀린다', () => {
    const { svc } = setup()
    const goal = svc.addGoal('2026-11-16', '보고서 마무리')
    const t = svc.addTask('2026-11-20', '보고서 초안')
    svc.setTaskGoal(t.id, goal.id)

    svc.runRollover('2026-11-21') // 금요일 미완료 → 다음 주 월요일
    expect(svc.getTask(t.id)).toMatchObject({ date: '2026-11-23', goalTitle: '보고서 마무리' })
    expect(svc.getWeek('2026-11-16').goals[0].tasks.map((x) => x.id)).toEqual([t.id])

    svc.deleteGoal(goal.id)
    expect(svc.getTask(t.id)).toMatchObject({ goalId: null, goalTitle: null })
    expect(svc.getWeek('2026-11-16').goals).toEqual([])
  })
})

describe('다른 날짜로 옮기기', () => {
  it('그날 미완료 맨 아래로 가고 이월 횟수는 그대로이며, 지난 날짜로는 옮기지 않는다', () => {
    const { svc, titles } = setup()
    const a = svc.addTask('2026-11-18', 'A')
    svc.addTask('2026-11-20', '금1')
    svc.setDone(svc.addTask('2026-11-20', '금-완료').id, true)

    svc.moveTaskToDate(a.id, '2026-11-20', '2026-11-18')
    expect(titles('2026-11-20')).toEqual(['금1', 'A', '금-완료'])
    expect(svc.getTask(a.id)!.carryCount).toBe(0)
    expect(svc.daySummaries('2026-11-18', '2026-11-20')).toEqual([{ date: '2026-11-20', total: 3, done: 1 }])

    expect(() => svc.moveTaskToDate(a.id, '2026-11-17', '2026-11-18')).toThrow()
  })
})

describe('완료와 정렬', () => {
  it('완료는 완료 시각 순으로 아래, 체크를 풀면 미완료 맨 아래로 돌아간다', () => {
    const { svc, tick, titles } = setup()
    const [a, b] = ['A', 'B', 'C'].map((t) => svc.addTask('2026-11-18', t))
    svc.setDone(b.id, true)
    tick()
    svc.setDone(a.id, true)
    expect(titles('2026-11-18')).toEqual(['C', 'B', 'A'])

    svc.setDone(a.id, false)
    expect(titles('2026-11-18')).toEqual(['C', 'A', 'B'])
  })

  it('같은 자리에 계속 끼워 넣어 간격이 좁아져도 순서가 유지된다', () => {
    const { svc, titles } = setup()
    const first = svc.addTask('2026-11-18', 'first')
    const last = svc.addTask('2026-11-18', 'last')
    let after = first.id
    const expected = ['first']
    for (let i = 0; i < 60; i++) {
      const t = svc.addTask('2026-11-18', `n${i}`)
      svc.moveTask(t.id, after, last.id)
      after = t.id
      expected.push(`n${i}`)
    }
    expect(titles('2026-11-18')).toEqual([...expected, 'last'])
  })
})
