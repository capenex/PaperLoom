import { useCallback, useState } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { writeExportToDirectory } from '../data/writeDirectory'
import { downloadExportZip } from '../data/writeZip'

export type ExportStatus = 'idle' | 'exporting' | 'success' | 'cancelled' | 'error'
export type ExportTarget = 'folder' | 'zip'

export function useExport() {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [target, setTarget] = useState<ExportTarget>('folder')
  const [message, setMessage] = useState('')

  const run = useCallback((document: PaperDocument, nextTarget: ExportTarget) => {
    setStatus('exporting')
    setTarget(nextTarget)
    setMessage('')

    const task =
      nextTarget === 'folder' ? writeExportToDirectory(document) : downloadExportZip(document)
    task
      .then(() => {
        setStatus('success')
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

  return { status, target, message, run }
}
