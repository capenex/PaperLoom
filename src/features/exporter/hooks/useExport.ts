import { useCallback, useState } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { writeExportToDirectory } from '../data/writeDirectory'

export type ExportStatus = 'idle' | 'exporting' | 'success' | 'error'

export function useExport() {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [message, setMessage] = useState('')

  const run = useCallback((document: PaperDocument) => {
    setStatus('exporting')
    setMessage('')

    writeExportToDirectory(document)
      .then(() => {
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus('idle')
          return
        }
        setStatus('error')
        setMessage(error instanceof Error ? error.message : '导出失败')
      })
  }, [])

  return { status, message, run }
}
