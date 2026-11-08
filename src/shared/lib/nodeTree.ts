import type { NodeId, PaperNode } from '../types/paper'

/** 每个父节点都列子节点的 children map（顺序跟随 nodes 数组，保证布局确定性） */
export function buildChildrenMap(nodes: readonly PaperNode[]): ReadonlyMap<NodeId, readonly PaperNode[]> {
  const childrenOf = new Map<NodeId, PaperNode[]>()
  for (const node of nodes) {
    for (const parentId of node.parentIds) {
      const siblings = childrenOf.get(parentId) ?? []
      siblings.push(node)
      childrenOf.set(parentId, siblings)
    }
  }
  return childrenOf
}

/** 层数派生：根=0，其余=父层+1；分层不变量成立时与走哪个父无关 */
export function computeNodeLevels(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
): ReadonlyMap<NodeId, number> {
  const childrenOf = buildChildrenMap(nodes)
  const levels = new Map<NodeId, number>()
  const queue: NodeId[] = [...rootIds]
  for (const rootId of rootIds) levels.set(rootId, 0)
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head]
    if (id === undefined) continue
    const level = levels.get(id) ?? 0
    for (const child of childrenOf.get(id) ?? []) {
      if (levels.has(child.id)) continue
      levels.set(child.id, level + 1)
      queue.push(child.id)
    }
  }
  return levels
}

/** 沿主父链走到根：每棵节点树独立排版，多父必须落在同一根树内 */
export function rootAncestorOf(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
): NodeId | null {
  const byId = new Map<NodeId, PaperNode>()
  for (const node of nodes) byId.set(node.id, node)
  let current = byId.get(nodeId)
  for (let steps = 0; current !== undefined && steps <= nodes.length; steps += 1) {
    const primary = current.parentIds[0]
    if (primary === undefined) return current.id
    current = byId.get(primary)
  }
  return null
}

/** 分层 DAG 不变量：父存在、不重复、不自父、根父一致、所有父同层且恰为上一层、同一根树 */
export function describeLevelProblem(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
): string | null {
  const ids = new Set<NodeId>()
  for (const node of nodes) {
    if (ids.has(node.id)) return `节点 ID 重复：${node.id}`
    ids.add(node.id)
  }
  if (rootIds.length === 0) return '至少要有一个根节点'
  const rootIdSet = new Set<NodeId>(rootIds)
  for (const rootId of rootIds) {
    if (!ids.has(rootId)) return `根节点不存在：${rootId}`
  }

  const levels = computeNodeLevels(nodes, rootIds)
  for (const node of nodes) {
    const isRoot = rootIdSet.has(node.id)
    if (isRoot && node.parentIds.length > 0) return `节点 ${node.id} 既是根节点又有父节点`
    if (!isRoot && node.parentIds.length === 0) return `非根节点缺少父节点：${node.id}`
    if (!levels.has(node.id)) return `节点无法从根节点到达：${node.id}`
    const seen = new Set<NodeId>()
    const treeRoot = rootAncestorOf(nodes, node.id)
    for (const parentId of node.parentIds) {
      if (parentId === node.id) return `节点不能以自身为父：${node.id}`
      if (seen.has(parentId)) return `父节点重复：${node.id} -> ${parentId}`
      seen.add(parentId)
      if (!ids.has(parentId)) return `父节点不存在：${parentId}`
      if (rootAncestorOf(nodes, parentId) !== treeRoot) {
        return `多父节点必须属于同一棵节点树：${node.id} -> ${parentId}`
      }
      const parentLevel = levels.get(parentId)
      const nodeLevel = levels.get(node.id)
      if (parentLevel === undefined || nodeLevel === undefined || parentLevel !== nodeLevel - 1) {
        return `父节点必须同层且为上一层：${node.id} -> ${parentId}`
      }
    }
  }
  return null
}

/** 任一父节点展开且可见，节点就可见；全部父链折叠才隐藏 */
export function visibleNodeIds(nodes: readonly PaperNode[]): ReadonlySet<NodeId> {
  const byId = new Map<NodeId, PaperNode>()
  for (const node of nodes) byId.set(node.id, node)
  const visible = new Set<NodeId>()
  const hidden = new Set<NodeId>()
  const visit = (id: NodeId): boolean => {
    if (visible.has(id)) return true
    if (hidden.has(id)) return false
    const node = byId.get(id)
    if (node === undefined) return false
    const ok =
      node.parentIds.length === 0 ||
      node.parentIds.some((parentId) => {
        const parent = byId.get(parentId)
        return parent !== undefined && !parent.layout.collapsed && visit(parentId)
      })
    if (ok) visible.add(id)
    else hidden.add(id)
    return ok
  }
  for (const node of nodes) visit(node.id)
  return visible
}

/** 以 nodeId 为起点向下可达的全部 ID（含自身）：拖动预览用 */
export function collectDescendantIds(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
): ReadonlySet<NodeId> {
  const childrenOf = buildChildrenMap(nodes)
  const ids = new Set<NodeId>([nodeId])
  const queue: NodeId[] = [nodeId]
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head]
    if (id === undefined) continue
    for (const child of childrenOf.get(id) ?? []) {
      if (ids.has(child.id)) continue
      ids.add(child.id)
      queue.push(child.id)
    }
  }
  return ids
}

/** 删除闭包：自身 + 父列表被清空者递归级联；根节点不参与级联 */
export function collectRemovalIds(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
): ReadonlySet<NodeId> {
  const removed = new Set<NodeId>([nodeId])
  let grew = true
  while (grew) {
    grew = false
    for (const node of nodes) {
      if (removed.has(node.id) || node.parentIds.length === 0) continue
      if (node.parentIds.every((parentId) => removed.has(parentId))) {
        removed.add(node.id)
        grew = true
      }
    }
  }
  return removed
}