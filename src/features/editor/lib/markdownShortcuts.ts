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
  { pattern: /(?:^|[^*])\*([^*\s][^*]*?)\*(?!\*)/u, render: (t) => `<em>${escapeHtmlText(t)}</em>` },
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
  let earliest: InlineShortcutMatch | null = null
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
    const candidate: InlineShortcutMatch = {
      startIndex: match.index + startOffset,
      endIndex: match.index + fullMatch.length,
      replacementHtml: rule.render(inner),
    }
    if (earliest === null || candidate.startIndex < earliest.startIndex) {
      earliest = candidate
    }
  }
  return earliest
}

/** 匹配光标前的行内 Markdown 闭合语法（**加粗**、*斜体*、~~删除线~~、`代码`、$公式$） */
export function matchInlineMarkdown(textBeforeCaret: string): InlineShortcutMatch | null {
  return matchWithRules(textBeforeCaret, INLINE_RULES)
}

/** 匹配文本任意位置的闭合行内语法（用于先输入 $$ 再回填 \pi 后按回车或粘贴多处语法的场景） */
export function matchAnyInlineMarkdown(text: string): InlineShortcutMatch | null {
  return matchWithRules(text, ANYWHERE_INLINE_RULES)
}

function isIgnorableEmptySibling(node: Node): boolean {
  return node instanceof Text && node.data.replace(/\u200B/gu, '') === ''
}

