import { escapeHtmlText } from '@/shared/lib/html'
import { renderInlineMathHtml } from './mathFormula'

export type BlockShortcutAction =
  | { readonly kind: 'formatBlock'; readonly tag: 'h1' | 'h2' | 'h3' | 'blockquote' }
  | { readonly kind: 'command'; readonly command: 'insertUnorderedList' | 'insertOrderedList' }

export interface InlineShortcutMatch {
  readonly startIndex: number
  readonly endIndex: number
  readonly replacementHtml: string
}

interface InlineRule {
  readonly pattern: RegExp
  readonly render: (content: string) => string
}

const BLOCK_RULES: Readonly<Record<string, BlockShortcutAction>> = {
  '#': { kind: 'formatBlock', tag: 'h1' },
  '##': { kind: 'formatBlock', tag: 'h2' },
  '###': { kind: 'formatBlock', tag: 'h3' },
  '>': { kind: 'formatBlock', tag: 'blockquote' },
  '-': { kind: 'command', command: 'insertUnorderedList' },
  '*': { kind: 'command', command: 'insertUnorderedList' },
  '1.': { kind: 'command', command: 'insertOrderedList' },
}

const INLINE_RULES: readonly InlineRule[] = [
  { pattern: /\*\*([^*\s][^*]*?)\*\*$/u, render: (t) => `<strong>${escapeHtmlText(t)}</strong>` },
  { pattern: /~~([^~\s][^~]*?)~~$/u, render: (t) => `<del>${escapeHtmlText(t)}</del>` },
  { pattern: /`([^`\n]+)`$/u, render: (t) => `<code>${escapeHtmlText(t)}</code>` },
  { pattern: /(?:^|[^$\\])\$([^$\n]+?)\$$/u, render: (tex) => renderInlineMathHtml(tex) },
  { pattern: /(?:^|[^*])\*([^*\s][^*]*?)\*$/u, render: (t) => `<em>${escapeHtmlText(t)}</em>` },
]

const ANYWHERE_INLINE_RULES: readonly InlineRule[] = [
  { pattern: /\*\*([^*\s][^*]*?)\*\*/u, render: (t) => `<strong>${escapeHtmlText(t)}</strong>` },
  { pattern: /~~([^~\s][^~]*?)~~/u, render: (t) => `<del>${escapeHtmlText(t)}</del>` },
  { pattern: /`([^`\n]+)`/u, render: (t) => `<code>${escapeHtmlText(t)}</code>` },
  { pattern: /(?:^|[^$\\])\$([^$\n]+?)\$/u, render: (tex) => renderInlineMathHtml(tex) },
]

