/** 富文本编辑的 DOM 工具：集中封装浏览器命令、选区保存与链接处理 */

const FONT_SIZE_MARKER = '7'
const SAFE_LINK_PATTERN = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/)/iu
const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu

function execEditorCommand(command: string, value?: string): boolean {
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
  if (editor.textContent === '') {
    editor.innerHTML = ''
    onChange('')
    return
  }
  onChange(editor.innerHTML)
}

export function insertPlainText(editor: HTMLDivElement | null, text: string): void {
  if (editor === null || text === '') return
  execEditorCommand('insertText', text)
}

/** 所有输入链接统一在新窗口打开，并阻断 opener 引用 */
function hardenLinks(editor: HTMLDivElement): void {
  editor.querySelectorAll('a').forEach((anchor) => {
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

function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** 把浏览器命令生成的 font 字号标记就地改成内联 px 样式，避免移动节点导致光标丢失 */
export function normalizeFontSizeTags(editor: HTMLDivElement, sizePx: number): void {
  editor.querySelectorAll('font[size="7"]').forEach((fontTag) => {
    fontTag.removeAttribute('size')
    fontTag.setAttribute('style', `font-size: ${sizePx}px`)
  })
}

function selectionInsideEditor(editor: HTMLDivElement): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

export function runEditorCommand(
  editor: HTMLDivElement | null,
  command: string,
  value: string | undefined,
  onChange: (html: string) => void,
): void {
  if (editor === null) return
  execEditorCommand(command, value)
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
  execEditorCommand('fontSize', FONT_SIZE_MARKER)
  normalizeFontSizeTags(editor, sizePx)
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
  if (selectionInsideEditor(editor)) {
    const selection = window.getSelection()
    if (selection !== null && !selection.isCollapsed) {
      execEditorCommand('createLink', url)
      hardenLinks(editor)
      emitHtml(editor, onChange)
      return
    }
  }

  const label = escapeHtmlText(url)
  execEditorCommand('insertHTML', `<a href="${escapeHtmlAttribute(url)}">${label}</a>`)
  hardenLinks(editor)
  emitHtml(editor, onChange)
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
  editor.focus()
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
    .replace(/\s+/gu, ' ')
    .trim()
}
