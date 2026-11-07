import { createId } from '@/shared/lib/id'
import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import type {
  DocumentDefaults,
  ImageNodeContent,
  NodeId,
  NodeLayout,
  PaperDocument,
  PaperNode,
} from '@/shared/types/paper'
import type { Point } from './layout'
import { nextRootAnchor, stageBoundsShift } from './layout'

/** 初始文档展示的图片内容 */
const SAMPLE_IMAGE: ImageNodeContent = {
  kind: 'image',
  src: '/media/oxcq2cmh.jpg',
  alt: '示例图片',
}

/** 生成空白文字节点；尺寸留空，渲染时使用共享默认值 */
function createTextNode(id: NodeId, parentId: NodeId | null): PaperNode {
  return {
    id,
    parentId,
    content: { kind: 'text', richText: '' },
    layout: { x: 0, y: 0, collapsed: false },
  }
}

/** 生成图片节点；尺寸留空，默认尺寸与文字节点一致 */
function createImageNode(id: NodeId, parentId: NodeId | null): PaperNode {
  return {
    id,
    parentId,
    content: SAMPLE_IMAGE,
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

/** 内容越出舞台左上角时，把所有根节点锚点整体平移回来，各棵树的相对位置保持不变 */
function ensureStageBounds(document: PaperDocument): PaperDocument {
  const shift = stageBoundsShift(document.nodes, document.rootIds, document.defaults)
  if (shift.x === 0 && shift.y === 0) return document

  const nodes = document.nodes.map((node) =>
    node.parentId === null
      ? {
          ...node,
          layout: { ...node.layout, x: node.layout.x + shift.x, y: node.layout.y + shift.y },
        }
      : node,
  )

  return { ...document, nodes }
}

/** 结构变更的统一出口：替换节点与根列表，并保证内容仍落在舞台内 */
function withStructure(
  document: PaperDocument,
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
): PaperDocument {
  return ensureStageBounds({ ...withNodes(document, nodes), rootIds })
}

/** 创建包含根节点与示例图片节点的初始文档 */
export function createInitialDocument(): PaperDocument {
  const rootId = createId()
  const imageId = createId()
  const now = new Date().toISOString()
  return ensureStageBounds({
    meta: {
      id: createId(),
      title: '未命名演示',
      author: '',
      createdAt: now,
      updatedAt: now,
    },
    rootIds: [rootId],
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    nodes: [createTextNode(rootId, null), createImageNode(imageId, rootId)],
  })
}

/** 新增一个根节点：锚点排在现有内容下方，子树位置由布局算法相对锚点推算 */
export function addRootNode(document: PaperDocument, newNodeId: NodeId): PaperDocument {
  const anchor = nextRootAnchor(document.nodes, document.rootIds, document.defaults)
  const newRoot: PaperNode = {
    id: newNodeId,
    parentId: null,
    content: { kind: 'text', richText: '' },
    layout: { x: anchor.x, y: anchor.y, collapsed: false },
  }

  return withStructure(
    document,
    [...document.nodes, newRoot],
    [...document.rootIds, newNodeId],
  )
}

/** 在指定节点下添加一个空白子节点，返回新文档（不可变更新） */
export function addChildNode(
  document: PaperDocument,
  parentId: NodeId,
  newNodeId: NodeId,
): PaperDocument {
  const exists = document.nodes.some((node) => node.id === parentId)
  if (!exists) return document

  const nodes = [...document.nodes, createTextNode(newNodeId, parentId)]
  return withStructure(document, nodes, document.rootIds)
}

/** 在指定节点之后插入一个空白同级节点；根节点没有同级节点 */
export function addSiblingNode(
  document: PaperDocument,
  nodeId: NodeId,
  newNodeId: NodeId,
): PaperDocument {
  const reference = document.nodes.find((node) => node.id === nodeId)
  if (reference === undefined || reference.parentId === null) return document

  const newNode = createTextNode(newNodeId, reference.parentId)
  const insertIndex = document.nodes.findIndex((node) => node.id === nodeId)
  const nodes = [
    ...document.nodes.slice(0, insertIndex + 1),
    newNode,
    ...document.nodes.slice(insertIndex + 1),
  ]

  return withStructure(document, nodes, document.rootIds)
}

/** 更新文字节点的富文本内容；图片节点不会被修改 */
export function updateTextNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  richText: string,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind !== 'text') return document

  const nodes = document.nodes.map((node) => {
    if (node.id !== nodeId) return node
    return { ...node, content: { ...target.content, richText } }
  })

  return withNodes(document, nodes)
}

