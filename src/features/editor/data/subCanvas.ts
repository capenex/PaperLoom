/**
 * 支线子画布（SubCanvas）与宿主节点同源投射（Host Node Projection）纯数据操作
 *
 * 宿主节点同时存在于上级画布与支线子画布中（共用同一个 NodeId 与 NodeContent），
 * 在任意一侧修改其内容或事件绑定都会自动双向同步，而两侧的坐标（layout）与子树各自独立。
 */

import { createId } from '@/shared/lib/id'
import { resolveNodeEvents } from '@/shared/lib/nodeEvents'
import type {
  CanvasId,
  NodeContent,
  NodeEventBinding,
  NodeId,
  PaperDocument,
  PaperNode,
  SubCanvas,
} from '@/shared/types/paper'
import { stageBoundsShift } from './layout'
import { withHiddenFlag } from './nodeVisibility'

export interface BreadcrumbItem {
  readonly canvasId: CanvasId | null
  readonly label: string
}

function syncNodeInList(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
  content: NodeContent,
  events: readonly NodeEventBinding[] | undefined,
): readonly PaperNode[] {
  let changed = false
  const next = nodes.map((node) => {
    if (node.id !== nodeId) return node
    if (node.content === content && node.events === events) return node
    changed = true
    return events === undefined ? { ...node, content } : { ...node, content, events }
  })
  return changed ? next : nodes
}

/** 将指定节点的最新 content 与 events 同步到主画布及所有包含该同源节点的支线画布 */
export function propagateSharedNodeState(
  document: PaperDocument,
  nodeId: NodeId,
  content: NodeContent,
  events: readonly NodeEventBinding[] | undefined,
): PaperDocument {
  const nodes = syncNodeInList(document.nodes, nodeId, content, events)
  if (document.subCanvases === undefined) {
    return nodes === document.nodes ? document : { ...document, nodes }
  }

  let subChanged = false
  const subCanvases: Record<CanvasId, SubCanvas> = {}
  for (const [id, sub] of Object.entries(document.subCanvases)) {
    const subNodes = syncNodeInList(sub.nodes, nodeId, content, events)
    if (subNodes !== sub.nodes) subChanged = true
    subCanvases[id] = subNodes === sub.nodes ? sub : { ...sub, nodes: subNodes }
  }

  if (nodes === document.nodes && !subChanged) return document
  return { ...document, nodes, subCanvases }
}

/** 获取当前激活画布对应的文档视图切片（主画布直接返回 document，子画布替换 nodes 与 rootIds） */
export function activeCanvasDocument(
  document: PaperDocument,
  activeCanvasId: CanvasId | null,
): PaperDocument {
  if (activeCanvasId === null) return document
  const sub = document.subCanvases?.[activeCanvasId]
  if (sub === undefined) return document
  return {
    ...document,
    nodes: sub.nodes,
    rootIds: sub.rootIds,
  }
}

function syncChangedNodesAfterTransform(
  beforeNodes: readonly PaperNode[],
  afterDoc: PaperDocument,
  currentNodes: readonly PaperNode[],
): PaperDocument {
  const beforeById = new Map<NodeId, PaperNode>()
  for (const node of beforeNodes) beforeById.set(node.id, node)

  let synced = afterDoc
  for (const node of currentNodes) {
    const prev = beforeById.get(node.id)
    if (prev !== undefined && (prev.content !== node.content || prev.events !== node.events)) {
      synced = propagateSharedNodeState(synced, node.id, node.content, node.events)
    }
  }
  return synced
}

/** 在指定画布（主画布或支线子画布）上执行纯文档变换，并自动跨画布同步同源节点的内容 */
export function applyInCanvas(
  document: PaperDocument,
  activeCanvasId: CanvasId | null,
  transform: (slice: PaperDocument) => PaperDocument,
): PaperDocument {
  if (activeCanvasId === null) {
    const nextMain = transform(document)
    if (nextMain === document) return document
    return syncChangedNodesAfterTransform(document.nodes, nextMain, nextMain.nodes)
  }

  const sub = document.subCanvases?.[activeCanvasId]
  if (sub === undefined) return document
  const slice: PaperDocument = { ...document, nodes: sub.nodes, rootIds: sub.rootIds }
  const nextSlice = transform(slice)
  if (nextSlice === slice) return document

  const updatedSub: SubCanvas = {
    ...sub,
    nodes: nextSlice.nodes,
    rootIds: nextSlice.rootIds,
  }
  const withSub: PaperDocument = {
    ...document,
    meta: nextSlice.meta,
    defaults: nextSlice.defaults,
    subCanvases: {
      ...document.subCanvases,
      [activeCanvasId]: updatedSub,
    },
  }
  return syncChangedNodesAfterTransform(sub.nodes, withSub, nextSlice.nodes)
}

