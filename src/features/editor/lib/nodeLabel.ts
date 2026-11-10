import { resolveImageItems } from '@/shared/lib/mediaPages'
import type { NodeContent, PaperNode } from '@/shared/types/paper'
import { splitRichTextPages } from './markdownRichText'
import { plainTextFromHtml } from './richText'

const NODE_KIND_LABELS: Readonly<Record<NodeContent['kind'], string>> = {
  text: '富文本',
  title: '纯标题',
  image: '多媒体',
  file: '静态文件',
}

export function nodeKindLabel(kind: NodeContent['kind']): string {
  return NODE_KIND_LABELS[kind]
}

function truncateLabel(text: string): string {
  return text.length > 12 ? `${text.slice(0, 12)}…` : text
}

export function nodeDisplayLabel(node: PaperNode): string {
  const content = node.content
  if (content.kind === 'title') return content.title.trim() || '未命名标题'
  if (content.kind === 'image') return content.alt.trim() || '未命名图片'
  if (content.kind === 'file') return content.fileName.trim() || '未命名文件'
  const firstLine = (plainTextFromHtml(content.richText).split('\n')[0] ?? '').trim()
  return firstLine === '' ? '未命名节点' : truncateLabel(firstLine)
}

export function nodePageCount(node: PaperNode): number {
  const content = node.content
  if (content.kind === 'image') return resolveImageItems(content).length
  if (content.kind === 'text') return splitRichTextPages(content.richText).length
  return 1
}
