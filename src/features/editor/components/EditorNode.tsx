/* eslint-disable jsx-a11y/prefer-tag-over-role -- 卡片需要容纳块级富文本，原生 button 只能包含短语内容 */
import { memo, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { cn } from 'cn'

import { resolveActiveImageIndex, resolveImageItems } from '@/shared/lib/mediaPages'
import { EXPANDED_MEDIA_SCALE, resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeSize } from '@/shared/lib/nodeDefaults'
import { findBoundSubCanvasId } from '@/shared/lib/nodeEvents'
import type {
  CanvasId,
  DocumentDefaults,
  ImageNodeContent,
  NodeEventAction,
  NodeId,
  PageSwitchMode,
  PaperNode,
  PaperReference,
  TextNodeContent,
} from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { cardHandlers } from '../lib/cardInteraction'
import { splitRichTextPages } from '../lib/markdownRichText'
import { plainTextFromHtml } from '../lib/richText'
import { FileNodeBody, NodeBadge, TitleNodeBody } from './StaticNodeBodies'

interface EditorNodeProps {
  readonly node: PaperNode
  readonly position: Point
  readonly defaults: DocumentDefaults
  readonly selected: boolean
  readonly editing: boolean
  readonly expanded: boolean
  readonly activeCanvasId?: CanvasId | null | undefined
  readonly activeHostNodeId?: NodeId | null | undefined
  readonly isHostRoot?: boolean | undefined
  /** 这张卡片正被 Alt 拖动 */
  readonly dragging: boolean
  /** 舞台上是否有任何节点正处于 Alt 拖动中 */
  readonly anyDragging?: boolean | undefined
  /** 这张卡片是当前合法的挂载落点 */
  readonly dropTarget: boolean
  /** 拖到空白处，提示松手后脱离为新根节点 */
  readonly detachHint: boolean
  readonly onSelect: (nodeId: NodeId) => void
  readonly onEdit: (nodeId: NodeId) => void
  readonly onFitNodeSize: (nodeId: NodeId, size: NodeSize) => void
  readonly onSwitchNodePage: (nodeId: NodeId, mode: PageSwitchMode, pageIndex?: number) => void
  readonly onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onDragStart: (nodeId: NodeId, event: ReactPointerEvent<HTMLElement>) => void
  readonly shouldSuppressClick: () => boolean
}

interface NodeBodyProps {
  readonly node: PaperNode
  readonly fontSize: number
  readonly onSwitchNodePage: (nodeId: NodeId, mode: PageSwitchMode, pageIndex?: number) => void
}

interface TextNodeBodyProps {
  readonly content: TextNodeContent
  readonly fontSize: number
  readonly onSwitchPage: (pageIndex: number) => void
}

interface ImageNodeBodyProps {
  readonly content: ImageNodeContent
  readonly onSwitchPage: (pageIndex: number) => void
}

function cardClassName(
  selected: boolean,
  editing: boolean,
  expanded: boolean,
  flushPadding: boolean,
  anyDragging: boolean,
): string {
  return cn(
    'absolute flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border',
    'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06),0_1px_3px_-1px_rgba(15,23,42,0.04)]',
    anyDragging
      ? 'transition-[transform,box-shadow,border-color,outline-color,opacity] duration-200 ease-out'
      : 'transition-[transform,left,top,width,height,box-shadow,border-color,outline-color,opacity] duration-250 ease-out',
    'hover:border-slate-300/90 hover:shadow-[0_10px_24px_-4px_rgba(15,23,42,0.1)] focus-visible:outline-none',
    'border-slate-200/90 bg-white text-slate-900',
    flushPadding ? 'p-0' : 'px-3.5 py-2.5',
    (selected || editing) &&
      'border-primary/40 ring-2 ring-primary ring-offset-2 ring-offset-[#fbfcfe]',
    expanded && 'z-30 shadow-2xl',
  )
}

/** 隐藏节点只淡化底色与内容，选中框与落点高亮保持原样，便于找回 */
const HIDDEN_CARD_CLASS =
  'border-dashed border-slate-300/50 bg-white/25 shadow-none *:opacity-25 hover:shadow-none'

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

function NodePageTurnControls({
  pageIndex,
  pageCount,
  onPrev,
  onNext,
}: Readonly<{
  pageIndex: number
  pageCount: number
  onPrev: () => void
  onNext: () => void
}>) {
  return (
    <div
      role="group"
      aria-label="节点翻页"
      className="absolute right-2.5 bottom-1.5 z-20 flex items-center gap-0.5 rounded-md border border-slate-200/90 bg-white/95 px-1 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs backdrop-blur-xs select-none"
    >
      <button
        type="button"
        aria-label="上一页"
        disabled={pageIndex <= 0}
        className="flex size-4 cursor-pointer items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          onPrev()
        }}
      >
        ‹
      </button>
      <span className="px-1 font-mono text-[10px] tabular-nums text-slate-500">
        {pageIndex + 1}/{pageCount}
      </span>
      <button
        type="button"
        aria-label="下一页"
        disabled={pageIndex >= pageCount - 1}
        className="flex size-4 cursor-pointer items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          onNext()
        }}
      >
        ›
      </button>
    </div>
  )
}

