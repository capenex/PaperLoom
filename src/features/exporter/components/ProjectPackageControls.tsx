import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import {
  Check,
  ChevronDown,
  Download,
  FileArchive,
  FilePlus2,
  FolderOpen,
  History,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'

import { hasBoundDirectoryHandle } from '@/shared/lib/workspaceFolderSync'
import type { PaperDocument } from '@/shared/types/paper'
import { writeExportToDirectory } from '../data/writeDirectory'
import { useExport } from '../hooks/useExport'
import type { ExportStatus, ExportTarget } from '../hooks/useExport'
import { useRestore } from '../hooks/useRestore'
import type { RestoreStatus } from '../hooks/useRestore'

interface ProjectPackageControlsProps {
  readonly document: PaperDocument
  readonly onRestoreDocument: (document: PaperDocument) => void
  readonly onRefreshFilePool?: (() => Promise<void>) | undefined
  readonly filePoolOpen?: boolean | undefined
  readonly onToggleFilePool?: (() => void) | undefined
  readonly onOpenNewSlideComposer?: (() => void) | undefined
  readonly onResetBlankProject?: (() => void) | undefined
}

const MENU_ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-45'

function StatusItemIcon({
  status,
  idle: Idle,
}: Readonly<{
  status: ExportStatus | RestoreStatus
  idle: LucideIcon
}>) {
  if (status === 'exporting' || status === 'restoring') {
    return <Loader2 className="size-4 animate-spin" aria-hidden="true" />
  }
  if (status === 'success') return <Check className="size-4 text-emerald-600" aria-hidden="true" />
  if (status === 'error') return <TriangleAlert className="size-4 text-red-500" aria-hidden="true" />
  return <Idle className="size-4 text-slate-500" aria-hidden="true" />
}

interface ToastModel {
  readonly tone: 'success' | 'warning' | 'error'
  readonly text: string
}

function resolveActiveToast(
  exportStatus: ExportStatus,
  exportMessage: string,
  restoreStatus: RestoreStatus,
  restoreMessage: string,
): ToastModel | null {
  if (exportStatus === 'error' && exportMessage !== '') {
    return { tone: 'error', text: exportMessage }
  }
  if (exportStatus === 'cancelled') {
    return {
      tone: 'warning',
      text: '已取消：未选定文件夹或未允许写入，可换个文件夹或改用下载 zip',
    }
  }
  if (exportStatus === 'success') {
    return { tone: 'success', text: exportMessage === '' ? '导出完成' : exportMessage }
  }
  if (restoreStatus === 'error' && restoreMessage !== '') {
    return { tone: 'error', text: restoreMessage }
  }
  if (restoreStatus === 'success') {
    return {
      tone: 'success',
      text: restoreMessage === '' ? '工程已复原并写入 project.json' : restoreMessage,
    }
  }
  return null
}

function PackageFeedbackToast({
  exportStatus,
  exportMessage,
  restoreStatus,
  restoreMessage,
  onDismiss,
}: Readonly<{
  exportStatus: ExportStatus
  exportMessage: string
  restoreStatus: RestoreStatus
  restoreMessage: string
  onDismiss: () => void
}>) {
  const toast = resolveActiveToast(exportStatus, exportMessage, restoreStatus, restoreMessage)

  useEffect(() => {
    if (toast === null) return undefined
    const delayMs = toast.tone === 'error' ? 6000 : 3500
    const timer = window.setTimeout(onDismiss, delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toast, onDismiss])

  if (toast === null) return null

  const toneCls =
    toast.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-600'
      : toast.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'

  return (
    <output
      className={cn(
        'absolute top-full left-0 z-40 mt-1.5 flex w-72 items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs leading-5 shadow-md',
        toneCls,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {toast.tone === 'success' && <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />}
        <span className="break-words">{toast.text}</span>
      </div>
      <button
        type="button"
        aria-label="关闭提示"
        onClick={onDismiss}
        className="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </output>
  )
}

interface PackageDropdownMenuProps {
  readonly busy: boolean
  readonly filePoolOpen: boolean
  readonly canQuickSync: boolean
  readonly exportTarget: ExportTarget
  readonly exportStatus: ExportStatus
  readonly restoreStatus: RestoreStatus
  readonly onToggleFilePool?: (() => void) | undefined
  readonly onOpenNewSlideComposer?: (() => void) | undefined
  readonly onExportQuickFolder: () => void
  readonly onExportFolder: () => void
  readonly onExportZip: () => void
  readonly onRestoreFolder: () => void
  readonly onRestoreZip: () => void
  readonly onRestoreBackup: () => void
  readonly onResetBlankProject?: (() => void) | undefined
}

function MenuQuickToolsSection({
  filePoolOpen,
  onToggleFilePool,
  onOpenNewSlideComposer,
}: Readonly<{
  filePoolOpen: boolean
  onToggleFilePool?: (() => void) | undefined
  onOpenNewSlideComposer?: (() => void) | undefined
}>) {
  if (onToggleFilePool === undefined && onOpenNewSlideComposer === undefined) return null
  return (
    <>
      {onToggleFilePool !== undefined && (
        <button
          type="button"
          role="menuitem"
          className={cn(MENU_ITEM_CLASS, filePoolOpen && 'bg-primary/8 font-semibold text-primary')}
          onClick={onToggleFilePool}
        >
          <Layers className="size-4 text-primary" aria-hidden="true" />
          <span className="flex-1">{filePoolOpen ? '关闭文件池' : '打开文件池'}</span>
          {filePoolOpen && <Check className="size-3.5 text-primary" aria-hidden="true" />}
        </button>
      )}
      {onOpenNewSlideComposer !== undefined && (
        <button type="button" role="menuitem" className={MENU_ITEM_CLASS} onClick={onOpenNewSlideComposer}>
          <Presentation className="size-4 text-primary" aria-hidden="true" />
          <span>新建幻灯片伪图片</span>
        </button>
      )}
      <hr className="my-1 border-slate-100" />
    </>
  )
}

function PackageDropdownMenu(props: Readonly<PackageDropdownMenuProps>) {
  const {
    busy,
    filePoolOpen,
    canQuickSync,
    exportTarget,
    exportStatus,
    restoreStatus,
    onToggleFilePool,
    onOpenNewSlideComposer,
    onExportQuickFolder,
    onExportFolder,
    onExportZip,
    onRestoreFolder,
    onRestoreZip,
    onRestoreBackup,
    onResetBlankProject,
  } = props

  return (
    <div
      role="menu"
      aria-label="工程文件菜单"
      className="absolute top-full left-0 z-40 mt-1.5 w-52 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg"
    >
      <MenuQuickToolsSection
        filePoolOpen={filePoolOpen}
        onToggleFilePool={onToggleFilePool}
        onOpenNewSlideComposer={onOpenNewSlideComposer}
      />
      {canQuickSync && (
        <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onExportQuickFolder}>
          <StatusItemIcon status={exportTarget === 'quick-folder' ? exportStatus : 'idle'} idle={RefreshCw} />
          <span>快速同步导出</span>
        </button>
      )}
      <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onExportFolder}>
        <StatusItemIcon status={exportTarget === 'folder' ? exportStatus : 'idle'} idle={Download} />
        <span>导出文件夹</span>
      </button>
      <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onExportZip}>
        <StatusItemIcon status={exportTarget === 'zip' ? exportStatus : 'idle'} idle={FileArchive} />
        <span>下载 zip</span>
      </button>
      <hr className="my-1 border-slate-100" />
      <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onRestoreFolder}>
        <StatusItemIcon status={restoreStatus} idle={FolderOpen} />
        <span>打开文件夹</span>
      </button>
      <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onRestoreZip}>
        <StatusItemIcon status={restoreStatus} idle={RotateCcw} />
        <span>zip 复原</span>
      </button>
      <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onRestoreBackup}>
        <StatusItemIcon status={restoreStatus} idle={History} />
        <span>从备份恢复 (.bak)</span>
      </button>
      {onResetBlankProject !== undefined && (
        <>
          <hr className="my-1 border-slate-100" />
          <button type="button" role="menuitem" disabled={busy} className={MENU_ITEM_CLASS} onClick={onResetBlankProject}>
            <FilePlus2 className="size-4 text-slate-500" aria-hidden="true" />
            <span>新建空白工程</span>
          </button>
        </>
      )}
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

