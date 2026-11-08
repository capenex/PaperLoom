import { useEffect, useRef, useState } from 'react'
import { Pencil, Zap } from 'lucide-react'
import { cn } from 'cn'

import { createId } from '@/shared/lib/id'
import {
  DEFAULT_HOST_EXIT_EVENT,
  defaultEventsForNode,
  findTriggeredEvent,
  isActionActiveInCanvas,
  resolveBindingTarget,
  resolveNodeEvents,
} from '@/shared/lib/nodeEvents'
import type { CanvasId, NodeEventBinding, PaperNode } from '@/shared/types/paper'
import { NodeEventPopover } from './NodeEventPopover'

interface NodeEventControlProps {
  readonly node: PaperNode
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
  eventCount,
  showEditButton,
  onToggleOpen,
  onEditNodeText,
}: Readonly<{
  eventCount: number
  showEditButton: boolean
  onToggleOpen: () => void
  onEditNodeText: () => void
}>) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleOpen}
        className={cn(
          'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-2xs transition-colors',
          eventCount > 0
            ? 'border-primary/30 bg-primary/8 text-primary hover:bg-primary/12'
            : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50',
        )}
      >
        <Zap className="size-3.5" aria-hidden="true" />
        <span>事件</span>
        {eventCount > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
            {eventCount}
          </span>
        )}
      </button>

      {showEditButton && (
        <button
          type="button"
          onClick={onEditNodeText}
          title="双击已被事件占用，点击此处（或按住 Alt 双击节点）编辑富文本内容"
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          <Pencil className="size-3.5 text-slate-500" aria-hidden="true" />
          <span>编辑文字</span>
        </button>
      )}
    </>
  )
}

/** 节点事件绑定工具栏入口：展示当前绑定事件数、提供富文本快捷编辑按钮与事件编辑浮窗 */
export function NodeEventControl(props: Readonly<NodeEventControlProps>) {
  const { node, activeCanvasId, onUpdateEvents, onEnterSubCanvas, onEditNodeText } = props
  const isHostRoot = Boolean(props.isHostRoot)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rawEvents = resolveNodeEvents(node)
  const events = effectiveEventsInCanvas(node, activeCanvasId, isHostRoot)
  const isRichTextNode = node.content.kind === 'text'
  const hostNodeId = isHostRoot ? node.id : null
  const dblClickEvent = findTriggeredEvent(node, 'double-click', activeCanvasId, 'node', hostNodeId)
  const dblClickOccupied = dblClickEvent?.action.type !== 'edit-node'

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
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <EventToggleButtons
        eventCount={events.length}
        showEditButton={isRichTextNode && dblClickOccupied}
        onToggleOpen={() => {
          setOpen((prev) => !prev)
        }}
        onEditNodeText={onEditNodeText}
      />
      {open && (
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
