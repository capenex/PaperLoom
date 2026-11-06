import { Check, Download, Loader2, TriangleAlert } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import type { PaperDocument } from '@/shared/types/paper'
import { useExport } from '../hooks/useExport'
import type { ExportStatus } from '../hooks/useExport'

function statusLabel(status: ExportStatus): string {
  if (status === 'exporting') return '正在导出'
  if (status === 'success') return '已导出'
  if (status === 'error') return '重试导出'
  return '导出到文件夹'
}

function StatusIcon({ status }: Readonly<{ status: ExportStatus }>) {
  if (status === 'exporting') return <Loader2 className="animate-spin" aria-hidden="true" />
  if (status === 'success') return <Check aria-hidden="true" />
  if (status === 'error') return <TriangleAlert aria-hidden="true" />
  return <Download aria-hidden="true" />
}

export function ExportButton({ document }: Readonly<{ document: PaperDocument }>) {
  const { status, message, run } = useExport()

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        className="w-full"
        disabled={status === 'exporting'}
        title={message}
        onClick={() => {
          run(document)
        }}
      >
        <StatusIcon status={status} />
        {statusLabel(status)}
      </Button>
      {status === 'error' && message !== '' && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600">
          {message}
        </p>
      )}
      {status === 'success' && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          文件夹内双击 index.html 即可离线展示
        </p>
      )}
    </div>
  )
}
