import type { PaperReference } from '@/shared/types/paper'

export interface ReferencePreview {
  readonly reference: PaperReference
  readonly x: number
  readonly y: number
}

const POPUP_WIDTH = 360
const POPUP_ESTIMATED_HEIGHT = 320
const EDGE_GAP = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 弹窗贴在链接下方，放不下时翻到上方；横向夹在视口内 */
export function placeReferencePreview(rect: DOMRect): { readonly x: number; readonly y: number } {
  const x = clamp(rect.left, EDGE_GAP, Math.max(EDGE_GAP, window.innerWidth - POPUP_WIDTH - EDGE_GAP))
  const below = rect.bottom + EDGE_GAP
  const y =
    below + POPUP_ESTIMATED_HEIGHT <= window.innerHeight - EDGE_GAP
      ? below
      : Math.max(EDGE_GAP, rect.top - POPUP_ESTIMATED_HEIGHT - EDGE_GAP)
  return { x, y }
}
