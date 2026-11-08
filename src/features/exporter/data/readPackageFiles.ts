/**
 * 导出包文件读取适配器
 *
 * 把「导出文件夹」（webkitdirectory 的 FileList）或「.zip 压缩包」统一转换成
 * 「相对路径 -> Blob」映射，供 restore 流水线消费。
 */

import { unzipSync } from 'fflate'

export type PackageFileMap = Map<string, Blob>

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/^\/+/u, '')
}

function stripTopDirectory(path: string): string {
  const slashIndex = path.indexOf('/')
  return slashIndex === -1 ? path : path.slice(slashIndex + 1)
}

/** 找到 data.js 所在目录作为基准前缀（'' 表示就在根目录） */
function findDataJsBase(paths: Iterable<string>): string | null {
  let base: string | null = null
  for (const path of paths) {
    if (path === 'data.js') return ''
    if (path.endsWith('/data.js')) {
      const candidate = path.slice(0, -'data.js'.length)
      if (base === null || candidate.length < base.length) base = candidate
    }
  }
  return base
}

/** 所有文件都挤在同一个顶层文件夹下时，以该文件夹为基准前缀 */
function findSharedTopDirectory(paths: Iterable<string>): string | null {
  let top: string | null = null
  for (const path of paths) {
    const slashIndex = path.indexOf('/')
    if (slashIndex <= 0) return null
    const segment = path.slice(0, slashIndex)
    if (top === null) top = segment
    else if (segment !== top) return null
  }
  return top
}

function rebase(files: ReadonlyMap<string, Blob>, base: string): PackageFileMap {
  const rebased: PackageFileMap = new Map()
  for (const [path, blob] of files) {
    rebased.set(path.startsWith(base) ? path.slice(base.length) : path, blob)
  }
  return rebased
}

/** 剥离包裹用的外层目录，把 data.js 归位到映射根部 */
function toPackageRoot(files: Map<string, Blob>): PackageFileMap {
  const base = findDataJsBase(files.keys()) ?? findSharedTopDirectory(files.keys())
  if (base === null || base === '') return files
  return rebase(files, base)
}

/** 从导出文件夹选中的 FileList 读取（每个 File 携带 webkitRelativePath） */
export function readDirectoryFiles(files: FileList): PackageFileMap {
  const collected: PackageFileMap = new Map()
  for (let i = 0; i < files.length; i += 1) {
    const file = files.item(i)
    if (file === null) continue
    const path = normalizePath(stripTopDirectory(file.webkitRelativePath))
    if (path === '') continue
    collected.set(path, file)
  }
  return toPackageRoot(collected)
}

/** 从 .zip 压缩包读取并解压 */
export async function readZipFile(file: File): Promise<PackageFileMap> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = unzipSync(bytes)
  const collected: PackageFileMap = new Map()
  for (const [rawPath, data] of Object.entries(entries)) {
    const path = normalizePath(rawPath)
    if (path === '' || path.endsWith('/')) continue
    collected.set(path, new Blob([data]))
  }
  return toPackageRoot(collected)
}
