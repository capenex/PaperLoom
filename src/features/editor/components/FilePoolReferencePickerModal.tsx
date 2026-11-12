import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUp,
  FileText,
  Folder,
  Image as ImageIcon,
  Layers,
  Presentation,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import { buildInboxUrl } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { syncFilePoolToBoundDirectory } from '@/shared/lib/workspaceFolderSync'
import { fetchInboxTree, uploadFileToInboxFolder } from '../lib/inboxClient'

interface FilePoolReferencePickerModalProps {
  readonly onSelectEntry: (entry: InboxEntry) => void
  readonly onClose: () => void
}

function isReferenceSelectableEntry(entry: InboxEntry): boolean {
  if (entry.kind === 'folder') return true
  if (entry.category === 'image' || entry.category === 'slide' || entry.category === 'reference') {
    return true
  }
  const lower = entry.ext.toLowerCase()
  return lower === '.pdf' || lower === '.html' || lower === '.htm'
}

function EntryIcon({ entry }: Readonly<{ entry: InboxEntry }>) {
  if (entry.kind === 'folder') {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">
        <Folder className="size-4 fill-amber-400/30" aria-hidden="true" />
      </div>
    )
  }
  if (entry.category === 'image' || entry.category === 'slide') {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50">
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
  if (entry.ext.toLowerCase() === '.pdf' || entry.category === 'reference') {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200/60">
        <FileText className="size-4" aria-hidden="true" />
      </div>
    )
  }
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
      <ImageIcon className="size-4" aria-hidden="true" />
    </div>
  )
}

function PickerHeader({
  onTriggerUpload,
  onClose,
}: Readonly<{
  onTriggerUpload: () => void
  onClose: () => void
}>) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Layers className="size-3.5" aria-hidden="true" />
        </div>
        <span className="text-sm font-bold text-slate-900">从文件池选择本地引用</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={onTriggerUpload}
        >
          <Upload className="size-3.5 text-primary" aria-hidden="true" />
          上传新文件到池
        </Button>
        <button
          type="button"
          aria-label="关闭选择窗口"
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function PickerBreadcrumbBar({
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
          aria-label="搜索引用文件"
          placeholder="搜索文件…"
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

function PickerEntryList({
  loading,
  entries,
  onEnterFolder,
  onSelectEntry,
}: Readonly<{
  loading: boolean
  entries: readonly InboxEntry[]
  onEnterFolder: (folderPath: string) => void
  onSelectEntry: (entry: InboxEntry) => void
}>) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-slate-400">
        正在读取文件池…
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-xs text-slate-400">
        <p>当前目录暂无可用作引用的文件</p>
        <p className="mt-1 text-[11px]">支持选择图片、幻灯片（.slide.svg）、PDF 或 HTML，也可点击右上角上传</p>
      </div>
    )
  }
  return (
    <>
      {entries.map((entry) => (
        <button
          key={entry.path}
          type="button"
          onClick={() => {
            if (entry.kind === 'folder') onEnterFolder(entry.path)
            else onSelectEntry(entry)
          }}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <EntryIcon entry={entry} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-800">{entry.name}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {entry.kind === 'folder'
                ? '点击进入文件夹'
                : `点击选择作为引用 · ${entry.ext || entry.category}`}
            </div>
          </div>
        </button>
      ))}
    </>
  )
}

function usePickerEntries() {
  const [entries, setEntries] = useState<readonly InboxEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refreshEntries = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchInboxTree()
      setEntries(next)
      void syncFilePoolToBoundDirectory(next)
    } finally {
      setLoading(false)
    }
  }, [])

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

  return { entries, loading, refreshEntries }
}

/** 从文件池选择引用文件（PDF / 图片 / 幻灯片 / HTML）的模态弹窗 */
export function FilePoolReferencePickerModal({
  onSelectEntry,
  onClose,
}: Readonly<FilePoolReferencePickerModalProps>) {
  const { entries, loading, refreshEntries } = usePickerEntries()
  const [currentFolder, setCurrentFolder] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const visibleEntries = useMemo(() => {
    const selectable = entries.filter(isReferenceSelectableEntry)
    const q = searchQuery.trim().toLowerCase()
    if (q !== '') {
      return selectable.filter((e) => e.kind === 'file' && e.name.toLowerCase().includes(q))
    }
    return selectable.filter((e) => e.parentPath === currentFolder)
  }, [entries, currentFolder, searchQuery])

  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    void (async () => {
      for (const file of files) await uploadFileToInboxFolder(file, currentFolder)
      await refreshEntries()
    })()
  }

  return createPortal(
    <dialog
      open
      aria-label="从文件池选择引用文件"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none max-h-none items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
    >
      <div className="flex max-h-[480px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl">
        <PickerHeader
          onTriggerUpload={() => {
            uploadInputRef.current?.click()
          }}
          onClose={onClose}
        />
        <PickerBreadcrumbBar
          currentFolder={currentFolder}
          searchQuery={searchQuery}
          onSelectFolder={(folder) => {
            setSearchQuery('')
            setCurrentFolder(folder)
          }}
          onSearchChange={setSearchQuery}
        />
        <div className="min-h-[220px] flex-1 space-y-1.5 overflow-y-auto p-3">
          <PickerEntryList
            loading={loading}
            entries={visibleEntries}
            onEnterFolder={(folderPath) => {
              setSearchQuery('')
              setCurrentFolder(folderPath)
            }}
            onSelectEntry={onSelectEntry}
          />
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          accept=".pdf,.html,.htm,image/*"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={handleUploadChange}
        />
      </div>
    </dialog>,
    document.body,
  )
}
