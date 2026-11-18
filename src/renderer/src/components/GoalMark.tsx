/** 목표 번호 표식. 주간 화면의 01, 02와 같은 번호를 어디서나 같은 모양(◆ 01)으로 보여 준다. */
export const goalNoText = (no: number | null) => (no === null ? '' : String(no).padStart(2, '0'))

export function GoalMark({ no, title }: { no: number | null; title?: string | null }) {
  return (
    <span className="goal-mark" title={title ? `목표 ${goalNoText(no)} · ${title}` : undefined}>
      ◆&nbsp;{goalNoText(no)}
    </span>
  )
}
