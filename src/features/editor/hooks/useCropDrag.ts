import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

import type { CropPoint, CropRect } from '../lib/pdfCrop'
import { cropPointOf, cropRectBetween, cropToPreview } from '../lib/pdfCrop'

export interface CropDragControls {
  readonly crop: CropRect | null
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerUp: () => void
}

function pointOf(event: ReactPointerEvent<HTMLElement>): CropPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return cropPointOf(rect, event.clientX, event.clientY)
}

/** 在页面上拖框选区：松手即裁出预览图 */
export function useCropDrag(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onCrop: (preview: Blob | null) => void,
): CropDragControls {
  const dragStartRef = useRef<CropPoint | null>(null)
  // pointermove 的状态更新是连续事件，松手时可能尚未提交，裁剪要用 ref 里的最新框
  const cropRef = useRef<CropRect | null>(null)
  const [crop, setCrop] = useState<CropRect | null>(null)

  function updateCrop(next: CropRect): void {
    cropRef.current = next
    setCrop(next)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointOf(event)
    dragStartRef.current = point
    updateCrop({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const start = dragStartRef.current
    if (start === null) return
    updateCrop(cropRectBetween(start, pointOf(event)))
  }

  function handlePointerUp(): void {
    if (dragStartRef.current === null) return
    dragStartRef.current = null
    void cropToPreview(canvasRef.current, cropRef.current).then(onCrop)
  }

  return {
    crop,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  }
}
