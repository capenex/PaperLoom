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
import { plainTextFromHtml } from '../lib/richText'
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
  readonly onUpdateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
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
  readonly parents: readonly PaperNode[]
  readonly onRemoveParent: (nodeId: NodeId, parentId: NodeId) => void
}

function parentLabel(parent: PaperNode): string {
  const content = parent.content
  if (content.kind === 'title') return content.title || '标题节点'
  if (content.kind === 'file') return content.fileName
  if (content.kind === 'image') return content.alt || '图片节点'
  return plainTextFromHtml(content.richText).slice(0, 12) || '空白节点'
}

/** 多父节点父列表：每个父一枚可移除芯片；Alt 拖到上一层节点可追加父 */
function ParentChips({
  node,
  parents,
  onRemoveParent,
}: Readonly<{
  node: PaperNode
  parents: readonly PaperNode[]
  onRemoveParent: (nodeId: NodeId, parentId: NodeId) => void
}>) {
  if (parents.length === 0) return null
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-slate-400">父节点</span>
      {parents.map((parent) => (
        <span
          key={parent.id}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
        >
          {parentLabel(parent)}
          <button
            type="button"
            aria-label={`移除父节点 ${parentLabel(parent)}`}
            title="移除该父节点（删到空则升为根节点）"
            className="cursor-pointer text-slate-400 hover:text-red-500"
            onClick={() => {
              onRemoveParent(node.id, parent.id)
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

function ToolbarDivider() {
  return <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
}

function NodeInspectorTypeAndEvents(props: Readonly<NodeInspectorProps>) {
  const { node, activeCanvasId } = props
  return (
    <>
      <NodeTypeControl
        content={node.content}
        onChangeKind={(kind) => {
          props.onChangeKind(node.id, kind)
        }}
        onUpdateTitle={(title, subtitle) => {
          props.onUpdateTitle(node.id, title, subtitle)
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
        isHostRoot={props.isHostRoot}
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

/** 选中节点的操作区：增删同级/子节点、切换节点类型（及标题行内修改）、编辑事件绑定与节点尺寸 */
export function NodeInspector(props: Readonly<NodeInspectorProps>) {
  const { node, defaults, rootCount, isHostRoot } = props
  const size = resolveNodeSize(node.layout, defaults)
  const isRoot = node.parentIds.length === 0
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
      <ParentChips node={node} parents={props.parents} onRemoveParent={props.onRemoveParent} />
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
