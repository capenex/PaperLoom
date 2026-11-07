import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
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

/** 子树的列宽与最大节点高度 */
interface ColumnMetrics {
  readonly widths: readonly number[]
  readonly maxNodeHeight: number
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

function buildChildrenMap(nodes: readonly PaperNode[]): ReadonlyMap<NodeId, readonly PaperNode[]> {
  const childrenOf = new Map<NodeId, PaperNode[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const siblings = childrenOf.get(node.parentId) ?? []
    siblings.push(node)
    childrenOf.set(node.parentId, siblings)
  }
  return childrenOf
}

/** 统计子树每一列的最大宽度与最大节点高度，用于自适应列距与行距 */
function measureSubtree(
  root: PaperNode,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  defaults: DocumentDefaults,
): ColumnMetrics {
  const widths: number[] = []
  let maxNodeHeight = 0

  function visit(node: PaperNode, depth: number): void {
    const size = resolveNodeSize(node.layout, defaults)
    widths[depth] = Math.max(widths[depth] ?? 0, size.width)
    maxNodeHeight = Math.max(maxNodeHeight, size.height)
    for (const child of childrenOf.get(node.id) ?? []) {
      visit(child, depth + 1)
    }
  }

  visit(root, 0)
  return { widths, maxNodeHeight }
}

/** 子树内各列的横向偏移：根节点列落在原点，其后每列按上一列宽度加间距递推 */
function computeColumnOffsets(widths: readonly number[]): readonly number[] {
  const offsets = [0]
  for (let depth = 1; depth < widths.length; depth += 1) {
    const previousOffset = offsets[depth - 1] ?? 0
    offsets[depth] = previousOffset + (widths[depth - 1] ?? 0) + COLUMN_GAP
  }
  return offsets
}

/** 子树本地布局：叶子按行距铺开，父节点落在子节点区间的垂直中点，根节点归位到原点 */
function layoutSubtree(
  rootId: NodeId,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  columnOffsets: readonly number[],
  rowHeight: number,
): ReadonlyMap<NodeId, Point> {
  const raw = new Map<NodeId, Point>()
  let leafIndex = 0

  function visit(nodeId: NodeId, depth: number): number {
    const children = childrenOf.get(nodeId) ?? []
    let y: number
    if (children.length === 0) {
      y = leafIndex * rowHeight
      leafIndex += 1
    } else {
      const childYs = children.map((child) => visit(child.id, depth + 1))
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2
    }
    raw.set(nodeId, { x: columnOffsets[depth] ?? 0, y })
    return y
  }

  visit(rootId, 0)
  const rootY = raw.get(rootId)?.y ?? 0
  const local = new Map<NodeId, Point>()
  raw.forEach((point, id) => {
    local.set(id, { x: point.x, y: point.y - rootY })
  })
  return local
}

/** 把一棵子树放到根节点锚点上：本地坐标加上锚点即为画布坐标 */
function placeSubtree(
  root: PaperNode,
  nodeById: ReadonlyMap<NodeId, PaperNode>,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  defaults: DocumentDefaults,
): readonly PlacedNode[] {
  const metrics = measureSubtree(root, childrenOf, defaults)
  const columnOffsets = computeColumnOffsets(metrics.widths)
  const rowHeight = Math.max(MIN_ROW_HEIGHT, metrics.maxNodeHeight + ROW_GAP)
  const localPositions = layoutSubtree(root.id, childrenOf, columnOffsets, rowHeight)

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

/** 按 rootIds 顺序定位全部子树；孤立的非根节点没有归属，不参与布局 */
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

  const placed: PlacedNode[] = []
  for (const rootId of rootIds) {
    const root = nodeById.get(rootId)
    if (root === undefined) continue
    placed.push(...placeSubtree(root, nodeById, childrenOf, defaults))
  }
  return placed
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
 * 计算整份文档的画布布局：每棵子树相对自己的根节点锚点定位，锚点即舞台坐标。
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

/** 节点在原始坐标（未经归一化平移）中的位置：根节点取自身锚点，其余由舞台坐标反推 */
export function rawPositionOf(node: PaperNode, layout: DocumentLayout): Point {
  if (node.parentId === null) return { x: node.layout.x, y: node.layout.y }

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
