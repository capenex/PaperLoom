import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { Check, FileArchive, FolderOpen, Loader2, RotateCcw, TriangleAlert } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import type { PaperDocument } from '@/shared/types/paper'
import { useRestore } from '../hooks/useRestore'
import type { RestoreStatus } from '../hooks/useRestore'
import { ExportButton } from './ExportButton'

interface ProjectPackageControlsProps {
  readonly document: PaperDocument
  readonly onRestoreDocument: (document: PaperDocument) => void
}

function RestoreIcon({ status }: Readonly<{ status: RestoreStatus }>) {
  if (status === 'restoring') return <Loader2 className="animate-spin" aria-hidden="true" />
  if (status === 'success') return <Check aria-hidden="true" />
  if (status === 'error') return <TriangleAlert aria-hidden="true" />
  return <RotateCcw aria-hidden="true" />
}

/** 顶部栏右侧的工程包操作：导出离线演示包，或从导出文件夹 / .zip 压缩包复原工程 */
export function ProjectPackageControls({
  document,
  onRestoreDocument,
}: Readonly<ProjectPackageControlsProps>) {
  const { status, message, restoreFromFolder, restoreFromZip } = useRestore(onRestoreDocument)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  function handleFolderChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = event.target.files
    if (files !== null && files.length > 0) restoreFromFolder(files)
    event.target.value = ''
  }

  function handleZipChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (file !== null) restoreFromZip(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <ExportButton document={document} />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={status === 'restoring'}
          title="从导出文件夹复原工程（还原资源并替换当前画布）"
          onClick={() => {
            folderInputRef.current?.click()
          }}
        >
          <FolderOpen aria-hidden="true" />
          文件夹复原
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={status === 'restoring'}
          title="从 .zip 压缩包复原工程（还原资源并替换当前画布）"
          onClick={() => {
            zipInputRef.current?.click()
          }}
        >
          <FileArchive aria-hidden="true" />
          zip 复原
        </Button>
      </div>
      <input
        ref={(element) => {
          folderInputRef.current = element
          if (element !== null) element.setAttribute('webkitdirectory', '')
        }}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleFolderChange}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleZipChange}
      />
      {status === 'error' && message !== '' && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600">
          {message}
        </p>
      )}
      {status === 'success' && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          <RestoreIcon status={status} /> 工程已复原并写入 project.json
        </p>
      )}
    </div>
  )
}
