import { ASCII_PUNCTUATION_PATTERN } from './markdownEscapes'

export const BLOCK_TAG_PATTERN = /^(?:DIV|P|H[1-6]|BLOCKQUOTE|UL|OL|LI|PRE)$/iu
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

function firstTextInside(node: Node): Text | null {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  const first = walker.nextNode()
  return first instanceof Text ? first : null
}

/** 目标文本节点之前紧邻的反斜杠个数是否为奇数（奇数=最后一个反斜杠正在转义它） */
function precededByEscapeBackslash(line: Node, target: Text): boolean {
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
  let preceding = ''
  for (let cur = walker.nextNode(); cur !== null; cur = walker.nextNode()) {
    if (cur === target) break
    if (cur instanceof Text) preceding += cur.data
  }
  let run = 0
  for (let i = preceding.length - 1; i >= 0 && preceding[i] === '\\'; i -= 1) run += 1
  return run % 2 === 1
}

/** 元素里看似纯语法的字符若正被反斜杠转义，则它是内容，必须保留其富文本样式 */
function isEscapedSyntaxContent(root: HTMLElement, el: Element): boolean {
  const firstText = firstTextInside(el)
  if (firstText === null) return false
  const char = firstText.data[0] ?? ''
  if (!ASCII_PUNCTUATION_PATTERN.test(char)) return false
  let line: Node = el
  while (line.parentNode !== null && line.parentNode !== root) line = line.parentNode
  return precededByEscapeBackslash(line, firstText)
}

/** 清理浏览器注入的默认计算样式 span、零宽字符，并剥离误挂在 Markdown 语法符（如 - / #）上的链接或样式 */
export function cleanBrowserArtifacts(root: HTMLElement, stripSyntaxTokenStyling = true): void {
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

  if (stripSyntaxTokenStyling) {
    root.querySelectorAll('a, font, span, b, strong, i, em, u, s, del, strike').forEach((el) => {
      if (el.classList.contains('pl-math')) return
      if (!PURE_MD_SYNTAX_PATTERN.test(el.textContent ?? '')) return
      if (isEscapedSyntaxContent(root, el)) return
      unwrapElement(el)
    })
  }

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