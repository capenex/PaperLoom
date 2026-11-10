import type { ImageNodeContent, ImageSlideItem, PageSwitchMode } from '../types/paper'

function clampPageIndex(index: number, pageCount: number): number {
  const maxIndex = Math.max(0, pageCount - 1)
  return Math.min(Math.max(index, 0), maxIndex)
}

export function resolveImageItems(content: ImageNodeContent): readonly ImageSlideItem[] {
  if (content.items !== undefined && content.items.length > 0) return content.items
  return [{ src: content.src, alt: content.alt }]
}

export function resolveActiveImageIndex(content: ImageNodeContent): number {
  return clampPageIndex(content.activeIndex ?? 0, resolveImageItems(content).length)
}

export function resolveActiveImageItem(content: ImageNodeContent): ImageSlideItem {
  const items = resolveImageItems(content)
  return items[resolveActiveImageIndex(content)] ?? { src: content.src, alt: content.alt }
}

export function buildImageContentWithItems(
  items: readonly ImageSlideItem[],
  activeIndex: number,
): ImageNodeContent {
  const safeIndex = clampPageIndex(activeIndex, items.length)
  const active = items[safeIndex] ?? { src: '', alt: '' }
  return {
    kind: 'image',
    src: active.src,
    alt: active.alt,
    items,
    activeIndex: safeIndex,
  }
}

export function computeNextPageIndex(
  current: number,
  pageCount: number,
  mode: PageSwitchMode,
  targetIndex?: number,
): number {
  if (pageCount <= 1) return 0
  if (mode === 'first') return 0
  if (mode === 'last') return pageCount - 1
  if (mode === 'next-loop') return (current + 1) % pageCount
  if (mode === 'prev-loop') return (current - 1 + pageCount) % pageCount
  return clampPageIndex(targetIndex ?? 0, pageCount)
}