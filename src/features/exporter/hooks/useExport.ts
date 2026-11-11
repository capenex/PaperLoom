import { useCallback, useState } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { hasCachedExportDirectory, writeExportToDirectory } from '../data/writeDirectory'
import { downloadExportZip } from '../data/writeZip'

export type ExportStatus = 'idle' | 'exporting' | 'success' | 'cancelled' | 'error'
export type ExportTarget = 'folder' | 'quick-folder' | 'zip'

export function useExport() {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [target, setTarget] = useState<ExportTarget>('folder')
  const [message, setMessage] = useState('')
  const [canQuickSync, setCanQuickSync] = useState(hasCachedExportDirectory)

  const dismiss = useCallback(() => {
    setStatus('idle')
    setMessage('')
  }, [])

  const run = useCallback((document: PaperDocument, nextTarget: ExportTarget) => {
    setStatus('exporting')
    setTarget(nextTarget)
    setMessage('')

    const task =
      nextTarget === 'zip'
        ? downloadExportZip(document)
        : writeExportToDirectory(document, nextTarget === 'quick-folder')
    task
      .then(() => {
        setCanQuickSync(hasCachedExportDirectory())
        setStatus('success')
        setMessage(
          nextTarget === 'zip'
            ? '已生成并开始下载 zip 导出包'
            : '已成功导出到目标文件夹（旧冗余资源已自动清理）',
        )
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus('cancelled')
          return
        }
        setStatus('error')
        setMessage(error instanceof Error ? error.message : '导出失败')
      })
  }, [])

  return { status, target, message, canQuickSync, run, dismiss }
}
