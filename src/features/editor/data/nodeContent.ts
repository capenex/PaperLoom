import {
  DEFAULT_REFERENCE_EVENTS,
  defaultEventsForKind,
  resolveBindingTarget,
  resolveNodeEvents,
} from '@/shared/lib/nodeEvents'
import { REFERENCE_KIND_ATTR } from '@/shared/lib/reference'
import type {
  FileNodeContent,
  ImageNodeContent,
  NodeContent,
  NodeEventBinding,
  NodeId,
  PaperDocument,
  PaperNode,
  StaticFileFormat,
  TitleNodeContent,
} from '@/shared/types/paper'
import { splitRichTextPages } from '../lib/markdownRichText'

/** 旧版遗留的失效示例图片路径（用于自动识别并清理失效占位图） */
export const LEGACY_BROKEN_SAMPLE_IMAGE_SRC = '/media/oxcq2cmh.jpg'

const SAMPLE_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eef2ff"/><stop offset="100%" stop-color="#e0e7ff"/></linearGradient></defs><rect width="640" height="400" fill="url(#bg)"/><circle cx="490" cy="110" r="42" fill="#c7d2fe"/><path d="M80 340 L230 190 L355 300 L455 215 L575 340 Z" fill="#a5b4fc"/><path d="M190 340 L335 205 L495 340 Z" fill="#818cf8" opacity="0.85"/></svg>'

/** 初始文档默认展示的示例图片内容（内联矢量图，离线恒可用） */
export const SAMPLE_IMAGE: ImageNodeContent = {
  kind: 'image',
  src: `data:image/svg+xml;utf8,${encodeURIComponent(SAMPLE_IMAGE_SVG)}`,
  alt: '示例图片',
}

/** 切换为多媒体节点但尚无历史图片时的空白初始状态 */
const EMPTY_IMAGE_CONTENT: ImageNodeContent = {
  kind: 'image',
  src: '',
  alt: '',
  items: [],
  activeIndex: 0,
}

const SAMPLE_TITLE: TitleNodeContent = {
  kind: 'title',
  title: '核心主题',
  subtitle: '',
}

const SAMPLE_FILE: FileNodeContent = {
  kind: 'file',
  fileName: 'example.ts',
  format: 'code',
  text: '// 点击顶部「选择文件」导入本地代码或 Markdown\nexport function greet(name: string): string {\n  return `Hello, ${name}!`\n}',
}

/** 记录每个节点在各类型下的最近一次内容，保证切换节点类型再切回时不丢失原内容 */
const nodeKindContentCache = new Map<string, NodeContent>()

function kindCacheKey(
  document: PaperDocument,
  nodeId: NodeId,
  kind: NodeContent['kind'],
): string {
  return `${document.meta.id}:${nodeId}:${kind}`
}

function isLegacyBrokenImageContent(content: NodeContent): boolean {
  return content.kind === 'image' && content.src === LEGACY_BROKEN_SAMPLE_IMAGE_SRC
}

export function rememberNodeKindContent(
  document: PaperDocument,
  nodeId: NodeId,
  content: NodeContent,
): void {
  if (isLegacyBrokenImageContent(content)) return
  nodeKindContentCache.set(kindCacheKey(document, nodeId, content.kind), content)
}

function replaceNodes(document: PaperDocument, nodes: readonly PaperNode[]): PaperDocument {
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    nodes,
  }
}

function defaultContentForKind(kind: NodeContent['kind']): NodeContent {
  if (kind === 'image') return EMPTY_IMAGE_CONTENT
  if (kind === 'title') return SAMPLE_TITLE
  if (kind === 'file') return SAMPLE_FILE
  return { kind: 'text', richText: '' }
}

function mergeEventsForNewKind(
  node: PaperNode,
  nextKind: NodeContent['kind'],
): readonly NodeEventBinding[] {
  const customEvents = resolveNodeEvents(node).filter(
    (binding) =>
      resolveBindingTarget(binding) === 'node' &&
      binding.action.type !== 'open-detail' &&
      binding.action.type !== 'edit-node',
  )
  const kindDefaults = defaultEventsForKind(nextKind)
  const merged = [...customEvents]
  for (const def of kindDefaults) {
    if (!merged.some((item) => item.trigger === def.trigger)) {
      merged.push(def)
    }
  }
  return merged
}

/** 更新文字节点的富文本内容；首次插入引用锚点且已有自定义事件时自动补齐默认引用事件 */
export function updateTextNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  richText: string,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind !== 'text') return document

  const hadRef = target.content.richText.includes(REFERENCE_KIND_ATTR)
  const hasRef = richText.includes(REFERENCE_KIND_ATTR)
  const shouldAppendRefDefaults =
    !hadRef &&
    hasRef &&
    target.events !== undefined &&
    !target.events.some((item) => resolveBindingTarget(item) !== 'node')

  const pageCount = splitRichTextPages(richText).length
  const prevPageCount = splitRichTextPages(target.content.richText).length
  const prevIndex = target.content.activePageIndex ?? 0
  const activePageIndex =
    pageCount > prevPageCount
      ? pageCount - 1
      : Math.min(Math.max(prevIndex, 0), pageCount - 1)

  const nextContent: NodeContent = { ...target.content, richText, activePageIndex }
  rememberNodeKindContent(document, nodeId, nextContent)

  const nodes = document.nodes.map((node) => {
    if (node.id !== nodeId) return node
    const events =
      shouldAppendRefDefaults && node.events !== undefined
        ? [...node.events, ...DEFAULT_REFERENCE_EVENTS]
        : node.events
    return {
      ...node,
      content: nextContent,
      ...(events === undefined ? {} : { events }),
    }
  })

  return replaceNodes(document, nodes)
}

/** 更新纯标题节点的主标题与副标题 */
export function updateTitleNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  title: string,
  subtitle: string,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind !== 'title') return document
  const content: TitleNodeContent = { kind: 'title', title, subtitle }
  rememberNodeKindContent(document, nodeId, content)
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}

/** 切换节点类型（富文本 / 纯标题 / 多媒体 / 静态文件）；保留并恢复该节点在各类型下的历史内容 */
export function changeNodeKind(
  document: PaperDocument,
  nodeId: NodeId,
  kind: NodeContent['kind'],
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind === kind) return document
  rememberNodeKindContent(document, nodeId, target.content)
  const cached = nodeKindContentCache.get(kindCacheKey(document, nodeId, kind))
  const content =
    cached !== undefined && !isLegacyBrokenImageContent(cached)
      ? cached
      : defaultContentForKind(kind)
  const events = mergeEventsForNewKind(target, kind)
  return replaceNodes(
    document,
    document.nodes.map(
      (node): PaperNode => (node.id === nodeId ? { ...node, content, events } : node),
    ),
  )
}

/** 更新多媒体（图片）节点的资源地址与替代文本 */
export function updateImageNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  src: string,
  alt: string,
): PaperDocument {
  if (!document.nodes.some((node) => node.id === nodeId)) return document
  const content: ImageNodeContent = {
    kind: 'image',
    src,
    alt,
    items: src.trim() === '' ? [] : [{ src, alt }],
    activeIndex: 0,
  }
  rememberNodeKindContent(document, nodeId, content)
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}

/** 更新静态文件节点的文件名、展示格式与文本内容 */
export function updateFileNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  fileName: string,
  format: StaticFileFormat,
  text: string,
): PaperDocument {
  if (!document.nodes.some((node) => node.id === nodeId)) return document
  const content: FileNodeContent = { kind: 'file', fileName, format, text }
  rememberNodeKindContent(document, nodeId, content)
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}
