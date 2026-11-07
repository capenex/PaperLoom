import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { usePdfSource } from '../hooks/usePdfSource'
import { clampPageNumber, DETAIL_PAGE_WIDTH, renderPdfPage } from '../lib/pdfCrop'

interface PdfPagerProps {
  readonly pageNumber: number
  readonly pageCount: number
  readonly onGo: (pageNumber: number) => void
}

interface PdfPageViewerProps {
  readonly pdf: PDFDocumentProxy
  readonly pageCount: number
  readonly pageNumber: number
  readonly onChangePage: (pageNumber: number) => void
}

interface PdfDetailViewProps {
  readonly src: string
  readonly page: number
}

function PdfPager({ pageNumber, pageCount, onGo }: Readonly<PdfPagerProps>) {
  return (
    <header className="flex shrink-0 items-center justify-center gap-2 py-2 text-xs text-slate-300">
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
      <span aria-live="polite">
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
    </header>
  )
}

function PdfPageViewer({
  pdf,
  pageCount,
  pageNumber,
  onChangePage,
}: Readonly<PdfPageViewerProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    // 翻页过快时上一页的渲染任务可能已被销毁，这类中断忽略即可
    void renderPdfPage(pdf, pageNumber, canvas, DETAIL_PAGE_WIDTH).catch(() => undefined)
  }, [pdf, pageNumber])

  return (
    <div className="flex h-full w-full flex-col">
      <PdfPager
        pageNumber={pageNumber}
        pageCount={pageCount}
        onGo={(next) => {
          onChangePage(clampPageNumber(next, pageCount))
        }}
      />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <canvas ref={canvasRef} className="mx-auto block max-w-full bg-white shadow" />
      </div>
    </div>
  )
}

function PdfViewMessage({ children }: Readonly<{ children: string }>) {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
      {children}
    </div>
  )
}

/** 右侧详情的 PDF 正文：用 pdf.js 逐页渲染并定位到引用页，不依赖浏览器内置阅读器 */
export function PdfDetailView({ src, page }: Readonly<PdfDetailViewProps>) {
  const { pdf, pageCount, loadFailed } = usePdfSource(src)
  const [pageNumber, setPageNumber] = useState(page)

  if (loadFailed) return <PdfViewMessage>PDF 解析失败</PdfViewMessage>
  if (pdf === null) return <PdfViewMessage>正在解析 PDF…</PdfViewMessage>
  return (
    <PdfPageViewer
      pdf={pdf}
      pageCount={pageCount}
      pageNumber={pageNumber}
      onChangePage={setPageNumber}
    />
  )
}
