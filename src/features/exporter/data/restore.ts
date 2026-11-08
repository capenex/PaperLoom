/**
 * 导出包解析与复原流水线
 *
 * 把离线演示包（data.js + res/inbox/ + assets/）还原为可再次编辑的工程：
 * 资源字节重新落盘到 res/inbox/，文档内的路径改写为新的持久化地址。
 * 输入是抽象的「相对路径 -> 字节」映射，来源（文件夹 / .zip）由 readPackageFiles 负责。
 */

import { uploadBlobToInbox } from '@/shared/lib/inbox'
import { parseProjectFile } from '@/shared/lib/projectFile'
import { REFERENCE_KIND_ATTR, REFERENCE_PREVIEW_ATTR } from '@/shared/lib/reference'
import { PAPERLOOM_GLOBAL_KEY } from '@/shared/types/export'
import type { PaperDocument, PaperNode } from '@/shared/types/paper'
import { PROJECT_FORMAT_VERSION } from '@/shared/types/project'

export interface InlinePdfEntry {
  readonly key: string
  readonly base64: string
}

const DATA_JS_PREFIX = `window.${PAPERLOOM_GLOBAL_KEY} =`

const ASSET_PATH_PREFIXES: readonly string[] = ['res/inbox/', 'assets/media/', 'assets/refs/']

const PDF_BYTES_PATH_PREFIX = 'assets/refs/'

const RESTORE_MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.pdf': 'application/pdf',
}

const INLINE_PDF_ENTRY_PATTERN = /\[("(?:[^"\\]|\\.)*")\]\s*=\s*("(?:[^"\\]|\\.)*")/gu

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extensionOf(path: string): string {
  const dotIndex = path.lastIndexOf('.')
  return dotIndex === -1 ? '' : path.slice(dotIndex).toLowerCase()
}

/** 解析 data.js 文本，校验并还原出合法的 PaperDocument */
export function parseDataJsDocument(script: string): PaperDocument {
  const trimmed = script.trim()
  if (!trimmed.startsWith(DATA_JS_PREFIX)) {
    throw new Error('data.js 缺少 window.PAPERLOOM_DATA 赋值，不是有效的导出包')
  }
  const jsonText = trimmed.slice(DATA_JS_PREFIX.length).replace(/;\s*$/u, '').trim()
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('data.js 内容不是合法 JSON')
  }
  if (!isRecord(raw) || raw.document === undefined) {
    throw new Error('data.js 缺少 document 字段')
  }
  // parseProjectFile 校验的是工程文件信封；data.js 只带 document，补上格式版本后复用同一套校验
  const result = parseProjectFile(
    JSON.stringify({ formatVersion: PROJECT_FORMAT_VERSION, document: raw.document }),
  )
  if (!result.ok) {
    throw new Error(`data.js 文档校验失败：${result.reason}`)
  }
  return result.project.document
}

