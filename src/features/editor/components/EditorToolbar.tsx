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
  )
}
