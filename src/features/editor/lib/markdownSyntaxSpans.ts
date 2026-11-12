import { ASCII_PUNCTUATION_PATTERN } from './markdownEscapes'
import { findEarliestInlineCompileMatch } from './markdownRichText'

export interface MarkdownSyntaxSpan {
  readonly start: number
  readonly end: number
}

const GUARD_LINE_PREFIX_PATTERN = /^\u200B*(?:#{1,3}|>|[-*]|\d+\.)[ \u00A0]*/u
const PAGE_BREAK_SYNTAX_LINE_PATTERN = /^[\s\u00A0\u200B]*-{3,}[\s\u00A0\u200B]*$/u

function mergeSyntaxSpans(spans: readonly MarkdownSyntaxSpan[]): readonly MarkdownSyntaxSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const merged: MarkdownSyntaxSpan[] = []
  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (last !== undefined && span.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, span.end) }
    } else {
      merged.push(span)
    }
  }
  return merged
}

/**
 * 标记一行源码里属于「语法」的字符区间：行首前缀、--- 分页线、转义反斜杠、内联定界符。
 * 转义对里只有第一个反斜杠是语法，被转义的字符是内容，可以携带富文本样式。
 */
export function collectMarkdownSyntaxSpans(lineText: string): readonly MarkdownSyntaxSpan[] {
  if (PAGE_BREAK_SYNTAX_LINE_PATTERN.test(lineText)) {
    return [{ start: 0, end: lineText.length }]
  }
  const spans: MarkdownSyntaxSpan[] = []
  const prefix = GUARD_LINE_PREFIX_PATTERN.exec(lineText)
  if (prefix !== null) spans.push({ start: 0, end: prefix[0].length })

  const neutral = Array.from(lineText)
  let i = 0
  while (i < neutral.length) {
    const next = neutral[i + 1]
    if (neutral[i] === '\\' && next !== undefined && ASCII_PUNCTUATION_PATTERN.test(next)) {
      spans.push({ start: i, end: i + 1 })
      neutral[i + 1] = '\u0000'
      i += 2
    } else {
      i += 1
    }
  }

  let work = neutral.join('')
  for (;;) {
    const match = findEarliestInlineCompileMatch(work)
    if (match === null) break
    const markerLength = match.marker.length
    const open = match.startIndex
    const close = match.endIndex - markerLength
    if (open < close) {
      spans.push({ start: open, end: open + markerLength }, { start: close, end: match.endIndex })
    }
    work =
      work.slice(0, match.startIndex) +
      '\u0000'.repeat(match.endIndex - match.startIndex) +
      work.slice(match.endIndex)
  }

  return mergeSyntaxSpans(spans)
}

/**
 * 收集一行源码中所有未转义的 `$...$` 行内公式完整区间 `[startIndex, endIndex]`。
 * 供选区保护使用：选中含公式的文本或公式片段时，不拆散 `$` 定界符并允许整体挂引用与字号。
 */
export function collectInlineMathRanges(lineText: string): readonly MarkdownSyntaxSpan[] {
  if (PAGE_BREAK_SYNTAX_LINE_PATTERN.test(lineText)) return []
  const neutral = Array.from(lineText)
  let i = 0
  while (i < neutral.length) {
    const next = neutral[i + 1]
    if (neutral[i] === '\\' && next !== undefined && ASCII_PUNCTUATION_PATTERN.test(next)) {
      neutral[i] = '\u0000'
      neutral[i + 1] = '\u0000'
      i += 2
    } else {
      i += 1
    }
  }

  const ranges: MarkdownSyntaxSpan[] = []
  let work = neutral.join('')
  for (;;) {
    const match = findEarliestInlineCompileMatch(work)
    if (match === null) break
    if (match.marker === '$') {
      ranges.push({ start: match.startIndex, end: match.endIndex })
    }
    work =
      work.slice(0, match.startIndex) +
      '\u0000'.repeat(match.endIndex - match.startIndex) +
      work.slice(match.endIndex)
  }
  return ranges
}