import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import { useCanvasViewport } from '../hooks/useCanvasViewport'
import { usePdfSource } from '../hooks/usePdfSource'
import { clampPageNumber, DETAIL_PAGE_WIDTH, renderPdfPage } from '../lib/pdfCrop'

interface PdfPagerProps {
  readonly label?: string | undefined
  readonly zoom: number
  readonly pageNumber: number
  readonly pageCount: number
  readonly onResetView: () => void
  readonly onGo: (pageNumber: number) => void
}

interface PdfPageViewerProps {
  readonly label?: string | undefined
  readonly pdf: PDFDocumentProxy
  readonly pageCount: number
  readonly pageNumber: number
  readonly onChangePage: (pageNumber: number) => void
}

interface PdfDetailViewProps {
  readonly src: string
  readonly page: number
  readonly label?: string | undefined
}

function PdfPager({ label, zoom, pageNumber, pageCount, onResetView, onGo }: Readonly<PdfPagerProps>) {
  const displayLabel = label === undefined || label.trim() === '' ? '文献预览' : label
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/90 px-4 py-2 text-xs text-slate-600">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200/60">
          PDF
        </span>
        <span className="truncate font-medium text-slate-700">{displayLabel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          title="滚轮缩放 · 拖拽平移 · 点击重置视图为 100%"
          onClick={onResetView}
          className="cursor-pointer rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="上一页"
          disabled={pageNumber <= 1}
          onClick={() => {
            onGo(pageNumber - 1)
          }}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span aria-live="polite" className="min-w-16 text-center font-medium text-slate-700 tabular-nums">
          第 {pageNumber} / {pageCount} 页
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="下一页"
          disabled={pageNumber >= pageCount}
          onClick={() => {
            onGo(pageNumber + 1)
          }}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}

function PdfPageViewer(props: Readonly<PdfPageViewerProps>) {
  const { label, pdf, pageCount, pageNumber, onChangePage } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { viewportRef, zoom, resetView, worldStyle, panning, onPointerDown, onPointerMove, onPointerUp } =
    useCanvasViewport()

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    void renderPdfPage(pdf, pageNumber, canvas, DETAIL_PAGE_WIDTH).catch(() => undefined)
  }, [pdf, pageNumber])

  return (
    <div className="flex h-full w-full flex-col bg-slate-100/65">
      <PdfPager
        label={label}
        zoom={zoom}
        pageNumber={pageNumber}
        pageCount={pageCount}
        onResetView={resetView}
        onGo={(next) => { onChangePage(clampPageNumber(next, pageCount)) }}
      />
      <div
        ref={viewportRef}
        aria-label="PDF 页面画布（滚轮缩放，拖拽平移）"
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden select-none',
          panning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex h-full w-full items-center justify-center p-5">
          <div style={worldStyle}>
            <canvas
              ref={canvasRef}
              className="block max-h-[calc(100vh-6.5rem)] max-w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-6px_rgba(15,23,42,0.12)]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function PdfViewMessage({ children }: Readonly<{ children: string }>) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50/60 text-xs font-medium text-slate-400">
      {children}
    </div>
  )
}

/** 右侧详情的 PDF 正文：用 pdf.js 逐页渲染并支持与左画布一致的滚轮缩放与拖拽平移 */
export function PdfDetailView({ src, page, label }: Readonly<PdfDetailViewProps>) {
  const { pdf, pageCount, loadFailed } = usePdfSource(src)
  const [pageNumber, setPageNumber] = useState(page)

  if (loadFailed) return <PdfViewMessage>PDF 解析失败</PdfViewMessage>
  if (pdf === null) return <PdfViewMessage>正在解析 PDF…</PdfViewMessage>
  return (
    <PdfPageViewer
      label={label}
      pdf={pdf}
      pageCount={pageCount}
      pageNumber={pageNumber}
      onChangePage={setPageNumber}
    />
  )
}
