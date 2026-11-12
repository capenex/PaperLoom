import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import type { NodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeId, PaperDocument } from '@/shared/types/paper'
import { resizeImageNodeOnWheel } from '../lib/imageNodeWheelZoom'

/** Ctrl/Cmd + 滚轮缩放图片节点：在捕获阶段拦截，避免冒泡到视口触发画布整体缩放 */
export function useImageNodeWheelZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  document: PaperDocument,
  onResize: (nodeId: NodeId, size: NodeSize) => void,
): void {
  const stateRef = useRef({ document, onResize })
  useEffect(() => {
    stateRef.current = { document, onResize }
  }, [document, onResize])
  useEffect(() => {
    const element = containerRef.current
    if (element === null) return undefined
    const handleWheel = (event: WheelEvent): void => {
      const latest = stateRef.current
      if (!resizeImageNodeOnWheel(event, latest.document, latest.document.defaults, latest.onResize)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    element.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [containerRef])
}