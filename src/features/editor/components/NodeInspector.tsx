import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type {
  DocumentDefaults,
  NodeContent,
  NodeId,
  NodeLayout,
  PaperNode,
  StaticFileFormat,
} from '@/shared/types/paper'
import { NodeActions } from './NodeActions'
import { NodeSizeControls } from './NodeSizeControls'
import { NodeTypeControl } from './NodeTypeControl'

interface NodeInspectorProps {
  readonly node: PaperNode
  readonly defaults: DocumentDefaults
  readonly rootCount: number
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
}

function ToolbarDivider() {
  return <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
}

/** 选中节点的操作区：增删同级/子节点、切换节点类型（富文本/纯标题/多媒体/静态文件）与自身尺寸 */
export function NodeInspector(props: Readonly<NodeInspectorProps>) {
  const { node, defaults, rootCount } = props
  const size = resolveNodeSize(node.layout, defaults)
  const isRoot = node.parentId === null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <NodeActions
        isRoot={isRoot}
        canDelete={!isRoot || rootCount > 1}
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
      <NodeTypeControl
        kind={node.content.kind}
        onChangeKind={(kind) => {
          props.onChangeKind(node.id, kind)
        }}
        onPickImage={(src, alt) => {
          props.onUpdateImage(node.id, src, alt)
        }}
        onPickFile={(fileName, format, text) => {
          props.onUpdateFile(node.id, fileName, format, text)
        }}
      />
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
