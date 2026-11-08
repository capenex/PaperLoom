import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import { buildChildrenMap } from '@/shared/lib/nodeTree'
import type { DocumentDefaults, NodeId, PaperNode } from '@/shared/types/paper'

/** 画布逻辑坐标点 */
export interface Point {
  readonly x: number
  readonly y: number
}

/** 文档整体布局：每个节点的画布坐标与舞台尺寸 */
export interface DocumentLayout {
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly width: number
  readonly height: number
  /** 舞台坐标 = 原始坐标 + origin；反向换算节点锚点时需要减去它 */
  readonly origin: Point
}

/** 轴对齐包围盒（节点中心 ± 半宽半高） */
interface Bounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

/** 已按根节点锚点定位并测量好的节点 */
interface PlacedNode {
  readonly id: NodeId
  readonly center: Point
  readonly width: number
  readonly height: number
}

/** 子树的列宽与每层行高 */
interface ColumnMetrics {
  readonly widths: readonly number[]
  readonly rowHeights: readonly number[]
}

const COLUMN_GAP = 96
const ROW_GAP = 48
const MIN_ROW_HEIGHT = 140
/** 新根节点子树与上方内容之间的纵向留白 */
const ROOT_GAP_Y = 160
const STAGE_PADDING_X = 96
const STAGE_PADDING_Y = 80
const MIN_STAGE_SIZE = 400

const EMPTY_LAYOUT: DocumentLayout = {
  positions: new Map(),
  width: MIN_STAGE_SIZE,
  height: MIN_STAGE_SIZE,
  origin: { x: 0, y: 0 },
}

/** 统计子树每一列的最大宽度与行高；记忆化保证多父共享子节点只测量一次 */
function measureSubtree(
  root: PaperNode,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  defaults: DocumentDefaults,
): ColumnMetrics {
  const widths: number[] = []
  const heights: number[] = []
  const seen = new Set<NodeId>()

  function visit(node: PaperNode, depth: number): void {
    if (seen.has(node.id)) return
    seen.add(node.id)
    const size = resolveNodeSize(node.layout, defaults)
    widths[depth] = Math.max(widths[depth] ?? 0, size.width)
    heights[depth] = Math.max(heights[depth] ?? 0, size.height)
    for (const child of childrenOf.get(node.id) ?? []) {
      visit(child, depth + 1)
    }
  }

  visit(root, 0)
  return {
    widths,
    rowHeights: heights.map((height) => Math.max(MIN_ROW_HEIGHT, height + ROW_GAP)),
  }
}

/** 子树内各列的横向中心偏移：相邻两列中心距 = 左列半宽 + 右列半宽 + 列间距 */
function computeColumnOffsets(widths: readonly number[]): readonly number[] {
  const offsets = [0]
  for (let depth = 1; depth < widths.length; depth += 1) {
    const previousOffset = offsets[depth - 1] ?? 0
    const halfSpan = Math.round(((widths[depth - 1] ?? 0) + (widths[depth] ?? 0)) / 2)
    offsets[depth] = previousOffset + halfSpan + COLUMN_GAP
  }
  return offsets
}

/**
 * 子树本地行分配：记忆化 DFS 让共享子节点只占一行（叶子按层计数、父取子行中点）；
 * 自底向上逐层重算中点并强制最小行距；再自顶向下对齐——单子跟父行、多父共享子取父行中点，
 * 相同期望行的连续节点整块居中，消除「父被推开、子留在原地」的歪斜。
 */
