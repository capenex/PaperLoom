import { parseReferenceAnchor, REFERENCE_KIND_ATTR } from '@/shared/lib/reference'
import type {
  NodeId,
  PaperNode,
  PaperReference,
  StaticFileFormat,
} from '@/shared/types/paper'

/** 右侧详情内容：图片节点全图、静态文件全文，或本地引用（图片 / 页面 / PDF 定位页） */
export type DetailContent =
  | { readonly type: 'image'; readonly src: string; readonly alt: string }
  | { readonly type: 'page'; readonly src: string; readonly label: string }
  | { readonly type: 'pdf'; readonly src: string; readonly page: number; readonly label: string }
  | {
      readonly type: 'file'
      readonly fileName: string
      readonly format: StaticFileFormat
      readonly text: string
    }

function detailFromReference(reference: PaperReference): DetailContent {
  if (reference.kind === 'image') {
    return { type: 'image', src: reference.src, alt: reference.label }
  }
  if (reference.kind === 'page') {
    return { type: 'page', src: reference.src, label: reference.label }
  }
  return { type: 'pdf', src: reference.src, page: reference.page ?? 1, label: reference.label }
}

/** 从富文本节点中提取首个本地引用（如内嵌的 PDF 引用链接），供节点级 open-detail 事件直接调用 */
function findFirstEmbeddedReference(richText: string): PaperReference | null {
  if (typeof DOMParser === 'undefined' || !richText.includes(REFERENCE_KIND_ATTR)) {
    return null
  }
  const doc = new DOMParser().parseFromString(richText, 'text/html')
  const anchor = doc.querySelector(`a[${REFERENCE_KIND_ATTR}]`)
  return anchor === null ? null : parseReferenceAnchor(anchor)
}

function findNodeDetailContent(
  nodes: readonly PaperNode[],
  nodeId: NodeId | null,
): DetailContent | null {
  if (nodeId === null) return null
  const node = nodes.find((item) => item.id === nodeId)
  if (node === undefined) return null
  if (node.content.kind === 'image') {
    if (node.content.src.trim() === '' || node.content.src === '/media/oxcq2cmh.jpg') {
      return null
    }
    return { type: 'image', src: node.content.src, alt: node.content.alt }
  }
  if (node.content.kind === 'file') {
    return {
      type: 'file',
      fileName: node.content.fileName,
      format: node.content.format,
      text: node.content.text,
    }
  }
  if (node.content.kind === 'text') {
    const embeddedRef = findFirstEmbeddedReference(node.content.richText)
    if (embeddedRef !== null) return detailFromReference(embeddedRef)
  }
  return null
}

/** 自定义预览详情与引用详情优先于节点详情，共用右侧面板 */
export function findDetailContent(
  nodes: readonly PaperNode[],
  detailMediaNodeId: NodeId | null,
  detailReference: PaperReference | null,
  detailCustom: DetailContent | null = null,
): DetailContent | null {
  if (detailCustom !== null) return detailCustom
  if (detailReference !== null) return detailFromReference(detailReference)
  return findNodeDetailContent(nodes, detailMediaNodeId)
}
