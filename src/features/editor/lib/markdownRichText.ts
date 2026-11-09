import { escapeHtmlText } from '@/shared/lib/html'
import { renderInlineMathHtml } from './mathFormula'
import { BLOCK_TAG_PATTERN, cleanBrowserArtifacts } from './markdownClean'
import {
  decompileRichTextToEditableHtml,
  firstLeadingTextNode,
  hasChildBlockElement,
  splitNodesAtBr,
} from './markdownDecompile'
import {
  neutralizeBackslashEscapes,
  restoreEscapeSentinels,
  restoreEscapeSentinelsInHtml,
} from './markdownEscapes'
import { placeCaretAt } from './markdownShortcuts'

const RENDERED_BLOCK_DETECT_PATTERN = /<(?:h[1-6]|ul|ol|blockquote|pre|hr)\b|class="pl-math"/iu
const HEADING_PREFIX_PATTERN = /^(\u200B*#{1,3})[ \u00A0]+/u
const QUOTE_PREFIX_PATTERN = /^\u200B*>[ \u00A0]+/u
const UL_PREFIX_PATTERN = /^\u200B*[-*][ \u00A0]+/u
const OL_PREFIX_PATTERN = /^\u200B*\d+\.[ \u00A0]+/u
const PAGE_BREAK_LINE_PATTERN = /^[\s\u00A0\u200B]*-{3,}[\s\u00A0\u200B]*$/u
const PAGE_BREAK_HTML = '<hr data-pl-page-break="true">'
const PAGE_BREAK_SPLIT_PATTERN = /<hr\b[^>]*data-pl-page-break[^>]*>/iu

/** 按 `<hr data-pl-page-break="true">` 切分多页富文本；单页时返回长度为 1 的数组 */
export function splitRichTextPages(richText: string): readonly string[] {
  if (richText.trim() === '') return ['']
  const pages = richText.split(PAGE_BREAK_SPLIT_PATTERN)
  return pages.length > 0 ? pages : [richText]
}

interface InlineMarkdownRule {
  readonly pattern: RegExp
  readonly marker: string
  readonly render: (inner: string) => string
}

const INLINE_COMPILE_RULES: readonly InlineMarkdownRule[] = [
  { pattern: /\*\*([^*\s][^*]*?)\*\*/u, marker: '**', render: (t) => `<strong data-pl-md="**">${escapeHtmlText(t)}</strong>` },
  { pattern: /~~([^~\s][^~]*?)~~/u, marker: '~~', render: (t) => `<del data-pl-md="~~">${escapeHtmlText(t)}</del>` },
  { pattern: /`([^`\n]+)`/u, marker: '`', render: (t) => `<code>${escapeHtmlText(t)}</code>` },
  { pattern: /(?:^|[^$\\])\$([^$\n]+?)\$/u, marker: '$', render: (tex) => renderInlineMathHtml(restoreEscapeSentinels(tex)) },
  { pattern: /(?:^|[^*])\*([^*\s][^*]*?)\*(?!\*)/u, marker: '*', render: (t) => `<em data-pl-md="*">${escapeHtmlText(t)}</em>` },
]

function splitNodesIntoFragments(nodes: readonly Node[], out: DocumentFragment[]): void {
  if (nodes.length === 1 && nodes[0] instanceof HTMLBRElement) {
    out.push(document.createDocumentFragment())
    return
  }
  for (const segment of splitNodesAtBr(nodes)) {
    const frag = document.createDocumentFragment()
    for (const item of segment) frag.appendChild(item)
    out.push(frag)
  }
}

function extractEditorLineFragments(container: Node, out: DocumentFragment[]): void {
  let inlineBuffer: Node[] = []
  const flushInline = (): void => {
    if (inlineBuffer.length === 0) return
    splitNodesIntoFragments(inlineBuffer, out)
    inlineBuffer = []
  }

  for (const child of Array.from(container.childNodes)) {
    if (child instanceof HTMLElement && BLOCK_TAG_PATTERN.test(child.tagName)) {
      flushInline()
      if (child.tagName.toUpperCase() === 'HR') {
        const hrFrag = document.createDocumentFragment()
        hrFrag.appendChild(document.createTextNode('---'))
        out.push(hrFrag)
      } else if (hasChildBlockElement(child)) {
        extractEditorLineFragments(child, out)
      } else if (child.childNodes.length === 0) {
        out.push(document.createDocumentFragment())
      } else {
        splitNodesIntoFragments(Array.from(child.childNodes), out)
      }
    } else if (!(child instanceof Text && child.data === '')) {
      inlineBuffer.push(child.cloneNode(true))
    }
  }
  flushInline()
}