function wrapCloseCallback(
  setOpen: (open: boolean) => void,
  fn: (() => void) | undefined,
): (() => void) | undefined {
  if (fn === undefined) return undefined
  return () => {
    setOpen(false)
    fn()
  }
}

function useAutoSyncBoundDirectory(paperDocument: PaperDocument): void {
  useEffect(() => {
    if (!hasBoundDirectoryHandle()) return undefined
    const timer = window.setTimeout(() => {
      void writeExportToDirectory(paperDocument, true).catch(() => {
        // 忽略后台自动写盘异常
      })
    }, 800)
    return () => {
      window.clearTimeout(timer)
    }
  }, [paperDocument])
}

/** 顶栏「开始」选项卡左侧的「文件」下拉菜单：集合文件池开关、幻灯片画板、导出/快速同步与工程复原 */
export function ProjectPackageControls({
  document: paperDocument,
  onRestoreDocument,
  onRefreshFilePool,
  filePoolOpen = false,
  onToggleFilePool,
  onOpenNewSlideComposer,
  onResetBlankProject,
}: Readonly<ProjectPackageControlsProps>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const exportCtrl = useExport()
  const restoreCtrl = useRestore(onRestoreDocument)
  const busy = exportCtrl.status === 'exporting' || restoreCtrl.status === 'restoring'

  useAutoSyncBoundDirectory(paperDocument)

  const dismissAllFeedback = (): void => {
    exportCtrl.dismiss()
    restoreCtrl.dismiss()
  }
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
          dismissAllFeedback()
          setOpen((prev) => !prev)
        }}
        className={cn(
          'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-3 text-[13px] font-semibold whitespace-nowrap transition-colors select-none',
          open ? 'bg-primary text-white shadow-2xs' : 'bg-primary/10 text-primary hover:bg-primary/15',
        )}
      >
        <span>文件</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <PackageDropdownMenu
          busy={busy}
          filePoolOpen={filePoolOpen}
          canQuickSync={exportCtrl.canQuickSync}
          exportTarget={exportCtrl.target}
          exportStatus={exportCtrl.status}
          restoreStatus={restoreCtrl.status}
          onToggleFilePool={wrapCloseCallback(setOpen, onToggleFilePool)}
          onOpenNewSlideComposer={wrapCloseCallback(setOpen, onOpenNewSlideComposer)}
          onExportQuickFolder={() => {
            setOpen(false)
            exportCtrl.run(paperDocument, 'quick-folder')
          }}
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
            void restoreCtrl.openWorkspaceFolder(paperDocument, onRefreshFilePool).then((res) => {
              if (res === 'fallback-input') folderInputRef.current?.click()
            })
          }}
          onRestoreZip={() => {
            setOpen(false)
            zipInputRef.current?.click()
          }}
          onRestoreBackup={() => {
            setOpen(false)
            restoreCtrl.restoreFromBackup()
          }}
          onResetBlankProject={wrapCloseCallback(setOpen, onResetBlankProject)}
        />
      )}
      <HiddenRestoreInputs folderInputRef={folderInputRef} zipInputRef={zipInputRef} onRestoreFolder={restoreCtrl.restoreFromFolder} onRestoreZip={restoreCtrl.restoreFromZip} />
      <PackageFeedbackToast exportStatus={exportCtrl.status} exportMessage={exportCtrl.message} restoreStatus={restoreCtrl.status} restoreMessage={restoreCtrl.message} onDismiss={dismissAllFeedback} />
    </div>
  )
}
