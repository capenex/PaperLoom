/** 富文本编辑的 DOM 工具：集中封装浏览器命令、选区保存与链接处理 */

import { escapeHtmlAttribute, escapeHtmlText } from '@/shared/lib/html'
import {
  applyReferenceAttributes,
  createReferenceAnchorHtml,
  REFERENCE_KIND_ATTR,
} from '@/shared/lib/reference'
import type { PaperReference } from '@/shared/types/paper'
import { cleanBrowserArtifacts, unwrapElement } from './markdownClean'
import { compileMarkdownRichTextHtml, toggleMarkdownListPrefix } from './markdownRichText'
import { collectMarkdownSyntaxSpans } from './markdownSyntaxSpans'
import { placeCaretAt } from './markdownShortcuts'

const FONT_SIZE_MARKER = '7'
const SAFE_LINK_PATTERN = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/)/iu
const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu
const CLEARABLE_FORMAT_SELECTOR = 'a, font, span, b, strong, i, em, u, s, del, strike, sub, sup'

function execEditorCommand(command: string, value?: string): boolean {
  // eslint-disable-next-line typescript/no-deprecated -- 兼容无 execCommand 的单元测试 DOM 环境
  if (typeof document.execCommand !== 'function') return false
  // eslint-disable-next-line typescript/no-deprecated -- 浏览器内置富文本命令暂无等价标准 API
  return document.execCommand(command, false, value)
}

export function emitHtml(
  editor: HTMLDivElement | null,
  onChange: (html: string) => void,
  pendingFontSize?: number | null,
): void {
  if (editor === null) return
  if (pendingFontSize !== undefined && pendingFontSize !== null) {
    normalizeFontSizeTags(editor, pendingFontSize)
  }
  const compiled = compileMarkdownRichTextHtml(editor.innerHTML)
  onChange(compiled)
}

export function insertPlainText(editor: HTMLDivElement | null, text: string): void {
  if (editor === null || text === '') return
  execEditorCommand('insertText', text)
}

/** 所有常规超链接统一在新窗口打开，并阻断 opener 引用；本地引用不跳转，保持原样 */
function hardenLinks(editor: HTMLDivElement): void {
  editor.querySelectorAll('a').forEach((anchor) => {
    if (anchor.hasAttribute(REFERENCE_KIND_ATTR)) return
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  })
}

/** 补全裸域名并拒绝 javascript: 等危险协议 */
export function normalizeLinkUrl(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  if (SAFE_LINK_PATTERN.test(value)) return value
  if (HAS_SCHEME_PATTERN.test(value)) return null
  return `https://${value}`
}

/** 把浏览器命令生成的 font 字号标记就地改成内联 px 样式，并清理内部冲突的旧字号 */
export function normalizeFontSizeTags(editor: HTMLDivElement, sizePx: number): void {
  editor.querySelectorAll('font[size="7"]').forEach((fontTag) => {
    fontTag.removeAttribute('size')
    fontTag.setAttribute('style', `font-size: ${sizePx}px`)
    fontTag.querySelectorAll('[style*="font-size"]').forEach((nested) => {
      if (nested instanceof HTMLElement) {
        nested.style.removeProperty('font-size')
        if (nested.getAttribute('style')?.trim() === '') {
          nested.removeAttribute('style')
        }
      }
    })
  })
}