type LineBlockKind =
  | { readonly kind: 'heading'; readonly tag: 'h1' | 'h2' | 'h3' }
  | { readonly kind: 'blockquote' }
  | { readonly kind: 'ul' }
  | { readonly kind: 'ol' }
  | { readonly kind: 'paragraph' }

function consumeLineBlockPrefix(frag: DocumentFragment): LineBlockKind {
  frag.normalize()
  const textNode = firstLeadingTextNode(frag)
  if (textNode === null) return { kind: 'paragraph' }

  const text = textNode.data
  const headingMatch = HEADING_PREFIX_PATTERN.exec(text)
  if (headingMatch !== null) {
    const hashes = (headingMatch[1] ?? '').replace(/\u200B/gu, '')
    textNode.data = text.slice(headingMatch[0].length)
    return { kind: 'heading', tag: hashes.length === 1 ? 'h1' : hashes.length === 2 ? 'h2' : 'h3' }
  }
  const quoteMatch = QUOTE_PREFIX_PATTERN.exec(text)
  if (quoteMatch !== null) {
    textNode.data = text.slice(quoteMatch[0].length)
    return { kind: 'blockquote' }
  }
  const ulMatch = UL_PREFIX_PATTERN.exec(text)
  if (ulMatch !== null) {
    textNode.data = text.slice(ulMatch[0].length)
    return { kind: 'ul' }
  }
  const olMatch = OL_PREFIX_PATTERN.exec(text)
  if (olMatch !== null) {
    textNode.data = text.slice(olMatch[0].length)
    return { kind: 'ol' }
  }
  return { kind: 'paragraph' }
}

export function findEarliestInlineCompileMatch(text: string): {
  readonly startIndex: number
  readonly endIndex: number
  readonly replacementHtml: string
  readonly marker: string
} | null {
  let earliest: { startIndex: number; endIndex: number; replacementHtml: string; marker: string } | null = null
  for (const rule of INLINE_COMPILE_RULES) {
    const match = rule.pattern.exec(text)
    if (match === null) continue
    const inner = match[1]
    if (inner === undefined || inner.trim() === '') continue
    const full = match[0]
    const hasLeadingChar =
      (!full.startsWith('$') && full.endsWith('$')) ||
      (!full.startsWith('*') && full.endsWith('*') && !full.endsWith('**'))
    const startIndex = match.index + (hasLeadingChar ? 1 : 0)
    const endIndex = match.index + full.length
    if (earliest === null || startIndex < earliest.startIndex) {
      earliest = { startIndex, endIndex, replacementHtml: rule.render(inner), marker: rule.marker }
    }
  }
  return earliest
}

function compileFragmentInlineMarkdown(frag: DocumentFragment): string {
  const container = document.createElement('div')
  container.appendChild(frag)
  container.normalize()
  neutralizeBackslashEscapes(container)

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current !== null) {
    if (current instanceof Text && current.parentElement?.closest('code, .pl-math') === null) {
      textNodes.push(current)
    }
    current = walker.nextNode()
  }

  for (const initialNode of textNodes) {
    let node: Text | null = initialNode
    while (node !== null) {
      const match = findEarliestInlineCompileMatch(node.data)
      if (match === null || node.parentNode === null) break
      const before = node.data.slice(0, match.startIndex)
      const after = node.data.slice(match.endIndex)
      const tpl = document.createElement('div')
      tpl.innerHTML = match.replacementHtml
      const inserted = tpl.firstChild
      if (inserted === null) break
      node.data = before
      const trailing = document.createTextNode(after)
      const nextSibling = node.nextSibling
      node.parentNode.insertBefore(inserted, nextSibling)
      node.parentNode.insertBefore(trailing, nextSibling)
      node = trailing
    }
  }

  return restoreEscapeSentinelsInHtml(
    container.innerHTML
      .replace(/\*\*(?!\s)((?:(?!\*\*)[\s\S])+?)(?<!\s)\*\*/gu, '<strong data-pl-md="**">$1</strong>')
      .replace(/~~(?!\s)((?:(?!~~)[\s\S])+?)(?<!\s)~~/gu, '<del data-pl-md="~~">$1</del>'),
  )
}

