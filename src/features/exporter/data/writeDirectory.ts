import type { PaperDocument } from '@/shared/types/paper'
import { createExportFiles } from './generate'

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      readonly mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
}

async function writeFile(
  parent: FileSystemDirectoryHandle,
  name: string,
  content: string | Blob,
): Promise<void> {
  const handle = await parent.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

/** 让用户选择目标文件夹（如 U 盘），直接写入完整静态演示包 */
export async function writeExportToDirectory(document: PaperDocument): Promise<void> {
  const picker = window.showDirectoryPicker
  if (picker === undefined) {
    throw new Error('当前浏览器不支持写入文件夹，请使用最新版 Chrome 或 Edge')
  }

  const root = await picker({ mode: 'readwrite' })
  const files = await createExportFiles(document)

  for (const file of files) {
    const segments = file.path.split('/')
    const fileName = segments.at(-1)
    if (fileName === undefined) continue

    let parent = root
    for (const directoryName of segments.slice(0, -1)) {
      parent = await parent.getDirectoryHandle(directoryName, { create: true })
    }
    await writeFile(parent, fileName, file.content)
  }
}
