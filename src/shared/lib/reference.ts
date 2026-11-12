import type { PaperReference, ReferenceKind } from '@/shared/types/paper'
import { escapeHtmlAttribute, escapeHtmlText } from './html'

/** 引用锚点种类属性：取值为 page/pdf/image；常规 HTML 超链接没有该属性 */
export const REFERENCE_KIND_ATTR = 'data-pl-ref'
/** PDF 引用页码属性（从 1 起） */
export const REFERENCE_PAGE_ATTR = 'data-pl-page'
/** PDF 单击预览图属性 */
export const REFERENCE_PREVIEW_ATTR = 'data-pl-preview'

const KIND_BY_EXTENSION: Readonly<Record<string, ReferenceKind>> = {
  '.pdf': 'pdf',
  '.html': 'page',
  '.htm': 'page',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.avif': 'image',
}

export function parseReferenceKind(value: string | null): ReferenceKind | null {
  if (value === 'page' || value === 'pdf' || value === 'image') return value
  return null
}

/** 从 MIME 推断引用种类；不可引用的类型返回 null */
export function referenceKindFromMime(mime: string): ReferenceKind | null {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'text/html') return 'page'
  if (mime.startsWith('image/')) return 'image'
  return null
}

/** MIME 缺失时按扩展名推断引用种类；不可引用的类型返回 null */
export function referenceKindFromFileName(name: string): ReferenceKind | null {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return null
  return KIND_BY_EXTENSION[name.slice(dot).toLowerCase()] ?? null
}

/** 读取锚点携带的本地引用；常规 HTML 超链接返回 null */
export function parseReferenceAnchor(anchor: Element): PaperReference | null {
  const kind = parseReferenceKind(anchor.getAttribute(REFERENCE_KIND_ATTR))
  if (kind === null) return null
  const src = anchor.getAttribute('href')
  if (src === null || src.trim() === '') return null

  const pageRaw = anchor.getAttribute(REFERENCE_PAGE_ATTR)
  const page = pageRaw === null ? Number.NaN : Number(pageRaw)
  const previewSrc = anchor.getAttribute(REFERENCE_PREVIEW_ATTR)

  return {
    kind,
    src,
    label: anchor.textContent?.trim() ?? '',
    ...(Number.isInteger(page) && page > 0 ? { page } : {}),
    ...(previewSrc === null || previewSrc === '' ? {} : { previewSrc }),
  }
}

/** 生成本地引用锚点 HTML：靠 data-pl-* 属性族与常规超链接区分 */
export function createReferenceAnchorHtml(reference: PaperReference): string {
  const attributes = [
    `${REFERENCE_KIND_ATTR}="${reference.kind}"`,
    `href="${escapeHtmlAttribute(reference.src)}"`,
  ]
  if (reference.page !== undefined) {
    attributes.push(`${REFERENCE_PAGE_ATTR}="${reference.page}"`)
  }
  if (reference.previewSrc !== undefined) {
    attributes.push(`${REFERENCE_PREVIEW_ATTR}="${escapeHtmlAttribute(reference.previewSrc)}"`)
  }
  return `<a ${attributes.join(' ')}>${escapeHtmlText(reference.label)}</a>`
}

/** 把引用信息写回已有锚点（浏览器 createLink 命令只生成 href） */
export function applyReferenceAttributes(anchor: Element, reference: PaperReference): void {
  anchor.setAttribute(REFERENCE_KIND_ATTR, reference.kind)
  anchor.removeAttribute('target')
  anchor.removeAttribute('rel')
  if (reference.page === undefined) {
    anchor.removeAttribute(REFERENCE_PAGE_ATTR)
  } else {
    anchor.setAttribute(REFERENCE_PAGE_ATTR, String(reference.page))
  }
  if (reference.previewSrc === undefined) {
    anchor.removeAttribute(REFERENCE_PREVIEW_ATTR)
  } else {
    anchor.setAttribute(REFERENCE_PREVIEW_ATTR, reference.previewSrc)
  }
}
