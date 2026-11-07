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

function findNodeDetailContent(
  nodes: readonly PaperNode[],
  nodeId: NodeId | null,
): DetailContent | null {
  if (nodeId === null) return null
  const node = nodes.find((item) => item.id === nodeId)
  if (node === undefined) return null
  if (node.content.kind === 'image') {
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
  return null
}

/** 引用详情优先于节点详情，两者共用右侧面板 */
export function findDetailContent(
  nodes: readonly PaperNode[],
  detailMediaNodeId: NodeId | null,
  detailReference: PaperReference | null,
): DetailContent | null {
  if (detailReference !== null) return detailFromReference(detailReference)
  return findNodeDetailContent(nodes, detailMediaNodeId)
}
