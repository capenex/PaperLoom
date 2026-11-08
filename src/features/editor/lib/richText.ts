/** 富文本编辑的 DOM 工具：集中封装浏览器命令、选区保存与链接处理 */

import { escapeHtmlAttribute, escapeHtmlText } from '@/shared/lib/html'
import {
  applyReferenceAttributes,
  createReferenceAnchorHtml,
  REFERENCE_KIND_ATTR,
} from '@/shared/lib/reference'
import type { PaperReference } from '@/shared/types/paper'
import {
  cleanBrowserArtifacts,
  compileMarkdownRichTextHtml,
  toggleMarkdownListPrefix,
  unwrapElement,
} from './markdownRichText'
import { placeCaretAt } from './markdownShortcuts'

const FONT_SIZE_MARKER = '7'
const SAFE_LINK_PATTERN = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/)/iu
const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu
const PURE_MD_SELECTION_PATTERN = /^[\s\u00A0\u200B]*(?:#{1,3}|[-*>]|\d+\.|\*{1,2}|~~|`|\$)+[\s\u00A0\u200B]*$/u
const LEADING_LINE_MD_PATTERN = /^\u200B*(?:#{1,3}|>|[-*]|\d+\.)[ \u00A0]*/u
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

function isLineLeadingTextNode(editor: HTMLDivElement, textNode: Text): boolean {
  let cur: Node | null = textNode
  while (cur !== null && cur !== editor) {
    if (cur.previousSibling !== null) return false
    const parent: Node | null = cur.parentNode
    if (parent === editor || (parent instanceof HTMLElement && parent.tagName === 'DIV')) {
      return true
    }
    cur = parent
  }
  return false
}

/**
 * 阻止对 Markdown 语法符号本身（如 `# `、`- `、`1. `、`> `、`**`）挂载链接、引用或富文本样式：
 * - 若选区包含行首 Markdown 前缀，自动将选区起点推过该前缀；
 * - 若仅选中了纯 Markdown 语法符号，返回 false 直接拦截；
 * - 若光标折叠在行首 Markdown 前缀内部，插入元素前先将光标移到前缀之后。
 */
export function guardSelectionAgainstMarkdownSyntax(editor: HTMLDivElement): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return true
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return true

  if (range.collapsed) {
    if (range.startContainer instanceof Text && isLineLeadingTextNode(editor, range.startContainer)) {
      const match = LEADING_LINE_MD_PATTERN.exec(range.startContainer.data)
      if (match !== null && range.startOffset < match[0].length) {
        placeCaretAt(range.startContainer, match[0].length)
      }
    }
    return true
  }

  if (PURE_MD_SELECTION_PATTERN.test(selection.toString())) {
    return false
  }

  if (range.startContainer instanceof Text && isLineLeadingTextNode(editor, range.startContainer)) {
    const match = LEADING_LINE_MD_PATTERN.exec(range.startContainer.data)
    if (match !== null && range.startOffset < match[0].length) {
      const nextStart = Math.min(range.startContainer.data.length, match[0].length)
      if (range.endContainer === range.startContainer && range.endOffset <= nextStart) {
        return false
      }
      range.setStart(range.startContainer, nextStart)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  return !PURE_MD_SELECTION_PATTERN.test(selection.toString())
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
