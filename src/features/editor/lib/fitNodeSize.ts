/**
 * 富文本、纯标题与图片节点的自适应尺寸计算（Ctrl/Cmd + 左键单击或工具栏「贴合内容」触发）
 *
 * 多页富文本节点根据所有页面中最大的宽度与最大的高度共同确定尺寸，避免翻页时卡片尺寸跳动。
 * 图片节点按黄金视觉框等比缩放，多页图片取所有页面理想框的最大包络。
 */

import { isSlideSvgPath } from '@/shared/lib/inbox'
import { resolveImageItems } from '@/shared/lib/mediaPages'
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  DEFAULT_SLIDE_NODE_HEIGHT,
  DEFAULT_SLIDE_NODE_WIDTH,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import type { NodeSize } from '@/shared/lib/nodeDefaults'
import type {
  DocumentDefaults,
  ImageNodeContent,
  ImageSlideItem,
  PaperNode,
  TextNodeContent,
  TitleNodeContent,
} from '@/shared/types/paper'
import { splitRichTextPages } from './markdownRichText'

const CARD_PAD_X = 28
const CARD_PAD_Y = 20
const TITLE_PAD_X = 48
const TITLE_PAD_Y = 32
const COMFORT_TEXT_MAX_WIDTH = 460
/** 多页节点右下方翻页器预留底部安全高度 */
const PAGER_RESERVE_HEIGHT = 24

export const IMAGE_FIT_TARGET_LONG_EDGE = 360
export const IMAGE_FIT_SQUARE_EDGE = 320
export const IMAGE_FIT_MIN_WIDTH = 160
export const IMAGE_FIT_MAX_WIDTH = 440
export const IMAGE_FIT_MIN_HEIGHT = 120
export const IMAGE_FIT_MAX_HEIGHT = 360

const IMAGE_FIT_SQUARE_RATIO_MIN = 0.92
const IMAGE_FIT_SQUARE_RATIO_MAX = 1.08
const IMAGE_FIT_FALLBACK_WIDTH = 240
const IMAGE_FIT_FALLBACK_HEIGHT = 180
/** 多页图片节点翻页胶囊额外预留的底部高度 */
const IMAGE_PAGER_RESERVE_HEIGHT = 16

function clampWidth(width: number): number {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(width)))
}

function clampHeight(height: number): number {
  return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(height)))
}

/** 估算单行文本的像素宽度（区分中日韩全角字符与西文半角字符） */
export function estimateTextVisualWidth(text: string, fontSize: number): number {
  let units = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    units += code > 0x7f ? 1.02 : 0.58
  }
  return units * fontSize
}

function estimateTitleSize(content: TitleNodeContent, fontSize: number): NodeSize {
  const title = content.title.trim()
  const subtitle = content.subtitle.trim()
  if (title === '' && subtitle === '') {
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT }
  }

  const titleFont = Math.round(fontSize * 1.15)
  const subFont = Math.max(12, Math.round(fontSize * 0.82))
  const titleWidth = estimateTextVisualWidth(title, titleFont) * 1.1
  const subWidth = estimateTextVisualWidth(subtitle, subFont)

  const width = clampWidth(Math.max(titleWidth, Math.min(subWidth, 380)) + TITLE_PAD_X)
  const innerWidth = Math.max(72, width - 36)
  const subLines =
    subtitle === '' ? 0 : Math.min(2, Math.max(1, Math.ceil(subWidth / innerWidth)))
  const titleBlockH = title === '' ? 0 : Math.ceil(titleFont * 1.45)
  const subBlockH = subtitle === '' ? 0 : 6 + Math.ceil(subLines * subFont * 1.4)

  return {
    width,
    height: clampHeight(TITLE_PAD_Y + titleBlockH + subBlockH),
  }
}

interface ParsedTextLine {
  readonly text: string
  readonly scale: number
}

function extractLinesFromHtml(richText: string): readonly ParsedTextLine[] {
  const normalized = richText
    .replaceAll(/<\s*br\s*\/?>/giu, '\n')
    .replaceAll(/<\/\s*(?:p|div|li|blockquote|pre|h[1-6])\s*>/giu, '\n')
  const plain = normalized.replaceAll(/<[^>]+>/gu, '').replaceAll('&nbsp;', ' ').trim()
  if (plain === '') return []

  const hasH1 = /<\s*h1[\s>]/iu.test(richText)
  const hasH2 = /<\s*h2[\s>]/iu.test(richText)
  const lines = plain
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '')

  return lines.map((text, index) => ({
    text,
    scale: index === 0 && hasH1 ? 1.35 : index === 0 && hasH2 ? 1.18 : 1,
  }))
}

function estimateSinglePageWidth(lines: readonly ParsedTextLine[], fontSize: number): number {
  if (lines.length === 0) return DEFAULT_NODE_WIDTH
  let widestLine = 0
  for (const line of lines) {
    const linePx = estimateTextVisualWidth(line.text, fontSize * line.scale)
    if (linePx > widestLine) widestLine = linePx
  }
  const targetMax = Math.min(MAX_NODE_WIDTH, Math.max(COMFORT_TEXT_MAX_WIDTH, widestLine * 0.65))
  return clampWidth(Math.min(targetMax, widestLine + CARD_PAD_X + 6))
}

