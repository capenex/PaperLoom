import { useState } from 'react'
import { Paperclip } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { buildInboxUrl } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { referenceKindFromFileName } from '@/shared/lib/reference'
import type { PaperReference } from '@/shared/types/paper'
import { FilePoolReferencePickerModal } from './FilePoolReferencePickerModal'
import { PdfCropDialog } from './PdfCropDialog'

interface ReferenceControlProps {
  readonly onReference: (reference: PaperReference) => void
}

/** 插入本地引用：从文件池中选择 PDF / 图片 / 幻灯片 / HTML 页面；PDF 先切图再插入 */
export function ReferenceControl({ onReference }: Readonly<ReferenceControlProps>) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)

  function handleSelectInboxEntry(entry: InboxEntry): void {
    setPickerOpen(false)
    const src = buildInboxUrl(entry.path)
    if (entry.category === 'image' || entry.category === 'slide') {
      onReference({ kind: 'image', src, label: entry.name })
      return
    }
    const kind = referenceKindFromFileName(entry.name)
    if (kind === 'page') {
      onReference({ kind: 'page', src, label: entry.name })
      return
    }
    if (kind === 'pdf' || entry.ext.toLowerCase() === '.pdf') {
      void fetch(src, { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) throw new Error('读取文件池中的 PDF 失败')
          const blob = await res.blob()
          const pdfFile = new File([blob], entry.name, { type: 'application/pdf' })
          setCropFile(pdfFile)
        })
        .catch((error: unknown) => {
          window.alert(error instanceof Error ? error.message : '读取 PDF 失败')
        })
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="插入本地引用"
        title="从文件池插入本地引用（PDF / 图片 / 幻灯片 / HTML 页面）"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        onClick={() => {
          setPickerOpen(true)
        }}
      >
        <Paperclip aria-hidden="true" />
      </Button>
      {pickerOpen && (
        <FilePoolReferencePickerModal
          onSelectEntry={handleSelectInboxEntry}
          onClose={() => {
            setPickerOpen(false)
          }}
        />
      )}
      {cropFile !== null && (
        <PdfCropDialog
          file={cropFile}
          onCancel={() => {
            setCropFile(null)
          }}
          onConfirm={(reference) => {
            setCropFile(null)
            onReference(reference)
          }}
        />
      )}
    </>
  )
}