const BLOCK_PREFIX_PATTERN = /^\u200B*(#{1,3}|[-*>]|1\.)[ \u00A0]/u

/** 匹配行首块级 Markdown 快捷前缀（以空格或 nbsp 触发） */
export function matchBlockPrefix(textBeforeCaret: string): BlockShortcutAction | null {
  const match = BLOCK_PREFIX_PATTERN.exec(textBeforeCaret)
  if (match === null) return null
  const token = match[1]
  if (token === undefined) return null
  return BLOCK_RULES[token] ?? null
}

function matchWithRules(text: string, rules: readonly InlineRule[]): InlineShortcutMatch | null {
  for (const rule of rules) {
    const match = rule.pattern.exec(text)
    if (match === null) continue
    const inner = match[1]
    if (inner === undefined || inner.trim() === '') continue
    const fullMatch = match[0]
    const hasLeadingChar =
      (!fullMatch.startsWith('$') && fullMatch.endsWith('$')) ||
      (!fullMatch.startsWith('*') && fullMatch.endsWith('*') && !fullMatch.endsWith('**'))
    const startOffset = hasLeadingChar ? 1 : 0
    return {
      startIndex: match.index + startOffset,
      endIndex: match.index + fullMatch.length,
      replacementHtml: rule.render(inner),
    }
  }
  return null
}

/** 匹配光标前的行内 Markdown 闭合语法（**加粗**、*斜体*、~~删除线~~、`代码`、$公式$） */
export function matchInlineMarkdown(textBeforeCaret: string): InlineShortcutMatch | null {
  return matchWithRules(textBeforeCaret, INLINE_RULES)
}

/** 匹配文本任意位置的闭合行内语法（用于先输入 $$ 再回填 \pi 后按回车或完成编辑的场景） */
export function matchAnyInlineMarkdown(text: string): InlineShortcutMatch | null {
  return matchWithRules(text, ANYWHERE_INLINE_RULES)
}

function isAtBlockStart(editor: HTMLDivElement, textNode: Node): boolean {
  let current: Node | null = textNode
  while (current !== null && current !== editor) {
    if (current.previousSibling !== null) return false
    const parent: Node | null = current.parentNode
    if (
      parent instanceof HTMLElement &&
      (parent === editor || /^(?:DIV|P|H[1-6]|BLOCKQUOTE|LI)$/iu.test(parent.tagName))
    ) {
      return true
    }
    current = parent
  }
  return false
}

function placeCaretAt(node: Node, offset: number): void {
  const selection = window.getSelection()
  if (selection === null) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 合并相邻拆分文本节点并解析当前光标所在的 Text 节点与偏移量（修复中文输入法拆分文本节点） */
function resolveActiveTextCaret(
  editor: HTMLDivElement,
): { readonly textNode: Text; readonly offset: number } | null {
  const selection = window.getSelection()
  if (selection === null || !selection.isCollapsed) return null
  let anchorNode: Node | null = selection.anchorNode
  let offset = selection.anchorOffset
  if (anchorNode === null || !editor.contains(anchorNode)) return null

  if (anchorNode instanceof Element && offset > 0) {
    const prevChild = anchorNode.childNodes[offset - 1]
    if (prevChild instanceof Text) {
      anchorNode = prevChild
      offset = prevChild.data.length
    }
  }
  if (!(anchorNode instanceof Text)) return null

  while (anchorNode.previousSibling instanceof Text) {
    const prev = anchorNode.previousSibling
    anchorNode.data = prev.data + anchorNode.data
    offset += prev.data.length
    prev.parentNode?.removeChild(prev)
  }
  while (anchorNode.nextSibling instanceof Text) {
    const next = anchorNode.nextSibling
    anchorNode.data = anchorNode.data + next.data
    next.parentNode?.removeChild(next)
  }
  return { textNode: anchorNode, offset }
}

function runBlockAction(
  editor: HTMLDivElement,
  textNode: Text,
  action: BlockShortcutAction,
): void {
  const remaining = textNode.data.replace(BLOCK_PREFIX_PATTERN, '')
  if (action.kind === 'command') {
    textNode.data = remaining
    placeCaretAt(textNode, remaining.length)
    // eslint-disable-next-line typescript/no-deprecated -- contentEditable 列表命令
    document.execCommand(action.command, false)
    return
  }

  const block = document.createElement(action.tag)
  const contentText = document.createTextNode(remaining === '' ? '\u200B' : remaining)
  block.appendChild(contentText)

  const parent = textNode.parentElement
  if (parent !== null && parent !== editor && parent.parentElement === editor) {
    editor.replaceChild(block, parent)
  } else if (textNode.parentNode !== null) {
    textNode.parentNode.replaceChild(block, textNode)
  }
  placeCaretAt(contentText, contentText.data.length)
}

function runInlineReplacement(
  textNode: Text,
  match: InlineShortcutMatch,
  moveCaret: boolean,
): void {
  const before = textNode.data.slice(0, match.startIndex)
  const after = textNode.data.slice(match.endIndex)
  const parent = textNode.parentNode
  if (parent === null) return

  const template = document.createElement('template')
  template.innerHTML = match.replacementHtml
  const insertedNode = template.content.firstChild
  if (insertedNode === null) return

  textNode.data = before
  const trailingText = document.createTextNode(`\u200B${after}`)
  const nextSibling = textNode.nextSibling
  parent.insertBefore(insertedNode, nextSibling)
  parent.insertBefore(trailingText, nextSibling)
  if (moveCaret) {
    placeCaretAt(trailingText, 1)
  }
}

/** 扫描并转换编辑器中所有已闭合但尚未渲染的行内语法（如先打 $$ 再填 \pi 后按回车） */
export function flushPendingInlineMarkdown(
  editor: HTMLDivElement | null,
  allowCaretInside = true,
): boolean {
  if (editor === null) return false
  const caret = allowCaretInside ? null : resolveActiveTextCaret(editor)
  let changed = false
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current !== null) {
    if (
      current instanceof Text &&
      current.parentElement?.closest('.pl-math, code') === null
    ) {
      textNodes.push(current)
    }
    current = walker.nextNode()
  }

  for (const node of textNodes) {
    const match = matchAnyInlineMarkdown(node.data)
    if (match === null) continue
    if (
      caret !== null &&
      node === caret.textNode &&
      caret.offset > match.startIndex &&
      caret.offset < match.endIndex
    ) {
      continue
    }
    runInlineReplacement(node, match, true)
    changed = true
  }
  return changed
}

/** 在标题或引用块末尾按回车时，换行回到普通段落 */
export function exitHeadingOrQuoteOnEnter(
  editor: HTMLDivElement | null,
  key: string,
  shiftKey: boolean,
): boolean {
  if (editor === null || key !== 'Enter' || shiftKey) return false
  const selection = window.getSelection()
  if (selection === null || !selection.isCollapsed) return false
  let current: Node | null = selection.anchorNode
  while (current !== null && current !== editor) {
    if (
      current instanceof HTMLElement &&
      /^(?:H[1-6]|BLOCKQUOTE)$/iu.test(current.tagName) &&
      current.parentElement === editor
    ) {
      const nextBlock = document.createElement('div')
      const text = document.createTextNode('\u200B')
      nextBlock.appendChild(text)
      editor.insertBefore(nextBlock, current.nextSibling)
      placeCaretAt(text, 1)
      return true
    }
    current = current.parentNode
  }
  return false
}

/** 在富文本输入时检查并执行 Markdown 即时转换（方式 A），触发转换时返回 true */
export function applyMarkdownShortcut(editor: HTMLDivElement | null): boolean {
  if (editor === null) return false
  const caret = resolveActiveTextCaret(editor)
  if (caret !== null) {
    const { textNode, offset } = caret
    const textBeforeCaret = textNode.data.slice(0, offset)

    if (isAtBlockStart(editor, textNode)) {
      const blockAction = matchBlockPrefix(textBeforeCaret)
      if (blockAction !== null) {
        runBlockAction(editor, textNode, blockAction)
        return true
      }
    }

    const inlineMatch = matchInlineMarkdown(textBeforeCaret)
    if (inlineMatch !== null) {
      runInlineReplacement(textNode, inlineMatch, true)
      return true
    }
  }

  return flushPendingInlineMarkdown(editor, false)
}
