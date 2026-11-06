import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeId, PaperNode } from '@/shared/types/paper'

export interface Point {
  readonly x: number
  readonly y: number
}

export interface TreeLayout {
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly width: number
  readonly height: number
}

const COLUMN_GAP = 96
const ROW_GAP = 48
const MIN_ROW_HEIGHT = 140
const MIN_PADDING_X = 180
const MIN_PADDING_Y = 100

interface ColumnMetrics {
  readonly widths: readonly number[]
  readonly maxDepth: number
  readonly maxNodeHeight: number
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

/** 统计每一列的最大节点宽度与全局最大高度，用于自适应列距与行距 */
function measureColumns(
  root: PaperNode,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
): ColumnMetrics {
  const widths: number[] = []
  let maxDepth = 0
  let maxNodeHeight = 0

  function visit(node: PaperNode, depth: number): void {
    const size = resolveNodeSize(node.layout)
    widths[depth] = Math.max(widths[depth] ?? 0, size.width)
    maxNodeHeight = Math.max(maxNodeHeight, size.height)
    maxDepth = Math.max(maxDepth, depth)
    for (const child of childrenOf.get(node.id) ?? []) {
      visit(child, depth + 1)
    }
  }

  visit(root, 0)
  return { widths, maxDepth, maxNodeHeight }
}

function computeColumnOffsets(widths: readonly number[], paddingX: number): readonly number[] {
  const offsets = [paddingX]
  for (let depth = 1; depth < widths.length; depth += 1) {
    const previousOffset = offsets[depth - 1] ?? paddingX
    const previousWidth = widths[depth - 1] ?? 0
    offsets[depth] = previousOffset + previousWidth + COLUMN_GAP
  }
  return offsets
}

/** 自动树形布局：叶子节点垂直均分，父节点落在子节点区间的垂直中点 */
function assignPositions(
  rootId: NodeId,
  childrenOf: ReadonlyMap<NodeId, readonly PaperNode[]>,
  columnOffsets: readonly number[],
  rowHeight: number,
  paddingY: number,
): { readonly positions: ReadonlyMap<NodeId, Point>; readonly leafCount: number } {
  const positions = new Map<NodeId, Point>()
  let leafIndex = 0

  function visit(nodeId: NodeId, depth: number): number {
    const children = childrenOf.get(nodeId) ?? []
    let y: number
    if (children.length === 0) {
      y = paddingY + leafIndex * rowHeight
      leafIndex += 1
    } else {
      const childYs = children.map((child) => visit(child.id, depth + 1))
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2
    }
    positions.set(nodeId, { x: columnOffsets[depth] ?? MIN_PADDING_X, y })
    return y
  }

  visit(rootId, 0)
  return { positions, leafCount: leafIndex }
}

export function layoutTree(nodes: readonly PaperNode[], rootId: NodeId): TreeLayout {
  const root = nodes.find((node) => node.id === rootId)
  if (root === undefined) {
    return { positions: new Map(), width: 400, height: 400 }
  }

  const childrenOf = buildChildrenMap(nodes)
  const metrics = measureColumns(root, childrenOf)
  const widestColumn = Math.max(...metrics.widths, 0)
  const paddingX = Math.max(MIN_PADDING_X, widestColumn / 2 + 48)
  const paddingY = Math.max(MIN_PADDING_Y, metrics.maxNodeHeight / 2 + 40)
  const columnOffsets = computeColumnOffsets(metrics.widths, paddingX)
  const rowHeight = Math.max(MIN_ROW_HEIGHT, metrics.maxNodeHeight + ROW_GAP)
  const { positions, leafCount } = assignPositions(
    rootId,
    childrenOf,
    columnOffsets,
    rowHeight,
    paddingY,
  )

  const lastOffset = columnOffsets[metrics.maxDepth] ?? paddingX
  const lastWidth = metrics.widths[metrics.maxDepth] ?? 0

  return {
    positions,
    width: lastOffset + lastWidth / 2 + paddingX,
    height: Math.max(paddingY * 2 + (leafCount - 1) * rowHeight, 400),
  }
}