function layoutSubtree(
  rootId: NodeId,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  parentsOf: ReadonlyMap<NodeId, readonly NodeId[]>,
  columnOffsets: readonly number[],
  rowHeights: readonly number[],
): ReadonlyMap<NodeId, Point> {
  const yOf = new Map<NodeId, number>()
  const depthOf = new Map<NodeId, number>()
  const leafCounters: number[] = []
  const byDepth: NodeId[][] = []
  let maxDepth = 0

  const visit = (id: NodeId, depth: number): number => {
    const existing = yOf.get(id)
    if (existing !== undefined) return existing
    depthOf.set(id, depth)
    maxDepth = Math.max(maxDepth, depth)
    const bucket = byDepth[depth] ?? []
    bucket.push(id)
    byDepth[depth] = bucket
    const children = childrenOf.get(id) ?? []
    let y: number
    if (children.length === 0) {
      const counter = leafCounters[depth] ?? 0
      leafCounters[depth] = counter + 1
      y = counter * (rowHeights[depth] ?? MIN_ROW_HEIGHT)
    } else {
      const childYs = children.map((child) => visit(child.id, depth + 1))
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2
    }
    yOf.set(id, y)
    return y
  }
  visit(rootId, 0)

  for (let depth = maxDepth; depth >= 0; depth -= 1) {
    const ids = byDepth[depth] ?? []
    const rowHeight = rowHeights[depth] ?? MIN_ROW_HEIGHT
    for (const id of ids) {
      const children = childrenOf.get(id) ?? []
      if (children.length === 0) continue
      const childYs = children.map((child) => yOf.get(child.id) ?? 0)
      yOf.set(id, (Math.min(...childYs) + Math.max(...childYs)) / 2)
    }
    let previous = Number.NEGATIVE_INFINITY
    for (const id of ids) {
      const y = Math.max(yOf.get(id) ?? 0, previous + rowHeight)
      yOf.set(id, y)
      previous = y
    }
  }

  const desiredOf = (id: NodeId): number => {
    const parents = parentsOf.get(id) ?? []
    if (parents.length === 0) return yOf.get(id) ?? 0
    return parents.reduce((sum, parentId) => sum + (yOf.get(parentId) ?? 0), 0) / parents.length
  }
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const ids = byDepth[depth] ?? []
    const rowHeight = rowHeights[depth] ?? MIN_ROW_HEIGHT
    let previous = Number.NEGATIVE_INFINITY
    let i = 0
    while (i < ids.length) {
      const id = ids[i]
      if (id === undefined) {
        i += 1
        continue
      }
      const desired = desiredOf(id)
      let j = i + 1
      while (j < ids.length && desiredOf(ids[j] ?? '') === desired) j += 1
      const count = j - i
      const start = Math.max(desired - ((count - 1) * rowHeight) / 2, previous + rowHeight)
      for (let k = i; k < j; k += 1) {
        const y = start + (k - i) * rowHeight
        yOf.set(ids[k] ?? '', y)
        previous = y
      }
      i = j
    }
  }

  const rootY = yOf.get(rootId) ?? 0
  // 根必须排在首位：子树避让以 placed[0] 作为根锚点参考
  const local = new Map<NodeId, Point>([[rootId, { x: columnOffsets[0] ?? 0, y: 0 }]])
  yOf.forEach((y, id) => {
    if (id === rootId) return
    local.set(id, { x: columnOffsets[depthOf.get(id) ?? 0] ?? 0, y: y - rootY })
  })
  return local
}

/** 把一棵子树放到根节点锚点上：本地坐标加上锚点即为画布坐标 */
function placeSubtree(
  root: PaperNode,
  nodeById: ReadonlyMap<NodeId, PaperNode>,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  parentsOf: ReadonlyMap<NodeId, readonly NodeId[]>,
  defaults: DocumentDefaults,
): readonly PlacedNode[] {
  const metrics = measureSubtree(root, childrenOf, defaults)
  const columnOffsets = computeColumnOffsets(metrics.widths)
  const localPositions = layoutSubtree(
    root.id,
    childrenOf,
    parentsOf,
    columnOffsets,
    metrics.rowHeights,
  )

  const placed: PlacedNode[] = []
  localPositions.forEach((point, id) => {
    const node = nodeById.get(id)
    if (node === undefined) return
    const size = resolveNodeSize(node.layout, defaults)
    placed.push({
      id,
      center: { x: root.layout.x + point.x, y: root.layout.y + point.y },
      width: size.width,
      height: size.height,
    })
  })
  return placed
}

function shiftSubtree(subtree: readonly PlacedNode[], dx: number, dy: number): readonly PlacedNode[] {
  return subtree.map((item) => ({
    ...item,
    center: { x: item.center.x + dx, y: item.center.y + dy },
  }))
}

/** 当某棵子树内的节点放大后与周围其他子树发生重叠时，将相邻子树整体向外推开 */
function resolveSubtreeOverlaps(subtrees: readonly (readonly PlacedNode[])[]): readonly PlacedNode[] {
  const resolved = [...subtrees]
  for (let i = 0; i < resolved.length; i += 1) {
    const first = resolved[i]
    const rootA = first?.[0]
    if (first === undefined || rootA === undefined) continue
    const boundsA = boundsOf(first)

    for (let j = i + 1; j < resolved.length; j += 1) {
      const second = resolved[j]
      const rootB = second?.[0]
      if (second === undefined || rootB === undefined) continue
      const boundsB = boundsOf(second)
      const overlapRight = boundsA.maxX + ROW_GAP - boundsB.minX
      const overlapLeft = boundsB.maxX + ROW_GAP - boundsA.minX
      const overlapDown = boundsA.maxY + ROW_GAP - boundsB.minY
      const overlapUp = boundsB.maxY + ROW_GAP - boundsA.minY
      if (overlapRight <= 0 || overlapLeft <= 0 || overlapDown <= 0 || overlapUp <= 0) continue

      const rootDx = rootB.center.x - rootA.center.x
      const rootDy = rootB.center.y - rootA.center.y
      const pushVert = rootDy >= 0 ? overlapDown : -overlapUp
      const pushHoriz = rootDx >= 0 ? overlapRight : -overlapLeft
      const preferHorizontal =
        Math.abs(rootDx) > Math.abs(rootDy) && Math.abs(pushHoriz) < Math.abs(pushVert)
      resolved[j] = shiftSubtree(
        second,
        preferHorizontal ? pushHoriz : 0,
        preferHorizontal ? 0 : pushVert,
      )
    }
  }
  return resolved.flat()
}

