import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { openPdfDocumentByUrl } from '../lib/pdfCrop'

export interface PdfSourceState {
  readonly pdf: PDFDocumentProxy | null
  readonly pageCount: number
  readonly loadFailed: boolean
}

/** 按地址读取 PDF；换地址或卸载时销毁 pdf.js 的渲染资源 */
export function usePdfSource(src: string): PdfSourceState {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loading = openPdfDocumentByUrl(src)
    loading.promise
      .then((loaded) => {
        if (!cancelled) setPdf(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
      setPdf(null)
      void loading.destroy().catch(() => undefined)
    }
  }, [src])

  return { pdf, pageCount: pdf?.numPages ?? 0, loadFailed }
}
