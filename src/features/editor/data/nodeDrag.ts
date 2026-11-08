import type { NodeId, PaperDocument } from '@/shared/types/paper'
import { canAddParent } from './document'
import type { Point } from './layout'

/** 位移超过该值（画布坐标）才算拖动，避免手抖误改结构 */
export const DRAG_THRESHOLD = 4

/** 画布呈现的拖动状态：谁在被拖动、可挂载的目标、是否落在空白处、预览位置 */
export interface NodeDragView {
  readonly draggingNodeId: NodeId | null
  readonly dropTargetId: NodeId | null
  readonly overBlank: boolean
  readonly previewPositions: ReadonlyMap<NodeId, Point> | null
}

/** 一次拖动过程的不变量：起点、缩放、被拖动子树与拖动前的布局 */
export interface DragSession {
  readonly nodeId: NodeId
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  readonly zoom: number
  readonly isRoot: boolean
  readonly baseAnchor: Point
  readonly basePositions: ReadonlyMap<NodeId, Point>
  readonly subtreeIds: ReadonlySet<NodeId>
}

/** 指针下方的命中结果：命中的卡片，以及其中允许改挂的目标 */
export interface DropProbe {
  readonly hitId: NodeId | null
  readonly targetId: NodeId | null
}

export const IDLE_DRAG_VIEW: NodeDragView = {
  draggingNodeId: null,
  dropTargetId: null,
  overBlank: false,
  previewPositions: null,
}

/** 指针的屏幕位移换算成画布坐标位移 */
export function deltaOf(session: DragSession, clientX: number, clientY: number): Point {
  return {
    x: (clientX - session.startX) / session.zoom,
    y: (clientY - session.startY) / session.zoom,
  }
}

/** 位移是否已超过拖动阈值 */
export function movedBeyond(delta: Point): boolean {
  return Math.abs(delta.x) > DRAG_THRESHOLD || Math.abs(delta.y) > DRAG_THRESHOLD
}

/** 预览位置：布局副本中把被拖动的整棵子树平移，其余节点保持不动 */
export function previewOf(session: DragSession, delta: Point): ReadonlyMap<NodeId, Point> {
  const preview = new Map(session.basePositions)
  for (const id of session.subtreeIds) {
    const base = session.basePositions.get(id)
    if (base === undefined) continue
    preview.set(id, { x: base.x + delta.x, y: base.y + delta.y })
  }
  return preview
}

/** 拖动结束后的新锚点 */
export function anchorAfter(session: DragSession, delta: Point): Point {
  return { x: session.baseAnchor.x + delta.x, y: session.baseAnchor.y + delta.y }
}

/** 命中的卡片能否作为追加父节点的目标（必须恰为上一层） */
export function probeDrop(
  document: PaperDocument,
  session: DragSession,
  hitId: NodeId | null,
): DropProbe {
  const allowed = hitId !== null && canAddParent(document, session.nodeId, hitId)
  return { hitId, targetId: allowed ? hitId : null }
}
