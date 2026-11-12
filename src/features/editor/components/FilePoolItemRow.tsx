import { useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import {
  Check,
  FileCode,
  FileText,
  Folder,
  Image as ImageIcon,
  Pencil,
  Presentation,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from 'cn'

import { buildInboxUrl } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import {
  hasInboxPayloadInDataTransfer,
  readDraggedInboxPayload,
  writeDraggedInboxPayload,
} from '../lib/inboxClient'

interface FilePoolItemRowProps {
  readonly entry: InboxEntry
  readonly usageCount: number
  readonly onEnterFolder: (folderPath: string) => void
  readonly onRename: (entry: InboxEntry, newName: string) => void
  readonly onMoveToFolder: (sourcePath: string, targetFolder: string) => void
  readonly onDelete: (entry: InboxEntry) => void
  readonly onEditSlide: (relPath: string) => void
  readonly onPreviewEntry: (entry: InboxEntry) => void
}

function stripKnownExtension(name: string, ext: string): string {
  if (ext !== '' && name.toLowerCase().endsWith(ext.toLowerCase())) {
    return name.slice(0, -ext.length)
  }
  return name
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function EntryThumbnail({ entry }: Readonly<{ entry: InboxEntry }>) {
  if (entry.kind === 'folder') {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">
        <Folder className="size-5 fill-amber-400/30" aria-hidden="true" />
      </div>
    )
  }
  if (entry.category === 'slide' || entry.category === 'image') {
    return (
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50">
        <img
          src={buildInboxUrl(entry.path, entry.updatedAt)}
          alt={entry.name}
          className="h-full w-full object-cover"
          draggable={false}
        />
        {entry.category === 'slide' && (
          <span className="absolute right-0.5 bottom-0.5 rounded bg-primary px-1 py-px text-[9px] leading-none font-bold text-white shadow-2xs">
            PPT
          </span>
        )}
      </div>
    )
  }
  if (entry.category === 'reference') {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200/60">
        <FileText className="size-5" aria-hidden="true" />
      </div>
    )
  }
  if (entry.category === 'document') {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/60">
        <FileCode className="size-5" aria-hidden="true" />
      </div>
    )
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
      <ImageIcon className="size-5" aria-hidden="true" />
    </div>
  )
}

function InlineRenameForm({
  initialStem,
  ext,
  onCommit,
  onCancel,
}: Readonly<{
  initialStem: string
  ext: string
  onCommit: (nextStem: string) => void
  onCancel: () => void
}>) {
  const [draft, setDraft] = useState(initialStem)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        type="text"
        aria-label="重命名文件"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(draft)
          if (e.key === 'Escape') onCancel()
        }}
        className="h-6 min-w-0 flex-1 rounded border border-primary/50 bg-white px-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-primary/30"
      />
      {ext !== '' && <span className="shrink-0 text-[11px] text-slate-400">{ext}</span>}
      <button
        type="button"
        aria-label="确认重命名"
        onClick={() => {
          onCommit(draft)
        }}
        className="cursor-pointer rounded p-1 text-emerald-600 hover:bg-emerald-50"
      >
        <Check className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="取消重命名"
        onClick={onCancel}
        className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function EntryActionButtons({
  entry,
  onEditSlide,
  onStartRename,
  onDelete,
}: Readonly<{
  entry: InboxEntry
  onEditSlide: (relPath: string) => void
  onStartRename: () => void
  onDelete: (entry: InboxEntry) => void
}>) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {entry.category === 'slide' && (
        <button
          type="button"
          aria-label={`编辑幻灯片 ${entry.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onEditSlide(entry.path)
          }}
          className="cursor-pointer rounded-md p-1.5 text-primary hover:bg-primary/10"
        >
          <Presentation className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        aria-label={`重命名 ${entry.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onStartRename()
        }}
        className="cursor-pointer rounded-md p-1.5 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`删除 ${entry.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onDelete(entry)
        }}
        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function EntryInfoBlock({
  entry,
  usageCount,
}: Readonly<{
  entry: InboxEntry
  usageCount: number
}>) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-xs font-medium text-slate-800">{entry.name}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
        {entry.kind === 'folder' ? (
          <span>双击打开 · 可拖入文件</span>
        ) : (
          <>
            <span>{formatByteSize(entry.size)}</span>
            <span
              className={cn(
                'inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium',
                usageCount > 0
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                  : 'bg-slate-100 text-slate-500',
              )}
            >
              {usageCount > 0 ? `已用 ${usageCount}` : '未用'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export function FilePoolItemRow({
  entry,
  usageCount,
  onEnterFolder,
  onRename,
  onMoveToFolder,
  onDelete,
  onEditSlide,
  onPreviewEntry,
}: Readonly<FilePoolItemRowProps>) {
  const [renaming, setRenaming] = useState(false)
  const [folderDragOver, setFolderDragOver] = useState(false)

  const handleFolderDragOver = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (entry.kind !== 'folder' || !hasInboxPayloadInDataTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    setFolderDragOver(true)
  }

  const handleFolderDrop = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (entry.kind !== 'folder') return
    setFolderDragOver(false)
    const payload = readDraggedInboxPayload(event.dataTransfer)
    if (payload === null || payload.path === entry.path) return
    event.preventDefault()
    event.stopPropagation()
    onMoveToFolder(payload.path, entry.path)
  }

  return (
    <div
      draggable={!renaming}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copyMove'
        writeDraggedInboxPayload(event.dataTransfer, entry)
      }}
      onDragOver={handleFolderDragOver}
      onDragLeave={() => {
        setFolderDragOver(false)
      }}
      onDrop={handleFolderDrop}
      onDoubleClick={() => {
        if (renaming) return
        if (entry.kind === 'folder') onEnterFolder(entry.path)
        else onPreviewEntry(entry)
      }}
      className={cn(
        'group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors select-none',
        folderDragOver
          ? 'border-primary bg-primary/10'
          : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/80',
      )}
    >
      <EntryThumbnail entry={entry} />
      {renaming ? (
        <InlineRenameForm
          initialStem={stripKnownExtension(entry.name, entry.ext)}
          ext={entry.kind === 'folder' ? '' : entry.ext}
          onCommit={(nextStem) => {
            setRenaming(false)
            onRename(entry, nextStem)
          }}
          onCancel={() => {
            setRenaming(false)
          }}
        />
      ) : (
        <>
          <EntryInfoBlock entry={entry} usageCount={usageCount} />
          <EntryActionButtons
            entry={entry}
            onEditSlide={onEditSlide}
            onStartRename={() => {
              setRenaming(true)
            }}
            onDelete={onDelete}
          />
        </>
      )}
    </div>
  )
}
