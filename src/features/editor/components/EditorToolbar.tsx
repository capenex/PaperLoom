import type { DocumentDefaults, NodeId, NodeLayout, PaperNode } from '@/shared/types/paper'
import { DocumentToolbar } from './DocumentToolbar'
import { NodeInspector } from './NodeInspector'

interface EditorToolbarProps {
  readonly selectedNode: PaperNode | undefined
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly onAddRoot: () => void
  readonly onUpdateDefaults: (patch: Partial<DocumentDefaults>) => void
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDeleteNode: (nodeId: NodeId) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
}

/** 编辑栏：选中节点时编辑该节点，未选中时进行文档级宏观操作 */
export function EditorToolbar({
  selectedNode,
  defaults,
  rootCount,
  onAddRoot,
  onUpdateDefaults,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onUpdateLayout,
}: Readonly<EditorToolbarProps>) {
  if (selectedNode === undefined) {
    return (
      <DocumentToolbar
        defaults={defaults}
        onAddRoot={onAddRoot}
        onUpdateDefaults={onUpdateDefaults}
      />
    )
  }

  return (
    <NodeInspector
      node={selectedNode}
      defaults={defaults}
      rootCount={rootCount}
      onAddChild={onAddChild}
      onAddSibling={onAddSibling}
      onDelete={onDeleteNode}
      onUpdateLayout={onUpdateLayout}
    />
  )
}
