import { createId } from '@/shared/lib/id'
import { defaultEventsForKind } from '@/shared/lib/nodeEvents'
import { collectDescendantIds, describeLevelProblem } from '@/shared/lib/nodeTree'
import type {
  NodeContent,
  NodeEventBinding,
  NodeId,
  PaperDocument,
  PaperNode,
} from '@/shared/types/paper'
import { nextRootAnchor, stageBoundsShift } from './layout'

export type CopyNodeMode = 'single' | 'subtree'

export interface NodeClipboardPayload {
  readonly mode: CopyNodeMode
  readonly rootNodeId: NodeId
  readonly nodes: readonly PaperNode[]
}

export interface PasteNodeResult {
  readonly document: PaperDocument
  readonly pastedRootId: NodeId
}

function cloneNodeContent(content: NodeContent): NodeContent {
  if (content.kind === 'text') return { kind: 'text', richText: content.richText }
  if (content.kind === 'title') {
    return { kind: 'title', title: content.title, subtitle: content.subtitle }
  }
  if (content.kind === 'image') {
    return {
      kind: 'image',
      src: content.src,
      alt: content.alt,
      ...(content.items === undefined
        ? {}
        : { items: content.items.map((item) => ({ ...item })) }),
      ...(content.activeIndex === undefined ? {} : { activeIndex: content.activeIndex }),
    }
  }
  return {
    kind: 'file',
    fileName: content.fileName,
    format: content.format,
    text: content.text,
  }
}

function snapshotNode(node: PaperNode): PaperNode {
  const base: PaperNode = {
    id: node.id,
    parentIds: [...node.parentIds],
    content: cloneNodeContent(node.content),
    layout: { ...node.layout },
  }
  const withEvents =
    node.events === undefined
      ? base
      : { ...base, events: node.events.map((ev) => ({ ...ev, action: { ...ev.action } })) }
  return node.isHidden === true ? { ...withEvents, isHidden: true } : withEvents
}

/**
 * 清洗粘贴节点的事件：
 * 剥离原节点专属的支线子画布跳转（open-canvas）与子画布宿主返回（return-parent-canvas），
 * 防止跨画布粘贴后出现同画布自递归跳转或两个节点抢占同一 subCanvas.hostNodeId。
 */
function sanitizeClonedEvents(
  node: PaperNode,
): readonly NodeEventBinding[] | undefined {
  if (node.events === undefined) return undefined
  const kept: NodeEventBinding[] = []
  for (const binding of node.events) {
    if (
      binding.action.type === 'open-canvas' ||
      binding.action.type === 'return-parent-canvas'
    ) {
      continue
    }
    kept.push({
      ...binding,
      id: createId(),
      action: { ...binding.action },
    })
  }
  if (kept.length === 0) {
    const defaults = defaultEventsForKind(node.content.kind)
    return defaults.length > 0 ? defaults : undefined
  }
  return kept
}

/**
 * 复制指定节点到剪贴板载荷：
 * - mode = 'single'（Ctrl+C）：仅复制当前选中节点本身
 * - mode = 'subtree'（Ctrl+Shift+C）：复制当前选中节点及其整棵可达子树
 */
export function copyNodeToClipboard(
  document: PaperDocument,
  nodeId: NodeId,
  mode: CopyNodeMode,
): NodeClipboardPayload | null {
  const rootNode = document.nodes.find((item) => item.id === nodeId)
  if (rootNode === undefined) return null

  if (mode === 'single') {
    return {
      mode: 'single',
      rootNodeId: rootNode.id,
      nodes: [snapshotNode(rootNode)],
    }
  }

  const subtreeIds = collectDescendantIds(document.nodes, nodeId)
  const orderedNodes = [
    snapshotNode(rootNode),
    ...document.nodes
      .filter((item) => item.id !== nodeId && subtreeIds.has(item.id))
      .map(snapshotNode),
  ]

  return {
    mode: 'subtree',
    rootNodeId: rootNode.id,
    nodes: orderedNodes,
  }
}

