/**
 * sort_order는 실수다. 두 항목 사이에 넣을 때 중간값을 주어 다른 항목을 다시 번호 매기지 않는다.
 * 같은 자리에 수십 번 넣어 간격이 MIN_GAP보다 좁아지면 호출하는 쪽이 그 날 목록을 다시 번호 매긴다.
 */
export const MIN_GAP = 1e-6

export function orderBetween(prev: number | null, next: number | null): number {
  if (prev !== null && next !== null) return (prev + next) / 2
  if (prev !== null) return prev + 1
  if (next !== null) return next - 1
  return 0
}

export function gapTooSmall(prev: number | null, next: number | null): boolean {
  return prev !== null && next !== null && next - prev < MIN_GAP
}
