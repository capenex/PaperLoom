import { escapeHtmlText } from '@/shared/lib/html'

/** 反斜杠可转义的 ASCII 标点；转义后字符按字面渲染，不再参与任何语法 */
export const ASCII_PUNCTUATION_PATTERN = /[!-/:-@[-`{-~]/u
const ESCAPE_SENTINEL_BASE = 0xe000
const ESCAPE_SENTINEL_PATTERN = /[\uE021-\uE07E]/gu
const SOURCE_ESCAPE_PATTERN = /[\\$`*~]/gu

function escapeSentinel(char: string): string {
  return String.fromCharCode(ESCAPE_SENTINEL_BASE + char.charCodeAt(0))
}

export function restoreEscapeSentinels(text: string): string {
  return text.replace(ESCAPE_SENTINEL_PATTERN, (sentinel) =>
    String.fromCharCode(sentinel.charCodeAt(0) - ESCAPE_SENTINEL_BASE),
  )
}

export function restoreEscapeSentinelsInHtml(html: string): string {
  return html.replace(ESCAPE_SENTINEL_PATTERN, (sentinel) =>
    escapeHtmlText(String.fromCharCode(sentinel.charCodeAt(0) - ESCAPE_SENTINEL_BASE)),
  )
}

export function escapeMarkdownSourceChars(text: string): string {
  return text.replace(SOURCE_ESCAPE_PATTERN, (char) => `\\${char}`)
}

function collectSourceTextNodes(container: HTMLElement): readonly Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current !== null) {
    if (current instanceof Text && current.parentElement?.closest('code, .pl-math') === null) {
      nodes.push(current)
    }
    current = walker.nextNode()
  }
  return nodes
}

function followingChar(nodes: readonly Text[], index: number): { readonly node: Text; readonly char: string } | null {
  for (let j = index + 1; j < nodes.length; j += 1) {
    const node = nodes[j]
    if (node !== undefined && node.data.length > 0) return { node, char: node.data[0] ?? '' }
  }
  return null
}

function neutralizeNodeEscapes(node: Text, following: { readonly node: Text; readonly char: string } | null): void {
  const data = node.data
  let out = ''
  let p = 0
  while (p < data.length) {
    const char = data[p] ?? ''
    const nextInNode = p + 1 < data.length ? (data[p + 1] ?? '') : null
    if (char === '\\' && nextInNode !== null && ASCII_PUNCTUATION_PATTERN.test(nextInNode)) {
      out += escapeSentinel(nextInNode)
      p += 2
      continue
    }
    if (char === '\\' && nextInNode === null && following !== null && ASCII_PUNCTUATION_PATTERN.test(following.char)) {
      following.node.data = escapeSentinel(following.char) + following.node.data.slice(1)
      p += 1
      continue
    }
    out += char
    p += 1
  }
  node.data = out
}

/**
 * 消费反斜杠转义：`\X` 去掉反斜杠、把 X 换成哨兵字符按字面渲染。
 * 转义对可以跨内联元素边界——反斜杠是语法，被转义的字符是内容，
 * 因此第二个字符可以独立携带字号、颜色、引用等富文本样式。
 */
export function neutralizeBackslashEscapes(container: HTMLElement): void {
  const nodes = collectSourceTextNodes(container)
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node === undefined) continue
    neutralizeNodeEscapes(node, followingChar(nodes, i))
  }
}