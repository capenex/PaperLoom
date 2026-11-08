import { useEffect, useRef, useState } from 'react'
import { Pencil, Zap } from 'lucide-react'
import { cn } from 'cn'

import { createId } from '@/shared/lib/id'
import {
  defaultEventsForNode,
  findTriggeredEvent,
  resolveBindingTarget,
  resolveNodeEvents,
} from '@/shared/lib/nodeEvents'
import type { CanvasId, NodeEventBinding, PaperNode } from '@/shared/types/paper'
import { NodeEventPopover } from './NodeEventPopover'

interface NodeEventControlProps {
  readonly node: PaperNode
  readonly activeCanvasId: CanvasId | null
  readonly onUpdateEvents: (events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (canvasId: CanvasId) => void
  readonly onEditNodeText: () => void
}

function bindOrEnterBranchCanvas(
  events: readonly NodeEventBinding[],
  onUpdateEvents: (events: readonly NodeEventBinding[]) => void,
  onEnterSubCanvas: (canvasId: CanvasId) => void,
  closePopover: () => void,
): void {
  const existing = events.find(
    (item) => resolveBindingTarget(item) === 'node' && item.action.type === 'open-canvas',
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
      (item) => !(resolveBindingTarget(item) === 'node' && item.trigger === 'double-click'),
    ),
    nextBinding,
  ])
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
          title="双击已被事件占用，点击此处（或按住 Alt 双击节点）编辑文字内容"
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          <Pencil className="size-3.5 text-slate-500" aria-hidden="true" />
          <span>编辑文字</span>
        </button>
      )}
    </>
  )
}

/** 节点事件绑定工具栏入口：展示当前绑定事件数、提供快捷文字编辑按钮与事件编辑浮窗 */
export function NodeEventControl(props: Readonly<NodeEventControlProps>) {
  const { node, activeCanvasId, onUpdateEvents, onEnterSubCanvas, onEditNodeText } = props
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const events = resolveNodeEvents(node)
  const isTextEditable = node.content.kind === 'text' || node.content.kind === 'title'
  const dblClickEvent = findTriggeredEvent(node, 'double-click', activeCanvasId, 'node')
  const dblClickOccupied = dblClickEvent?.action.type !== 'edit-node'

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!open || !(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown) }
  }, [open])

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <EventToggleButtons
        eventCount={events.length}
        showEditButton={isTextEditable && dblClickOccupied}
        onToggleOpen={() => { setOpen((prev) => !prev) }}
        onEditNodeText={onEditNodeText}
      />
      {open && (
        <NodeEventPopover
          kind={node.content.kind}
          events={events}
          defaultEvents={defaultEventsForNode(node)}
          onUpdateEvents={onUpdateEvents}
          onEnterCanvas={(id) => { onEnterSubCanvas(id); setOpen(false) }}
          onBindBranchCanvas={() => {
            bindOrEnterBranchCanvas(events, onUpdateEvents, onEnterSubCanvas, () => { setOpen(false) })
          }}
        />
      )}
    </div>
  )
}
