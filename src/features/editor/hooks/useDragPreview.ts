import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { deltaOf, previewOf, probeDrop } from '../data/nodeDrag'
import type { DragSession, NodeDragView } from '../data/nodeDrag'
import { cardIdAtPoint } from '../lib/dragHitTest'

/** 一次指针采样：只保留刷新预览需要的屏幕坐标 */
export interface PointerSample {
  readonly clientX: number
  readonly clientY: number
}

interface DragPreviewOptions {
  readonly sessionRef: RefObject<DragSession | null>
  readonly getDocument: () => PaperDocument
  readonly setView: Dispatch<SetStateAction<NodeDragView>>
}

export interface DragPreview {
  readonly schedule: (sample: PointerSample) => void
  readonly cancel: () => void
}

/** 用最新采样刷新一次预览：命中测试、落点判定与被拖动子树的平移位置 */
function renderPreview(options: Readonly<DragPreviewOptions>, sample: PointerSample): void {
  const session = options.sessionRef.current
  if (session === null) return
  const { clientX, clientY } = sample
  const hitId = cardIdAtPoint(clientX, clientY, session.subtreeIds)
  options.setView({
    draggingNodeId: session.nodeId,
    dropTargetId: probeDrop(options.getDocument(), session, hitId).targetId,
    overBlank: hitId === null,
    previewPositions: previewOf(session, deltaOf(session, clientX, clientY)),
  })
}

/** 指针事件的频率远高于屏幕刷新率，把预览刷新合并到每帧最多一次 */
export function useDragPreview(options: Readonly<DragPreviewOptions>): DragPreview {
  const optionsRef = useRef(options)
  const frameRef = useRef(0)
  const sampleRef = useRef<PointerSample>({ clientX: 0, clientY: 0 })

  useEffect(() => {
    optionsRef.current = options
  })

  const cancel = useCallback(() => {
    if (frameRef.current === 0) return
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
  }, [])

  const schedule = useCallback((sample: PointerSample) => {
    sampleRef.current = sample
    if (frameRef.current !== 0) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      renderPreview(optionsRef.current, sampleRef.current)
    })
  }, [])

  useEffect(() => cancel, [cancel])

  return { schedule, cancel }
}