function estimateSinglePageHeightAtWidth(
  lines: readonly ParsedTextLine[],
  fontSize: number,
  width: number,
): number {
  if (lines.length === 0) return DEFAULT_NODE_HEIGHT
  const innerWidth = Math.max(80, width - CARD_PAD_X)
  let contentHeight = 0
  for (const line of lines) {
    const effectiveFont = fontSize * line.scale
    const linePx = estimateTextVisualWidth(line.text, effectiveFont)
    const wrappedCount = Math.max(1, Math.ceil(linePx / innerWidth))
    contentHeight += wrappedCount * effectiveFont * 1.55
  }
  return contentHeight + CARD_PAD_Y
}

function estimateRichTextSize(content: TextNodeContent, fontSize: number): NodeSize {
  const pages = splitRichTextPages(content.richText)
  const parsedPages = pages.map(extractLinesFromHtml)
  const hasAnyContent = parsedPages.some((lines) => lines.length > 0)
  if (!hasAnyContent) {
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT }
  }

  let maxWidth = MIN_NODE_WIDTH
  for (const lines of parsedPages) {
    const pageW = estimateSinglePageWidth(lines, fontSize)
    if (pageW > maxWidth) maxWidth = pageW
  }
  const finalWidth = clampWidth(maxWidth)

  let maxRawHeight = MIN_NODE_HEIGHT
  for (const lines of parsedPages) {
    const pageH = estimateSinglePageHeightAtWidth(lines, fontSize, finalWidth)
    if (pageH > maxRawHeight) maxRawHeight = pageH
  }
  const pagerExtra = pages.length > 1 ? PAGER_RESERVE_HEIGHT : 0

  return {
    width: finalWidth,
    height: clampHeight(maxRawHeight + pagerExtra),
  }
}

/** 幻灯片伪图片（.slide.svg）的理想画布尺寸：默认按 560x315（16:9）呈现，保证图文排版清晰可读 */
export function computeIdealSlideBox(naturalWidth?: number, naturalHeight?: number): NodeSize {
  const valid =
    typeof naturalWidth === 'number' &&
    typeof naturalHeight === 'number' &&
    Number.isFinite(naturalWidth) &&
    Number.isFinite(naturalHeight) &&
    naturalWidth > 0 &&
    naturalHeight > 0
  if (!valid) {
    return { width: DEFAULT_SLIDE_NODE_WIDTH, height: DEFAULT_SLIDE_NODE_HEIGHT }
  }
  const ratio = naturalWidth / naturalHeight
  const width = DEFAULT_SLIDE_NODE_WIDTH
  const height = clampHeight(Math.round(width / ratio))
  return { width: clampWidth(width), height }
}

/** 单张图片的黄金视觉框：近正方形修正为 320 边长，横竖图以 360 长边等比缩放并兜住短边下限 */
export function computeIdealImageBox(naturalWidth: number, naturalHeight: number): NodeSize {
  const invalid =
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  if (invalid) {
    return { width: IMAGE_FIT_FALLBACK_WIDTH, height: IMAGE_FIT_FALLBACK_HEIGHT }
  }
  const ratio = naturalWidth / naturalHeight
  let width: number
  let height: number
  if (ratio >= IMAGE_FIT_SQUARE_RATIO_MIN && ratio <= IMAGE_FIT_SQUARE_RATIO_MAX) {
    width = IMAGE_FIT_SQUARE_EDGE
    height = Math.round(IMAGE_FIT_SQUARE_EDGE / ratio)
  } else if (ratio > IMAGE_FIT_SQUARE_RATIO_MAX) {
    width = IMAGE_FIT_TARGET_LONG_EDGE
    height = Math.round(IMAGE_FIT_TARGET_LONG_EDGE / ratio)
    if (height < IMAGE_FIT_MIN_HEIGHT) {
      height = IMAGE_FIT_MIN_HEIGHT
      width = Math.min(IMAGE_FIT_MAX_WIDTH, Math.round(IMAGE_FIT_MIN_HEIGHT * ratio))
    }
  } else {
    height = IMAGE_FIT_TARGET_LONG_EDGE
    width = Math.round(IMAGE_FIT_TARGET_LONG_EDGE * ratio)
    if (width < IMAGE_FIT_MIN_WIDTH) {
      width = IMAGE_FIT_MIN_WIDTH
      height = Math.min(IMAGE_FIT_MAX_HEIGHT, Math.round(IMAGE_FIT_MIN_WIDTH / ratio))
    }
  }
  return {
    width: Math.min(IMAGE_FIT_MAX_WIDTH, Math.max(IMAGE_FIT_MIN_WIDTH, width)),
    height: Math.min(IMAGE_FIT_MAX_HEIGHT, Math.max(IMAGE_FIT_MIN_HEIGHT, height)),
  }
}

interface ImageNaturalSize {
  readonly width: number
  readonly height: number
}

