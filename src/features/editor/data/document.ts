import { createId } from '@/shared/lib/id'
import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import { defaultEventsForKind } from '@/shared/lib/nodeEvents'
import { collectDescendantIds, collectRemovalIds, describeLevelProblem } from '@/shared/lib/nodeTree'
import type {
  DocumentDefaults,
  FileNodeContent,
  ImageNodeContent,
  NodeId,
  NodeLayout,
  PaperDocument,
  PaperNode,
} from '@/shared/types/paper'
import type { Point } from './layout'
import { nextRootAnchor, stageBoundsShift } from './layout'
import { SAMPLE_IMAGE } from './nodeContent'

export {
  changeNodeKind,
  updateFileNodeContent,
  updateImageNodeContent,
  updateTextNodeContent,
  updateTitleNodeContent,
} from './nodeContent'
export {
  addImagePageToNode,
  moveActiveImagePageInNode,
  removeActiveImagePageFromNode,
  replaceActiveImagePageInNode,
  resolveWatchlistNodes,
  switchNodePageInDocument,
  toggleNodeInWatchlist,
} from './mediaDocument'
export {
  activeCanvasDocument,
  applyInCanvas,
  canDeleteNodeInCanvas,
  ensureSubCanvasForNode,
  propagateSharedNodeState,
  updateEventActionTarget,
  updateNodeEventsInDocument,
} from './subCanvas'

export interface AddImageNodeTarget {
  readonly parentId?: NodeId | null
  readonly anchor?: Point
  readonly size?: { readonly width: number; readonly height: number }
}

/** 生成空白文字节点；尺寸留空，渲染时使用共享默认值 */
function createTextNode(
  id: NodeId,
  parentId: NodeId | null,
  richText = '',
  anchor: Point = { x: 0, y: 0 },
): PaperNode {
  return {
    id,
    parentIds: parentId === null ? [] : [parentId],
    content: { kind: 'text', richText },
    layout: { x: anchor.x, y: anchor.y, collapsed: false },
  }
}

/** 生成图片节点；尺寸留空，默认绑定「二次点击弹出图片详情弹窗」事件 */
function createImageNode(
  id: NodeId,
  parentId: NodeId | null,
  content: ImageNodeContent = SAMPLE_IMAGE,
  anchor: Point = { x: 0, y: 0 },
  size?: { readonly width: number; readonly height: number },
): PaperNode {
  return {
    id,
    parentIds: parentId === null ? [] : [parentId],
    content,
    events: defaultEventsForKind('image'),
    layout: {
      x: anchor.x,
      y: anchor.y,
      collapsed: false,
      ...(size === undefined ? {} : { width: size.width, height: size.height }),
    },
  }
}