/** 将光标放到编辑器末尾最深层的文本节点内，避免落在块级标签外侧导致输入脱节 */
export function placeCaretAtEnd(editor: HTMLDivElement): void {
  const selection = window.getSelection()
  if (selection === null) return
  const range = document.createRange()
  let last: Node | null = editor.lastChild
  while (last !== null && !(last instanceof Text) && last.lastChild !== null) {
    last = last.lastChild
  }
  if (last instanceof Text) {
    range.setStart(last, last.data.length)
  } else {
    range.selectNodeContents(editor)
  }
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function selectionInsideEditor(editor: HTMLDivElement): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

/** 选区所在的行容器：顶层行 div；裸内联内容退回编辑器根 */
function lineContainerOf(editor: HTMLDivElement, node: Node): Node {
  let cur: Node | null = node
  while (cur !== null && cur !== editor) {
    if (cur.parentNode === editor && cur instanceof HTMLElement && cur.tagName === 'DIV') return cur
    cur = cur.parentNode
  }
  return editor
}

function lineTextIndex(line: Node, container: Node, offset: number): number {
  const range = document.createRange()
  range.setStart(line, 0)
  range.setEnd(container, offset)
  return range.toString().length
}

function locateLineIndex(line: Node, index: number): { readonly node: Node; readonly offset: number } {
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
  let acc = 0
  let last: Text | null = null
  for (let cur = walker.nextNode(); cur !== null; cur = walker.nextNode()) {
    if (!(cur instanceof Text)) continue
    last = cur
    if (acc + cur.data.length >= index) return { node: cur, offset: index - acc }
    acc += cur.data.length
  }
  if (last !== null) return { node: last, offset: last.data.length }
  return { node: line, offset: 0 }
}

/**
 * 阻止对 Markdown 语法字符（行首前缀、转义反斜杠、`**`/`$` 等定界符）挂载富文本样式：
 * - 选区边缘落在语法区间内时自动收缩到内容部分；仅选中语法则直接拦截；
 * - 单行选区内部仍含语法时拦截，保证语法不会被样式包裹；
 * - 转义对里只有第一个反斜杠受保护，被转义的第二个字符可随意设置字号、挂引用。
 */
export function guardSelectionAgainstMarkdownSyntax(editor: HTMLDivElement): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return true
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return true

  const startLine = lineContainerOf(editor, range.startContainer)
  const endLine = lineContainerOf(editor, range.endContainer)
  const startSpans = collectMarkdownSyntaxSpans(startLine.textContent ?? '')
  const startIndex = lineTextIndex(startLine, range.startContainer, range.startOffset)

  if (range.collapsed) {
    const span = startSpans.find((s) => startIndex >= s.start && startIndex < s.end)
    if (span !== undefined) {
      const loc = locateLineIndex(startLine, span.end)
      placeCaretAt(loc.node, loc.offset)
    }
    return true
  }

  let newStart = startIndex
  for (const span of startSpans) {
    if (newStart >= span.start && newStart < span.end) newStart = span.end
  }
  const endSpans =
    startLine === endLine ? startSpans : collectMarkdownSyntaxSpans(endLine.textContent ?? '')
  const endIndex = lineTextIndex(endLine, range.endContainer, range.endOffset)
  let newEnd = endIndex
  for (const span of endSpans) {
    if (newEnd > span.start && newEnd <= span.end) newEnd = span.start
  }

  if (startLine === endLine) {
    if (newEnd <= newStart) return false
    if (startSpans.some((span) => span.start >= newStart && span.end <= newEnd)) return false
  }

  const startLoc = locateLineIndex(startLine, newStart)
  const endLoc = locateLineIndex(endLine, newEnd)
  range.setStart(startLoc.node, startLoc.offset)
  range.setEnd(endLoc.node, endLoc.offset)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

/**
 * 清除格式（removeFormat）：同时清除常规富文本样式、字号、颜色以及超链接（a[href]）和本地引用（a[data-pl-ref]）。
 * 支持选中文本清除，也支持直接将光标置于链接/引用/样式词内部一键剥离。
 */
export function clearEditorFormatting(editor: HTMLDivElement): void {
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return

  if (range.collapsed) {
    let cur: Node | null = range.startContainer
    const toUnwrap: Element[] = []
    while (cur !== null && cur !== editor) {
      if (cur instanceof HTMLElement && cur.matches(CLEARABLE_FORMAT_SELECTOR)) {
        toUnwrap.push(cur)
      }
      cur = cur.parentNode
    }
    toUnwrap.forEach(unwrapElement)
    editor.normalize()
    return
  }

  editor.querySelectorAll('a').forEach((anchor) => {
    if (range.intersectsNode(anchor)) {
      unwrapElement(anchor)
    }
  })

  execEditorCommand('removeFormat')
  execEditorCommand('unlink')

  const afterRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : range
  editor.querySelectorAll(CLEARABLE_FORMAT_SELECTOR).forEach((el) => {
    if (!el.classList.contains('pl-math') && afterRange.intersectsNode(el)) {
      unwrapElement(el)
    }
  })
  editor.normalize()
}

export function runEditorCommand(
  editor: HTMLDivElement | null,
  command: string,
  value: string | undefined,
  onChange: (html: string) => void,
): void {
  if (editor === null) return
  if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
    toggleMarkdownListPrefix(editor, command)
    emitHtml(editor, onChange)
    return
  }
  if (command === 'removeFormat') {
    clearEditorFormatting(editor)
    cleanBrowserArtifacts(editor)
    emitHtml(editor, onChange)
    return
  }
  if (!guardSelectionAgainstMarkdownSyntax(editor)) return
  execEditorCommand(command, value)
  cleanBrowserArtifacts(editor)
  hardenLinks(editor)
  emitHtml(editor, onChange)
}

