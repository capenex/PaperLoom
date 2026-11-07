import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import type { NodeId, PaperDocument } from '@/shared/types/paper'
import { deltaOf, IDLE_DRAG_VIEW, movedBeyond } from '../data/nodeDrag'
import type { DragSession, NodeDragView } from '../data/nodeDrag'
import { useDragPreview } from './useDragPreview'

/** 拖动结束后这段时间内的 click 视为拖动余波，不触发选中或取消选中 */
const CLICK_SUPPRESS_MS = 300

interface DragTrackingOptions {
  readonly sessionRef: RefObject<DragSession | null>
  readonly getDocument: () => PaperDocument
  readonly onCommit: (session: DragSession, clientX: number, clientY: number) => void
}

export interface DragTracking {
  readonly view: NodeDragView
  readonly begin: (nodeId: NodeId) => void
  readonly shouldSuppressClick: () => boolean
}

/** 拖动期间在 window 上跟踪指针，拖动结束自动摘掉监听 */
function usePointerListeners(
  active: boolean,
  onMove: (event: PointerEvent) => void,
  onUp: (event: PointerEvent) => void,
  onCancel: () => void,
): void {
  useEffect(() => {
    if (!active) return undefined
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [active, onCancel, onMove, onUp])
}

/** 拖动跟踪：每帧刷新预览位置与落点提示，指针抬起时把落点交给上层提交 */
export function useDragTracking({
  sessionRef,
  getDocument,
  onCommit,
}: Readonly<DragTrackingOptions>): DragTracking {
  const [view, setView] = useState<NodeDragView>(IDLE_DRAG_VIEW)
  const movedRef = useRef(false)
  const endedAtRef = useRef(0)
  const { schedule, cancel } = useDragPreview({ sessionRef, getDocument, setView })

  // 阈值判断留在事件里同步做：抬手可能早于下一帧，否则快速一甩会被当成没动
  const handleMove = useCallback((event: PointerEvent) => {
    const session = sessionRef.current
    if (session === null || session.pointerId !== event.pointerId) return
    if (movedBeyond(deltaOf(session, event.clientX, event.clientY))) movedRef.current = true
    schedule({ clientX: event.clientX, clientY: event.clientY })
  }, [schedule, sessionRef])

  const handleUp = useCallback((event: PointerEvent) => {
    cancel()
    const session = sessionRef.current
    sessionRef.current = null
    setView(IDLE_DRAG_VIEW)
    if (session === null || session.pointerId !== event.pointerId || !movedRef.current) return
    endedAtRef.current = performance.now()
    onCommit(session, event.clientX, event.clientY)
  }, [cancel, onCommit, sessionRef])

  const handleCancel = useCallback(() => {
    cancel()
    sessionRef.current = null
    setView(IDLE_DRAG_VIEW)
  }, [cancel, sessionRef])

  const begin = useCallback((nodeId: NodeId) => {
    movedRef.current = false
    setView({ ...IDLE_DRAG_VIEW, draggingNodeId: nodeId })
  }, [])

  usePointerListeners(view.draggingNodeId !== null, handleMove, handleUp, handleCancel)

  const shouldSuppressClick = useCallback(() => performance.now() - endedAtRef.current < CLICK_SUPPRESS_MS, [])

  return { view, begin, shouldSuppressClick }
}
