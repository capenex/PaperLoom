import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults, NodeId, NodeLayout, PaperNode } from '@/shared/types/paper'
import { NodeActions } from './NodeActions'
import { NodeSizeControls } from './NodeSizeControls'

interface NodeInspectorProps {
  readonly node: PaperNode
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDelete: (nodeId: NodeId) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
}

/** 选中节点的操作区：增删同级/子节点与自身尺寸 */
export function NodeInspector({
  node,
  defaults,
  rootCount,
  onAddChild,
  onAddSibling,
  onDelete,
  onUpdateLayout,
}: Readonly<NodeInspectorProps>) {
  const size = resolveNodeSize(node.layout, defaults)
  const isRoot = node.parentId === null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <NodeActions
        isRoot={isRoot}
        canDelete={!isRoot || rootCount > 1}
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
