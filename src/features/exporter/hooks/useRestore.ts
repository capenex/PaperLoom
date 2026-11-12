import { useCallback, useState } from 'react'

import { parseProjectFile } from '@/shared/lib/projectFile'
import {
  importLooseFilesToInbox,
  readFilesFromDirectoryHandle,
  setBoundDirectoryHandle,
} from '@/shared/lib/workspaceFolderSync'
import type { PaperDocument } from '@/shared/types/paper'
import { readDirectoryFiles, readZipFile } from '../data/readPackageFiles'
import { restoreProjectFromPackage } from '../data/restore'
import { writeExportToDirectory } from '../data/writeDirectory'

export type RestoreStatus = 'idle' | 'restoring' | 'success' | 'error'

async function executeOpenWorkspaceFolder(
  currentDoc: PaperDocument,
  onRestore: (document: PaperDocument) => void,
  setStatus: (status: RestoreStatus) => void,
  setMessage: (message: string) => void,
  onRefreshFilePool?: () => Promise<void>,
): Promise<'handled' | 'fallback-input'> {
  const picker = window.showDirectoryPicker
  if (picker === undefined) return 'fallback-input'
  try {
    const root = await picker({ mode: 'readwrite' })
    setBoundDirectoryHandle(root)
    setStatus('restoring')
    setMessage('')
    const files = await readFilesFromDirectoryHandle(root)
    if (files.has('data.js') || files.has('project.json')) {
      const restoredDoc = await restoreProjectFromPackage(files)
      onRestore(restoredDoc)
    } else {
      await importLooseFilesToInbox(files)
      await writeExportToDirectory(currentDoc, true)
    }
    if (onRefreshFilePool !== undefined) await onRefreshFilePool()
    setStatus('success')
    setMessage('已打开文件夹并建立双向同步（后续修改将直接写入该文件夹）')
    return 'handled'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'handled'
    setStatus('error')
    setMessage(error instanceof Error ? error.message : '打开文件夹失败')
    return 'handled'
  }
}

/** 打开本地文件夹或复原工程：绑定本地目录句柄并保持画布与文件池实时同步 */
export function useRestore(onRestore: (document: PaperDocument) => void) {
  const [status, setStatus] = useState<RestoreStatus>('idle')
  const [message, setMessage] = useState('')

  const dismiss = useCallback(() => {
    setStatus('idle')
    setMessage('')
  }, [])

  const start = useCallback(
    (files: ReadonlyMap<string, Blob | string>) => {
      setStatus('restoring')
      setMessage('')
      restoreProjectFromPackage(files)
        .then((restoredDocument) => {
          onRestore(restoredDocument)
          setStatus('success')
          setMessage('工程已打开并写入 project.json')
        })
        .catch((error: unknown) => {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : '打开工程失败')
        })
    },
    [onRestore],
  )

  const openWorkspaceFolder = useCallback(
    (
      currentDoc: PaperDocument,
      onRefreshFilePool?: () => Promise<void>,
    ): Promise<'handled' | 'fallback-input'> =>
      executeOpenWorkspaceFolder(currentDoc, onRestore, setStatus, setMessage, onRefreshFilePool),
    [onRestore],
  )

  const restoreFromFolder = useCallback(
    (files: FileList) => {
      start(readDirectoryFiles(files))
    },
    [start],
  )

  const restoreFromZip = useCallback(
    (file: File) => {
      setStatus('restoring')
      setMessage('')
      readZipFile(file)
        .then(start)
        .catch((error: unknown) => {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : '读取 .zip 压缩包失败')
        })
    },
    [start],
  )

  const restoreFromBackup = useCallback(() => {
    setStatus('restoring')
    setMessage('')
    fetch('/api/project/backup', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('未找到可用的备份文件（project.json.bak）')
        const raw = await res.text()
        const parsed = parseProjectFile(raw)
        if (!parsed.ok) throw new Error(`备份文件校验失败：${parsed.reason}`)
        onRestore(parsed.project.document)
        setStatus('success')
        setMessage('已从上次备份（project.json.bak）恢复工程')
      })
      .catch((error: unknown) => {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : '从备份恢复失败')
      })
  }, [onRestore])

  return {
    status,
    message,
    openWorkspaceFolder,
    restoreFromFolder,
    restoreFromZip,
    restoreFromBackup,
    dismiss,
  }
}
