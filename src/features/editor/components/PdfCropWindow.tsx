import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { Button } from '@/shared/components/ui/button'
import { PdfCropPageCanvas } from './PdfCropPageCanvas'

export interface PdfCropWindowProps {
  readonly fileName: string
  readonly pdf: PDFDocumentProxy | null
  readonly loadFailed: boolean
  readonly pageNumber: number
  readonly pageCount: number
  readonly cropUsable: boolean
  readonly onCrop: (preview: Blob | null) => void
  readonly onChangePage: (pageNumber: number) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

interface PdfCropHeaderProps {
  readonly fileName: string
  readonly pageNumber: number
  readonly pageCount: number
  readonly onChangePage: (pageNumber: number) => void
}

interface PdfCropStageProps {
  readonly pdf: PDFDocumentProxy | null
  readonly loadFailed: boolean
  readonly pageNumber: number
  readonly onCrop: (preview: Blob | null) => void
}

interface PdfCropFooterProps {
  readonly cropUsable: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function PdfCropHeader({
  fileName,
  pageNumber,
  pageCount,
  onChangePage,
}: Readonly<PdfCropHeaderProps>) {
  return (
    <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{fileName}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="上一页"
        disabled={pageNumber <= 1}
        onClick={() => {
          onChangePage(pageNumber - 1)
        }}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span className="text-xs text-slate-500">
        第 {pageNumber} / {Math.max(pageCount, 1)} 页
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="下一页"
        disabled={pageNumber >= pageCount}
        onClick={() => {
          onChangePage(pageNumber + 1)
        }}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </header>
  )
}

function PdfCropStage({ pdf, loadFailed, pageNumber, onCrop }: Readonly<PdfCropStageProps>) {
  return (
    <div className="overflow-auto bg-slate-100 p-4">
      {pdf === null ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          {loadFailed ? 'PDF 解析失败' : '正在解析 PDF…'}
        </div>
      ) : (
        <PdfCropPageCanvas key={pageNumber} pdf={pdf} pageNumber={pageNumber} onCrop={onCrop} />
      )}
    </div>
  )
}

function PdfCropFooter({ cropUsable, onCancel, onConfirm }: Readonly<PdfCropFooterProps>) {
  return (
    <footer className="flex items-center gap-2 border-t border-slate-200 px-4 py-2">
      <span className="flex-1 text-xs text-slate-500">
        在页面上拖框，裁出单击引用时展示的预览图
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        取消
      </Button>
      <Button type="button" size="sm" disabled={!cropUsable} onClick={onConfirm}>
        使用此切图
      </Button>
    </footer>
  )
}

/** 切图窗界面：挂在 body 下，避开编辑窗 transform 对 fixed 定位的影响 */
export function PdfCropWindow(props: Readonly<PdfCropWindowProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    props.onCancel()
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      open
      aria-label="PDF 切图预览"
      className="fixed inset-0 z-50 m-0 flex h-full w-full items-center justify-center bg-slate-900/50 p-6 outline-none"
      onKeyDown={handleKeyDown}
    >
      <div className="flex max-h-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <PdfCropHeader
          fileName={props.fileName}
          pageNumber={props.pageNumber}
          pageCount={props.pageCount}
          onChangePage={props.onChangePage}
        />
        <PdfCropStage
          pdf={props.pdf}
          loadFailed={props.loadFailed}
          pageNumber={props.pageNumber}
          onCrop={props.onCrop}
        />
        <PdfCropFooter
          cropUsable={props.cropUsable}
          onCancel={props.onCancel}
          onConfirm={props.onConfirm}
        />
      </div>
    </dialog>,
    document.body,
  )
}
