/**
 * 文档级文件池（res/inbox/）引用计数追踪与重命名/移动路径自动重写
 */

import type {
  ImageNodeContent,
  ImageSlideItem,
  NodeId,
  PaperDocument,
  PaperNode,
} from '@/shared/types/paper'
import { buildInboxUrl, normalizeInboxLookupPath } from './inbox'
import { buildImageContentWithItems, resolveActiveImageIndex, resolveImageItems } from './mediaPages'

const RICH_TEXT_ATTR_PATTERN = /(?:href|src|data-pl-src|data-pl-preview)=["']([^"']+)["']/giu

function collectNodeInboxPaths(node: PaperNode): readonly string[] {
  if (node.content.kind === 'image') {
    const paths: string[] = []
    for (const item of resolveImageItems(node.content)) {
      const rel = normalizeInboxLookupPath(item.src)
      if (rel !== null && !paths.includes(rel)) {
        paths.push(rel)
      }
    }
    return paths
  }
  if (node.content.kind === 'text') {
    const paths: string[] = []
    for (const match of node.content.richText.matchAll(RICH_TEXT_ATTR_PATTERN)) {
      const rawUrl = match[1]
      if (rawUrl === undefined) continue
      const rel = normalizeInboxLookupPath(rawUrl)
      if (rel !== null && !paths.includes(rel)) {
        paths.push(rel)
      }
    }
    return paths
  }
  return []
}

function allDocumentNodes(document: PaperDocument): readonly PaperNode[] {
  if (document.subCanvases === undefined) return document.nodes
  const subNodes = Object.values(document.subCanvases).flatMap((sub) => sub.nodes)
  return [...document.nodes, ...subNodes]
}

/**
 * 统计整份文档（含主画布与所有支线子画布）对 res/inbox/ 下各相对路径的引用节点 ID 列表。
 * 返回 Map<相对路径, readonly NodeId[]>
 */
export function collectDocumentInboxUsage(
  document: PaperDocument,
): ReadonlyMap<string, readonly NodeId[]> {
  const usage = new Map<string, NodeId[]>()
  for (const node of allDocumentNodes(document)) {
    for (const relPath of collectNodeInboxPaths(node)) {
      const existing = usage.get(relPath)
      if (existing === undefined) {
        usage.set(relPath, [node.id])
      } else if (!existing.includes(node.id)) {
        existing.push(node.id)
      }
    }
  }
  return usage
}

function matchAndRewriteRelPath(
  currentRelPath: string,
  fromRelPath: string,
  toRelPath: string,
): string | null {
  if (currentRelPath === fromRelPath) return toRelPath
  const folderPrefix = `${fromRelPath}/`
  if (currentRelPath.startsWith(folderPrefix)) {
    return `${toRelPath}/${currentRelPath.slice(folderPrefix.length)}`
  }
  return null
}

function baseNameOf(relPath: string): string {
  const slashIndex = relPath.lastIndexOf('/')
  return slashIndex === -1 ? relPath : relPath.slice(slashIndex + 1)
}

function rewriteSlideItem(
  item: ImageSlideItem,
  fromRelPath: string,
  toRelPath: string,
  cacheBust?: number,
): { readonly item: ImageSlideItem; readonly changed: boolean } {
  const currentRel = normalizeInboxLookupPath(item.src)
  if (currentRel === null) return { item, changed: false }
  const nextRel = matchAndRewriteRelPath(currentRel, fromRelPath, toRelPath)
  if (nextRel === null) return { item, changed: false }

  const nextSrc = buildInboxUrl(nextRel, cacheBust)
  const oldBase = baseNameOf(currentRel)
  const newBase = baseNameOf(nextRel)
  const nextAlt =
    item.alt === oldBase || item.alt === '' ? newBase : item.alt

  return {
    item: { ...item, src: nextSrc, alt: nextAlt },
    changed: true,
  }
}

function rewriteImageNodeInboxPaths(
  content: ImageNodeContent,
  fromRelPath: string,
  toRelPath: string,
  cacheBust?: number,
): ImageNodeContent | null {
  const items = resolveImageItems(content)
  let changed = false
  const nextItems = items.map((entry) => {
    const result = rewriteSlideItem(entry, fromRelPath, toRelPath, cacheBust)
    if (result.changed) changed = true
    return result.item
  })
  if (!changed) return null
  const activeIndex = resolveActiveImageIndex(content)
  return buildImageContentWithItems(nextItems, activeIndex)
}

function rewriteRichTextInboxPaths(
  richText: string,
  fromRelPath: string,
  toRelPath: string,
  cacheBust?: number,
): string | null {
  let changed = false
  const nextHtml = richText.replace(
    /((?:href|src|data-pl-src|data-pl-preview)=["'])([^"']+)(["'])/giu,
    (fullMatch, prefix: string, rawUrl: string, suffix: string) => {
      const currentRel = normalizeInboxLookupPath(rawUrl)
      if (currentRel === null) return fullMatch
      const nextRel = matchAndRewriteRelPath(currentRel, fromRelPath, toRelPath)
      if (nextRel === null) return fullMatch
      changed = true
      return `${prefix}${buildInboxUrl(nextRel, cacheBust)}${suffix}`
    },
  )
  return changed ? nextHtml : null
}

function rewriteNodeInboxPaths(
  node: PaperNode,
  fromRelPath: string,
  toRelPath: string,
  cacheBust?: number,
): PaperNode {
  if (node.content.kind === 'image') {
    const nextImage = rewriteImageNodeInboxPaths(node.content, fromRelPath, toRelPath, cacheBust)
    return nextImage === null ? node : { ...node, content: nextImage }
  }
  if (node.content.kind === 'text') {
    const nextHtml = rewriteRichTextInboxPaths(
      node.content.richText,
      fromRelPath,
      toRelPath,
      cacheBust,
    )
    return nextHtml === null ? node : { ...node, content: { ...node.content, richText: nextHtml } }
  }
  return node
}

/**
 * 当文件池中的文件或文件夹被重命名/移动（或原位保存需要刷新 ?t= 时间戳）时，
 * 自动重写整份文档（含主画布与所有支线子画布）中的引用路径，确保绝不断链。
 */
export function rewriteDocumentInboxPaths(
  document: PaperDocument,
  fromRelPath: string,
  toRelPath: string,
  cacheBust?: number,
): PaperDocument {
  let anyChanged = false
  const mapNodes = (nodes: readonly PaperNode[]): readonly PaperNode[] =>
    nodes.map((node) => {
      const next = rewriteNodeInboxPaths(node, fromRelPath, toRelPath, cacheBust)
      if (next !== node) anyChanged = true
      return next
    })

  const nodes = mapNodes(document.nodes)
  const subCanvases =
    document.subCanvases === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(document.subCanvases).map(([id, sub]) => [
            id,
            { ...sub, nodes: mapNodes(sub.nodes) },
          ]),
        )

  if (!anyChanged) return document
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    nodes,
    ...(subCanvases === undefined ? {} : { subCanvases }),
  }
}
