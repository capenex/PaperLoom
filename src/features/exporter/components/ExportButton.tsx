import { Check, Download, FileArchive, Loader2, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import type { PaperDocument } from '@/shared/types/paper'
import { useExport } from '../hooks/useExport'
import type { ExportStatus } from '../hooks/useExport'

function StatusIcon({ status, idle: Idle }: Readonly<{ status: ExportStatus; idle: LucideIcon }>) {
  if (status === 'exporting') return <Loader2 className="animate-spin" aria-hidden="true" />
  if (status === 'success') return <Check aria-hidden="true" />
  if (status === 'error') return <TriangleAlert aria-hidden="true" />
  return <Idle aria-hidden="true" />
}

function ExportHint({ status, message }: Readonly<{ status: ExportStatus; message: string }>) {
  if (status === 'error' && message !== '') {
    return (
      <p className="absolute top-full right-0 z-30 mt-1.5 w-72 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600 shadow-md">
        {message}
      </p>
    )
  }
  if (status === 'cancelled') {
    return (
      <p className="absolute top-full right-0 z-30 mt-1.5 w-72 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 shadow-md">
        已取消：未选定文件夹或未允许写入（系统文件夹会被浏览器拦截），可换个文件夹或改用下载 zip
      </p>
    )
  }
  return null
}

export function ExportButton({ document }: Readonly<{ document: PaperDocument }>) {
  const { status, target, message, run } = useExport()
  const busy = status === 'exporting'

  return (
    <div className="relative flex items-center gap-1.5">
      <Button
        size="xs"
        disabled={busy}
        title="选择一个文件夹（如 U 盘）写入离线演示包，双击其中的 index.html 即可展示"
        onClick={() => {
          run(document, 'folder')
        }}
      >
        <StatusIcon status={target === 'folder' ? status : 'idle'} idle={Download} />
        导出文件夹
      </Button>
      <Button
        size="xs"
        variant="secondary"
        disabled={busy}
        title="打包成 .zip 下载，不需要文件夹授权；解压后双击 index.html 即可展示"
        onClick={() => {
          run(document, 'zip')
        }}
      >
        <StatusIcon status={target === 'zip' ? status : 'idle'} idle={FileArchive} />
        下载 zip
      </Button>
      <ExportHint status={status} message={message} />
    </div>
  )
}