function storedNaturalSize(item: ImageSlideItem): ImageNaturalSize | null {
  const width = item.naturalWidth ?? 0
  const height = item.naturalHeight ?? 0
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/** 浏览器环境复用页面里已加载的同 src <img> 的自然尺寸，避免重复解码图片 */
function findLoadedNaturalSize(src: string): ImageNaturalSize | null {
  if (typeof document === 'undefined' || src.trim() === '') return null
  const images = document.querySelectorAll('img')
  for (const image of images) {
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) continue
    if (image.getAttribute('src') !== src && image.src !== src) continue
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  return null
}

/** 多页图片取各页理想框的最大宽与最大高；页数大于 1 时高度额外预留翻页胶囊空间 */
function fitImageEnvelope(content: ImageNodeContent, useDom: boolean): NodeSize | null {
  const items = resolveImageItems(content)
  let maxWidth = 0
  let maxHeight = 0
  let measured = false
  for (const item of items) {
    const isSlide = isSlideSvgPath(item.src) || isSlideSvgPath(item.alt)
    const natural = storedNaturalSize(item) ?? (useDom ? findLoadedNaturalSize(item.src) : null)
    if (isSlide) {
      measured = true
      const box = computeIdealSlideBox(natural?.width, natural?.height)
      if (box.width > maxWidth) maxWidth = box.width
      if (box.height > maxHeight) maxHeight = box.height
      continue
    }
    if (natural === null) continue
    measured = true
    const box = computeIdealImageBox(natural.width, natural.height)
    if (box.width > maxWidth) maxWidth = box.width
    if (box.height > maxHeight) maxHeight = box.height
  }
  if (!measured) return null
  let minHeight = IMAGE_FIT_MIN_HEIGHT
  if (items.length > 1) minHeight += IMAGE_PAGER_RESERVE_HEIGHT
  return {
    width: clampWidth(maxWidth),
    height: clampHeight(Math.max(maxHeight, minHeight)),
  }
}

/** 纯逻辑估算节点贴合内容后的合适尺寸（多页富文本与多页图片取所有页面最大宽高） */
export function estimateFittedNodeSize(
  node: PaperNode,
  defaults: DocumentDefaults,
): NodeSize | null {
  if (node.content.kind === 'title') {
    return estimateTitleSize(node.content, defaults.fontSize)
  }
  if (node.content.kind === 'text') {
    return estimateRichTextSize(node.content, defaults.fontSize)
  }
  if (node.content.kind === 'image') {
    return fitImageEnvelope(node.content, false)
  }
  return null
}

function measureRichTextInDom(
  richText: string,
  fontSize: number,
  fallback: NodeSize,
): NodeSize {
  if (typeof document === 'undefined') return fallback
  const pages = splitRichTextPages(richText)
  const probe = document.createElement('div')
  probe.className = 'node-rich-text'
  probe.style.position = 'fixed'
  probe.style.left = '-9999px'
  probe.style.top = '0'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  probe.style.fontSize = `${fontSize}px`
  probe.style.lineHeight = '1.625'
  document.body.appendChild(probe)

  let maxDomWidth = MIN_NODE_WIDTH
  let measuredAny = false
  for (const pageHtml of pages) {
    if (pageHtml.trim() === '') continue
    probe.style.width = 'max-content'
    probe.style.maxWidth = `${COMFORT_TEXT_MAX_WIDTH - CARD_PAD_X}px`
    probe.innerHTML = pageHtml
    const rect = probe.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      measuredAny = true
      maxDomWidth = Math.max(maxDomWidth, Math.ceil(rect.width) + CARD_PAD_X + 4)
    }
  }

  if (!measuredAny) {
    probe.remove()
    return fallback
  }

  const finalWidth = clampWidth(maxDomWidth)
  let maxWrappedHeight = 0
  for (const pageHtml of pages) {
    if (pageHtml.trim() === '') continue
    probe.style.width = `${finalWidth - CARD_PAD_X}px`
    probe.style.maxWidth = 'none'
    probe.innerHTML = pageHtml
    const rectH = probe.getBoundingClientRect().height
    const pageH = Math.max(probe.scrollHeight, Math.ceil(rectH))
    if (pageH > maxWrappedHeight) maxWrappedHeight = pageH
  }
  probe.remove()

  const pagerExtra = pages.length > 1 ? PAGER_RESERVE_HEIGHT : 0
  return {
    width: finalWidth,
    height: clampHeight(maxWrappedHeight + CARD_PAD_Y + 2 + pagerExtra),
  }
}

/** 计算富文本、纯标题或图片节点的贴合尺寸（多页内容取所有页面的最大宽和最大高） */
export function fitNodeSize(node: PaperNode, defaults: DocumentDefaults): NodeSize | null {
  if (node.content.kind === 'image') {
    return fitImageEnvelope(node.content, true)
  }
  const estimated = estimateFittedNodeSize(node, defaults)
  if (estimated === null) return null
  if (node.content.kind === 'text' && node.content.richText.trim() !== '') {
    return measureRichTextInDom(node.content.richText, defaults.fontSize, estimated)
  }
  return estimated
}