function createFileNode(
  id: NodeId,
  parentId: NodeId | null,
  content: FileNodeContent,
  anchor: Point = { x: 0, y: 0 },
): PaperNode {
  return {
    id,
    parentIds: parentId === null ? [] : [parentId],
    content,
    events: defaultEventsForKind('file'),
    layout: { x: anchor.x, y: anchor.y, collapsed: false },
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
    node.parentIds.length === 0
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
    parentIds: [],
    content: { kind: 'text', richText: '' },
    layout: { x: anchor.x, y: anchor.y, collapsed: false },
  }

  return withStructure(document, [...document.nodes, newRoot], [...document.rootIds, newNodeId])
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

/** 新增一个多媒体（图片）节点：指定有效 parentId 时挂为子节点，否则作为新根节点插入 */
export function addImageNode(
  document: PaperDocument,
  newNodeId: NodeId,
  content: ImageNodeContent,
  target?: AddImageNodeTarget,
): PaperDocument {
  const parentId = target?.parentId ?? null
  if (parentId !== null && document.nodes.some((node) => node.id === parentId)) {
    const child = createImageNode(newNodeId, parentId, content, { x: 0, y: 0 }, target?.size)
    return withStructure(document, [...document.nodes, child], document.rootIds)
  }

  const anchor =
    target?.anchor ?? nextRootAnchor(document.nodes, document.rootIds, document.defaults)
  const root = createImageNode(newNodeId, null, content, anchor, target?.size)
  return withStructure(document, [...document.nodes, root], [...document.rootIds, newNodeId])
}

/** 新增一个静态文件节点（支持直接从文件池或外部拖入 .md / 代码文件创建） */
export function addFileNode(
  document: PaperDocument,
  newNodeId: NodeId,
  content: FileNodeContent,
  target?: AddImageNodeTarget,
): PaperDocument {
  const parentId = target?.parentId ?? null
  if (parentId !== null && document.nodes.some((node) => node.id === parentId)) {
    const child = createFileNode(newNodeId, parentId, content)
    return withStructure(document, [...document.nodes, child], document.rootIds)
  }
  const anchor =
    target?.anchor ?? nextRootAnchor(document.nodes, document.rootIds, document.defaults)
  const root = createFileNode(newNodeId, null, content, anchor)
  return withStructure(document, [...document.nodes, root], [...document.rootIds, newNodeId])
}

/** 新增一个带初始富文本（如拖入 PDF/HTML 自动生成的引用锚点）的文本节点 */
export function addRichTextNode(
  document: PaperDocument,
  newNodeId: NodeId,
  richText: string,
  target?: AddImageNodeTarget,
): PaperDocument {
  const parentId = target?.parentId ?? null
  if (parentId !== null && document.nodes.some((node) => node.id === parentId)) {
    const child = createTextNode(newNodeId, parentId, richText)
    return withStructure(document, [...document.nodes, child], document.rootIds)
  }
  const anchor =
    target?.anchor ?? nextRootAnchor(document.nodes, document.rootIds, document.defaults)
  const root = createTextNode(newNodeId, null, richText, anchor)
  return withStructure(document, [...document.nodes, root], [...document.rootIds, newNodeId])
}

/** 在指定节点之后插入一个空白同级节点；根节点没有同级节点 */
export function addSiblingNode(
  document: PaperDocument,
  nodeId: NodeId,
  newNodeId: NodeId,
): PaperDocument {
  const reference = document.nodes.find(node => node.id === nodeId)
  const primaryParent = reference?.parentIds[0]
  if (reference === undefined || primaryParent === undefined) return document

  const newNode = createTextNode(newNodeId, primaryParent)
  const insertIndex = document.nodes.findIndex(node => node.id === nodeId)
  const nodes = [
    ...document.nodes.slice(0, insertIndex + 1),
    newNode,
    ...document.nodes.slice(insertIndex + 1),
  ]

  return withStructure(document, nodes, document.rootIds)
}

/** 更新节点布局（宽高、根节点锚点等），未提供的字段保持不变 */
export function updateNodeLayout(
  document: PaperDocument,
  nodeId: NodeId,
  patch: Partial<NodeLayout>,
): PaperDocument {
  const exists = document.nodes.some(node => node.id === nodeId)
  if (!exists) return document

  const nodes = document.nodes.map(node => {
    if (node.id !== nodeId) return node
    return { ...node, layout: { ...node.layout, ...patch } }
  })

  return withStructure(document, nodes, document.rootIds)
}

/** 收集以 nodeId 为起点向下可达的全部 ID（含自身），拖动预览用 */
export function collectSubtreeIds(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
): ReadonlySet<NodeId> {
  return collectDescendantIds(nodes, nodeId)
}

/** 删除节点及其级联闭包（父列表被清空的节点递归随删）；最后一个根节点不可删除 */
export function removeNode(document: PaperDocument, nodeId: NodeId): PaperDocument {
  const isRoot = document.rootIds.includes(nodeId)
  if (isRoot && document.rootIds.length <= 1) return document
  const exists = document.nodes.some(node => node.id === nodeId)
  if (!exists) return document

  const removed = collectRemovalIds(document.nodes, nodeId)
  const nodes = document.nodes
    .filter(node => !removed.has(node.id))
    .map(node =>
      node.parentIds.some(id => removed.has(id))
        ? { ...node, parentIds: node.parentIds.filter(id => !removed.has(id)) }
        : node,
    )
  return withStructure(
    document,
    nodes,
    isRoot ? document.rootIds.filter(id => !removed.has(id)) : document.rootIds,
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

/** 移动根节点锚点；全局层列布局下横坐标由列决定，锚点主要记录纵向意图 */
export function moveRootAnchor(
  document: PaperDocument,
  nodeId: NodeId,
  anchor: Point,
): PaperDocument {
  const target = document.nodes.find(node => node.id === nodeId)
  if (target === undefined || target.parentIds.length > 0) return document

  return updateNodeLayout(document, nodeId, { x: anchor.x, y: anchor.y })
}

/** 能否追加父节点：不重复、不自父、同一根树内，且追加后整份文档仍满足「父同层且上一层」不变量 */
export function canAddParent(document: PaperDocument, nodeId: NodeId, targetId: NodeId): boolean {
  if (nodeId === targetId) return false
  const node = document.nodes.find(item => item.id === nodeId)
  const target = document.nodes.find(item => item.id === targetId)
  if (node === undefined || target === undefined) return false
  if (node.parentIds.includes(targetId)) return false

  const nodes = document.nodes.map(item =>
    item.id === nodeId ? { ...item, parentIds: [...item.parentIds, targetId] } : item,
  )
  const rootIds =
    node.parentIds.length === 0 ? document.rootIds.filter(id => id !== nodeId) : document.rootIds
  return describeLevelProblem(nodes, rootIds) === null
}

/** 追加一个父节点（多父）；若它原本是根节点则从根列表移除，并将该节点移至 nodes 末尾以保证排在同级节点最后位置 */
export function addParentNode(
  document: PaperDocument,
  nodeId: NodeId,
  targetId: NodeId,
): PaperDocument {
  if (!canAddParent(document, nodeId, targetId)) return document

  const node = document.nodes.find(item => item.id === nodeId)
  if (node === undefined) return document
  const updated: PaperNode = { ...node, parentIds: [...node.parentIds, targetId] }
  const nodes = [...document.nodes.filter(item => item.id !== nodeId), updated]
  const rootIds =
    node.parentIds.length === 0
      ? document.rootIds.filter(id => id !== nodeId)
      : document.rootIds

  return withStructure(document, nodes, rootIds)
}

/** 移除一个父节点；删到空父列表时节点升为根节点；破坏分层不变量时拒绝 */
export function removeParentNode(
  document: PaperDocument,
  nodeId: NodeId,
  parentId: NodeId,
): PaperDocument {
  const node = document.nodes.find(item => item.id === nodeId)
  if (node === undefined || !node.parentIds.includes(parentId)) return document

  const parentIds = node.parentIds.filter(id => id !== parentId)
  const nodes = document.nodes.map(item =>
    item.id === nodeId ? { ...item, parentIds } : item,
  )
  const rootIds = parentIds.length === 0 ? [...document.rootIds, nodeId] : document.rootIds
  if (describeLevelProblem(nodes, rootIds) !== null) return document

  return withStructure(document, nodes, rootIds)
}

/** 把节点脱离为新根节点，锚点落在 anchor；原本就是根节点时等价于移动锚点 */
export function detachNodeAsRoot(
  document: PaperDocument,
  nodeId: NodeId,
  anchor: Point,
): PaperDocument {
  const node = document.nodes.find(item => item.id === nodeId)
  if (node === undefined) return document
  if (node.parentIds.length === 0) return moveRootAnchor(document, nodeId, anchor)

  const nodes = document.nodes.map(item =>
    item.id === nodeId
      ? { ...item, parentIds: [], layout: { ...item.layout, x: anchor.x, y: anchor.y } }
      : item,
  )
  const rootIds = [...document.rootIds, nodeId]
  if (describeLevelProblem(nodes, rootIds) !== null) return document

  return withStructure(document, nodes, rootIds)
}