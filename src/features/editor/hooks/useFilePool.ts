import { useCallback, useEffect, useMemo, useState } from 'react'

import { sanitizeInboxSegment } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import {
  collectDocumentInboxUsage,
  rewriteDocumentInboxPaths,
} from '@/shared/lib/inboxReferences'
import type { NodeId, PaperDocument } from '@/shared/types/paper'
import {
  createInboxFolder,
  deleteInboxEntries,
  fetchInboxTree,
  moveInboxEntry,
  uploadFileToInboxFolder,
} from '../lib/inboxClient'

export interface FilePoolController {
  readonly isOpen: boolean
  readonly setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  readonly currentFolder: string
  readonly setCurrentFolder: (folder: string) => void
  readonly searchQuery: string
  readonly setSearchQuery: (query: string) => void
  readonly entries: readonly InboxEntry[]
  readonly visibleEntries: readonly InboxEntry[]
  readonly usageMap: ReadonlyMap<string, readonly NodeId[]>
  readonly unusedFilePaths: readonly string[]
  readonly loading: boolean
  readonly feedback: string
  readonly clearFeedback: () => void
  readonly refresh: () => Promise<void>
  readonly uploadFiles: (files: readonly File[]) => Promise<void>
  readonly createFolder: (name?: string) => Promise<string | null>
  readonly renameEntry: (entry: InboxEntry, newName: string) => Promise<void>
  readonly moveEntryToFolder: (entryPath: string, targetFolder: string) => Promise<void>
  readonly deleteEntry: (entry: InboxEntry) => Promise<void>
  readonly cleanupUnusedFiles: () => Promise<void>
}

function buildRenamedPath(oldPath: string, newBaseName: string, oldExt: string): string | null {
  const trimmed = sanitizeInboxSegment(newBaseName)
  if (trimmed === '') return null
  const finalName =
    oldExt !== '' && !trimmed.toLowerCase().endsWith(oldExt.toLowerCase())
      ? `${trimmed}${oldExt}`
      : trimmed
  const slashIdx = oldPath.lastIndexOf('/')
  return slashIdx === -1 ? finalName : `${oldPath.slice(0, slashIdx)}/${finalName}`
}

interface PoolMutationDeps {
  readonly document: PaperDocument
  readonly currentFolder: string
  readonly unusedFilePaths: readonly string[]
  readonly setCurrentFolder: (folder: string) => void
  readonly setLoading: (loading: boolean) => void
  readonly setFeedback: (feedback: string) => void
  readonly refresh: () => Promise<void>
  readonly onReplaceDocument: (next: PaperDocument) => void
}

async function moveAndRewriteInboxPath(
  fromPath: string,
  toPath: string,
  document: PaperDocument,
  onReplaceDocument: (next: PaperDocument) => void,
  refresh: () => Promise<void>,
): Promise<void> {
  await moveInboxEntry(fromPath, toPath)
  const updatedDoc = rewriteDocumentInboxPaths(document, fromPath, toPath)
  if (updatedDoc !== document) onReplaceDocument(updatedDoc)
  await refresh()
}

