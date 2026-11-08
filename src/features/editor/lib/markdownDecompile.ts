import { escapeHtmlText } from '@/shared/lib/html'
import { BLOCK_TAG_PATTERN, cleanBrowserArtifacts } from './markdownClean'
import { escapeMarkdownSourceChars } from './markdownEscapes'

const BLOCK_TOKEN_AT_LINE_START = /^(?:#{1,3}|>|[-*]|\d+\.)[ \u00A0]/u

export function splitNodesAtBr(nodes: readonly Node[]): Node[][] {
  const segments: Node[][] = [[]]
  for (const node of nodes) {
    if (node instanceof HTMLBRElement) segments.push([])
    else segments[segments.length - 1]?.push(node.cloneNode(true))
  }
  if (segments.length > 1 && (segments[segments.length - 1]?.length ?? 0) === 0) segments.pop()
  return segments
}

export function firstLeadingTextNode(root: Node): Text | null {
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

export function hasChildBlockElement(el: HTMLElement): boolean {
  return Array.from(el.children).some((child) => BLOCK_TAG_PATTERN.test(child.tagName))
}

function revertInlineMarkdownElements(root: HTMLElement): void {
  root.querySelectorAll('.pl-math').forEach((mathEl) => {
    const tex = mathEl.getAttribute('data-pl-math') ?? (mathEl.textContent ?? '')
    mathEl.replaceWith(document.createTextNode(`$${escapeMarkdownSourceChars(tex)}$`))
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

/** 无结构前缀的行若以块级语法 token 开头，转义其中的标点以免被重新编译成标题/列表 */
function escapeLeadingBlockToken(div: HTMLElement): void {
  const textNode = firstLeadingTextNode(div)
  if (textNode === null) return
  const match = BLOCK_TOKEN_AT_LINE_START.exec(textNode.data)
  if (match === null) return
  const token = match[0]
  const escapeAt = /^\d/u.test(token) ? token.indexOf('.') : 0
  textNode.data = `${textNode.data.slice(0, escapeAt)}\\${textNode.data.slice(escapeAt)}`
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
    const linePrefix = idx === 0 ? firstLinePrefix : ''
    if (linePrefix === '') escapeLeadingBlockToken(temp)
    const html = `${linePrefix}${temp.innerHTML}`
    if (html !== '' || segments.length > 1) lines.push(html)
  })
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

/** 把字面文本里的语法敏感字符转义成源码写法，保证重新编译时不被误认为语法 */
function escapeLiteralTextForSource(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let cur = walker.nextNode(); cur !== null; cur = walker.nextNode()) {
    if (cur instanceof Text && cur.parentElement?.closest('pre, .pl-math') === null) {
      cur.data = escapeMarkdownSourceChars(cur.data)
    }
  }
}

/**
 * 将节点存储的已渲染 HTML 还原为编辑器内显示的「Markdown 源码 + 文本富文本样式」行结构。
 */
export function decompileRichTextToEditableHtml(renderedHtml: string): string {
  if (renderedHtml.trim() === '') return ''
  const root = document.createElement('div')
  root.innerHTML = renderedHtml
  // 已渲染 HTML 里的字面 $ / * 等是内容而非语法，不能剥离它们携带的样式
  cleanBrowserArtifacts(root, false)
  escapeLiteralTextForSource(root)
  revertInlineMarkdownElements(root)

  const lines: string[] = []
  collectEditableLines(root, lines)
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop()
  }
  if (lines.length === 0) return ''
  return lines.map((line) => `<div>${line === '' ? '<br>' : line}</div>`).join('')
}