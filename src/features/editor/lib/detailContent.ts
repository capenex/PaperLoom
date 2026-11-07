import type { ImageNodeContent, NodeId, PaperNode, PaperReference } from '@/shared/types/paper'

/** 右侧详情内容：图片节点全图，或本地引用（图片 / 页面 / PDF 定位页） */
export type DetailContent =
  | { readonly type: 'image'; readonly src: string; readonly alt: string }
  | { readonly type: 'page'; readonly src: string; readonly label: string }
  | { readonly type: 'pdf'; readonly src: string; readonly page: number; readonly label: string }

function detailFromReference(reference: PaperReference): DetailContent {
  if (reference.kind === 'image') {
    return { type: 'image', src: reference.src, alt: reference.label }
  }
  if (reference.kind === 'page') {
    return { type: 'page', src: reference.src, label: reference.label }
  }
  return { type: 'pdf', src: reference.src, page: reference.page ?? 1, label: reference.label }
}

function findDetailImageContent(
  nodes: readonly PaperNode[],
  nodeId: NodeId | null,
): ImageNodeContent | null {
  if (nodeId === null) return null
  const node = nodes.find((item) => item.id === nodeId)
  if (node === undefined || node.content.kind !== 'image') return null
  return node.content
}

/** 引用详情优先于图片详情，两者共用右侧面板 */
export function findDetailContent(
  nodes: readonly PaperNode[],
  detailMediaNodeId: NodeId | null,
  detailReference: PaperReference | null,
): DetailContent | null {
  if (detailReference !== null) return detailFromReference(detailReference)
  const image = findDetailImageContent(nodes, detailMediaNodeId)
  return image === null ? null : { type: 'image', src: image.src, alt: image.alt }
}
