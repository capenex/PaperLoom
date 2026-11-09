import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import {
  Check,
  ChevronDown,
  Download,
  FileArchive,
  FolderOpen,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'

import type { PaperDocument } from '@/shared/types/paper'
import { useExport } from '../hooks/useExport'
import type { ExportStatus } from '../hooks/useExport'
import { useRestore } from '../hooks/useRestore'
import type { RestoreStatus } from '../hooks/useRestore'

interface ProjectPackageControlsProps {
  readonly document: PaperDocument
  readonly onRestoreDocument: (document: PaperDocument) => void
}

const MENU_ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-45'

function ExportItemIcon({
  status,
  idle: Idle,
}: Readonly<{ status: ExportStatus; idle: LucideIcon }>) {
  if (status === 'exporting') return <Loader2 className="size-4 animate-spin" aria-hidden="true" />
  if (status === 'success') return <Check className="size-4 text-emerald-600" aria-hidden="true" />
  if (status === 'error') return <TriangleAlert className="size-4 text-red-500" aria-hidden="true" />
  return <Idle className="size-4 text-slate-500" aria-hidden="true" />
}

function RestoreItemIcon({
  status,
  idle: Idle,
}: Readonly<{ status: RestoreStatus; idle: LucideIcon }>) {
  if (status === 'restoring') return <Loader2 className="size-4 animate-spin" aria-hidden="true" />
  if (status === 'success') return <Check className="size-4 text-emerald-600" aria-hidden="true" />
  if (status === 'error') return <TriangleAlert className="size-4 text-red-500" aria-hidden="true" />
  return <Idle className="size-4 text-slate-500" aria-hidden="true" />
}

function PackageFeedbackToast({
  exportStatus,
  exportMessage,
  restoreStatus,
  restoreMessage,
}: Readonly<{
  exportStatus: ExportStatus
  exportMessage: string
  restoreStatus: RestoreStatus
  restoreMessage: string
}>) {
  if (exportStatus === 'error' && exportMessage !== '') {
    return (
      <p className="absolute top-full left-0 z-40 mt-1.5 w-72 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600 shadow-md">
        {exportMessage}
      </p>
    )
  }
  if (exportStatus === 'cancelled') {
    return (
      <p className="absolute top-full left-0 z-40 mt-1.5 w-72 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 shadow-md">
        已取消：未选定文件夹或未允许写入，可换个文件夹或改用下载 zip
      </p>
    )
  }
  if (restoreStatus === 'error' && restoreMessage !== '') {
    return (
      <p className="absolute top-full left-0 z-40 mt-1.5 w-72 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600 shadow-md">
        {restoreMessage}
      </p>
    )
  }
  if (restoreStatus === 'success') {
    return (
      <p className="absolute top-full left-0 z-40 mt-1.5 flex w-60 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600 shadow-md">
        <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
        工程已复原并写入 project.json
      </p>
    )
  }
  return null
}

function PackageDropdownMenu({
  busy,
  exportTarget,
  exportStatus,
  restoreStatus,
  onExportFolder,
  onExportZip,
  onRestoreFolder,
  onRestoreZip,
}: Readonly<{
  busy: boolean
  exportTarget: 'folder' | 'zip' | null
  exportStatus: ExportStatus
  restoreStatus: RestoreStatus
  onExportFolder: () => void
  onExportZip: () => void
  onRestoreFolder: () => void
  onRestoreZip: () => void
}>) {
  return (
    <div
      role="menu"
      aria-label="工程文件菜单"
      className="absolute top-full left-0 z-40 mt-1.5 w-44 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        className={MENU_ITEM_CLASS}
        onClick={onExportFolder}
      >
        <ExportItemIcon
          status={exportTarget === 'folder' ? exportStatus : 'idle'}
          idle={Download}
        />
        <span>导出文件夹</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        className={MENU_ITEM_CLASS}
        onClick={onExportZip}
      >
        <ExportItemIcon
          status={exportTarget === 'zip' ? exportStatus : 'idle'}
          idle={FileArchive}
        />
        <span>下载 zip</span>
      </button>

      <hr className="my-1 border-slate-100" />

      <button
        type="button"
        role="menuitem"
        disabled={busy}
        className={MENU_ITEM_CLASS}
        onClick={onRestoreFolder}
      >
        <RestoreItemIcon status={restoreStatus} idle={FolderOpen} />
        <span>文件夹复原</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        className={MENU_ITEM_CLASS}
        onClick={onRestoreZip}
      >
        <RestoreItemIcon status={restoreStatus} idle={RotateCcw} />
        <span>zip 复原</span>
      </button>
    </div>
  )
}

function useDismissOnOutside(
  open: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!open || !(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target) === true) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (open && event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, containerRef, onClose])
}

function HiddenRestoreInputs({
  folderInputRef,
  zipInputRef,
  onRestoreFolder,
  onRestoreZip,
}: Readonly<{
  folderInputRef: RefObject<HTMLInputElement | null>
  zipInputRef: RefObject<HTMLInputElement | null>
  onRestoreFolder: (files: FileList) => void
  onRestoreZip: (file: File) => void
}>) {
  return (
    <>
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
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = event.target.files
          if (files !== null && files.length > 0) onRestoreFolder(files)
          event.target.value = ''
        }}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0] ?? null
          event.target.value = ''
          if (file !== null) onRestoreZip(file)
        }}
      />
    </>
  )
}

/** 顶栏「开始」选项卡左侧的「文件」下拉菜单：集合导出文件夹、下载 zip、文件夹复原与 zip 复原 */
export function ProjectPackageControls({
  document: paperDocument,
  onRestoreDocument,
}: Readonly<ProjectPackageControlsProps>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const exportCtrl = useExport()
  const restoreCtrl = useRestore(onRestoreDocument)
  const busy = exportCtrl.status === 'exporting' || restoreCtrl.status === 'restoring'

  useDismissOnOutside(open, containerRef, () => {
    setOpen(false)
  })

  return (
    <div ref={containerRef} className="relative flex shrink-0 items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev)
        }}
        className={cn(
          'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-3 text-[13px] font-semibold whitespace-nowrap transition-colors select-none',
          open
            ? 'bg-primary text-white shadow-2xs'
            : 'bg-primary/10 text-primary hover:bg-primary/15',
        )}
      >
        <span>文件</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <PackageDropdownMenu
          busy={busy}
          exportTarget={exportCtrl.target}
          exportStatus={exportCtrl.status}
          restoreStatus={restoreCtrl.status}
          onExportFolder={() => {
            setOpen(false)
            exportCtrl.run(paperDocument, 'folder')
          }}
          onExportZip={() => {
            setOpen(false)
            exportCtrl.run(paperDocument, 'zip')
          }}
          onRestoreFolder={() => {
            setOpen(false)
            folderInputRef.current?.click()
          }}
          onRestoreZip={() => {
            setOpen(false)
            zipInputRef.current?.click()
          }}
        />
      )}
      <HiddenRestoreInputs
        folderInputRef={folderInputRef}
        zipInputRef={zipInputRef}
        onRestoreFolder={restoreCtrl.restoreFromFolder}
        onRestoreZip={restoreCtrl.restoreFromZip}
      />
      <PackageFeedbackToast
        exportStatus={exportCtrl.status}
        exportMessage={exportCtrl.message}
        restoreStatus={restoreCtrl.status}
        restoreMessage={restoreCtrl.message}
      />
    </div>
  )
}
