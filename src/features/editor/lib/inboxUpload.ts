/**
 * 编辑器文件粘贴、外部文件拖入与文件池拖拽上画布入库工具
 */

import {
  buildInboxUrl,
  classifyInboxFileName,
  detectInboxExtension,
  uploadBlobToInbox,
} from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { buildImageContentWithItems } from '@/shared/lib/mediaPages'
import { createReferenceAnchorHtml, referenceKindFromFileName } from '@/shared/lib/reference'
import type {
  FileNodeContent,
  ImageNodeContent,
  ImageSlideItem,
  NodeId,
  PaperNode,
  StaticFileFormat,
} from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import { computeIdealImageBox } from './fitNodeSize'
import { fetchInboxTextContent, hasInboxPayloadInDataTransfer } from './inboxClient'
import { detectStaticFileFormat } from './staticMarkdown'

const IMAGE_FILE_NAME_PATTERN = /\.(?:png|jpe?g|webp|gif|svg|avif|bmp)$/iu

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return IMAGE_FILE_NAME_PATTERN.test(file.name)
}

function imageFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.type}`
}

/** 从剪贴板或拖拽 DataTransfer 中提取全部图片文件 */
export function extractImageFiles(dataTransfer: DataTransfer | null): readonly File[] {
  if (dataTransfer === null) return []
  const result: File[] = []
  const seen = new Set<string>()

  for (let i = 0; i < dataTransfer.files.length; i += 1) {
    const file = dataTransfer.files.item(i)
    if (file !== null && isImageFile(file)) {
      seen.add(imageFileKey(file))
      result.push(file)
    }
  }

  for (let i = 0; i < dataTransfer.items.length; i += 1) {
    const item = dataTransfer.items[i]
    if (item === undefined || item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file === null) continue
    const key = imageFileKey(file)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(file)
    }
  }

  return result
}

/** 从拖拽 DataTransfer 中提取任意类型的外部文件 */
export function extractAllDroppedFiles(dataTransfer: DataTransfer | null): readonly File[] {
  if (dataTransfer === null) return []
  const result: File[] = []
  for (let i = 0; i < dataTransfer.files.length; i += 1) {
    const file = dataTransfer.files.item(i)
    if (file !== null) result.push(file)
  }
  return result
}

const PASTE_TYPE_PRIORITY = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
]

function typeRank(file: File): number {
  const index = PASTE_TYPE_PRIORITY.indexOf(file.type)
  return index === -1 ? PASTE_TYPE_PRIORITY.length : index
}

/** 粘贴只取一张图：截图与多格式剪贴板会把同一张图暴露成多个文件项，取最标准的那份 */
export function extractPastedImageFile(dataTransfer: DataTransfer | null): File | null {
  const files = extractImageFiles(dataTransfer)
  if (files.length === 0) return null
  return files.reduce((best, file) => (typeRank(file) < typeRank(best) ? file : best))
}

/** 判断拖拽事件中是否携带外部文件或文件池条目 */
export function hasFilesInDataTransfer(dataTransfer: DataTransfer | null): boolean {
  if (dataTransfer === null) return false
  if (hasInboxPayloadInDataTransfer(dataTransfer)) return true
  if (dataTransfer.types.includes('Files')) return true
  for (let i = 0; i < dataTransfer.items.length; i += 1) {
    if (dataTransfer.items[i]?.kind === 'file') return true
  }
  return false
}

export const INBOX_SAVE_FAILED =
  '图片写入 res/inbox 失败，请确认开发服务器（npm run dev）正在运行'

export async function saveImageFileToInbox(
  file: File,
  nowMs = Date.now(),
  folderPath = '',
): Promise<ImageNodeContent> {
  const src = await uploadBlobToInbox(file, file.name, nowMs, folderPath, true, false)
  const inboxFileName = src.slice(src.lastIndexOf('/') + 1)
  return {
    kind: 'image',
    src,
    alt: file.name.trim() === '' ? inboxFileName : file.name,
  }
}

export function readImageNaturalSizeFromUrl(
  url: string,
): Promise<{ readonly naturalWidth: number; readonly naturalHeight: number } | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const probe = new Image()
    probe.onload = () => {
      const size =
        probe.naturalWidth > 0 && probe.naturalHeight > 0
          ? { naturalWidth: probe.naturalWidth, naturalHeight: probe.naturalHeight }
          : null
      resolve(size)
    }
    probe.onerror = () => {
      resolve(null)
    }
    probe.src = url
  })
}

async function readImageNaturalSize(
  file: File,
): Promise<{ readonly naturalWidth: number; readonly naturalHeight: number } | null> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    return await readImageNaturalSizeFromUrl(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function saveImageSlideToInbox(
  file: File,
  nowMs = Date.now(),
  folderPath = '',
): Promise<ImageSlideItem> {
  const size = await readImageNaturalSize(file)
  const content = await saveImageFileToInbox(file, nowMs, folderPath)
  if (size === null) return { src: content.src, alt: content.alt }
  return {
    src: content.src,
    alt: content.alt,
    naturalWidth: size.naturalWidth,
    naturalHeight: size.naturalHeight,
  }
}

export interface CanvasFileDropCallbacks {
  readonly nodes: readonly PaperNode[]
  readonly inboxEntries?: readonly InboxEntry[] | undefined
  readonly currentInboxFolder?: string | undefined
  readonly onRefreshInbox?: (() => Promise<void>) | undefined
  readonly onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
  readonly onAddImagePages?: ((nodeId: NodeId, items: readonly ImageSlideItem[]) => void) | undefined
  readonly onReplaceImagePage?: ((nodeId: NodeId, item: ImageSlideItem) => void) | undefined
  readonly onAddFile?: ((content: FileNodeContent, target?: AddImageNodeTarget) => void) | undefined
  readonly onUpdateFile?:
    | ((nodeId: NodeId, fileName: string, format: StaticFileFormat, text: string) => void)
    | undefined
  readonly onAddRichText?: ((richText: string, target?: AddImageNodeTarget) => void) | undefined
  readonly onUpdateContent?: ((nodeId: NodeId, richText: string) => void) | undefined
}

export async function buildSlideItemFromInboxPath(
  relPath: string,
  name: string,
): Promise<ImageSlideItem> {
  const src = buildInboxUrl(relPath)
  const size = await readImageNaturalSizeFromUrl(src)
  if (size === null) return { src, alt: name }
  return {
    src,
    alt: name,
    naturalWidth: size.naturalWidth,
    naturalHeight: size.naturalHeight,
  }
}

function computeEnvelopeBox(
  items: readonly ImageSlideItem[],
): { readonly width: number; readonly height: number } | undefined {
  let maxW = 0
  let maxH = 0
  for (const item of items) {
    if (item.naturalWidth !== undefined && item.naturalHeight !== undefined) {
      const box = computeIdealImageBox(item.naturalWidth, item.naturalHeight)
      maxW = Math.max(maxW, box.width)
      maxH = Math.max(maxH, box.height)
    }
  }
  return maxW > 0 && maxH > 0 ? { width: maxW, height: maxH } : undefined
}

export function applyImageItemsToCanvas(
  items: readonly ImageSlideItem[],
  hitNode: PaperNode | undefined,
  altKey: boolean,
  target: AddImageNodeTarget | undefined,
  callbacks: Readonly<CanvasFileDropCallbacks>,
): void {
  const first = items[0]
  if (first === undefined) return

  if (hitNode?.content.kind === 'image') {
    if (altKey && items.length === 1 && callbacks.onReplaceImagePage !== undefined) {
      callbacks.onReplaceImagePage(hitNode.id, first)
      return
    }
    if (callbacks.onAddImagePages !== undefined) {
      callbacks.onAddImagePages(hitNode.id, items)
      return
    }
  }

  const size = computeEnvelopeBox(items)
  const content: ImageNodeContent =
    items.length === 1
      ? { kind: 'image', src: first.src, alt: first.alt, items: [first], activeIndex: 0 }
      : buildImageContentWithItems(items, 0)

  callbacks.onAddImage(content, {
    ...target,
    ...(size === undefined ? {} : { size }),
  })
}

export async function dispatchInboxEntryToCanvas(
  entry: Pick<InboxEntry, 'kind' | 'path' | 'name' | 'ext' | 'category'>,
  hitNode: PaperNode | undefined,
  altKey: boolean,
  target: AddImageNodeTarget | undefined,
  callbacks: Readonly<CanvasFileDropCallbacks>,
): Promise<void> {
  if (entry.kind === 'folder') {
    const folderPrefix = `${entry.path}/`
    const childImageEntries = (callbacks.inboxEntries ?? [])
      .filter(
        (item) =>
          item.kind === 'file' &&
          item.path.startsWith(folderPrefix) &&
          (item.category === 'slide' || item.category === 'image'),
      )
      .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN', { numeric: true }))
    if (childImageEntries.length === 0) return
    const slideItems = await Promise.all(
      childImageEntries.map((item) => buildSlideItemFromInboxPath(item.path, item.name)),
    )
    applyImageItemsToCanvas(slideItems, hitNode, false, target, callbacks)
    return
  }

  if (entry.category === 'slide' || entry.category === 'image') {
    const slideItem = await buildSlideItemFromInboxPath(entry.path, entry.name)
    applyImageItemsToCanvas([slideItem], hitNode, altKey, target, callbacks)
    return
  }

  if (entry.category === 'document') {
    const text = await fetchInboxTextContent(entry.path)
    const format = detectStaticFileFormat(entry.name)
    if (hitNode?.content.kind === 'file' && callbacks.onUpdateFile !== undefined) {
      callbacks.onUpdateFile(hitNode.id, entry.name, format, text)
      return
    }
    callbacks.onAddFile?.({ kind: 'file', fileName: entry.name, format, text }, target)
    return
  }

  if (entry.category === 'reference') {
    const refKind = referenceKindFromFileName(entry.name) ?? 'pdf'
    const anchorHtml = createReferenceAnchorHtml({
      kind: refKind,
      src: buildInboxUrl(entry.path),
      label: entry.name,
    })
    if (hitNode?.content.kind === 'text' && callbacks.onUpdateContent !== undefined) {
      const nextHtml = `${hitNode.content.richText}<p>${anchorHtml}</p>`
      callbacks.onUpdateContent(hitNode.id, nextHtml)
      return
    }
    callbacks.onAddRichText?.(`<p>${anchorHtml}</p>`, target)
  }
}

export async function ingestExternalFileToCanvas(
  file: File,
  hitNode: PaperNode | undefined,
  altKey: boolean,
  target: AddImageNodeTarget | undefined,
  callbacks: Readonly<CanvasFileDropCallbacks>,
): Promise<void> {
  const category = classifyInboxFileName(file.name)
  const folder = callbacks.currentInboxFolder ?? ''

  if (category === 'document') {
    await uploadBlobToInbox(file, file.name, Date.now(), folder, true, false)
    const text = await file.text()
    const format = detectStaticFileFormat(file.name)
    if (hitNode?.content.kind === 'file' && callbacks.onUpdateFile !== undefined) {
      callbacks.onUpdateFile(hitNode.id, file.name, format, text)
    } else {
      callbacks.onAddFile?.({ kind: 'file', fileName: file.name, format, text }, target)
    }
    return
  }

  const src = await uploadBlobToInbox(file, file.name, Date.now(), folder, true, false)
  const prefix = '/res/inbox/'
  const rawRel = src.startsWith(prefix) ? src.slice(prefix.length) : file.name
  const relPath = rawRel
    .split('/')
    .map((seg) => decodeURIComponent(seg))
    .join('/')

  await dispatchInboxEntryToCanvas(
    {
      kind: 'file',
      path: relPath,
      name: file.name,
      ext: detectInboxExtension(file.name),
      category: category === 'other' && isImageFile(file) ? 'image' : category,
    },
    hitNode,
    altKey,
    target,
    callbacks,
  )
}
