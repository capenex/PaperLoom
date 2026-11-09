import type { NodeId, PaperDocument, PaperNode } from '@/shared/types/paper'

/** 只在隐藏时写入字段，取消隐藏即删除，旧工程与 JSON 保持干净 */
export function withHiddenFlag(node: PaperNode, hidden: boolean): PaperNode {
  if (hidden) return node.isHidden === true ? node : { ...node, isHidden: true }
  if (node.isHidden === undefined) return node
  const { isHidden: _dropped, ...rest } = node
  return rest
}

/** 设置节点隐藏状态；排版不受影响，所以无需重算舞台边界 */
export function setNodeHidden(
  document: PaperDocument,
  nodeId: NodeId,
  hidden: boolean,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || (target.isHidden === true) === hidden) return document
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    nodes: document.nodes.map((node) => (node.id === nodeId ? withHiddenFlag(node, hidden) : node)),
  }
}
