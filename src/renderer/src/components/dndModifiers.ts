import type { Modifier } from '@dnd-kit/core'

/** 세로로만 움직이고 목록 영역 밖으로 끌려 나가지 않게 한다(@dnd-kit/modifiers를 따로 들이지 않으려고 직접 작성). */
export const restrictToParent: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 }
  const minY = containerNodeRect.top - draggingNodeRect.top
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom
  return { ...transform, x: 0, y: Math.min(Math.max(transform.y, minY), maxY) }
}
