/**
 * 文件池（res/inbox/）客户端 API 与拖拽数据载荷协议
 */

import { buildInboxUrl, sanitizeInboxSegment, uploadBlobToInbox } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { parseSlideFromSvg, serializeSlideToSvg } from '@/shared/lib/slideSvg'
import type { SlideDocumentSpec } from '@/shared/types/slide'

export const INBOX_DRAG_MIME = 'application/x-paperloom-inbox'

export interface DraggedInboxPayload {
  readonly kind: 'file' | 'folder'
  readonly path: string
  readonly name: string
  readonly ext: string
  readonly category: InboxEntry['category']
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseInboxEntry(raw: unknown): InboxEntry | null {
  if (!isRecord(raw)) return null
  if (typeof raw.path !== 'string' || typeof raw.name !== 'string') return null
  const kind = raw.kind === 'folder' ? 'folder' : 'file'
  const category =
    raw.category === 'slide' ||
    raw.category === 'image' ||
    raw.category === 'document' ||
    raw.category === 'reference'
      ? raw.category
      : 'other'
  return {
    path: raw.path,
    name: raw.name,
    parentPath: typeof raw.parentPath === 'string' ? raw.parentPath : '',
    kind,
    size: typeof raw.size === 'number' ? raw.size : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    ext: typeof raw.ext === 'string' ? raw.ext : '',
    category,
  }
}

export async function fetchInboxTree(): Promise<readonly InboxEntry[]> {
  const res = await fetch('/api/res/inbox/tree', { cache: 'no-store' })
  if (!res.ok) throw new Error('无法读取文件池目录')
  const json: unknown = await res.json()
  if (!isRecord(json) || !Array.isArray(json.entries)) return []
  const list: InboxEntry[] = []
  for (const item of json.entries) {
    const parsed = parseInboxEntry(item)
    if (parsed !== null) list.push(parsed)
  }
  return list
}

export async function createInboxFolder(
  parentFolder: string,
  folderName: string,
): Promise<string> {
  const safeName = sanitizeInboxSegment(folderName)
  if (safeName === '') throw new Error('文件夹名称无效')
  const desiredPath = parentFolder === '' ? safeName : `${parentFolder}/${safeName}`
  const res = await fetch('/api/res/inbox/mkdir', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: desiredPath }),
  })
  if (!res.ok) throw new Error('创建文件夹失败')
  const json: unknown = await res.json()
  return isRecord(json) && typeof json.path === 'string' ? json.path : desiredPath
}

export async function moveInboxEntry(
  fromPath: string,
  toPath: string,
): Promise<{ readonly fromPath: string; readonly toPath: string }> {
  const res = await fetch('/api/res/inbox/move', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fromPath, toPath }),
  })
  if (!res.ok) throw new Error('重命名或移动文件失败')
  return { fromPath, toPath }
}

export async function deleteInboxEntries(paths: readonly string[]): Promise<number> {
  if (paths.length === 0) return 0
  const res = await fetch('/api/res/inbox/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paths }),
  })
  if (!res.ok) throw new Error('删除文件失败')
  const json: unknown = await res.json()
  return isRecord(json) && typeof json.deletedCount === 'number'
    ? json.deletedCount
    : paths.length
}

export async function uploadFileToInboxFolder(
  file: File,
  folderPath = '',
): Promise<{ readonly src: string; readonly relPath: string }> {
  const src = await uploadBlobToInbox(file, file.name, Date.now(), folderPath, true, false)
  const prefix = '/res/inbox/'
  const rawRel = src.startsWith(prefix) ? src.slice(prefix.length) : file.name
  const relPath = rawRel
    .split('/')
    .map((seg) => decodeURIComponent(seg))
    .join('/')
  return { src, relPath }
}

export async function saveSlideSvgToInbox(
  relPath: string,
  spec: SlideDocumentSpec,
  overwrite = true,
): Promise<{ readonly src: string; readonly relPath: string }> {
  const svgText = serializeSlideToSvg(spec)
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const slashIdx = relPath.lastIndexOf('/')
  const folder = slashIdx === -1 ? '' : relPath.slice(0, slashIdx)
  const rawName = slashIdx === -1 ? relPath : relPath.slice(slashIdx + 1)
  const fileName = rawName.toLowerCase().endsWith('.slide.svg')
    ? rawName
    : `${rawName}.slide.svg`
  const src = await uploadBlobToInbox(blob, fileName, Date.now(), folder, true, overwrite)
  const prefix = '/res/inbox/'
  const cleanSrc = (src.split('?')[0] ?? src)
  const rawRel = cleanSrc.startsWith(prefix) ? cleanSrc.slice(prefix.length) : relPath
  const finalRelPath = rawRel
    .split('/')
    .map((seg) => decodeURIComponent(seg))
    .join('/')
  return { src: buildInboxUrl(finalRelPath, Date.now()), relPath: finalRelPath }
}

export async function loadSlideSpecFromInbox(relPath: string): Promise<SlideDocumentSpec | null> {
  const url = buildInboxUrl(relPath, Date.now())
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const svgText = await res.text()
  return parseSlideFromSvg(svgText)
}

export async function fetchInboxTextContent(relPath: string): Promise<string> {
  const url = buildInboxUrl(relPath, Date.now())
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('读取文本文件失败')
  return res.text()
}

export function writeDraggedInboxPayload(
  dataTransfer: DataTransfer,
  entry: InboxEntry,
): void {
  const payload: DraggedInboxPayload = {
    kind: entry.kind,
    path: entry.path,
    name: entry.name,
    ext: entry.ext,
    category: entry.category,
  }
  dataTransfer.setData(INBOX_DRAG_MIME, JSON.stringify(payload))
  dataTransfer.setData('text/plain', entry.name)
}

export function readDraggedInboxPayload(dataTransfer: DataTransfer | null): DraggedInboxPayload | null {
  if (dataTransfer === null) return null
  const raw = dataTransfer.getData(INBOX_DRAG_MIME)
  if (raw === '') return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || typeof parsed.path !== 'string' || typeof parsed.name !== 'string') {
      return null
    }
    const kind = parsed.kind === 'folder' ? 'folder' : 'file'
    const category =
      parsed.category === 'slide' ||
      parsed.category === 'image' ||
      parsed.category === 'document' ||
      parsed.category === 'reference'
        ? parsed.category
        : 'other'
    return {
      kind,
      path: parsed.path,
      name: parsed.name,
      ext: typeof parsed.ext === 'string' ? parsed.ext : '',
      category,
    }
  } catch {
    return null
  }
}

export function hasInboxPayloadInDataTransfer(dataTransfer: DataTransfer | null): boolean {
  if (dataTransfer === null) return false
  return dataTransfer.types.includes(INBOX_DRAG_MIME)
}
