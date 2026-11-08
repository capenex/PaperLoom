import { useCallback, useState } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { readDirectoryFiles, readZipFile } from '../data/readPackageFiles'
import { restoreProjectFromPackage } from '../data/restore'

export type RestoreStatus = 'idle' | 'restoring' | 'success' | 'error'

/** 复原工程：读取导出包（文件夹或 .zip），还原资源并整体替换当前画布 */
export function useRestore(onRestore: (document: PaperDocument) => void) {
  const [status, setStatus] = useState<RestoreStatus>('idle')
  const [message, setMessage] = useState('')

  const start = useCallback(
    (files: ReadonlyMap<string, Blob | string>) => {
      setStatus('restoring')
      setMessage('')
      restoreProjectFromPackage(files)
        .then((restoredDocument) => {
          onRestore(restoredDocument)
          setStatus('success')
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

  return { status, message, restoreFromFolder, restoreFromZip }
}
