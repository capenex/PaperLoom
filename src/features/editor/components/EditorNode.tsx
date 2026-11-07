/* eslint-disable jsx-a11y/prefer-tag-over-role -- 卡片需要容纳块级富文本，原生 button 只能包含短语内容 */
import { memo, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { cn } from 'cn'

import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type {
  DocumentDefaults,
  ImageNodeContent,
  NodeId,
  PaperNode,
  PaperReference,
  TextNodeContent,
} from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { cardHandlers } from '../lib/cardInteraction'
import { plainTextFromHtml } from '../lib/richText'

const EXPANDED_MEDIA_SCALE = 2

interface EditorNodeProps {
  readonly node: PaperNode
  readonly position: Point
  readonly defaults: DocumentDefaults
  readonly selected: boolean
  readonly editing: boolean
  readonly expanded: boolean
  /** 这张卡片正被 Alt 拖动 */
  readonly dragging: boolean
  /** 这张卡片是当前合法的挂载落点 */
  readonly dropTarget: boolean
  /** 拖到空白处，提示松手后脱离为新根节点 */
  readonly detachHint: boolean
  readonly onSelect: (nodeId: NodeId) => void
  readonly onEdit: (nodeId: NodeId) => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onDragStart: (nodeId: NodeId, event: ReactPointerEvent<HTMLElement>) => void
  readonly shouldSuppressClick: () => boolean
}

interface NodeBodyProps {
  readonly node: PaperNode
  readonly fontSize: number
}

interface TextNodeBodyProps {
  readonly content: TextNodeContent
  readonly fontSize: number
}

interface ImageNodeBodyProps {
  readonly content: ImageNodeContent
}

function cardClassName(
  selected: boolean,
  editing: boolean,
  expanded: boolean,
  isImage: boolean,
): string {
  // 过渡属性刻意不含 left/top：拖动时位置每帧都在变，加了过渡卡片就追不上指针
  return cn(
    'absolute flex cursor-pointer select-none flex-col overflow-hidden rounded-[10px] border shadow-sm',
    'transition-[transform,box-shadow,border-color,outline-color,opacity] duration-200 ease-out',
    'hover:shadow-md focus-visible:outline-none',
    'border-slate-200 bg-white text-slate-900',
    isImage ? 'p-0' : 'px-3 py-2',
    selected && !editing && 'ring-2 ring-primary ring-offset-2 ring-offset-[#fbfcfe]',
    expanded && 'z-30 shadow-2xl',
  )
}

/** Alt 拖动时的附加样式：被拖动的卡片半透明，可作为落点的卡片高亮，空白落点提示将脱离为根 */
function dragClassName(dragging: boolean, dropTarget: boolean, detachHint: boolean): string {
  if (dragging) {
    return cn(
      'z-40 cursor-grabbing opacity-70',
      detachHint && 'outline-2 outline-dashed outline-sky-500',
    )
  }

  return dropTarget ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
}

function TextNodeBody({ content, fontSize }: Readonly<TextNodeBodyProps>) {
  const richText = content.richText

  if (richText.trim() === '') {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-xs text-slate-400">空白节点</span>
      </div>
    )
  }

  return (
    <div
      className="node-rich-text min-h-0 flex-1 overflow-hidden leading-relaxed text-slate-600"
      style={{ fontSize }}
      dangerouslySetInnerHTML={{ __html: richText }}
    />
  )
}

function ImageNodeBody({ content }: Readonly<ImageNodeBodyProps>) {
  const [failed, setFailed] = useState(false)

  if (failed || content.src.trim() === '') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
        图片不可用
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden bg-slate-100">
      <img
        src={content.src}
        alt={content.alt}
        draggable={false}
        className="h-full w-full select-none object-cover"
        onError={() => {
          setFailed(true)
        }}
      />
    </div>
  )
}

function NodeBody({ node, fontSize }: Readonly<NodeBodyProps>) {
  if (node.content.kind === 'image') {
    return <ImageNodeBody content={node.content} />
  }

  return <TextNodeBody content={node.content} fontSize={fontSize} />
}

function nodeAccessibleLabel(node: PaperNode): string {
  if (node.content.kind === 'image') {
    return node.content.alt.trim() === '' ? '未命名图片' : node.content.alt
  }

  const text = plainTextFromHtml(node.content.richText)
  if (text === '') return '空白节点'
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

function nodeAriaLabel(node: PaperNode): string {
  const label = nodeAccessibleLabel(node)
  return node.content.kind === 'image'
    ? `图片节点：${label}，点击放大，再次点击查看大图，右键空白处还原`
    : `节点：${label}，双击编辑内容`
}

const ALT_DRAG_HINT = '按住 Alt 拖动：拖到节点上成为其子节点，拖到空白处脱离为新根节点'

function nodeTitle(node: PaperNode): string {
  return node.content.kind === 'image'
    ? `点击放大，再次点击查看大图，右键空白处还原；${ALT_DRAG_HINT}`
    : `双击编辑内容；${ALT_DRAG_HINT}`
}

function nodeStyle(width: number, height: number, position: Point, expanded: boolean): CSSProperties {
  return {
    left: position.x,
    top: position.y,
    width,
    height,
    transform: expanded
      ? `translate(-50%, -50%) scale(${EXPANDED_MEDIA_SCALE})`
      : 'translate(-50%, -50%)',
  }
}

/** 拖动期间舞台每帧重渲染，memo 让位置没变的卡片直接跳过 */
export const EditorNode = memo(function EditorNode(props: Readonly<EditorNodeProps>) {
  const { node, position, defaults, selected, editing, dragging, dropTarget, detachHint } = props
  const size = resolveNodeSize(node.layout, defaults)
  const isImage = node.content.kind === 'image'
  const imageExpanded = isImage && props.expanded
  const handlers = cardHandlers({
    node,
    imageExpanded,
    onSelect: props.onSelect,
    onEdit: props.onEdit,
    onOpenMediaDetail: props.onOpenMediaDetail,
    onOpenReferencePreview: props.onOpenReferencePreview,
    onOpenReferenceDetail: props.onOpenReferenceDetail,
    onDragStart: props.onDragStart,
    shouldSuppressClick: props.shouldSuppressClick,
  })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={nodeAriaLabel(node)}
      title={nodeTitle(node)}
      data-node-id={node.id}
      className={cn(
        cardClassName(selected, editing, imageExpanded, isImage),
        dragClassName(dragging, dropTarget, detachHint),
      )}
      style={nodeStyle(size.width, size.height, position, imageExpanded)}
      {...handlers}
    >
      <NodeBody node={node} fontSize={defaults.fontSize} />
    </div>
  )
})