function TextNodeBody({ content, fontSize, onSwitchPage }: Readonly<TextNodeBodyProps>) {
  const richText = content.richText
  const pages = splitRichTextPages(richText)

  if (richText.trim() === '') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <span className="text-xs font-medium text-slate-500">空白节点</span>
      </div>
    )
  }

  const safeIndex = Math.min(
    Math.max(content.activePageIndex ?? 0, 0),
    Math.max(0, pages.length - 1),
  )
  const currentPageHtml = pages[safeIndex] ?? ''
  const isMultiPage = pages.length > 1

  return (
    <>
      {currentPageHtml.trim() === '' ? (
        <div
          className={cn(
            'flex min-h-0 flex-1 items-center justify-center text-xs text-slate-400',
            isMultiPage && 'pb-5',
          )}
        >
          当前页空白
        </div>
      ) : (
        <div
          className={cn(
            'node-rich-text min-h-0 flex-1 overflow-hidden leading-relaxed text-slate-600',
            isMultiPage && 'pb-5',
          )}
          style={{ fontSize }}
          dangerouslySetInnerHTML={{ __html: currentPageHtml }}
        />
      )}
      {isMultiPage && (
        <NodePageTurnControls
          pageIndex={safeIndex}
          pageCount={pages.length}
          onPrev={() => {
            onSwitchPage(safeIndex - 1)
          }}
          onNext={() => {
            onSwitchPage(safeIndex + 1)
          }}
        />
      )}
    </>
  )
}

function ImageNodeBody({ content, onSwitchPage }: Readonly<ImageNodeBodyProps>) {
  const [failed, setFailed] = useState(false)
  const items = resolveImageItems(content)
  const activeIndex = resolveActiveImageIndex(content)
  const isMultiPage = items.length > 1
  const isEmpty = content.src.trim() === ''

  if (isEmpty || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100/80 text-xs font-medium text-slate-400">
        {isEmpty ? '未选择图片' : '图片不可用'}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100 ring-1 ring-black/5 ring-inset">
      <img
        src={content.src}
        alt={content.alt}
        draggable={false}
        referrerPolicy="no-referrer"
        className={cn('h-full w-full select-none', isMultiPage ? 'object-contain' : 'object-cover')}
        onError={() => {
          setFailed(true)
        }}
      />
      {isMultiPage && (
        <NodePageTurnControls
          pageIndex={activeIndex}
          pageCount={items.length}
          onPrev={() => {
            onSwitchPage(activeIndex - 1)
          }}
          onNext={() => {
            onSwitchPage(activeIndex + 1)
          }}
        />
      )}
    </div>
  )
}

function NodeBody({ node, fontSize, onSwitchNodePage }: Readonly<NodeBodyProps>) {
  const switchToPage = (pageIndex: number): void => {
    onSwitchNodePage(node.id, 'index', pageIndex)
  }
  if (node.content.kind === 'image') {
    return <ImageNodeBody key={node.content.src} content={node.content} onSwitchPage={switchToPage} />
  }
  if (node.content.kind === 'title') {
    return <TitleNodeBody content={node.content} fontSize={fontSize} />
  }
  if (node.content.kind === 'file') {
    return <FileNodeBody content={node.content} fontSize={fontSize} />
  }
  return <TextNodeBody content={node.content} fontSize={fontSize} onSwitchPage={switchToPage} />
}

function nodeAccessibleLabel(node: PaperNode): string {
  if (node.content.kind === 'image') {
    return node.content.alt.trim() === '' ? '未命名图片' : node.content.alt
  }
  if (node.content.kind === 'title') {
    const joined = `${node.content.title} ${node.content.subtitle}`.trim()
    return joined === '' ? '空白标题' : joined
  }
  if (node.content.kind === 'file') {
    return node.content.fileName.trim() === '' ? '未命名文件' : node.content.fileName
  }

  const text = plainTextFromHtml(node.content.richText)
  if (text === '') return '空白节点'
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

function nodeAriaLabel(node: PaperNode, hasSubCanvas: boolean, isHostRoot: boolean): string {
  const label = nodeAccessibleLabel(node)
  const suffix = hasSubCanvas
    ? '，双击展开支线画布'
    : isHostRoot
      ? '，双击返回上级画布'
      : ''
  if (node.content.kind === 'image') {
    return `图片节点：${label}${suffix}`
  }
  if (node.content.kind === 'title') {
    return `标题节点：${label}${suffix}`
  }
  if (node.content.kind === 'file') {
    return `静态文件节点：${label}${suffix}`
  }
  return `节点：${label}${suffix}`
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
  const flushPadding = isImage || node.content.kind === 'file'
  const imageExpanded = isImage && props.expanded
  const activeCanvasId = props.activeCanvasId ?? null
  const activeHostNodeId = props.activeHostNodeId ?? null
  const isHostRoot = Boolean(props.isHostRoot)
  const hasSubCanvas = findBoundSubCanvasId(node, activeCanvasId) !== null
  const hidden = node.isHidden === true
  const hiddenSuffix = hidden ? '（已隐藏）' : ''
  const handlers = cardHandlers({
    node,
    defaults,
    selected,
    imageExpanded,
    activeCanvasId,
    activeHostNodeId,
    onSelect: props.onSelect,
    onEdit: props.onEdit,
    onFitNodeSize: props.onFitNodeSize,
    onTriggerEvent: props.onTriggerEvent,
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
      aria-label={nodeAriaLabel(node, hasSubCanvas, isHostRoot) + hiddenSuffix}
      data-node-id={node.id}
      className={cn(
        cardClassName(
          selected,
          editing,
          imageExpanded,
          flushPadding,
          Boolean(props.anyDragging),
        ),
        hidden && HIDDEN_CARD_CLASS,
        dragClassName(dragging, dropTarget, detachHint),
      )}
      style={nodeStyle(size.width, size.height, position, imageExpanded)}
      {...handlers}
    >
      <NodeBadge hasSubCanvas={hasSubCanvas} isHostRoot={isHostRoot} />
      <NodeBody node={node} fontSize={defaults.fontSize} onSwitchNodePage={props.onSwitchNodePage} />
    </div>
  )
})
