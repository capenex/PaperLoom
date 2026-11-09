import type {
  CanvasId,
  DocumentDefaults,
  NodeContent,
  NodeEventBinding,
  NodeId,
  NodeLayout,
  PaperNode,
  StaticFileFormat,
} from '@/shared/types/paper'
import { Move, Scaling } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import type { PendingNodeAction } from '../lib/pendingNodeAction'
import { DocumentToolbar } from './DocumentToolbar'
import { NodeInspector } from './NodeInspector'

interface EditorToolbarProps {
  readonly selectedNode: PaperNode | undefined
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly activeCanvasId?: CanvasId | null
  readonly activeHostNodeId?: NodeId | null
  readonly onAddRoot: () => void
  readonly onUpdateDefaults: (patch: Partial<DocumentDefaults>) => void
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDeleteNode: (nodeId: NodeId) => void
  readonly onChangeNodeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly onUpdateNodeTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onUpdateNodeImage: (nodeId: NodeId, src: string, alt: string) => void
  readonly onUpdateNodeFile: (
    nodeId: NodeId,
    fileName: string,
    format: StaticFileFormat,
    text: string,
  ) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
  readonly onUpdateNodeEvents: (nodeId: NodeId, events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (nodeId: NodeId, canvasId: CanvasId) => void
  readonly onEditNodeText: (nodeId: NodeId) => void
  readonly parents: readonly PaperNode[]
  readonly onRemoveParent: (nodeId: NodeId, parentId: NodeId) => void
  readonly pending: PendingNodeAction | null
  readonly onArmStructure: () => void
  readonly onArmFit: () => void
}

/** 待命指令按钮：结构移动（Alt 等价）与贴合内容（Ctrl 等价），两种编辑栏状态下都可见 */
function PendingActionButtons({
  pending,
  onArmStructure,
  onArmFit,
}: Readonly<{
  pending: PendingNodeAction | null
  onArmStructure: () => void
  onArmFit: () => void
}>) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant={pending?.kind === 'structure' ? 'default' : 'outline'}
        size="sm"
        title="Alt 等价：选中节点后点击，再点目标节点加父 / 点空白脱根；未选中时先点源节点"
        onClick={onArmStructure}
      >
        <Move aria-hidden="true" />
        结构移动
      </Button>
      <Button
        type="button"
        variant={pending?.kind === 'fit' ? 'default' : 'outline'}
        size="sm"
        title="Ctrl 等价：点击后选一个节点，按内容自适应宽高"
        onClick={onArmFit}
      >
        <Scaling aria-hidden="true" />
        贴合内容
      </Button>
    </div>
  )
}

/** 编辑栏：选中节点时编辑该节点（含标题文字与事件绑定），未选中时进行文档级宏观操作 */
export function EditorToolbar({
  selectedNode,
  defaults,
  rootCount,
  activeCanvasId = null,
  activeHostNodeId = null,
  onAddRoot,
  onUpdateDefaults,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onChangeNodeKind,
  onUpdateNodeTitle,
  onUpdateNodeImage,
  onUpdateNodeFile,
  onUpdateLayout,
  onUpdateNodeEvents,
  onEnterSubCanvas,
  onEditNodeText,
  parents,
  onRemoveParent,
  pending,
  onArmStructure,
  onArmFit,
}: Readonly<EditorToolbarProps>) {
  if (selectedNode === undefined) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <PendingActionButtons
          pending={pending}
          onArmStructure={onArmStructure}
          onArmFit={onArmFit}
        />
        <DocumentToolbar
          defaults={defaults}
          onAddRoot={onAddRoot}
          onUpdateDefaults={onUpdateDefaults}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <PendingActionButtons
        pending={pending}
        onArmStructure={onArmStructure}
        onArmFit={onArmFit}
      />
      <NodeInspector
      node={selectedNode}
      defaults={defaults}
      rootCount={rootCount}
      activeCanvasId={activeCanvasId}
      isHostRoot={selectedNode.id === activeHostNodeId}
      onAddChild={onAddChild}
      onAddSibling={onAddSibling}
      onDelete={onDeleteNode}
      onChangeKind={onChangeNodeKind}
      onUpdateTitle={onUpdateNodeTitle}
      onUpdateImage={onUpdateNodeImage}
      onUpdateFile={onUpdateNodeFile}
      onUpdateLayout={onUpdateLayout}
      onUpdateEvents={onUpdateNodeEvents}
      onEnterSubCanvas={onEnterSubCanvas}
      onEditNodeText={onEditNodeText}
        parents={parents}
        onRemoveParent={onRemoveParent}
      />
    </div>
  )
}
