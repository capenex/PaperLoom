import { createId } from '@/shared/lib/id'
import type {
  NodeContent,
  NodeId,
  NodeLayout,
  PaperDocument,
  PaperNode,
} from '@/shared/types/paper'

/** 生成空白演示节点；尺寸留空，渲染时使用共享默认值 */
function createNode(id: NodeId, parentId: NodeId | null): PaperNode {
  return {
    id,
    parentId,
    content: { richText: '' },
    layout: { x: 0, y: 0, collapsed: false },
  }
}

/** 替换节点列表并刷新更新时间 */
function withNodes(document: PaperDocument, nodes: readonly PaperNode[]): PaperDocument {
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    nodes,
  }
}

/** 创建只含根节点的初始文档 */
export function createInitialDocument(): PaperDocument {
  const rootId = createId()
  const now = new Date().toISOString()
  return {
    meta: {
      id: createId(),
      title: '未命名演示',
      author: '',
      createdAt: now,
      updatedAt: now,
    },
    rootId,
    nodes: [createNode(rootId, null)],
  }
}

/** 在指定节点下添加一个空白子节点，返回新文档（不可变更新） */
export function addChildNode(
  document: PaperDocument,
  parentId: NodeId,
  newNodeId: NodeId,
): PaperDocument {
  const exists = document.nodes.some((node) => node.id === parentId)
  if (!exists) return document

  return withNodes(document, [...document.nodes, createNode(newNodeId, parentId)])
}

/** 在指定节点之后插入一个空白同级节点；根节点没有同级节点 */
export function addSiblingNode(
  document: PaperDocument,
  nodeId: NodeId,
  newNodeId: NodeId,
): PaperDocument {
  const reference = document.nodes.find((node) => node.id === nodeId)
  if (reference === undefined || reference.parentId === null) return document

  const newNode = createNode(newNodeId, reference.parentId)
  const insertIndex = document.nodes.findIndex((node) => node.id === nodeId)
  const nodes = [
    ...document.nodes.slice(0, insertIndex + 1),
    newNode,
    ...document.nodes.slice(insertIndex + 1),
  ]

  return withNodes(document, nodes)
}

/** 更新节点内容（富文本），未提供的字段保持不变 */
export function updateNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  patch: Partial<NodeContent>,
): PaperDocument {
  const exists = document.nodes.some((node) => node.id === nodeId)
  if (!exists) return document

  const nodes = document.nodes.map((node) => {
    if (node.id !== nodeId) return node
    return { ...node, content: { ...node.content, ...patch } }
  })

  return withNodes(document, nodes)
}

/** 更新节点布局（宽高等），未提供的字段保持不变 */
export function updateNodeLayout(
  document: PaperDocument,
  nodeId: NodeId,
  patch: Partial<NodeLayout>,
): PaperDocument {
  const exists = document.nodes.some((node) => node.id === nodeId)
  if (!exists) return document

  const nodes = document.nodes.map((node) => {
    if (node.id !== nodeId) return node
    return { ...node, layout: { ...node.layout, ...patch } }
  })

  return withNodes(document, nodes)
}

/** 收集以 nodeId 为根的子树全部 ID */
function collectSubtreeIds(nodes: readonly PaperNode[], nodeId: NodeId): ReadonlySet<NodeId> {
  const ids = new Set<NodeId>([nodeId])
  let grew = true
  while (grew) {
    grew = false
    for (const node of nodes) {
      if (node.parentId !== null && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id)
        grew = true
      }
    }
  }
  return ids
}

/** 删除节点及其整个子树；根节点不可删除 */
export function removeNode(document: PaperDocument, nodeId: NodeId): PaperDocument {
  if (nodeId === document.rootId) return document
  const exists = document.nodes.some((node) => node.id === nodeId)
  if (!exists) return document

  const removed = collectSubtreeIds(document.nodes, nodeId)
  return withNodes(
    document,
    document.nodes.filter((node) => !removed.has(node.id)),
  )
}