function useFilePoolMutations(deps: Readonly<PoolMutationDeps>) {
  const { document, currentFolder, unusedFilePaths, setCurrentFolder, setLoading, setFeedback, refresh, onReplaceDocument } = deps

  const uploadFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return
      setLoading(true)
      try {
        for (const file of files) await uploadFileToInboxFolder(file, currentFolder)
        await refresh()
        setFeedback(`已上传 ${files.length} 个文件`)
      } catch {
        setFeedback('上传文件失败')
      } finally {
        setLoading(false)
      }
    },
    [currentFolder, refresh, setFeedback, setLoading],
  )

  const createFolder = useCallback(
    async (name = '新建文件夹'): Promise<string | null> => {
      try {
        const createdPath = await createInboxFolder(currentFolder, name)
        await refresh()
        setFeedback('已创建文件夹')
        return createdPath
      } catch {
        setFeedback('创建文件夹失败')
        return null
      }
    },
    [currentFolder, refresh, setFeedback],
  )

  const renameEntry = useCallback(
    async (entry: InboxEntry, newName: string) => {
      const nextPath = buildRenamedPath(entry.path, newName, entry.kind === 'folder' ? '' : entry.ext)
      if (nextPath === null || nextPath === entry.path) return
      try {
        await moveAndRewriteInboxPath(entry.path, nextPath, document, onReplaceDocument, refresh)
        setFeedback('已重命名并同步更新画布引用')
      } catch {
        setFeedback('重命名失败')
      }
    },
    [document, onReplaceDocument, refresh, setFeedback],
  )

  const moveEntryToFolder = useCallback(
    async (entryPath: string, targetFolder: string) => {
      const baseName = entryPath.slice(entryPath.lastIndexOf('/') + 1)
      const nextPath = targetFolder === '' ? baseName : `${targetFolder}/${baseName}`
      if (nextPath === entryPath || nextPath.startsWith(`${entryPath}/`)) return
      try {
        await moveAndRewriteInboxPath(entryPath, nextPath, document, onReplaceDocument, refresh)
        setFeedback('已移动文件并同步更新引用')
      } catch {
        setFeedback('移动失败')
      }
    },
    [document, onReplaceDocument, refresh, setFeedback],
  )

  const deleteEntry = useCallback(
    async (entry: InboxEntry) => {
      try {
        await deleteInboxEntries([entry.path])
        if (currentFolder === entry.path || currentFolder.startsWith(`${entry.path}/`)) setCurrentFolder(entry.parentPath)
        await refresh()
        setFeedback(`已删除 ${entry.name}`)
      } catch {
        setFeedback('删除失败')
      }
    },
    [currentFolder, refresh, setCurrentFolder, setFeedback],
  )

  const cleanupUnusedFiles = useCallback(async () => {
    if (unusedFilePaths.length === 0) {
      setFeedback('没有未使用的冗余文件')
      return
    }
    try {
      const count = await deleteInboxEntries(unusedFilePaths)
      await refresh()
      setFeedback(`已清理 ${count} 个未使用文件`)
    } catch {
      setFeedback('清理未使用文件失败')
    }
  }, [unusedFilePaths, refresh, setFeedback])

  return { uploadFiles, createFolder, renameEntry, moveEntryToFolder, deleteEntry, cleanupUnusedFiles }
}

export function useFilePool(
  document: PaperDocument,
  onReplaceDocument: (next: PaperDocument) => void,
): FilePoolController {
  const [isOpen, setIsOpenState] = useState(false)
  const [currentFolder, setCurrentFolder] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [entries, setEntries] = useState<readonly InboxEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const clearFeedback = useCallback(() => {
    setFeedback('')
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const nextEntries = await fetchInboxTree()
      setEntries(nextEntries)
    } catch {
      setFeedback('读取文件池失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchInboxTree()
      .then((nextEntries) => {
        if (!cancelled) setEntries(nextEntries)
      })
      .catch(() => {
        if (!cancelled) setFeedback('读取文件池失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setIsOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setIsOpenState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        if (resolved && !prev) void refresh()
        return resolved
      })
    },
    [refresh],
  )

  const usageMap = useMemo(() => collectDocumentInboxUsage(document), [document])
  const unusedFilePaths = useMemo(
    () =>
      entries
        .filter((item) => item.kind === 'file' && (usageMap.get(item.path)?.length ?? 0) === 0)
        .map((item) => item.path),
    [entries, usageMap],
  )

  const visibleEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (query !== '') return entries.filter((item) => item.name.toLowerCase().includes(query))
    return entries.filter((item) => item.parentPath === currentFolder)
  }, [entries, currentFolder, searchQuery])

  const mutations = useFilePoolMutations({
    document,
    currentFolder,
    unusedFilePaths,
    setCurrentFolder,
    setLoading,
    setFeedback,
    refresh,
    onReplaceDocument,
  })

  return {
    isOpen,
    setIsOpen,
    currentFolder,
    setCurrentFolder,
    searchQuery,
    setSearchQuery,
    entries,
    visibleEntries,
    usageMap,
    unusedFilePaths,
    loading,
    feedback,
    clearFeedback,
    refresh,
    ...mutations,
  }
}
