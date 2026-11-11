import { useCallback, useState } from 'react'

import { parseProjectFile } from '@/shared/lib/projectFile'
import type { PaperDocument } from '@/shared/types/paper'
import { readDirectoryFiles, readZipFile } from '../data/readPackageFiles'
import { restoreProjectFromPackage } from '../data/restore'

export type RestoreStatus = 'idle' | 'restoring' | 'success' | 'error'

/** 复原工程：读取导出包（文件夹 / .zip / .bak 备份），还原资源并整体替换当前画布 */
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
          setMessage('工程已复原并写入 project.json')
        })
        .catch((error: unknown) => {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : '复原工程失败')
        })
    },
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

  return { status, message, restoreFromFolder, restoreFromZip, restoreFromBackup, dismiss }
}