/** 用 font 标记命令设置字号后，转换成内联 px 样式，便于导出包直接渲染 */
export function applyFontSize(
  editor: HTMLDivElement | null,
  sizePx: number,
  onChange: (html: string) => void,
): void {
  if (editor === null) return
  if (!guardSelectionAgainstMarkdownSyntax(editor)) return
  execEditorCommand('fontSize', FONT_SIZE_MARKER)
  normalizeFontSizeTags(editor, sizePx)
  cleanBrowserArtifacts(editor)
  hardenLinks(editor)
  emitHtml(editor, onChange)
}

/** 有选中文字时把选中文字变成链接，否则插入一个以 URL 为文字的链接 */
export function applyLink(
  editor: HTMLDivElement | null,
  url: string,
  onChange: (html: string) => void,
): void {
  if (editor === null) return
  if (!guardSelectionAgainstMarkdownSyntax(editor)) return
  if (selectionInsideEditor(editor)) {
    const selection = window.getSelection()
    if (selection !== null && !selection.isCollapsed) {
      execEditorCommand('createLink', url)
      cleanBrowserArtifacts(editor)
      hardenLinks(editor)
      emitHtml(editor, onChange)
      return
    }
  }

  const label = escapeHtmlText(url)
  execEditorCommand('insertHTML', `<a href="${escapeHtmlAttribute(url)}">${label}</a>`)
  cleanBrowserArtifacts(editor)
  hardenLinks(editor)
  emitHtml(editor, onChange)
}

/** 有选中文字时把选中文字变成本地引用锚点，否则插入一个以引用名为文字的锚点 */
export function applyReference(
  editor: HTMLDivElement | null,
  reference: PaperReference,
  onChange: (html: string) => void,
): void {
  if (editor === null) return
  if (!guardSelectionAgainstMarkdownSyntax(editor)) return
  if (selectionInsideEditor(editor)) {
    const selection = window.getSelection()
    if (selection !== null && !selection.isCollapsed) {
      execEditorCommand('createLink', reference.src)
      tagReferenceAnchors(editor, reference)
      cleanBrowserArtifacts(editor)
      emitHtml(editor, onChange)
      return
    }
  }

  execEditorCommand('insertHTML', createReferenceAnchorHtml(reference))
  cleanBrowserArtifacts(editor)
  emitHtml(editor, onChange)
}

/** createLink 只生成 href，这里给刚生成的锚点补上 data-pl-* 引用属性 */
function tagReferenceAnchors(editor: HTMLDivElement, reference: PaperReference): void {
  editor.querySelectorAll('a').forEach((anchor) => {
    if (anchor.hasAttribute(REFERENCE_KIND_ATTR)) return
    if (anchor.getAttribute('href') !== reference.src) return
    applyReferenceAttributes(anchor, reference)
  })
}

export function captureSelection(editor: HTMLDivElement | null): Range | null {
  if (editor === null) return null
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null
  return range.cloneRange()
}

export function restoreSelection(editor: HTMLDivElement | null, range: Range | null): void {
  if (editor === null) return
  const liveSelection = window.getSelection()
  if (
    liveSelection !== null &&
    liveSelection.rangeCount > 0 &&
    !liveSelection.isCollapsed &&
    editor.contains(liveSelection.getRangeAt(0).commonAncestorContainer)
  ) {
    return
  }
  editor.focus({ preventScroll: true })
  if (range === null || !editor.contains(range.commonAncestorContainer)) return
  const selection = window.getSelection()
  if (selection === null) return
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 从 HTML 中提取纯文本，用于节点卡片的无障碍名称 */
export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/\u200B/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}
