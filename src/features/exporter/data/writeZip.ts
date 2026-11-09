import { strToU8, zipSync } from 'fflate'

import type { PaperDocument } from '@/shared/types/paper'
import { createExportFiles } from './generate'

function zipFileName(title: string): string {
  const safe = title.trim().replaceAll(/[\\/:*?"<>|]/gu, '_')
  return `${safe === '' ? 'PaperLoom' : safe}.zip`
}

/** 打包成 .zip 并触发下载，不依赖文件夹写入授权；与「zip 复原」互为往返 */
export async function downloadExportZip(document: PaperDocument): Promise<void> {
  const files = await createExportFiles(document)
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    entries[file.path] =
      typeof file.content === 'string'
        ? strToU8(file.content)
        : new Uint8Array(await file.content.arrayBuffer())
  }
  const zipped = zipSync(entries, { level: 6 })
  const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }))
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = zipFileName(document.meta.title)
  anchor.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}
