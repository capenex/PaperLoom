import { escapeHtmlText } from '@/shared/lib/html'
import type { StaticFileFormat } from '@/shared/types/paper'
import { renderInlineMathHtml } from './mathFormula'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])

/** 根据文件名推断静态文件展示格式 */
export function detectStaticFileFormat(fileName: string): StaticFileFormat {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return 'code'
  const ext = fileName.slice(dot).toLowerCase()
  return MARKDOWN_EXTENSIONS.has(ext) ? 'markdown' : 'code'
}

function formatInlineMarkdownLine(rawLine: string): string {
  const escaped = escapeHtmlText(rawLine)
  return escaped
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/gu, '<del>$1</del>')
    .replace(/`([^`]+)`/gu, '<code>$1</code>')
    .replace(/\$([^$]+)\$/gu, (_, tex: string) => renderInlineMathHtml(tex))
    .replace(/(?:^|[^*])\*([^*]+)\*/gu, (full, inner: string) => {
      const prefix = full.startsWith('*') ? '' : (full[0] ?? '')
      return `${prefix}<em>${inner}</em>`
    })
}

function renderMarkdownLine(line: string): string {
  const trimmed = line.trim()
  if (trimmed === '') return ''
  if (trimmed.startsWith('### ')) {
    return `<h3>${formatInlineMarkdownLine(trimmed.slice(4))}</h3>`
  }
  if (trimmed.startsWith('## ')) {
    return `<h2>${formatInlineMarkdownLine(trimmed.slice(3))}</h2>`
  }
  if (trimmed.startsWith('# ')) {
    return `<h1>${formatInlineMarkdownLine(trimmed.slice(2))}</h1>`
  }
  if (trimmed.startsWith('> ')) {
    return `<blockquote>${formatInlineMarkdownLine(trimmed.slice(2))}</blockquote>`
  }
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    return `<ul><li>${formatInlineMarkdownLine(trimmed.slice(2))}</li></ul>`
  }
  return `<p>${formatInlineMarkdownLine(trimmed)}</p>`
}

/** 将静态 Markdown 文件文本渲染为只读 HTML */
export function renderStaticMarkdownHtml(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```)/gu)
  const htmlParts: string[] = []

  for (const segment of segments) {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      const lines = segment.slice(3, -3).replace(/^\r?\n/u, '').split(/\r?\n/u)
      const codeBody = lines.length > 1 && /^[a-z0-9_-]+$/iu.test(lines[0] ?? '')
        ? lines.slice(1).join('\n')
        : lines.join('\n')
      htmlParts.push(`<pre class="pl-code-block"><code>${escapeHtmlText(codeBody)}</code></pre>`)
    } else {
      for (const line of segment.split(/\r?\n/u)) {
        const rendered = renderMarkdownLine(line)
        if (rendered !== '') htmlParts.push(rendered)
      }
    }
  }

  return htmlParts.join('')
}
