import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeId, PaperNode } from '@/shared/types/paper'
import type { TreeLayout } from './layout'

interface EditorConnectionsProps {
  readonly nodes: readonly PaperNode[]
  readonly layout: TreeLayout
}

export function EditorConnections({ nodes, layout }: Readonly<EditorConnectionsProps>) {
  const widths = new Map<NodeId, number>()
  for (const node of nodes) {
    widths.set(node.id, resolveNodeSize(node.layout).width)
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
    >
      {nodes.map((node) => {
        if (node.parentId === null) return null
        const source = layout.positions.get(node.parentId)
        const target = layout.positions.get(node.id)
        const parentWidth = widths.get(node.parentId)
        const childWidth = widths.get(node.id)
        if (
          source === undefined ||
          target === undefined ||
          parentWidth === undefined ||
          childWidth === undefined
        ) {
          return null
        }

        const startX = source.x + parentWidth / 2
        const endX = target.x - childWidth / 2
        const controlX = (startX + endX) / 2
        const path = `M ${startX} ${source.y} C ${controlX} ${source.y}, ${controlX} ${target.y}, ${endX} ${target.y}`

        return (
          <path
            key={node.id}
            d={path}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            opacity={0.45}
          />
        )
      })}
    </svg>
  )
}
