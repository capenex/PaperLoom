/**
 * 富文本节点与纯标题节点的自适应尺寸计算（Ctrl/Cmd + 左键单击或工具栏「贴合内容」触发）
 *
 * 多页富文本节点根据所有页面中最大的宽度与最大的高度共同确定尺寸，避免翻页时卡片尺寸跳动。
 */

import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import type { NodeSize } from '@/shared/lib/nodeDefaults'
import type {
  DocumentDefaults,
  PaperNode,
  TextNodeContent,
  TitleNodeContent,
} from '@/shared/types/paper'
import { splitRichTextPages } from './markdownRichText'

const CARD_PAD_X = 36
const CARD_PAD_Y = 28
const TITLE_PAD_X = 60
const TITLE_PAD_Y = 48
const COMFORT_TEXT_MAX_WIDTH = 460
/** 多页节点右下方翻页器预留底部安全高度 */
const PAGER_RESERVE_HEIGHT = 24

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
  const titleBlockH = title === '' ? 0 : Math.ceil(titleFont * 1.5)
  const subBlockH = subtitle === '' ? 0 : 6 + Math.ceil(subLines * subFont * 1.45)

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
    scale: index === 0 && hasH1 ? 1.5 : index === 0 && hasH2 ? 1.28 : 1,
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
  return clampWidth(Math.min(targetMax, widestLine + CARD_PAD_X + 8))
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
    contentHeight += wrappedCount * effectiveFont * 1.62 + 4
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

/** 纯逻辑估算节点贴合内容后的合适尺寸（多页富文本取所有页面最大宽高） */
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

  let maxDomWidth = fallback.width
  let measuredAny = false
  for (const pageHtml of pages) {
    if (pageHtml.trim() === '') continue
    probe.style.width = 'max-content'
    probe.style.maxWidth = `${COMFORT_TEXT_MAX_WIDTH - CARD_PAD_X}px`
    probe.innerHTML = pageHtml
    const rect = probe.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      measuredAny = true
      maxDomWidth = Math.max(maxDomWidth, rect.width + CARD_PAD_X + 6)
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
    const pageH = Math.max(probe.scrollHeight, probe.getBoundingClientRect().height)
    if (pageH > maxWrappedHeight) maxWrappedHeight = pageH
  }
  probe.remove()

  const pagerExtra = pages.length > 1 ? PAGER_RESERVE_HEIGHT : 0
  return {
    width: finalWidth,
    height: clampHeight(Math.max(maxWrappedHeight + CARD_PAD_Y + 4 + pagerExtra, fallback.height)),
  }
}

/** 计算富文本或纯标题节点的贴合尺寸（多页富文本取所有页面的最大宽和最大高） */
export function fitNodeSize(node: PaperNode, defaults: DocumentDefaults): NodeSize | null {
  const estimated = estimateFittedNodeSize(node, defaults)
  if (estimated === null) return null
  if (node.content.kind === 'text' && node.content.richText.trim() !== '') {
    return measureRichTextInDom(node.content.richText, defaults.fontSize, estimated)
  }
  return estimated
}
