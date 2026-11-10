import { canAddParent } from '../data/document'
import type { Point } from '../data/layout'
import type { NodeId, PaperDocument } from '@/shared/types/paper'

/** 待命指令：结构移动（Alt 等价）两段式、贴合内容（Ctrl 等价）一段式，或联动事件点选目标 */
export type PendingNodeAction =
  | { readonly kind: 'structure'; readonly sourceId: NodeId | null }
  | { readonly kind: 'fit' }
  | {
      readonly kind: 'pick-event-target'
      readonly sourceNodeId: NodeId
      readonly bindingId: string
    }

export type StructureDecision =
  | { readonly type: 'pick-source'; readonly nodeId: NodeId }
  | { readonly type: 'add-parent'; readonly targetId: NodeId }
  | { readonly type: 'detach'; readonly anchor: Point }
  | { readonly type: 'cancel' }
  | { readonly type: 'none' }

/**
 * 结构移动待命期的点击判定，与 Alt+拖拽落点语义对齐：
 * 未定源时第一次点节点选源；定源后点合法目标加父、点空白按点击位置脱根（根节点即整树搬移）。
 */
export function decideStructureClick(
  document: PaperDocument,
  sourceId: NodeId | null,
  clickedId: NodeId | null,
  point: Point | null,
): StructureDecision {
  if (sourceId === null) {
    return clickedId === null ? { type: 'none' } : { type: 'pick-source', nodeId: clickedId }
  }
  if (clickedId === sourceId) return { type: 'cancel' }
  if (clickedId !== null) {
    if (canAddParent(document, sourceId, clickedId)) {
      return { type: 'add-parent', targetId: clickedId }
    }
    return { type: 'none' }
  }
  if (point !== null) return { type: 'detach', anchor: point }
  return { type: 'none' }
}