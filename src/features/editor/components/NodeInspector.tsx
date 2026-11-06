import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeId, NodeLayout, PaperNode } from '@/shared/types/paper'
import { NodeActions } from './NodeActions'
import { NodeSizeControls } from './NodeSizeControls'

interface NodeInspectorProps {
  readonly node: PaperNode
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDelete: (nodeId: NodeId) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
}

export function NodeInspector({
  node,
  onAddChild,
  onAddSibling,
  onDelete,
  onUpdateLayout,
}: Readonly<NodeInspectorProps>) {
  const size = resolveNodeSize(node.layout)
  const isRoot = node.parentId === null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <NodeActions
        isRoot={isRoot}
        onAddChild={() => {
          onAddChild(node.id)
        }}
        onAddSibling={() => {
          onAddSibling(node.id)
        }}
        onDelete={() => {
          onDelete(node.id)
        }}
      />

      <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />

      <NodeSizeControls
        width={size.width}
        height={size.height}
        onWidthChange={(width) => {
          onUpdateLayout(node.id, { width })
        }}
        onHeightChange={(height) => {
          onUpdateLayout(node.id, { height })
        }}
      />
    </div>
  )
}
