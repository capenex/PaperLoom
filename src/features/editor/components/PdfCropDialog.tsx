import { useCallback, useState } from 'react'

import type { PaperReference } from '@/shared/types/paper'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { clampPageNumber, createPdfReference } from '../lib/pdfCrop'
import { PdfCropWindow } from './PdfCropWindow'

interface PdfCropDialogProps {
  readonly file: File
  readonly onCancel: () => void
  readonly onConfirm: (reference: PaperReference) => void
}

/** PDF 切图：拖框裁出单击引用时展示的预览图，页码留给双击跳转全文 */
export function PdfCropDialog({ file, onCancel, onConfirm }: Readonly<PdfCropDialogProps>) {
  const { pdf, pageCount, loadFailed } = usePdfDocument(file)
  const [pageNumber, setPageNumber] = useState(1)
  const [preview, setPreview] = useState<Blob | null>(null)

  const changePage = useCallback(
    (next: number) => {
      setPageNumber(clampPageNumber(next, pageCount))
      setPreview(null)
    },
    [pageCount],
  )

  const confirm = useCallback(() => {
    if (preview === null) return
    onConfirm(createPdfReference(file, pageNumber, preview))
  }, [file, onConfirm, pageNumber, preview])

  return (
    <PdfCropWindow
      fileName={file.name}
      pdf={pdf}
      loadFailed={loadFailed}
      pageNumber={pageNumber}
      pageCount={pageCount}
      cropUsable={preview !== null}
      onCrop={setPreview}
      onChangePage={changePage}
      onCancel={onCancel}
      onConfirm={confirm}
    />
  )
}
