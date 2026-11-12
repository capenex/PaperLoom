/**
 * 本地工作区文件夹（FileSystemDirectoryHandle）双向同步、SHA-256 去重与画布轻提示总线
 *
 * 位于 shared/lib 下以便 editor（文件池、拖拽入池）与 exporter（打开文件夹、快速同步导出）共享句柄。
 */

import { buildInboxUrl, uploadBlobToInbox } from './inbox'
import type { InboxEntry } from './inbox'

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      readonly mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
}

let boundDirectoryHandle: FileSystemDirectoryHandle | null = null
const folderListeners = new Set<() => void>()
const toastListeners = new Set<(message: string) => void>()

export function getBoundDirectoryHandle(): FileSystemDirectoryHandle | null {
  return boundDirectoryHandle
}

export function setBoundDirectoryHandle(handle: FileSystemDirectoryHandle | null): void {
  boundDirectoryHandle = handle
  for (const listener of folderListeners) {
    listener()
  }
}

export function hasBoundDirectoryHandle(): boolean {
  return boundDirectoryHandle !== null
}

export function getBoundDirectoryName(): string | null {
  return boundDirectoryHandle?.name ?? null
}

export function subscribeBoundDirectory(listener: () => void): () => void {
  folderListeners.add(listener)
  return () => {
    folderListeners.delete(listener)
  }
}

export function emitCanvasToast(message: string): void {
  for (const listener of toastListeners) {
    listener(message)
  }
}

export function subscribeCanvasToast(listener: (message: string) => void): () => void {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}

/** 计算 Blob 或 ArrayBuffer 的 SHA-256 十六进制摘要 */
export async function computeBlobSha256(input: Blob | ArrayBuffer): Promise<string> {
  const buffer = input instanceof Blob ? await input.arrayBuffer() : input
  if (typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const bytes = new Uint8Array(hashBuffer)
    let hex = ''
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, '0')
    }
    return hex
  }
  // 降级簡易哈希（仅无 WebCrypto 测试环境兜底）
  const bytes = new Uint8Array(buffer)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (const byte of bytes) {
    h1 = Math.imul(h1 ^ byte, 2654435761)
    h2 = Math.imul(h2 ^ byte, 1597334677)
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

async function scanDirectoryHandleFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: Map<string, File>,
): Promise<void> {
  if (typeof dir.values !== 'function') return
  for await (const entry of dir.values()) {
    if (entry.name.startsWith('.')) continue
    const relPath = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.kind === 'file') {
      try {
        const fileHandle = await dir.getFileHandle(entry.name, { create: false })
        const file = await fileHandle.getFile()
        out.set(relPath, file)
      } catch {
        // 忽略无法读取的文件
      }
    } else if (entry.kind === 'directory') {
      try {
        const childDir = await dir.getDirectoryHandle(entry.name, { create: false })
        await scanDirectoryHandleFiles(childDir, relPath, out)
      } catch {
        // 忽略无法访问的子目录
      }
    }
  }
}

/** 递归读取已打开文件夹内的所有文件 */
export async function readFilesFromDirectoryHandle(
  root: FileSystemDirectoryHandle,
): Promise<Map<string, File>> {
  const files = new Map<string, File>()
  await scanDirectoryHandleFiles(root, '', files)
  return files
}

