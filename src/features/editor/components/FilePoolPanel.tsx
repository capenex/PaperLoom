import { useRef } from 'react'
import type { ChangeEvent, DragEvent as ReactDragEvent } from 'react'
import {
  ArrowUp,
  FolderPlus,
  Layers,
  Presentation,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import type { InboxEntry } from '@/shared/lib/inbox'
import type { FilePoolController } from '../hooks/useFilePool'
import {
  hasInboxPayloadInDataTransfer,
  readDraggedInboxPayload,
} from '../lib/inboxClient'
import { FilePoolItemRow } from './FilePoolItemRow'

interface FilePoolPanelProps {
  readonly pool: FilePoolController
  readonly onCreateNewSlide: (folderPath: string) => void
  readonly onEditSlide: (relPath: string) => void
  readonly onQuickInsertEntry: (entry: InboxEntry) => void
}

function FolderBreadcrumbs({
  currentFolder,
  onSelectFolder,
  onDropEntryToFolder,
}: Readonly<{
  currentFolder: string
  onSelectFolder: (folder: string) => void
  onDropEntryToFolder: (entryPath: string, targetFolder: string) => void
}>) {
  const segments = currentFolder === '' ? [] : currentFolder.split('/')

  const handleBreadcrumbDrop = (
    event: ReactDragEvent<HTMLButtonElement>,
    targetFolder: string,
  ): void => {
    const payload = readDraggedInboxPayload(event.dataTransfer)
    if (payload === null) return
    event.preventDefault()
    event.stopPropagation()
    onDropEntryToFolder(payload.path, targetFolder)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 text-xs text-slate-600">
      {currentFolder !== '' && (
        <button
          type="button"
          aria-label="返回上一级目录"
          onClick={() => {
            const slash = currentFolder.lastIndexOf('/')
            onSelectFolder(slash === -1 ? '' : currentFolder.slice(0, slash))
          }}
          className="mr-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100"
        >
          <ArrowUp className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          onSelectFolder('')
        }}
        onDragOver={(e) => {
          if (hasInboxPayloadInDataTransfer(e.dataTransfer)) e.preventDefault()
        }}
        onDrop={(e) => {
          handleBreadcrumbDrop(e, '')
        }}
        className={cn(
          'shrink-0 cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors',
          currentFolder === '' ? 'bg-primary/10 text-primary' : 'hover:bg-slate-100',
        )}
      >
        根目录
      </button>
      {segments.map((seg, idx) => {
        const subPath = segments.slice(0, idx + 1).join('/')
        const isLast = idx === segments.length - 1
        return (
          <div key={subPath} className="flex shrink-0 items-center gap-1">
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => {
                onSelectFolder(subPath)
              }}
              onDragOver={(e) => {
                if (hasInboxPayloadInDataTransfer(e.dataTransfer)) e.preventDefault()
              }}
              onDrop={(e) => {
                handleBreadcrumbDrop(e, subPath)
              }}
              className={cn(
                'max-w-28 truncate cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors',
                isLast ? 'bg-primary/10 text-primary' : 'hover:bg-slate-100',
              )}
            >
              {seg}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function FilePoolActionToolbar({
  unusedCount,
  onTriggerUpload,
  onCreateFolder,
  onCreateSlide,
  onCleanupUnused,
}: Readonly<{
  unusedCount: number
  onTriggerUpload: () => void
  onCreateFolder: () => void
  onCreateSlide: () => void
  onCleanupUnused: () => void
}>) {
  return (
    <div className="grid grid-cols-2 gap-1.5 border-y border-slate-200/70 bg-slate-50/80 px-3 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 justify-start bg-white px-2.5 text-xs text-slate-700"
        onClick={onTriggerUpload}
      >
        <Upload className="size-3.5 text-primary" aria-hidden="true" />
        上传文件
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 justify-start bg-white px-2.5 text-xs text-slate-700"
        onClick={onCreateFolder}
      >
        <FolderPlus className="size-3.5 text-amber-600" aria-hidden="true" />
        新建文件夹
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 justify-start bg-white px-2.5 text-xs text-slate-700"
        onClick={onCreateSlide}
      >
        <Presentation className="size-3.5 text-primary" aria-hidden="true" />
        新建幻灯片
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={unusedCount === 0}
        className="h-8 justify-start bg-white px-2.5 text-xs text-slate-700"
        onClick={onCleanupUnused}
      >
        <Sparkles className="size-3.5 text-rose-500" aria-hidden="true" />
        清理未用 ({unusedCount})
      </Button>
    </div>
  )
}

function FilePoolHeader({
  loading,
  onRefresh,
  onClose,
}: Readonly<{
  loading: boolean
  onRefresh: () => void
  onClose: () => void
}>) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/80 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Layers className="size-3.5" aria-hidden="true" />
        </div>
        <span className="text-[13px] font-bold text-slate-900">文件池资源管理器</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="刷新文件池"
          onClick={onRefresh}
          className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="关闭文件池"
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function FilePoolEntryList({
  pool,
  onEditSlide,
  onQuickInsertEntry,
}: Readonly<{
  pool: FilePoolController
  onEditSlide: (relPath: string) => void
  onQuickInsertEntry: (entry: InboxEntry) => void
}>) {
  if (pool.visibleEntries.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-xs text-slate-400">
        <p>当前目录暂无文件</p>
        <p className="mt-1 text-[11px]">支持拖入外部文件、新建文件夹或新建幻灯片伪图片</p>
      </div>
    )
  }

  return (
    <>
      {pool.visibleEntries.map((entry) => (
        <FilePoolItemRow
          key={entry.path}
          entry={entry}
          usageCount={pool.usageMap.get(entry.path)?.length ?? 0}
          onEnterFolder={(folderPath) => {
            pool.setSearchQuery('')
            pool.setCurrentFolder(folderPath)
          }}
          onRename={(item, newName) => {
            void pool.renameEntry(item, newName)
          }}
          onMoveToFolder={(sourcePath, targetFolder) => {
            void pool.moveEntryToFolder(sourcePath, targetFolder)
          }}
          onDelete={(item) => {
            void pool.deleteEntry(item)
          }}
          onEditSlide={onEditSlide}
          onQuickInsertToCanvas={onQuickInsertEntry}
        />
      ))}
    </>
  )
}

function FilePoolFooterBar({
  feedback,
  onClearFeedback,
}: Readonly<{
  feedback: string
  onClearFeedback: () => void
}>) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-[11px] text-slate-500">
      <span className="truncate">
        {feedback === '' ? '可直接拖拽文件或文件夹到画布或已有节点' : feedback}
      </span>
      {feedback !== '' && (
        <button
          type="button"
          onClick={onClearFeedback}
          className="ml-2 shrink-0 cursor-pointer text-slate-400 hover:text-slate-700"
        >
          清除
        </button>
      )}
    </div>
  )
}

/** 画布左侧常驻悬浮「文件池资源管理器」面板（手动关闭前始终保持打开） */
export function FilePoolPanel({
  pool,
  onCreateNewSlide,
  onEditSlide,
  onQuickInsertEntry,
}: Readonly<FilePoolPanelProps>) {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  if (!pool.isOpen) return null

  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 0) void pool.uploadFiles(files)
  }

  return (
    <div
      aria-label="文件池资源管理器"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onDrop={(event) => {
        const files = Array.from(event.dataTransfer.files)
        if (files.length > 0) {
          event.preventDefault()
          event.stopPropagation()
          void pool.uploadFiles(files)
        }
      }}
      className="absolute top-3 left-3 bottom-3 z-30 flex w-84 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur-md"
    >
      <FilePoolHeader
        loading={pool.loading}
        onRefresh={() => {
          void pool.refresh()
        }}
        onClose={() => {
          pool.setIsOpen(false)
        }}
      />
      <FolderBreadcrumbs
        currentFolder={pool.currentFolder}
        onSelectFolder={pool.setCurrentFolder}
        onDropEntryToFolder={(entryPath, targetFolder) => {
          void pool.moveEntryToFolder(entryPath, targetFolder)
        }}
      />
      <div className="px-3 pb-2">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="搜索文件池"
            placeholder="搜索文件名…"
            value={pool.searchQuery}
            onChange={(e) => {
              pool.setSearchQuery(e.target.value)
            }}
            className="h-7 w-full rounded-lg border border-slate-200/90 bg-slate-50/70 pr-2.5 pl-8 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:bg-white"
          />
        </div>
      </div>
      <FilePoolActionToolbar
        unusedCount={pool.unusedFilePaths.length}
        onTriggerUpload={() => {
          uploadInputRef.current?.click()
        }}
        onCreateFolder={() => {
          void pool.createFolder()
        }}
        onCreateSlide={() => {
          onCreateNewSlide(pool.currentFolder)
        }}
        onCleanupUnused={() => {
          void pool.cleanupUnusedFiles()
        }}
      />
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        <FilePoolEntryList pool={pool} onEditSlide={onEditSlide} onQuickInsertEntry={onQuickInsertEntry} />
      </div>
      <FilePoolFooterBar feedback={pool.feedback} onClearFeedback={pool.clearFeedback} />
      <input ref={uploadInputRef} type="file" multiple tabIndex={-1} aria-hidden="true" className="hidden" onChange={handleUploadChange} />
    </div>
  )
}
