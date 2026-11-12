import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Check, Folder, Layers, Presentation, Search, X } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import { buildInboxUrl } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { syncFilePoolToBoundDirectory } from '@/shared/lib/workspaceFolderSync'
import {
  filterVisibleImagePoolEntries,
  resolveSelectedImageEntries,
  toggleImageSelection,
} from '../lib/filePoolImagePicker'
import { fetchInboxTree } from '../lib/inboxClient'

export type FilePoolImagePickerMode = 'replace' | 'add'

interface FilePoolImagePickerModalProps {
  readonly mode: FilePoolImagePickerMode
  readonly onConfirmEntries: (entries: readonly InboxEntry[]) => void
  readonly onClose: () => void
}

function ImageEntryThumbnail({ entry }: Readonly<{ entry: InboxEntry }>) {
  if (entry.kind === 'folder') {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">
        <Folder className="size-4 fill-amber-400/30" aria-hidden="true" />
      </div>
    )
  }
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50">
      <img
        src={buildInboxUrl(entry.path, entry.updatedAt)}
        alt={entry.name}
        className="h-full w-full object-cover"
        draggable={false}
      />
      {entry.category === 'slide' && (
        <Presentation className="absolute right-0.5 bottom-0.5 size-3 rounded bg-primary p-0.5 text-white" />
      )}
    </div>
  )
}

function ImagePickerHeader({
  mode,
  onClose,
}: Readonly<{
  mode: FilePoolImagePickerMode
  onClose: () => void
}>) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Layers className="size-3.5" aria-hidden="true" />
        </div>
        <span className="text-sm font-bold text-slate-900">
          {mode === 'replace' ? '从文件池选择替换图片' : '从文件池添加图片页'}
        </span>
      </div>
      <button
        type="button"
        aria-label="关闭图片选择窗口"
        onClick={onClose}
        className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function ImagePickerBreadcrumbBar({
  currentFolder,
  searchQuery,
  onSelectFolder,
  onSearchChange,
}: Readonly<{
  currentFolder: string
  searchQuery: string
  onSelectFolder: (folder: string) => void
  onSearchChange: (q: string) => void
}>) {
  const segments = currentFolder === '' ? [] : currentFolder.split('/')
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 bg-slate-50/70 px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs text-slate-600">
        {currentFolder !== '' && (
          <button
            type="button"
            aria-label="返回上一级"
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
          className={cn(
            'shrink-0 cursor-pointer rounded px-1.5 py-0.5 font-medium',
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
                className={cn(
                  'max-w-28 truncate cursor-pointer rounded px-1.5 py-0.5 font-medium',
                  isLast ? 'bg-primary/10 text-primary' : 'hover:bg-slate-100',
                )}
              >
                {seg}
              </button>
            </div>
          )
        })}
      </div>
      <div className="relative w-44 shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="搜索文件池图片"
          placeholder="搜索图片…"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value)
          }}
          className="h-7 w-full rounded-lg border border-slate-200 bg-white pr-2 pl-7 text-xs text-slate-800 outline-none focus:border-primary"
        />
      </div>
    </div>
  )
}

function ImageEntrySubtitle(
  entry: InboxEntry,
  mode: FilePoolImagePickerMode,
  isSearching: boolean,
): string {
  if (entry.kind === 'folder') return '点击进入文件夹'
  const kindText = entry.category === 'slide' ? '幻灯片页面' : entry.ext || '图片'
  const folderHint = isSearching ? ` · ${entry.parentPath || '根目录'}` : ''
  const actionHint = mode === 'replace' ? '点击替换当前页' : '点击勾选'
  return `${actionHint} · ${kindText}${folderHint}`
}