/** 从 .pdf.js 内联脚本中提取「资源键 -> base64」条目 */
export function extractInlinePdfEntries(script: string): readonly InlinePdfEntry[] {
  const entries: InlinePdfEntry[] = []
  for (const match of script.matchAll(INLINE_PDF_ENTRY_PATTERN)) {
    const keyJson = match[1]
    const base64Json = match[2]
    if (keyJson === undefined || base64Json === undefined) continue
    const key: unknown = JSON.parse(keyJson)
    const base64: unknown = JSON.parse(base64Json)
    if (typeof key !== 'string' || typeof base64 !== 'string') continue
    entries.push({ key, base64 })
  }
  return entries
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/** 导出包里的资源可能类型不全，按扩展名补回正确 MIME，避免后续导出 requireExtension 报错 */
async function toTypedBlob(value: Blob | string, path: string): Promise<Blob> {
  const mime = RESTORE_MIME_BY_EXT[extensionOf(path)]
  const blob = typeof value === 'string' ? new Blob([value]) : value
  if (mime === undefined || blob.type === mime) return blob
  return new Blob([await blob.arrayBuffer()], { type: mime })
}

function isPlainAssetPath(path: string): boolean {
  if (path.endsWith('.pdf.js')) return false
  return ASSET_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/** 普通文件资源（图片 / HTML / 直存的 PDF）全部重新落盘到 res/inbox/ */
async function restorePlainAssets(
  files: ReadonlyMap<string, Blob | string>,
  pathBySource: Map<string, string>,
): Promise<void> {
  for (const [path, value] of files) {
    if (!isPlainAssetPath(path)) continue
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const newSrc = await uploadBlobToInbox(await toTypedBlob(value, path), fileName)
    pathBySource.set(path, newSrc)
    pathBySource.set(`./${path}`, newSrc)
  }
}

/** .pdf.js 里的 PDF 字节是 base64 内联的，解码后作为 application/pdf 落盘 */
async function restoreInlinePdfs(
  files: ReadonlyMap<string, Blob | string>,
  pathBySource: Map<string, string>,
): Promise<void> {
  for (const [path, value] of files) {
    if (!path.startsWith(PDF_BYTES_PATH_PREFIX) || !path.endsWith('.pdf.js')) continue
    const script = typeof value === 'string' ? value : await value.text()
    for (const entry of extractInlinePdfEntries(script)) {
      const pdfBlob = new Blob([base64ToBytes(entry.base64)], { type: 'application/pdf' })
      pathBySource.set(entry.key, await uploadBlobToInbox(pdfBlob, 'restored.pdf'))
    }
  }
}

function rewriteRichTextPaths(
  richText: string,
  pathBySource: ReadonlyMap<string, string>,
): string | null {
  const parsed = new DOMParser().parseFromString(richText, 'text/html')
  const anchors = parsed.querySelectorAll(`a[${REFERENCE_KIND_ATTR}]`)
  if (anchors.length === 0) return null

  let changed = false
  anchors.forEach((anchor) => {
    for (const attribute of ['href', REFERENCE_PREVIEW_ATTR]) {
      const source = anchor.getAttribute(attribute)
      const mapped = source === null ? undefined : pathBySource.get(source)
      if (mapped === undefined) continue
      anchor.setAttribute(attribute, mapped)
      changed = true
    }
  })
  return changed ? parsed.body.innerHTML : null
}

function rewriteNodeSource(node: PaperNode, pathBySource: ReadonlyMap<string, string>): PaperNode {
  if (node.content.kind === 'image') {
    const mapped = pathBySource.get(node.content.src)
    if (mapped === undefined) return node
    return { ...node, content: { ...node.content, src: mapped } }
  }
  if (node.content.kind === 'text') {
    const rewritten = rewriteRichTextPaths(node.content.richText, pathBySource)
    if (rewritten === null) return node
    return { ...node, content: { ...node.content, richText: rewritten } }
  }
  return node
}

/** 把文档里的导出包相对路径替换回编辑器持久化路径（主画布与支线子画布一视同仁） */
export function rewriteDocumentPaths(
  document: PaperDocument,
  pathBySource: ReadonlyMap<string, string>,
): PaperDocument {
  const nodes = document.nodes.map((node) => rewriteNodeSource(node, pathBySource))
  if (document.subCanvases === undefined) return { ...document, nodes }
  const subCanvases = Object.fromEntries(
    Object.entries(document.subCanvases).map(([id, sub]) => [
      id,
      { ...sub, nodes: sub.nodes.map((node) => rewriteNodeSource(node, pathBySource)) },
    ]),
  )
  return { ...document, nodes, subCanvases }
}

function findDataJs(files: ReadonlyMap<string, Blob | string>): Blob | string {
  const entry = files.get('data.js')
  if (entry === undefined) {
    throw new Error('导出包里没有找到 data.js，不是有效的 PaperLoom 导出包')
  }
  return entry
}

/** 完整复原流水线：解析 data.js -> 还原资源到 res/inbox/ -> 重写文档路径 */
export async function restoreProjectFromPackage(
  files: ReadonlyMap<string, Blob | string>,
): Promise<PaperDocument> {
  const dataEntry = findDataJs(files)
  const script = typeof dataEntry === 'string' ? dataEntry : await dataEntry.text()
  const document = parseDataJsDocument(script)

  const pathBySource = new Map<string, string>()
  await restorePlainAssets(files, pathBySource)
  await restoreInlinePdfs(files, pathBySource)
  return rewriteDocumentPaths(document, pathBySource)
}
