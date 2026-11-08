import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
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
import { NodeActions } from './NodeActions'
import { NodeEventControl } from './NodeEventControl'
import { NodeSizeControls } from './NodeSizeControls'
import { NodeTypeControl } from './NodeTypeControl'

interface NodeInspectorProps {
  readonly node: PaperNode
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly activeCanvasId: CanvasId | null
  readonly isHostRoot: boolean
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDelete: (nodeId: NodeId) => void
  readonly onChangeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly onUpdateImage: (nodeId: NodeId, src: string, alt: string) => void
  readonly onUpdateFile: (
    nodeId: NodeId,
    fileName: string,
    format: StaticFileFormat,
    text: string,
  ) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
  readonly onUpdateEvents: (nodeId: NodeId, events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (nodeId: NodeId, canvasId: CanvasId) => void
  readonly onEditNodeText: (nodeId: NodeId) => void
}

function ToolbarDivider() {
  return <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
}

function NodeInspectorTypeAndEvents(props: Readonly<NodeInspectorProps>) {
  const { node, activeCanvasId } = props
  return (
    <>
      <NodeTypeControl
        kind={node.content.kind}
        onChangeKind={(kind) => {
          props.onChangeKind(node.id, kind)
        }}
        onPickImage={(src, alt) => {
          props.onUpdateImage(node.id, src, alt)
        }}
        onPickFile={(name, format, text) => {
          props.onUpdateFile(node.id, name, format, text)
        }}
      />
      <ToolbarDivider />
      <NodeEventControl
        node={node}
        activeCanvasId={activeCanvasId}
        onUpdateEvents={(events) => {
          props.onUpdateEvents(node.id, events)
        }}
        onEnterSubCanvas={(canvasId) => {
          props.onEnterSubCanvas(node.id, canvasId)
        }}
        onEditNodeText={() => {
          props.onEditNodeText(node.id)
        }}
      />
    </>
  )
}

/** 选中节点的操作区：增删同级/子节点、切换节点类型、编辑事件绑定与节点尺寸 */
export function NodeInspector(props: Readonly<NodeInspectorProps>) {
  const { node, defaults, rootCount, isHostRoot } = props
  const size = resolveNodeSize(node.layout, defaults)
  const isRoot = node.parentId === null
  const canDelete = !isHostRoot && (!isRoot || rootCount > 1)

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <NodeActions
        isRoot={isRoot}
        canDelete={canDelete}
        onAddChild={() => {
          props.onAddChild(node.id)
        }}
        onAddSibling={() => {
          props.onAddSibling(node.id)
        }}
        onDelete={() => {
          props.onDelete(node.id)
        }}
      />
      <ToolbarDivider />
      <NodeInspectorTypeAndEvents {...props} />
      <ToolbarDivider />
      <NodeSizeControls
        width={size.width}
        height={size.height}
        onWidthChange={(width) => {
          props.onUpdateLayout(node.id, { width })
        }}
        onHeightChange={(height) => {
          props.onUpdateLayout(node.id, { height })
        }}
      />
    </div>
  )
}
