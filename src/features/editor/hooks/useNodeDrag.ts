import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

import type { NodeId, PaperDocument } from '@/shared/types/paper'
import { collectSubtreeIds } from '../data/document'
import { rawPositionOf } from '../data/layout'
import type { DocumentLayout, Point } from '../data/layout'
import { anchorAfter, deltaOf, probeDrop } from '../data/nodeDrag'
import type { DragSession, NodeDragView } from '../data/nodeDrag'
import { cardIdAtPoint, measureWorldZoom } from '../lib/dragHitTest'
import { useDragTracking } from './useDragTracking'

export interface NodeDragControls extends NodeDragView {
  readonly startDrag: (nodeId: NodeId, event: ReactPointerEvent<HTMLElement>) => void
  readonly shouldSuppressClick: () => boolean
}

interface NodeDragOptions {
  readonly document: PaperDocument
  readonly layout: DocumentLayout
  readonly stageRef: RefObject<HTMLDivElement | null>
  readonly onMoveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly onAddParent: (nodeId: NodeId, targetId: NodeId) => void
  readonly onDetachAsRoot: (nodeId: NodeId, anchor: Point) => void
}

/** 拖动开始时的快照：缩放、拖动前的布局与被拖动子树 */
function createSession(
  nodeId: NodeId,
  event: ReactPointerEvent<HTMLElement>,
  options: Readonly<NodeDragOptions>,
): DragSession | null {
  const node = options.document.nodes.find((item) => item.id === nodeId)
  if (node === undefined) return null

  return {
    nodeId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    zoom: measureWorldZoom(options.stageRef.current),
    isRoot: node.parentIds.length === 0,
    baseAnchor: rawPositionOf(node, options.layout),
    basePositions: options.layout.positions,
    subtreeIds: collectSubtreeIds(options.document.nodes, nodeId),
  }
}

/** 落点提交：命中上一层目标则追加父节点，落在空白处则脱离为根，根节点自由移动锚点 */
function commitDrag(
  session: DragSession,
  clientX: number,
  clientY: number,
  options: Readonly<NodeDragOptions>,
): void {
  const hitId = cardIdAtPoint(clientX, clientY, session.subtreeIds)
  const probe = probeDrop(options.document, session, hitId)
  if (probe.targetId !== null) {
    options.onAddParent(session.nodeId, probe.targetId)
    return
  }

  const anchor = anchorAfter(session, deltaOf(session, clientX, clientY))
  if (probe.hitId === null) {
    options.onDetachAsRoot(session.nodeId, anchor)
    return
  }
  if (session.isRoot) options.onMoveRoot(session.nodeId, anchor)
}

/**
 * Alt + 拖动节点的结构编辑：
 * 拖动根节点即移动整棵树，拖到别的节点上挂为其子节点，拖到空白处脱离为新根节点。
 */
export function useNodeDrag(options: Readonly<NodeDragOptions>): NodeDragControls {
  const latestRef = useRef(options)
  const sessionRef = useRef<DragSession | null>(null)
  useEffect(() => {
    latestRef.current = options
  })

  const getDocument = useCallback(() => latestRef.current.document, [])
  const onCommit = useCallback((session: DragSession, clientX: number, clientY: number) => {
    commitDrag(session, clientX, clientY, latestRef.current)
  }, [])
  const tracking = useDragTracking({ sessionRef, getDocument, onCommit })
  const { begin } = tracking

  const startDrag = useCallback(
    (nodeId: NodeId, event: ReactPointerEvent<HTMLElement>) => {
      if (!event.altKey || event.button !== 0) return
      const session = createSession(nodeId, event, latestRef.current)
      if (session === null) return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      sessionRef.current = session
      begin(nodeId)
    },
    [begin],
  )

  return { ...tracking.view, startDrag, shouldSuppressClick: tracking.shouldSuppressClick }
}