function ImagePickerEntryList({
  loading,
  mode,
  isSearching,
  entries,
  selectedPaths,
  onEnterFolder,
  onSelectImage,
}: Readonly<{
  loading: boolean
  mode: FilePoolImagePickerMode
  isSearching: boolean
  entries: readonly InboxEntry[]
  selectedPaths: readonly string[]
  onEnterFolder: (folderPath: string) => void
  onSelectImage: (entry: InboxEntry) => void
}>) {
  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-slate-400">
        正在读取文件池…
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-xs text-slate-400">
        <p>当前目录暂无文件池图片</p>
        <p className="mt-1 text-[11px]">请先将图片或幻灯片保存到左侧文件池中</p>
      </div>
    )
  }
  return (
    <>
      {entries.map((entry) => {
        const selectedIndex =
          mode === 'add' && entry.kind === 'file' ? selectedPaths.indexOf(entry.path) : -1
        const isSelected = selectedIndex !== -1
        return (
          <button
            key={entry.path}
            type="button"
            aria-pressed={mode === 'add' && entry.kind === 'file' ? isSelected : undefined}
            onClick={() => {
              if (entry.kind === 'folder') onEnterFolder(entry.path)
              else onSelectImage(entry)
            }}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors',
              isSelected
                ? 'border-primary bg-primary/8'
                : 'border-slate-200/70 bg-white hover:border-primary/40 hover:bg-primary/5',
            )}
          >
            <ImageEntryThumbnail entry={entry} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-800">{entry.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-400">
                {ImageEntrySubtitle(entry, mode, isSearching)}
              </div>
            </div>
            {mode === 'add' && entry.kind === 'file' && (
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                  isSelected
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-300 bg-white text-transparent',
                )}
              >
                {isSelected ? selectedIndex + 1 : <Check className="size-3" aria-hidden="true" />}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

function useImagePoolEntries() {
  const [entries, setEntries] = useState<readonly InboxEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchInboxTree()
      .then((next) => {
        if (!cancelled) {
          setEntries(next)
          void syncFilePoolToBoundDirectory(next)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { entries, loading }
}

function ImagePickerFooter({
  selectedCount,
  onClose,
  onConfirm,
}: Readonly<{
  selectedCount: number
  onClose: () => void
  onConfirm: () => void
}>) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-4 py-2.5">
      <span className="text-xs text-slate-500">
        {selectedCount > 0 ? `已选择 ${selectedCount} 张图片` : '点击图片可多选并按顺序追加'}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={onClose}>
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={selectedCount === 0}
          className="h-7 px-3 text-xs"
          onClick={onConfirm}
        >
          添加图片页{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </Button>
      </div>
    </div>
  )
}

/** 仅从文件池中选择图片或幻灯片（.slide.svg）的模态弹窗 */
export function FilePoolImagePickerModal({
  mode,
  onConfirmEntries,
  onClose,
}: Readonly<FilePoolImagePickerModalProps>) {
  const { entries, loading } = useImagePoolEntries()
  const [currentFolder, setCurrentFolder] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<readonly string[]>([])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const visibleEntries = useMemo(
    () => filterVisibleImagePoolEntries(entries, currentFolder, searchQuery),
    [entries, currentFolder, searchQuery],
  )

  return createPortal(
    <dialog
      open
      aria-modal="true"
      aria-label={mode === 'replace' ? '从文件池选择替换图片' : '从文件池添加图片页'}
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none max-h-none items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
    >
      <div className="flex max-h-130 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl">
        <ImagePickerHeader mode={mode} onClose={onClose} />
        <ImagePickerBreadcrumbBar
          currentFolder={currentFolder}
          searchQuery={searchQuery}
          onSelectFolder={(folder) => {
            setSearchQuery('')
            setCurrentFolder(folder)
          }}
          onSearchChange={setSearchQuery}
        />
        <div className="min-h-55 flex-1 space-y-1.5 overflow-y-auto p-3">
          <ImagePickerEntryList
            loading={loading}
            mode={mode}
            isSearching={searchQuery.trim() !== ''}
            entries={visibleEntries}
            selectedPaths={selectedPaths}
            onEnterFolder={(folderPath) => {
              setSearchQuery('')
              setCurrentFolder(folderPath)
            }}
            onSelectImage={(entry) => {
              if (mode === 'replace') {
                onConfirmEntries([entry])
                return
              }
              setSelectedPaths((prev) => toggleImageSelection(prev, entry.path))
            }}
          />
        </div>
        {mode === 'add' && (
          <ImagePickerFooter
            selectedCount={selectedPaths.length}
            onClose={onClose}
            onConfirm={() => {
              const selected = resolveSelectedImageEntries(entries, selectedPaths)
              if (selected.length > 0) onConfirmEntries(selected)
            }}
          />
        )}
      </div>
    </dialog>,
    document.body,
  )
}