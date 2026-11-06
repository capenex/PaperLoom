import { MousePointerClick } from 'lucide-react'

import type { NodeId, NodeLayout, PaperNode } from '@/shared/types/paper'
import { NodeInspector } from './NodeInspector'

interface EditorToolbarProps {
  readonly selectedNode: PaperNode | undefined
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDeleteNode: (nodeId: NodeId) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
}

export function EditorToolbar({
  selectedNode,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onUpdateLayout,
}: Readonly<EditorToolbarProps>) {
  if (selectedNode === undefined) {
    return (
      <div className="flex min-h-12 items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-400">
        <MousePointerClick className="size-4 shrink-0" aria-hidden="true" />
        单击节点调整结构与尺寸，双击节点编辑内容
      </div>
    )
  }

  return (
    <NodeInspector
      node={selectedNode}
      onAddChild={onAddChild}
      onAddSibling={onAddSibling}
      onDelete={onDeleteNode}
      onUpdateLayout={onUpdateLayout}
    />
  )
}