function readFencedCodeBlock(
  fragments: readonly DocumentFragment[],
  startIndex: number,
): { readonly html: string; readonly nextIndex: number } {
  const codeLines: string[] = []
  let idx = startIndex + 1
  while (idx < fragments.length) {
    const nextText = fragments[idx]?.textContent ?? ''
    if (nextText.trim().startsWith('```')) {
      idx += 1
      break
    }
    codeLines.push(nextText)
    idx += 1
  }
  return {
    html: `<pre class="pl-code-block"><code>${escapeHtmlText(codeLines.join('\n'))}</code></pre>`,
    nextIndex: idx,
  }
}

/**
 * 将编辑器内的「Markdown 源码 + 文本富文本样式」实时编译为节点卡片渲染用的 HTML。
 */
export function compileMarkdownRichTextHtml(editorHtml: string): string {
  if (editorHtml.trim() === '') return ''
  const normalizedInput = RENDERED_BLOCK_DETECT_PATTERN.test(editorHtml)
    ? decompileRichTextToEditableHtml(editorHtml)
    : editorHtml

  const root = document.createElement('div')
  root.innerHTML = normalizedInput
  cleanBrowserArtifacts(root)

  const fragments: DocumentFragment[] = []
  extractEditorLineFragments(root, fragments)
  while (
    fragments.length > 0 &&
    (fragments[fragments.length - 1]?.textContent ?? '').trim() === '' &&
    fragments[fragments.length - 1]?.querySelector('a, img') === null
  ) {
    fragments.pop()
  }
  if (fragments.length === 0) return ''

  const htmlParts: string[] = []
  let activeListTag: 'ul' | 'ol' | null = null
  let activeListItems: string[] = []
  const flushList = (): void => {
    if (activeListTag === null) return
    const itemsHtml = activeListItems.map((item) => `<li>${item}</li>`).join('')
    htmlParts.push(`<${activeListTag}>${itemsHtml}</${activeListTag}>`)
    activeListTag = null
    activeListItems = []
  }

  let index = 0
  while (index < fragments.length) {
    const frag = fragments[index]
    if (frag === undefined) break
    const rawLineText = frag.textContent ?? ''
    if (rawLineText.trim().startsWith('```')) {
      flushList()
      const fenced = readFencedCodeBlock(fragments, index)
      htmlParts.push(fenced.html)
      index = fenced.nextIndex
      continue
    }
    if (PAGE_BREAK_LINE_PATTERN.test(rawLineText)) {
      flushList()
      htmlParts.push(PAGE_BREAK_HTML)
      index += 1
      continue
    }

    const blockKind = consumeLineBlockPrefix(frag)
    const inlineHtml = compileFragmentInlineMarkdown(frag)

    if (blockKind.kind === 'ul' || blockKind.kind === 'ol') {
      if (activeListTag !== blockKind.kind) {
        flushList()
        activeListTag = blockKind.kind
      }
      activeListItems.push(inlineHtml)
    } else {
      flushList()
      if (blockKind.kind === 'heading') {
        htmlParts.push(`<${blockKind.tag}>${inlineHtml}</${blockKind.tag}>`)
      } else if (blockKind.kind === 'blockquote') {
        htmlParts.push(`<blockquote>${inlineHtml}</blockquote>`)
      } else {
        htmlParts.push(`<div>${inlineHtml === '' ? '<br>' : inlineHtml}</div>`)
      }
    }
    index += 1
  }

  flushList()
  return htmlParts.join('')
}

