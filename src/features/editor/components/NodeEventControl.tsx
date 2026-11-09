import { useEffect, useRef, useState } from 'react'
import { Pencil, Zap } from 'lucide-react'
import { cn } from 'cn'

import { createId } from '@/shared/lib/id'
import {
  DEFAULT_HOST_EXIT_EVENT,
  defaultEventsForNode,
  isActionActiveInCanvas,
  resolveBindingTarget,
  resolveNodeEvents,
} from '@/shared/lib/nodeEvents'
import type { CanvasId, NodeEventBinding, PaperNode } from '@/shared/types/paper'
import { NodeEventPopover } from './NodeEventPopover'

interface NodeEventControlProps {
  readonly node: PaperNode | undefined
  readonly activeCanvasId: CanvasId | null
  readonly isHostRoot?: boolean | undefined
  readonly onUpdateEvents: (events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (canvasId: CanvasId) => void
  readonly onEditNodeText: () => void
}

function isCurrentCanvasEntryBinding(
  binding: NodeEventBinding,
  activeCanvasId: CanvasId | null,
): boolean {
  return (
    activeCanvasId !== null &&
    binding.action.type === 'open-canvas' &&
    binding.action.canvasId === activeCanvasId
  )
}

function bindOrEnterBranchCanvas(
  events: readonly NodeEventBinding[],
  activeCanvasId: CanvasId | null,
  onUpdateEvents: (events: readonly NodeEventBinding[]) => void,
  onEnterSubCanvas: (canvasId: CanvasId) => void,
  closePopover: () => void,
): void {
  const existing = events.find(
    (item) =>
      resolveBindingTarget(item) === 'node' &&
      item.action.type === 'open-canvas' &&
      item.action.canvasId !== activeCanvasId,
  )
  if (existing !== undefined && existing.action.type === 'open-canvas') {
    onEnterSubCanvas(existing.action.canvasId)
    closePopover()
    return
  }
  const nextBinding: NodeEventBinding = {
    id: createId(),
    target: 'node',
    trigger: 'double-click',
    action: { type: 'open-canvas', canvasId: createId() },
  }
  onUpdateEvents([
    ...events.filter(
      (item) =>
        !(
          resolveBindingTarget(item) === 'node' &&
          item.trigger === 'double-click' &&
          isActionActiveInCanvas(item.action, activeCanvasId)
        ),
    ),
    nextBinding,
  ])
}

/** 计算当前画布内展示给用户的生效事件列表（子画布内隐藏上级入口绑定，默认展示「双击返回上级画布」） */
function effectiveEventsInCanvas(
  node: PaperNode,
  activeCanvasId: CanvasId | null,
  isHostRoot: boolean,
): readonly NodeEventBinding[] {
  const base = resolveNodeEvents(node).filter(
    (item) => !isCurrentCanvasEntryBinding(item, activeCanvasId),
  )
  if (!isHostRoot || activeCanvasId === null) return base
  const hasActiveDblClick = base.some(
    (item) =>
      resolveBindingTarget(item) === 'node' &&
      item.trigger === 'double-click' &&
      isActionActiveInCanvas(item.action, activeCanvasId) &&
      (item.action.type === 'open-canvas' || item.action.type === 'return-parent-canvas'),
  )
  return hasActiveDblClick ? base : [...base, DEFAULT_HOST_EXIT_EVENT]
}

/** 在子画布内修改同源起点节点事件时，自动保留上级画布指向本子画布的入口绑定 */
function mergeSavedEventsFromCanvas(
  rawEvents: readonly NodeEventBinding[],
  nextVisibleEvents: readonly NodeEventBinding[],
  activeCanvasId: CanvasId | null,
): readonly NodeEventBinding[] {
  const parentEntryBindings = rawEvents.filter((item) =>
    isCurrentCanvasEntryBinding(item, activeCanvasId),
  )
  const cleanedVisible = nextVisibleEvents.filter(
    (item) => item.id !== DEFAULT_HOST_EXIT_EVENT.id,
  )
  return [...parentEntryBindings, ...cleanedVisible]
}

function EventToggleButtons({
  disabled,
  eventCount,
  canEditRichText,
  onToggleOpen,
  onEditNodeText,
}: Readonly<{
  disabled: boolean
  eventCount: number
  canEditRichText: boolean
  onToggleOpen: () => void
  onEditNodeText: () => void
}>) {
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleOpen}
        title={disabled ? '请先在画布中选中一个节点' : '管理节点触发事件与支线子画布'}
        className={cn(
          'inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium shadow-2xs transition-colors disabled:pointer-events-none disabled:opacity-45',
          !disabled && eventCount > 0
            ? 'border-primary/30 bg-primary/8 text-primary hover:bg-primary/12'
            : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50',
        )}
      >
        <Zap className="size-3" aria-hidden="true" />
        <span>事件</span>
        {!disabled && eventCount > 0 && (
          <span className="rounded bg-primary/15 px-1 text-[10px] font-bold tabular-nums text-primary">
            {eventCount}
          </span>
        )}
      </button>

      <button
        type="button"
        disabled={!canEditRichText}
        onClick={onEditNodeText}
        title={
          canEditRichText
            ? '打开富文本编辑器（支持按住 Alt 双击节点编辑）'
            : '选中富文本节点时可点击此处编辑文字'
        }
        className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45"
      >
        <Pencil className="size-3 text-slate-500" aria-hidden="true" />
        <span>编辑文字</span>
      </button>
    </>
  )
}

/** 节点事件绑定工具栏入口：展示当前绑定事件数、提供富文本快捷编辑按钮与事件编辑浮窗（未选中节点时原位虚化） */
export function NodeEventControl(props: Readonly<NodeEventControlProps>) {
  const { node, activeCanvasId, onUpdateEvents, onEnterSubCanvas, onEditNodeText } = props
  const isHostRoot = Boolean(props.isHostRoot)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const disabled = node === undefined
  const rawEvents = node === undefined ? [] : resolveNodeEvents(node)
  const events = node === undefined ? [] : effectiveEventsInCanvas(node, activeCanvasId, isHostRoot)
  const isRichTextNode = node?.content.kind === 'text'

  const handleUpdateEvents = (nextVisible: readonly NodeEventBinding[]): void => {
    onUpdateEvents(mergeSavedEventsFromCanvas(rawEvents, nextVisible, activeCanvasId))
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!open || !(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative flex h-6 items-center gap-1.5">
      <EventToggleButtons
        disabled={disabled}
        eventCount={events.length}
        canEditRichText={!disabled && isRichTextNode}
        onToggleOpen={() => {
          setOpen((prev) => !prev)
        }}
        onEditNodeText={onEditNodeText}
      />
      {open && node !== undefined && (
        <NodeEventPopover
          kind={node.content.kind}
          events={events}
          defaultEvents={defaultEventsForNode(node)}
          onUpdateEvents={handleUpdateEvents}
          onEnterCanvas={(id) => {
            onEnterSubCanvas(id)
            setOpen(false)
          }}
          onBindBranchCanvas={() => {
            bindOrEnterBranchCanvas(
              rawEvents,
              activeCanvasId,
              onUpdateEvents,
              onEnterSubCanvas,
              () => {
                setOpen(false)
              },
            )
          }}
        />
      )}
    </div>
  )
}