function isAtBlockStart(editor: HTMLDivElement, textNode: Node): boolean {
  let current: Node | null = textNode
  while (current !== null && current !== editor) {
    let prev = current.previousSibling
    while (prev !== null && isIgnorableEmptySibling(prev)) {
      prev = prev.previousSibling
    }
    if (prev instanceof HTMLBRElement) return true
    if (prev !== null) return false
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

export function placeCaretAt(node: Node, offset: number): void {
  const selection = window.getSelection()
  if (selection === null) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function deepestLastTextNode(root: Node): Text | null {
  let cursor: Node | null = root
  while (cursor !== null && !(cursor instanceof Text)) {
    cursor = cursor.lastChild
  }
  return cursor instanceof Text ? cursor : null
}

/** 合并相邻拆分文本节点并解析当前光标所在的 Text 节点与偏移量（合并后同步修复浏览器光标） */
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
    const lastText = prevChild === undefined ? null : deepestLastTextNode(prevChild)
    if (lastText !== null) {
      anchorNode = lastText
      offset = lastText.data.length
    }
  }
  if (!(anchorNode instanceof Text)) return null

  let merged = false
  while (anchorNode.previousSibling instanceof Text) {
    const prev = anchorNode.previousSibling
    anchorNode.data = prev.data + anchorNode.data
    offset += prev.data.length
    prev.parentNode?.removeChild(prev)
    merged = true
  }
  while (anchorNode.nextSibling instanceof Text) {
    const next = anchorNode.nextSibling
    anchorNode.data = anchorNode.data + next.data
    next.parentNode?.removeChild(next)
    merged = true
  }
  if (merged) {
    placeCaretAt(anchorNode, offset)
  }
  return { textNode: anchorNode, offset }
}

function unwrapFormattedBlockIfNeeded(editor: HTMLDivElement, textNode: Text): void {
  const parent = textNode.parentElement
  if (
    parent !== null &&
    parent !== editor &&
    parent.parentElement === editor &&
    /^(?:H[1-6]|BLOCKQUOTE)$/iu.test(parent.tagName)
  ) {
    const div = document.createElement('div')
    while (parent.firstChild !== null) {
      div.appendChild(parent.firstChild)
    }
    editor.replaceChild(div, parent)
  }
}

function runBlockAction(
  editor: HTMLDivElement,
  textNode: Text,
  action: BlockShortcutAction,
): void {
  const remaining = textNode.data.replace(BLOCK_PREFIX_PATTERN, '')
  if (action.kind === 'command') {
    unwrapFormattedBlockIfNeeded(editor, textNode)
    textNode.data = remaining === '' ? '\u200B' : remaining
    placeCaretAt(textNode, textNode.data.length)
    // eslint-disable-next-line typescript/no-deprecated -- contentEditable 列表命令
    document.execCommand(action.command, false)
    return
  }

  const block = document.createElement(action.tag)
  const parent = textNode.parentElement
  const isDirectBlock =
    parent !== null &&
    parent !== editor &&
    parent.parentElement === editor &&
    /^(?:DIV|P|H[1-6]|BLOCKQUOTE)$/iu.test(parent.tagName)

  const hasOtherSiblings = isDirectBlock && parent.childNodes.length > 1
  textNode.data = remaining === '' && !hasOtherSiblings ? '\u200B' : remaining
  const caretOffset = remaining === '' && !hasOtherSiblings ? 1 : remaining.length

  if (isDirectBlock) {
    while (parent.firstChild !== null) {
      block.appendChild(parent.firstChild)
    }
    editor.replaceChild(block, parent)
  } else if (textNode.parentNode !== null) {
    textNode.parentNode.replaceChild(block, textNode)
    block.appendChild(textNode)
  }
  placeCaretAt(textNode, caretOffset)
}

function runInlineReplacement(
  textNode: Text,
  match: InlineShortcutMatch,
  moveCaret: boolean,
): Text | null {
  const before = textNode.data.slice(0, match.startIndex)
  const after = textNode.data.slice(match.endIndex)
  const parent = textNode.parentNode
  if (parent === null) return null

  const template = document.createElement('template')
  template.innerHTML = match.replacementHtml
  const insertedNode = template.content.firstChild
  if (insertedNode === null) return null

  textNode.data = before
  const trailingText = document.createTextNode(`\u200B${after}`)
  const nextSibling = textNode.nextSibling
  parent.insertBefore(insertedNode, nextSibling)
  parent.insertBefore(trailingText, nextSibling)
  if (moveCaret) {
    placeCaretAt(trailingText, 1)
  }
  return trailingText
}

/** 扫描并转换编辑器中所有已闭合但尚未渲染的行内语法（保留光标相对位置并支持同行多处转换） */
export function flushPendingInlineMarkdown(
  editor: HTMLDivElement | null,
  allowCaretInside = true,
): boolean {
  if (editor === null) return false
  let caret = resolveActiveTextCaret(editor)
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

  for (const initialNode of textNodes) {
    let node: Text | null = initialNode
    while (node !== null) {
      const match = matchAnyInlineMarkdown(node.data)
      if (match === null) break
      const isCaretNode = caret !== null && node === caret.textNode
      const caretInsideMatch =
        isCaretNode && caret !== null && caret.offset > match.startIndex && caret.offset <= match.endIndex
      if (!allowCaretInside && isCaretNode && caret !== null && caret.offset > match.startIndex && caret.offset < match.endIndex) {
        break
      }
      const prevCaretOffset: number = isCaretNode && caret !== null ? caret.offset : -1
      const trailing: Text | null = runInlineReplacement(node, match, caretInsideMatch)
      changed = true
      if (trailing !== null && isCaretNode && !caretInsideMatch && prevCaretOffset > match.endIndex) {
        const nextOffset: number = Math.min(
          trailing.data.length,
          prevCaretOffset - match.endIndex + 1,
        )
        placeCaretAt(trailing, nextOffset)
        caret = { textNode: trailing, offset: nextOffset }
      }
      node = trailing
    }
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

/** 在行内代码/加粗/斜体/删除线末尾按右方向键时，跳出该行内标签以便继续输入普通文字 */
export function stepOutOfInlineOnArrowRight(editor: HTMLDivElement | null): boolean {
  if (editor === null) return false
  const caret = resolveActiveTextCaret(editor)
  if (caret === null || caret.offset < caret.textNode.data.length) return false
  const inlineParent = caret.textNode.parentElement?.closest('code, strong, em, del, a')
  if (
    !(inlineParent instanceof HTMLElement) ||
    !editor.contains(inlineParent) ||
    caret.textNode.nextSibling !== null
  ) {
    return false
  }
  const next = inlineParent.nextSibling
  if (next instanceof Text) {
    const targetOffset = next.data.startsWith('\u200B') ? 1 : 0
    placeCaretAt(next, targetOffset)
    return true
  }
  const trailing = document.createTextNode('\u200B')
  inlineParent.parentNode?.insertBefore(trailing, next)
  placeCaretAt(trailing, 1)
  return true
}

/** 处理退格键：一键删除光标紧邻的数学公式块，或在标题/引用块行首退回普通段落 */
export function handleEditorBackspace(editor: HTMLDivElement | null): boolean {
  if (editor === null) return false
  const selection = window.getSelection()
  if (selection === null || !selection.isCollapsed) return false

  const anchor = selection.anchorNode
  const offset = selection.anchorOffset
  if (anchor instanceof Element && offset > 0) {
    const prevChild = anchor.childNodes[offset - 1]
    if (prevChild instanceof HTMLElement && prevChild.classList.contains('pl-math')) {
      prevChild.remove()
      return true
    }
  }

  const caret = resolveActiveTextCaret(editor)
  if (caret === null) return false
  const textBefore = caret.textNode.data.slice(0, caret.offset).replace(/\u200B/gu, '')
  if (textBefore !== '') return false

  const prevSibling = caret.textNode.previousSibling
  if (prevSibling instanceof HTMLElement && prevSibling.classList.contains('pl-math')) {
    prevSibling.remove()
    placeCaretAt(caret.textNode, caret.offset)
    return true
  }

  const block = caret.textNode.parentElement
  if (
    block !== null &&
    block !== editor &&
    block.parentElement === editor &&
    /^(?:H[1-6]|BLOCKQUOTE)$/iu.test(block.tagName) &&
    prevSibling === null
  ) {
    const div = document.createElement('div')
    while (block.firstChild !== null) {
      div.appendChild(block.firstChild)
    }
    editor.replaceChild(div, block)
    placeCaretAt(caret.textNode, caret.offset)
    return true
  }
  return false
}

/** 双击已渲染的数学公式块时，将其还原为 $...$ 源码以便原地修改 */
export function expandMathElementForEditing(mathEl: HTMLElement): boolean {
  const tex = mathEl.getAttribute('data-pl-math')
  const parent = mathEl.parentNode
  if (tex === null || parent === null) return false
  const raw = `$${tex}$`
  const textNode = document.createTextNode(raw)
  parent.replaceChild(textNode, mathEl)
  placeCaretAt(textNode, raw.length - 1)
  return true
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
