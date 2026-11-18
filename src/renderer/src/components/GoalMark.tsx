/** 목표 번호 표식. 주간 화면의 01, 02와 같은 번호를 어디서나 같은 모양(◆ 01)으로 보여 준다. */
export const goalNoText = (no: number | null) => (no === null ? '' : String(no).padStart(2, '0'))

/**
 * ◆ 글자 대신 쓰는 마름모. 글꼴의 ◆는 글자 중심보다 약 0.07em 아래에 그려져 처져 보였다.
 * 크기(잉크 0.93em)와 폭(1em, 뒤 간격 유지)은 원래 글자와 같고, 위치는 CSS(.goal-diamond)가 글자 중심에 맞춘다.
 */
const Diamond = () => (
  <svg className="goal-diamond" viewBox="0 0 22 22" aria-hidden="true">
    <path d="M11 0.8 21.2 11 11 21.2 0.8 11Z" fill="currentColor" />
  </svg>
)

export function GoalMark({ no, title }: { no: number | null; title?: string | null }) {
  return (
    <span className="goal-mark" title={title ? `목표 ${goalNoText(no)} · ${title}` : undefined}>
      <Diamond />
      {no !== null && <>&nbsp;{goalNoText(no)}</>}
    </span>
  )
}