function ensureTopLevelLineDivs(editor: HTMLDivElement): void {
  const hasBareInline = Array.from(editor.childNodes).some(
    (child) => !(child instanceof HTMLElement && child.tagName === 'DIV'),
  )
  if (!hasBareInline) return

  const fragments: DocumentFragment[] = []
  extractEditorLineFragments(editor, fragments)
  editor.innerHTML = ''
  if (fragments.length === 0) {
    const div = document.createElement('div')
    div.appendChild(document.createElement('br'))
    editor.appendChild(div)
    return
  }
  for (const frag of fragments) {
    const div = document.createElement('div')
    div.appendChild(frag.childNodes.length === 0 ? document.createElement('br') : frag)
    editor.appendChild(div)
  }
}

function findTopLevelLineDiv(editor: HTMLDivElement, node: Node | null): HTMLDivElement | null {
  let cur: Node | null = node
  while (cur !== null && cur !== editor) {
    if (cur instanceof HTMLDivElement && cur.parentElement === editor) return cur
    cur = cur.parentNode
  }
  return null
}

/**
 * 工具栏点击「新建页」时，在当前所在行下方插入 `---` 分页线与新页首行，并将光标移入新页。
 */
export function insertMarkdownPageBreak(editor: HTMLDivElement | null): void {
  if (editor === null) return
  ensureTopLevelLineDivs(editor)

  const selection = window.getSelection()
  const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const activeDiv = range === null ? null : findTopLevelLineDiv(editor, range.endContainer)
  const allDivs = Array.from(editor.children).filter(
    (el): el is HTMLDivElement => el instanceof HTMLDivElement,
  )
  const targetDiv = activeDiv ?? allDivs[allDivs.length - 1] ?? null

  const hrDiv = document.createElement('div')
  hrDiv.textContent = '---'
  const newPageDiv = document.createElement('div')
  newPageDiv.appendChild(document.createElement('br'))

  if (targetDiv === null) {
    editor.appendChild(hrDiv)
    editor.appendChild(newPageDiv)
  } else {
    const nextSibling = targetDiv.nextSibling
    editor.insertBefore(hrDiv, nextSibling)
    editor.insertBefore(newPageDiv, nextSibling)
  }

  placeCaretAt(newPageDiv, 0)
}

/**
 * 工具栏点击「无序列表 / 有序列表」时，在当前选中的行首切换 `- ` 或 `1. ` Markdown 源码前缀。
 */
export function toggleMarkdownListPrefix(
  editor: HTMLDivElement | null,
  command: 'insertUnorderedList' | 'insertOrderedList',
): void {
  if (editor === null) return
  ensureTopLevelLineDivs(editor)

  const selection = window.getSelection()
  const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const startDiv = range === null ? null : findTopLevelLineDiv(editor, range.startContainer)
  const endDiv = range === null ? null : findTopLevelLineDiv(editor, range.endContainer)

  const allDivs = Array.from(editor.children).filter(
    (el): el is HTMLDivElement => el instanceof HTMLDivElement,
  )
  if (allDivs.length === 0) return

  const startIndex = startDiv === null ? allDivs.length - 1 : Math.max(0, allDivs.indexOf(startDiv))
  const endIndex = endDiv === null ? startIndex : Math.max(startIndex, allDivs.indexOf(endDiv))
  const targetDivs = allDivs.slice(startIndex, endIndex + 1)

  const checkPattern = command === 'insertUnorderedList' ? UL_PREFIX_PATTERN : OL_PREFIX_PATTERN
  const allMatched = targetDivs.every((div) => checkPattern.test(div.textContent ?? ''))

  let lastTextNode: Text | null = null
  for (let idx = 0; idx < targetDivs.length; idx += 1) {
    const div = targetDivs[idx]
    if (div === undefined) continue
    for (const br of Array.from(div.querySelectorAll('br'))) {
      if ((div.textContent ?? '').trim() !== '') br.remove()
    }
    let firstText = firstLeadingTextNode(div)
    if (firstText === null) {
      div.innerHTML = ''
      firstText = document.createTextNode('')
      div.appendChild(firstText)
    }
    const stripped = firstText.data.replace(UL_PREFIX_PATTERN, '').replace(OL_PREFIX_PATTERN, '')
    const prefix = allMatched ? '' : command === 'insertUnorderedList' ? '- ' : `${idx + 1}. `
    firstText.data = `${prefix}${stripped}`
    lastTextNode = firstText
  }

  if (lastTextNode !== null) {
    placeCaretAt(lastTextNode, lastTextNode.data.length)
  }
}