function createInitialSubCanvas(
  canvasId: CanvasId,
  hostNode: PaperNode,
  defaults: PaperDocument['defaults'],
): SubCanvas {
  const branchChildId = createId()
  const rawNodes: readonly PaperNode[] = [
    {
      ...withHiddenFlag(hostNode, false),
      parentIds: [],
      layout: {
        ...hostNode.layout,
        x: 0,
        y: 0,
        collapsed: false,
      },
    },
    {
      id: branchChildId,
      parentIds: [hostNode.id],
      content: { kind: 'text', richText: '' },
      layout: { x: 0, y: 0, collapsed: false },
    },
  ]
  const rootIds: readonly NodeId[] = [hostNode.id]
  const shift = stageBoundsShift(rawNodes, rootIds, defaults)
  const nodes = rawNodes.map((node) =>
    node.parentIds.length === 0
      ? { ...node, layout: { ...node.layout, x: node.layout.x + shift.x, y: node.layout.y + shift.y } }
      : node,
  )
  return { id: canvasId, hostNodeId: hostNode.id, nodes, rootIds }
}

/** 确保指定宿主节点拥有对应的支线子画布；若尚不存在则自动创建并放入宿主同源根节点 */
export function ensureSubCanvasForNode(
  document: PaperDocument,
  activeCanvasId: CanvasId | null,
  nodeId: NodeId,
  preferredCanvasId?: CanvasId,
): { readonly document: PaperDocument; readonly canvasId: CanvasId } {
  const slice = activeCanvasDocument(document, activeCanvasId)
  const hostNode = slice.nodes.find((node) => node.id === nodeId)
  const existingBinding =
    hostNode === undefined
      ? undefined
      : resolveNodeEvents(hostNode).find((item) => item.action.type === 'open-canvas')
  const existingCanvasId =
    existingBinding?.action.type === 'open-canvas' ? existingBinding.action.canvasId : undefined
  const canvasId = preferredCanvasId ?? existingCanvasId ?? createId()

  if (document.subCanvases?.[canvasId] !== undefined || hostNode === undefined) {
    return { document, canvasId }
  }

  const subCanvas = createInitialSubCanvas(canvasId, hostNode, document.defaults)
  return {
    document: {
      ...document,
      meta: { ...document.meta, updatedAt: new Date().toISOString() },
      subCanvases: {
        ...document.subCanvases,
        [canvasId]: subCanvas,
      },
    },
    canvasId,
  }
}

/** 更新节点的事件绑定列表；若包含 open-canvas 动作，自动初始化对应的支线子画布 */
export function updateNodeEventsInDocument(
  document: PaperDocument,
  activeCanvasId: CanvasId | null,
  nodeId: NodeId,
  events: readonly NodeEventBinding[],
): PaperDocument {
  let working = document
  for (const binding of events) {
    if (binding.action.type === 'open-canvas') {
      working = ensureSubCanvasForNode(
        working,
        activeCanvasId,
        nodeId,
        binding.action.canvasId,
      ).document
    }
  }

  return applyInCanvas(working, activeCanvasId, (slice) => {
    const target = slice.nodes.find((node) => node.id === nodeId)
    if (target === undefined) return slice
    const nodes = slice.nodes.map((node) => (node.id === nodeId ? { ...node, events } : node))
    return {
      ...slice,
      meta: { ...slice.meta, updatedAt: new Date().toISOString() },
      nodes,
    }
  })
}

/** 判断当前画布中的某个节点是否允许删除（支线子画布内的同源宿主起点节点受保护不可删） */
export function canDeleteNodeInCanvas(
  document: PaperDocument,
  activeCanvasId: CanvasId | null,
  node: PaperNode,
): boolean {
  const slice = activeCanvasDocument(document, activeCanvasId)
  if (activeCanvasId !== null) {
    const sub = document.subCanvases?.[activeCanvasId]
    if (sub !== undefined && node.id === sub.hostNodeId) return false
  }
  const isRoot = node.parentIds.length === 0
  return !isRoot || slice.rootIds.length > 1
}

export function updateEventActionTarget(
  document: PaperDocument,
  activeCanvasId: CanvasId | null,
  nodeId: NodeId,
  bindingId: string,
  targetNodeId: NodeId,
): PaperDocument {
  return applyInCanvas(document, activeCanvasId, (slice) => {
    const source = slice.nodes.find((node) => node.id === nodeId)
    if (source === undefined) return slice
    const events = resolveNodeEvents(source)
    const binding = events.find((item) => item.id === bindingId)
    if (binding === undefined || binding.action.type !== 'switch-node-page') return slice
    const nextEvents = events.map((item): NodeEventBinding => {
      if (item.id !== bindingId || item.action.type !== 'switch-node-page') return item
      return { ...item, action: { ...item.action, targetNodeId } }
    })
    const nodes = slice.nodes.map((node) =>
      node.id === nodeId ? { ...node, events: nextEvents } : node,
    )
    return {
      ...slice,
      meta: { ...slice.meta, updatedAt: new Date().toISOString() },
      nodes,
    }
  })
}
