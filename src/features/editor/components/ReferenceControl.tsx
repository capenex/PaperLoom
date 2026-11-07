import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Paperclip } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { referenceKindFromFileName, referenceKindFromMime } from '@/shared/lib/reference'
import type { PaperReference } from '@/shared/types/paper'
import { PdfCropDialog } from './PdfCropDialog'

interface ReferenceControlProps {
  readonly onReference: (reference: PaperReference) => void
}

interface ReferencePickerButtonProps {
  readonly onPickFile: (file: File) => void
}

function ReferencePickerButton({ onPickFile }: Readonly<ReferencePickerButtonProps>) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (file !== null) onPickFile(file)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="插入本地引用"
        title="插入本地引用（PDF / 图片 / HTML 页面）"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        onClick={() => {
          inputRef.current?.click()
        }}
      >
        <Paperclip aria-hidden="true" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.html,.htm,image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleChange}
      />
    </>
  )
}

/** 插入本地引用：选择 PDF / 图片 / HTML 页面；PDF 先切图再插入 */
export function ReferenceControl({ onReference }: Readonly<ReferenceControlProps>) {
  const [cropFile, setCropFile] = useState<File | null>(null)

  function handlePickFile(file: File): void {
    const kind = referenceKindFromMime(file.type) ?? referenceKindFromFileName(file.name)
    if (kind === null) return
    if (kind === 'pdf') {
      setCropFile(file)
      return
    }
    onReference({ kind, src: URL.createObjectURL(file), label: file.name })
  }

  return (
    <>
      <ReferencePickerButton onPickFile={handlePickFile} />
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