function buildClonedNodes(
  payload: NodeClipboardPayload,
  targetParentId: NodeId | null,
  rootAnchor: { readonly x: number; readonly y: number },
): { readonly clonedNodes: readonly PaperNode[]; readonly pastedRootId: NodeId } {
  const idMap = new Map<NodeId, NodeId>()
  for (const item of payload.nodes) {
    idMap.set(item.id, createId())
  }

  const pastedRootId = idMap.get(payload.rootNodeId) ?? createId()
  const clonedNodes: PaperNode[] = []

  for (const source of payload.nodes) {
    const newId = idMap.get(source.id) ?? createId()
    const isCopiedRoot = source.id === payload.rootNodeId
    const mappedParents = isCopiedRoot
      ? targetParentId === null
        ? []
        : [targetParentId]
      : source.parentIds.flatMap((pid) => {
          const mapped = idMap.get(pid)
          return mapped === undefined ? [] : [mapped]
        })

    const safeParentIds =
      !isCopiedRoot && mappedParents.length === 0 ? [pastedRootId] : mappedParents

    const layout = isCopiedRoot
      ? {
          ...source.layout,
          x: targetParentId === null ? rootAnchor.x : 0,
          y: targetParentId === null ? rootAnchor.y : 0,
          collapsed: payload.mode === 'single' ? false : source.layout.collapsed,
        }
      : { ...source.layout }

    const sanitizedEvents = sanitizeClonedEvents(source)
    const clonedBase: PaperNode = {
      id: newId,
      parentIds: safeParentIds,
      content: cloneNodeContent(source.content),
      layout,
    }
    const withEvents =
      sanitizedEvents === undefined ? clonedBase : { ...clonedBase, events: sanitizedEvents }
    const finalNode =
      source.isHidden === true ? { ...withEvents, isHidden: true } : withEvents
    clonedNodes.push(finalNode)
  }

  return { clonedNodes, pastedRootId }
}

/**
 * 将剪贴板中的单节点或子树粘贴到目标画布文档中（支持同画布与跨子画布粘贴）：
 * - 若当前选中了某个有效节点 selectedNodeId，则追加为该选中节点的最后一个子节点（排在其同级子节点最末）
 * - 若未选中节点（或原选中节点不在当前画布），则作为新根节点追加到当前画布末尾
 */
export function pasteClipboardIntoDocument(
  document: PaperDocument,
  payload: NodeClipboardPayload,
  selectedNodeId: NodeId | null,
): PasteNodeResult | null {
  if (payload.nodes.length === 0) return null

  const hasValidTarget =
    selectedNodeId !== null && document.nodes.some((item) => item.id === selectedNodeId)
  const targetParentId = hasValidTarget ? selectedNodeId : null
  const rootAnchor =
    targetParentId === null
      ? nextRootAnchor(document.nodes, document.rootIds, document.defaults)
      : { x: 0, y: 0 }

  const { clonedNodes, pastedRootId } = buildClonedNodes(payload, targetParentId, rootAnchor)
  const nextNodes = [...document.nodes, ...clonedNodes]
  const nextRootIds =
    targetParentId === null ? [...document.rootIds, pastedRootId] : document.rootIds

  if (describeLevelProblem(nextNodes, nextRootIds) !== null) return null

  const shift = stageBoundsShift(nextNodes, nextRootIds, document.defaults)
  const shiftedNodes =
    shift.x === 0 && shift.y === 0
      ? nextNodes
      : nextNodes.map((node) =>
          node.parentIds.length === 0
            ? {
                ...node,
                layout: { ...node.layout, x: node.layout.x + shift.x, y: node.layout.y + shift.y },
              }
            : node,
        )

  return {
    document: {
      ...document,
      meta: { ...document.meta, updatedAt: new Date().toISOString() },
      nodes: shiftedNodes,
      rootIds: nextRootIds,
    },
    pastedRootId,
  }
}
