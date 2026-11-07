import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { useCropDrag } from '../hooks/useCropDrag'
import { CROP_PAGE_HEIGHT, CROP_PAGE_WIDTH, renderPdfPage } from '../lib/pdfCrop'

interface PdfCropPageCanvasProps {
  readonly pdf: PDFDocumentProxy
  readonly pageNumber: number
  readonly onCrop: (preview: Blob | null) => void
}

/** 切图画布：渲染当前页，指针拖框选出单击引用时展示的预览区域 */
export function PdfCropPageCanvas({
  pdf,
  pageNumber,
  onCrop,
}: Readonly<PdfCropPageCanvasProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useCropDrag(canvasRef, onCrop)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    // 翻页过快时上一页的渲染任务可能已被销毁，这类中断忽略即可
    void renderPdfPage(pdf, pageNumber, canvas, CROP_PAGE_WIDTH, CROP_PAGE_HEIGHT).catch(() => undefined)
  }, [pageNumber, pdf])

  return (
    <div
      className="relative inline-block touch-none select-none"
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
    >
      <canvas ref={canvasRef} className="block bg-white shadow" />
      {drag.crop !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border-2 border-primary bg-primary/10"
          style={{
            left: drag.crop.x,
            top: drag.crop.y,
            width: drag.crop.width,
            height: drag.crop.height,
          }}
        />
      )}
    </div>
  )
}