/** 更新节点布局（宽高、根节点锚点等），未提供的字段保持不变 */
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

  return withStructure(document, nodes, document.rootIds)
}

/** 收集以 nodeId 为根的子树全部 ID（含自身） */
export function collectSubtreeIds(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
): ReadonlySet<NodeId> {
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

/** 删除节点及其整个子树；最后一个根节点不可删除 */
export function removeNode(document: PaperDocument, nodeId: NodeId): PaperDocument {
  const isRoot = document.rootIds.includes(nodeId)
  if (isRoot && document.rootIds.length <= 1) return document
  const exists = document.nodes.some((node) => node.id === nodeId)
  if (!exists) return document

  const removed = collectSubtreeIds(document.nodes, nodeId)
  return withStructure(
    document,
    document.nodes.filter((node) => !removed.has(node.id)),
    isRoot ? document.rootIds.filter((id) => !removed.has(id)) : document.rootIds,
  )
}

/** 更新文档级预设（节点尺寸与文字字号），未提供的字段保持不变 */
export function updateDocumentDefaults(
  document: PaperDocument,
  patch: Partial<DocumentDefaults>,
): PaperDocument {
  return ensureStageBounds({
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    defaults: { ...document.defaults, ...patch },
  })
}

/** 移动根节点锚点；子节点位置由布局算法相对锚点重算，因此相对关系保持不变 */
export function moveRootAnchor(
  document: PaperDocument,
  nodeId: NodeId,
  anchor: Point,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.parentId !== null) return document

  return updateNodeLayout(document, nodeId, { x: anchor.x, y: anchor.y })
}

/** 能否把 nodeId 挂到 targetId 之下：不能挂到自己、自己的后代，或已在该父节点下 */
export function canReparent(document: PaperDocument, nodeId: NodeId, targetId: NodeId): boolean {
  if (nodeId === targetId) return false

  const node = document.nodes.find((item) => item.id === nodeId)
  const target = document.nodes.find((item) => item.id === targetId)
  if (node === undefined || target === undefined) return false
  if (node.parentId === targetId) return false

  return !collectSubtreeIds(document.nodes, nodeId).has(targetId)
}

/** 把节点改挂到新的父节点下；若它原本是根节点，同时从根节点列表中移除 */
export function reparentNode(
  document: PaperDocument,
  nodeId: NodeId,
  targetId: NodeId,
): PaperDocument {
  if (!canReparent(document, nodeId, targetId)) return document

  const node = document.nodes.find((item) => item.id === nodeId)
  const nodes = document.nodes.map((item) =>
    item.id === nodeId ? { ...item, parentId: targetId } : item,
  )
  const rootIds =
    node?.parentId === null ? document.rootIds.filter((id) => id !== nodeId) : document.rootIds

  return withStructure(document, nodes, rootIds)
}

/** 把节点脱离为新根节点，锚点落在 anchor；原本就是根节点时等价于移动锚点 */
export function detachNodeAsRoot(
  document: PaperDocument,
  nodeId: NodeId,
  anchor: Point,
): PaperDocument {
  const node = document.nodes.find((item) => item.id === nodeId)
  if (node === undefined) return document
  if (node.parentId === null) return moveRootAnchor(document, nodeId, anchor)

  const nodes = document.nodes.map((item) =>
    item.id === nodeId
      ? { ...item, parentId: null, layout: { ...item.layout, x: anchor.x, y: anchor.y } }
      : item,
  )

  return withStructure(document, nodes, [...document.rootIds, nodeId])
}
