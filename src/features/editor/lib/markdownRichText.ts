import { escapeHtmlText } from '@/shared/lib/html'
import { renderInlineMathHtml } from './mathFormula'
import { placeCaretAt } from './markdownShortcuts'

const BLOCK_TAG_PATTERN = /^(?:DIV|P|H[1-6]|BLOCKQUOTE|UL|OL|LI|PRE)$/iu
const RENDERED_BLOCK_DETECT_PATTERN = /<(?:h[1-6]|ul|ol|blockquote|pre)\b|class="pl-math"/iu
const HEADING_PREFIX_PATTERN = /^(\u200B*#{1,3})[ \u00A0]+/u
const QUOTE_PREFIX_PATTERN = /^\u200B*>[ \u00A0]+/u
const UL_PREFIX_PATTERN = /^\u200B*[-*][ \u00A0]+/u
const OL_PREFIX_PATTERN = /^\u200B*\d+\.[ \u00A0]+/u

interface InlineMarkdownRule {
  readonly pattern: RegExp
  readonly render: (inner: string) => string
}

const INLINE_COMPILE_RULES: readonly InlineMarkdownRule[] = [
  { pattern: /\*\*([^*\s][^*]*?)\*\*/u, render: (t) => `<strong data-pl-md="**">${escapeHtmlText(t)}</strong>` },
  { pattern: /~~([^~\s][^~]*?)~~/u, render: (t) => `<del data-pl-md="~~">${escapeHtmlText(t)}</del>` },
  { pattern: /`([^`\n]+)`/u, render: (t) => `<code>${escapeHtmlText(t)}</code>` },
  { pattern: /(?:^|[^$\\])\$([^$\n]+?)\$/u, render: (tex) => renderInlineMathHtml(tex) },
  { pattern: /(?:^|[^*])\*([^*\s][^*]*?)\*(?!\*)/u, render: (t) => `<em data-pl-md="*">${escapeHtmlText(t)}</em>` },
]

const PURE_MD_SYNTAX_PATTERN = /^[\s\u00A0\u200B]*(?:#{1,3}|[-*>]|\d+\.|\*{1,2}|~~|`|\$)+[\s\u00A0\u200B]*$/u
const LINE_PREFIX_EXTRACT_PATTERN = /^((?:#{1,3}|>|[-*]|\d+\.)[ \u00A0]+)/u

export function unwrapElement(el: Element): void {
  const parent = el.parentNode
  if (parent === null) return
  while (el.firstChild !== null) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

function hoistLineMarkdownPrefix(lineEl: HTMLElement): void {
  const rawText = (lineEl.textContent ?? '').replace(/\u200B/gu, '')
  const match = LINE_PREFIX_EXTRACT_PATTERN.exec(rawText)
  if (match === null) return
  const prefix = match[1] ?? ''
  if (lineEl.firstChild instanceof Text && lineEl.firstChild.data.replace(/\u200B/gu, '').startsWith(prefix)) {
    return
  }

  let remaining = prefix.length
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT)
  for (let cur = walker.nextNode(); cur !== null && remaining > 0; cur = walker.nextNode()) {
    if (cur instanceof Text) {
      const cleaned = cur.data.replace(/\u200B/gu, '')
      if (cleaned.length <= remaining) {
        remaining -= cleaned.length
        cur.data = ''
      } else {
        cur.data = cleaned.slice(remaining)
        remaining = 0
      }
    }
  }

  lineEl.querySelectorAll('a, font, span, b, strong, i, em, u, s, del, strike').forEach((el) => {
    if ((el.textContent ?? '').replace(/\u200B/gu, '') === '' && el.querySelector('img, br') === null) {
      el.remove()
    }
  })
  lineEl.insertBefore(document.createTextNode(prefix.replace(/\u00A0/gu, ' ')), lineEl.firstChild)
}

/** 清理浏览器注入的默认计算样式 span、零宽字符，并剥离误挂在 Markdown 语法符（如 - / #）上的链接或样式 */
export function cleanBrowserArtifacts(root: HTMLElement): void {
  root.querySelectorAll('span[style]').forEach((span) => {
    if (!(span instanceof HTMLElement)) return
    if ((span.getAttribute('style') ?? '').includes('oklch')) {
      span.style.removeProperty('color')
      span.style.removeProperty('font-size')
    }
    if (span.style.backgroundColor.trim() === '' && span.style.color.trim() === '') {
      unwrapElement(span)
    }
  })

  root.querySelectorAll('a, font, span, b, strong, i, em, u, s, del, strike').forEach((el) => {
    if (!el.classList.contains('pl-math') && PURE_MD_SYNTAX_PATTERN.test(el.textContent ?? '')) {
      unwrapElement(el)
    }
  })

  const lineDivs = Array.from(root.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && BLOCK_TAG_PATTERN.test(child.tagName),
  )
  if (lineDivs.length > 0) lineDivs.forEach(hoistLineMarkdownPrefix)
  else hoistLineMarkdownPrefix(root)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let cur = walker.nextNode(); cur !== null; cur = walker.nextNode()) {
    if (cur instanceof Text && cur.data.includes('\u200B')) {
      cur.data = cur.data.replace(/\u200B/gu, '')
    }
  }
}

function revertInlineMarkdownElements(root: HTMLElement): void {
  root.querySelectorAll('.pl-math').forEach((mathEl) => {
    const tex = mathEl.getAttribute('data-pl-math') ?? (mathEl.textContent ?? '')
    mathEl.replaceWith(document.createTextNode(`$${tex}$`))
  })
  root.querySelectorAll('code').forEach((codeEl) => {
    if (codeEl.closest('pre') === null) {
      codeEl.replaceWith(document.createTextNode(`\`${codeEl.textContent ?? ''}\``))
    }
  })
  root.querySelectorAll('[data-pl-md]').forEach((mdEl) => {
    const marker = mdEl.getAttribute('data-pl-md') ?? ''
    if (marker !== '**' && marker !== '*' && marker !== '~~') return
    const parent = mdEl.parentNode
    if (parent === null) return
    parent.insertBefore(document.createTextNode(marker), mdEl)
    while (mdEl.firstChild !== null) parent.insertBefore(mdEl.firstChild, mdEl)
    parent.insertBefore(document.createTextNode(marker), mdEl)
    parent.removeChild(mdEl)
  })
}

function splitNodesAtBr(nodes: readonly Node[]): Node[][] {
  const segments: Node[][] = [[]]
  for (const node of nodes) {
    if (node instanceof HTMLBRElement) segments.push([])
    else segments[segments.length - 1]?.push(node.cloneNode(true))
  }
  if (segments.length > 1 && (segments[segments.length - 1]?.length ?? 0) === 0) segments.pop()
  return segments
}

function serializeNodesSplittingBr(nodes: readonly Node[], firstLinePrefix: string, lines: string[]): void {
  if (nodes.length === 1 && nodes[0] instanceof HTMLBRElement && firstLinePrefix === '') {
    lines.push('')
    return
  }
  const segments = splitNodesAtBr(nodes)
  segments.forEach((segment, idx) => {
    const temp = document.createElement('div')
    for (const item of segment) temp.appendChild(item)
    const html = `${idx === 0 ? firstLinePrefix : ''}${temp.innerHTML}`
    if (html !== '' || segments.length > 1) lines.push(html)
  })
}

function hasChildBlockElement(el: HTMLElement): boolean {
  return Array.from(el.children).some((child) => BLOCK_TAG_PATTERN.test(child.tagName))
}

function collectEditableLines(container: Node, lines: string[]): void {
  let inlineBuffer: Node[] = []
  const flushBuffer = (): void => {
    if (inlineBuffer.length === 0) return
    serializeNodesSplittingBr(inlineBuffer, '', lines)
    inlineBuffer = []
  }

  for (const child of Array.from(container.childNodes)) {
    if (child instanceof HTMLElement && BLOCK_TAG_PATTERN.test(child.tagName)) {
      flushBuffer()
      const tag = child.tagName.toUpperCase()
      const childNodes = Array.from(child.childNodes)
      if (tag === 'PRE') {
        lines.push('```', ...(child.textContent ?? '').split(/\r?\n/u).map(escapeHtmlText), '```')
      } else if (/^H[1-6]$/u.test(tag)) {
        serializeNodesSplittingBr(childNodes, `${'#'.repeat(Math.min(3, Math.max(1, Number(tag.slice(1)))))} `, lines)
      } else if (tag === 'BLOCKQUOTE') {
        serializeNodesSplittingBr(childNodes, '&gt; ', lines)
      } else if (tag === 'UL') {
        Array.from(child.children).forEach((li) => { serializeNodesSplittingBr(Array.from(li.childNodes), '- ', lines) })
      } else if (tag === 'OL') {
        Array.from(child.children).forEach((li, idx) => {
          serializeNodesSplittingBr(Array.from(li.childNodes), `${idx + 1}. `, lines)
        })
      } else if (hasChildBlockElement(child)) {
        collectEditableLines(child, lines)
      } else {
        serializeNodesSplittingBr(childNodes, '', lines)
      }
    } else if (!(child instanceof Text && child.data === '')) {
      inlineBuffer.push(child.cloneNode(true))
    }
  }
  flushBuffer()
}

/**
 * 将节点存储的已渲染 HTML 还原为编辑器内显示的「Markdown 源码 + 文本富文本样式」行结构。
 */
export function decompileRichTextToEditableHtml(renderedHtml: string): string {
  if (renderedHtml.trim() === '') return ''
  const root = document.createElement('div')
  root.innerHTML = renderedHtml
  cleanBrowserArtifacts(root)
  revertInlineMarkdownElements(root)

  const lines: string[] = []
  collectEditableLines(root, lines)
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop()
  }
  if (lines.length === 0) return ''
  return lines.map((line) => `<div>${line === '' ? '<br>' : line}</div>`).join('')
}

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
      if (hasChildBlockElement(child)) {
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

function firstLeadingTextNode(root: Node): Text | null {
  let cursor: Node | null = root.firstChild
  while (cursor !== null) {
    if (cursor instanceof Text) {
      if (cursor.data === '') {
        const next = cursor.nextSibling
        cursor.remove()
        cursor = next
        continue
      }
      return cursor
    }
    if (cursor instanceof HTMLElement && !/^(?:BR|IMG|HR)$/iu.test(cursor.tagName)) {
      cursor = cursor.firstChild
    } else {
      return null
    }
  }
  return null
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

function findEarliestInlineCompileMatch(text: string): {
  readonly startIndex: number
  readonly endIndex: number
  readonly replacementHtml: string
} | null {
  let earliest: { startIndex: number; endIndex: number; replacementHtml: string } | null = null
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
      earliest = { startIndex, endIndex, replacementHtml: rule.render(inner) }
    }
  }
  return earliest
}

function compileFragmentInlineMarkdown(frag: DocumentFragment): string {
  const container = document.createElement('div')
  container.appendChild(frag)
  container.normalize()

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

  return container.innerHTML
    .replace(/\*\*(?!\s)((?:(?!\*\*)[\s\S])+?)(?<!\s)\*\*/gu, '<strong data-pl-md="**">$1</strong>')
    .replace(/~~(?!\s)((?:(?!~~)[\s\S])+?)(?<!\s)~~/gu, '<del data-pl-md="~~">$1</del>')
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
    if ((frag.textContent ?? '').trim().startsWith('```')) {
      flushList()
      const fenced = readFencedCodeBlock(fragments, index)
      htmlParts.push(fenced.html)
      index = fenced.nextIndex
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