function invertChildren(
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
): ReadonlyMap<NodeId, readonly NodeId[]> {
  const parentsOf = new Map<NodeId, NodeId[]>()
  childrenOf.forEach((children, parentId) => {
    for (const child of children) {
      const list = parentsOf.get(child.id) ?? []
      list.push(parentId)
      parentsOf.set(child.id, list)
    }
  })
  return parentsOf
}

/** 按 rootIds 顺序独立定位每棵子树（根锚点自由），子树放大相交时自动推开邻近子树 */
function placeAllNodes(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
  defaults: DocumentDefaults,
): readonly PlacedNode[] {
  const nodeById = new Map<NodeId, PaperNode>()
  for (const node of nodes) {
    nodeById.set(node.id, node)
  }
  const childrenOf = buildChildrenMap(nodes)
  const parentsOf = invertChildren(childrenOf)

  const subtrees: (readonly PlacedNode[])[] = []
  for (const rootId of rootIds) {
    const root = nodeById.get(rootId)
    if (root === undefined) continue
    subtrees.push(placeSubtree(root, nodeById, childrenOf, parentsOf, defaults))
  }
  return resolveSubtreeOverlaps(subtrees)
}

function boundsOf(placed: readonly PlacedNode[]): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const item of placed) {
    minX = Math.min(minX, item.center.x - item.width / 2)
    minY = Math.min(minY, item.center.y - item.height / 2)
    maxX = Math.max(maxX, item.center.x + item.width / 2)
    maxY = Math.max(maxY, item.center.y + item.height / 2)
  }

  return { minX, minY, maxX, maxY }
}

/** 内容越出舞台左上角时需要的整体平移量，其余情况为 0 */
function shiftForBounds(bounds: Bounds): Point {
  return {
    x: Math.max(0, STAGE_PADDING_X - bounds.minX),
    y: Math.max(0, STAGE_PADDING_Y - bounds.minY),
  }
}

/** 整份文档需要的舞台平移量：数据结构据此把所有根节点锚点整体推回舞台内 */
export function stageBoundsShift(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
  defaults: DocumentDefaults,
): Point {
  const placed = placeAllNodes(nodes, rootIds, defaults)
  if (placed.length === 0) return { x: 0, y: 0 }
  return shiftForBounds(boundsOf(placed))
}

/**
 * 计算整份文档的画布布局：每棵子树相对自己的根节点锚点独立定位，锚点即舞台坐标。
 * 只有内容越出左上角时才整体平移，因此用户拖出来的位置会被原样保留。
 */
export function layoutDocument(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
  defaults: DocumentDefaults,
): DocumentLayout {
  const placed = placeAllNodes(nodes, rootIds, defaults)
  if (placed.length === 0) return EMPTY_LAYOUT

  const bounds = boundsOf(placed)
  const shift = shiftForBounds(bounds)
  const positions = new Map<NodeId, Point>()
  for (const item of placed) {
    positions.set(item.id, { x: item.center.x + shift.x, y: item.center.y + shift.y })
  }

  return {
    positions,
    width: Math.max(bounds.maxX + shift.x + STAGE_PADDING_X, MIN_STAGE_SIZE),
    height: Math.max(bounds.maxY + shift.y + STAGE_PADDING_Y, MIN_STAGE_SIZE),
    origin: shift,
  }
}

/** 节点在原始坐标（未经归一化平移）中的位置：优先由当前舞台坐标反推（含子树避让偏移） */
export function rawPositionOf(node: PaperNode, layout: DocumentLayout): Point {
  const position = layout.positions.get(node.id)
  if (position === undefined) return { x: node.layout.x, y: node.layout.y }
  return { x: position.x - layout.origin.x, y: position.y - layout.origin.y }
}

/** 新根节点的锚点：与首个根节点左对齐，纵向排在现有内容下方 */
export function nextRootAnchor(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
  defaults: DocumentDefaults,
): Point {
  const placed = placeAllNodes(nodes, rootIds, defaults)
  if (placed.length === 0) return { x: 0, y: 0 }

  const [firstRootId] = rootIds
  const firstRoot =
    firstRootId === undefined ? undefined : nodes.find((node) => node.id === firstRootId)

  return { x: firstRoot?.layout.x ?? 0, y: boundsOf(placed).maxY + ROOT_GAP_Y }
}