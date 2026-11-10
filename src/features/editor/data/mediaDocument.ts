import {
  buildImageContentWithItems,
  computeNextPageIndex,
  resolveActiveImageIndex,
  resolveImageItems,
} from '@/shared/lib/mediaPages'
import type {
  CanvasId,
  ImageNodeContent,
  ImageSlideItem,
  NodeContent,
  NodeId,
  PageSwitchMode,
  PaperDocument,
  PaperNode,
  TextNodeContent,
} from '@/shared/types/paper'
import { splitRichTextPages } from '../lib/markdownRichText'
import { applyInCanvas } from './subCanvas'

function replaceNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  content: NodeContent,
): PaperDocument {
  if (!document.nodes.some((node) => node.id === nodeId)) return document
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    nodes: document.nodes.map((node) => (node.id === nodeId ? { ...node, content } : node)),
  }
}

function addImagePageToSlice(
  slice: PaperDocument,
  nodeId: NodeId,
  newItems: readonly ImageSlideItem[],
): PaperDocument {
  const node = slice.nodes.find((item) => item.id === nodeId)
  if (node === undefined || node.content.kind !== 'image' || newItems.length === 0) return slice
  const items = [...resolveImageItems(node.content), ...newItems]
  return replaceNodeContent(slice, nodeId, buildImageContentWithItems(items, items.length - 1))
}

export function addImagePageToNode(
  document: PaperDocument,
  nodeId: NodeId,
  newItems: readonly ImageSlideItem[],
  canvasId: CanvasId | null = null,
): PaperDocument {
  return applyInCanvas(document, canvasId, (slice) => addImagePageToSlice(slice, nodeId, newItems))
}

function replaceActiveImagePageInSlice(
  slice: PaperDocument,
  nodeId: NodeId,
  item: ImageSlideItem,
): PaperDocument {
  const node = slice.nodes.find((entry) => entry.id === nodeId)
  if (node === undefined || node.content.kind !== 'image') return slice
  const activeIndex = resolveActiveImageIndex(node.content)
  const items = resolveImageItems(node.content).map((entry, index) =>
    index === activeIndex ? item : entry,
  )
  return replaceNodeContent(slice, nodeId, buildImageContentWithItems(items, activeIndex))
}

export function replaceActiveImagePageInNode(
  document: PaperDocument,
  nodeId: NodeId,
  item: ImageSlideItem,
  canvasId: CanvasId | null = null,
): PaperDocument {
  return applyInCanvas(document, canvasId, (slice) =>
    replaceActiveImagePageInSlice(slice, nodeId, item),
  )
}

function removeActiveImagePageFromSlice(slice: PaperDocument, nodeId: NodeId): PaperDocument {
  const node = slice.nodes.find((entry) => entry.id === nodeId)
  if (node === undefined || node.content.kind !== 'image') return slice
  const items = resolveImageItems(node.content)
  if (items.length <= 1) return slice
  const activeIndex = resolveActiveImageIndex(node.content)
  const remaining = items.filter((_, index) => index !== activeIndex)
  return replaceNodeContent(
    slice,
    nodeId,
    buildImageContentWithItems(remaining, Math.max(0, activeIndex - 1)),
  )
}

export function removeActiveImagePageFromNode(
  document: PaperDocument,
  nodeId: NodeId,
  canvasId: CanvasId | null = null,
): PaperDocument {
  return applyInCanvas(document, canvasId, (slice) =>
    removeActiveImagePageFromSlice(slice, nodeId),
  )
}

function switchImagePage(
  slice: PaperDocument,
  nodeId: NodeId,
  content: ImageNodeContent,
  mode: PageSwitchMode,
  pageIndex?: number,
): PaperDocument {
  const items = resolveImageItems(content)
  if (items.length <= 1) return slice
  const nextIndex = computeNextPageIndex(
    resolveActiveImageIndex(content),
    items.length,
    mode,
    pageIndex,
  )
  return replaceNodeContent(slice, nodeId, buildImageContentWithItems(items, nextIndex))
}

function switchTextPage(
  slice: PaperDocument,
  nodeId: NodeId,
  content: TextNodeContent,
  mode: PageSwitchMode,
  pageIndex?: number,
): PaperDocument {
  const pageCount = splitRichTextPages(content.richText).length
  const storedIndex = content.activePageIndex ?? 0
  const current = Math.min(Math.max(storedIndex, 0), Math.max(0, pageCount - 1))
  const nextIndex = computeNextPageIndex(current, pageCount, mode, pageIndex)
  if (nextIndex === storedIndex) return slice
  return replaceNodeContent(slice, nodeId, { ...content, activePageIndex: nextIndex })
}

function switchNodePageInSlice(
  slice: PaperDocument,
  nodeId: NodeId,
  mode: PageSwitchMode,
  pageIndex?: number,
): PaperDocument {
  const node = slice.nodes.find((entry) => entry.id === nodeId)
  if (node === undefined) return slice
  if (node.content.kind === 'image') {
    return switchImagePage(slice, nodeId, node.content, mode, pageIndex)
  }
  if (node.content.kind === 'text') {
    return switchTextPage(slice, nodeId, node.content, mode, pageIndex)
  }
  return slice
}

function canvasContainingNode(
  document: PaperDocument,
  nodeId: NodeId,
  preferred: CanvasId | null,
): CanvasId | null {
  const preferredSub = preferred === null ? undefined : document.subCanvases?.[preferred]
  if (preferredSub !== undefined && preferredSub.nodes.some((node) => node.id === nodeId)) {
    return preferred
  }
  if (document.nodes.some((node) => node.id === nodeId)) return null
  for (const [id, sub] of Object.entries(document.subCanvases ?? {})) {
    if (sub.nodes.some((node) => node.id === nodeId)) return id
  }
  return null
}

export function switchNodePageInDocument(
  document: PaperDocument,
  targetNodeId: NodeId,
  mode: PageSwitchMode,
  pageIndex?: number,
  canvasId: CanvasId | null = null,
): PaperDocument {
  const resolvedCanvasId = canvasContainingNode(document, targetNodeId, canvasId)
  return applyInCanvas(document, resolvedCanvasId, (slice) =>
    switchNodePageInSlice(slice, targetNodeId, mode, pageIndex),
  )
}

export function toggleNodeInWatchlist(document: PaperDocument, nodeId: NodeId): PaperDocument {
  const current = document.watchlistNodeIds ?? []
  const watchlistNodeIds = current.includes(nodeId)
    ? current.filter((id) => id !== nodeId)
    : [...current, nodeId]
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    watchlistNodeIds,
  }
}

export function resolveWatchlistNodes(document: PaperDocument): readonly PaperNode[] {
  const all = [
    ...document.nodes,
    ...Object.values(document.subCanvases ?? {}).flatMap((sub) => sub.nodes),
  ]
  const result: PaperNode[] = []
  for (const id of document.watchlistNodeIds ?? []) {
    const node = all.find((item) => item.id === id)
    if (node !== undefined) result.push(node)
  }
  return result
}