async function writeBlobToSubPath(
  root: FileSystemDirectoryHandle,
  relPath: string,
  content: Blob | string,
): Promise<void> {
  const segments = relPath.split('/').filter((s) => s !== '')
  const fileName = segments.at(-1)
  if (fileName === undefined) return
  let parent = root
  for (const dirName of segments.slice(0, -1)) {
    parent = await parent.getDirectoryHandle(dirName, { create: true })
  }
  const handle = await parent.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

async function ensureSubDirectory(
  root: FileSystemDirectoryHandle,
  segments: readonly string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root
  for (const seg of segments) {
    if (seg !== '') {
      current = await current.getDirectoryHandle(seg, { create: true })
    }
  }
  return current
}

async function pruneInboxDirectoryHandle(
  dir: FileSystemDirectoryHandle,
  relPrefix: string,
  expectedFilePaths: ReadonlySet<string>,
  expectedFolderPaths: ReadonlySet<string>,
): Promise<void> {
  if (typeof dir.values !== 'function') return
  const toRemove: string[] = []
  for await (const entry of dir.values()) {
    if (entry.name.startsWith('.')) continue
    const entryRel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`
    if (entry.kind === 'file') {
      if (!expectedFilePaths.has(entryRel)) {
        toRemove.push(entry.name)
      }
    } else if (entry.kind === 'directory') {
      try {
        const childDir = await dir.getDirectoryHandle(entry.name, { create: false })
        await pruneInboxDirectoryHandle(
          childDir,
          entryRel,
          expectedFilePaths,
          expectedFolderPaths,
        )
        const hasExpectedChild =
          expectedFolderPaths.has(entryRel) ||
          Array.from(expectedFilePaths).some((p) => p.startsWith(`${entryRel}/`))
        if (!hasExpectedChild) {
          toRemove.push(entry.name)
        }
      } catch {
        // ignore
      }
    }
  }
  for (const name of toRemove) {
    try {
      await dir.removeEntry(name, { recursive: true })
    } catch {
      // ignore
    }
  }
}

/**
 * 将当前文件池（res/inbox/）条目实时镜像同步到已绑定的本地文件夹 `res/inbox/` 子目录中：
 * - 通过 SHA-256 哈希比对跳过内容一致的文件，避免无意义的重复磁盘写入；
 * - 同步创建空文件夹，并删除已从文件池移除的文件/目录。
 */
export async function syncFilePoolToBoundDirectory(
  entries: readonly InboxEntry[],
): Promise<void> {
  const root = boundDirectoryHandle
  if (root === null) return
  try {
    const inboxDir = await ensureSubDirectory(root, ['res', 'inbox'])
    const localFiles = new Map<string, File>()
    await scanDirectoryHandleFiles(inboxDir, '', localFiles)

    const localHashByPath = new Map<string, string>()
    const seenHashes = new Set<string>()
    for (const [relPath, file] of localFiles) {
      const hash = await computeBlobSha256(file)
      localHashByPath.set(relPath, hash)
    }

    const expectedFilePaths = new Set<string>()
    const expectedFolderPaths = new Set<string>()

    for (const entry of entries) {
      if (entry.kind === 'folder') {
        expectedFolderPaths.add(entry.path)
        await ensureSubDirectory(inboxDir, entry.path.split('/'))
        continue
      }
      if (entry.sha256 !== undefined) {
        if (seenHashes.has(entry.sha256)) continue
        seenHashes.add(entry.sha256)
      }
      expectedFilePaths.add(entry.path)
      const existingHash = localHashByPath.get(entry.path)
      if (existingHash !== undefined && entry.sha256 !== undefined && existingHash === entry.sha256) {
        continue
      }
      const res = await fetch(buildInboxUrl(entry.path, Date.now()), { cache: 'no-store' })
      if (!res.ok) continue
      const blob = await res.blob()
      await writeBlobToSubPath(inboxDir, entry.path, blob)
    }

    await pruneInboxDirectoryHandle(inboxDir, '', expectedFilePaths, expectedFolderPaths)
  } catch {
    // 忽略用户撤销文件夹权限或瞬间锁冲突
  }
}

/**
 * 打开普通文件夹或导出包文件夹时，将本地文件夹中的文件（按 SHA-256 去重）导入到文件池 `res/inbox/`
 */
export async function importLooseFilesToInbox(
  files: ReadonlyMap<string, File>,
): Promise<void> {
  const seenHashes = new Set<string>()
  for (const [relPath, file] of files) {
    if (
      relPath === 'index.html' ||
      relPath === 'data.js' ||
      relPath.startsWith('assets/') ||
      relPath.startsWith('.')
    ) {
      continue
    }
    const hash = await computeBlobSha256(file)
    if (seenHashes.has(hash)) continue
    seenHashes.add(hash)

    const inboxRel = relPath.startsWith('res/inbox/')
      ? relPath.slice('res/inbox/'.length)
      : relPath
    const slashIdx = inboxRel.lastIndexOf('/')
    const folder = slashIdx === -1 ? '' : inboxRel.slice(0, slashIdx)
    const fileName = slashIdx === -1 ? inboxRel : inboxRel.slice(slashIdx + 1)
    await uploadBlobToInbox(file, fileName, Date.now(), folder, true, false)
  }
}
