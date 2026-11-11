import type { PaperDocument } from '@/shared/types/paper'
import { createExportFiles } from './generate'

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      readonly mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
}

let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null

export function hasCachedExportDirectory(): boolean {
  return cachedDirectoryHandle !== null
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

async function resolveExistingSubDir(
  root: FileSystemDirectoryHandle,
  segments: readonly string[],
): Promise<FileSystemDirectoryHandle | null> {
  let current = root
  for (const seg of segments) {
    try {
      current = await current.getDirectoryHandle(seg, { create: false })
    } catch {
      return null
    }
  }
  return current
}

async function pruneManagedSubtree(
  dir: FileSystemDirectoryHandle,
  relPrefix: string,
  expectedPaths: ReadonlySet<string>,
): Promise<boolean> {
  if (typeof dir.values !== 'function') return true
  const toRemove: string[] = []
  let hasRemaining = false

  for await (const entry of dir.values()) {
    const entryPath = `${relPrefix}/${entry.name}`
    if (entry.kind === 'file') {
      if (expectedPaths.has(entryPath)) {
        hasRemaining = true
      } else {
        toRemove.push(entry.name)
      }
    } else if (entry.kind === 'directory') {
      try {
        const childDir = await dir.getDirectoryHandle(entry.name, {
          create: false,
        })
        const childHasRemaining = await pruneManagedSubtree(childDir, entryPath, expectedPaths)
        if (childHasRemaining) {
          hasRemaining = true
        } else {
          toRemove.push(entry.name)
        }
      } catch {
        // 忽略无法访问的子目录
      }
    }
  }

  for (const name of toRemove) {
    try {
      await dir.removeEntry(name, { recursive: true })
    } catch {
      // 忽略清理失败项
    }
  }
  return hasRemaining
}

const MANAGED_EXPORT_SUBDIRS: readonly (readonly string[])[] = [
  ['res', 'inbox'],
  ['assets', 'media'],
  ['assets', 'refs'],
  ['assets', 'pdfjs'],
]

async function cleanupOrphanedExportAssets(
  root: FileSystemDirectoryHandle,
  expectedPaths: ReadonlySet<string>,
): Promise<void> {
  for (const segments of MANAGED_EXPORT_SUBDIRS) {
    const subDir = await resolveExistingSubDir(root, segments)
    if (subDir !== null) {
      await pruneManagedSubtree(subDir, segments.join('/'), expectedPaths)
    }
  }
}

async function pickOrReuseDirectory(reuseCached: boolean): Promise<FileSystemDirectoryHandle> {
  if (reuseCached && cachedDirectoryHandle !== null) {
    return cachedDirectoryHandle
  }
  const picker = window.showDirectoryPicker
  if (picker === undefined) {
    throw new Error('当前浏览器不支持写入文件夹，请使用最新版 Chrome 或 Edge')
  }
  const root = await picker({ mode: 'readwrite' })
  cachedDirectoryHandle = root
  return root
}

/** 让用户选择目标文件夹（或复用上次选择的文件夹），清理废弃旧资源并写入完整静态演示包 */
export async function writeExportToDirectory(
  document: PaperDocument,
  reuseCached = false,
): Promise<void> {
  const root = await pickOrReuseDirectory(reuseCached)
  const files = await createExportFiles(document)
  const expectedPaths = new Set(files.map((item) => item.path))

  await cleanupOrphanedExportAssets(root, expectedPaths)

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
