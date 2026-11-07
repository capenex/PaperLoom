import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { openPdfDocument } from '../lib/pdfCrop'

export interface PdfDocumentState {
  readonly pdf: PDFDocumentProxy | null
  readonly pageCount: number
  readonly loadFailed: boolean
}

/** 读取本地 PDF 文件；换文件或卸载时销毁 pdf.js 的渲染资源 */
export function usePdfDocument(file: File): PdfDocumentState {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loading = file.arrayBuffer().then((data) => openPdfDocument(data))
    loading
      .then((task) => task.promise)
      .then((loaded) => {
        if (!cancelled) setPdf(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
      setPdf(null)
      void loading.then((task) => task.destroy()).catch(() => undefined)
    }
  }, [file])

  return { pdf, pageCount: pdf?.numPages ?? 0, loadFailed }
}
