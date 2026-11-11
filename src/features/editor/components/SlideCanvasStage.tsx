import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { cn } from 'cn'

import type {
  SlideArrowElement,
  SlideDocumentSpec,
  SlideElement,
  SlideImageElement,
  SlideShapeElement,
  SlideTextElement,
} from '@/shared/types/slide'

interface SlideCanvasStageProps {
  readonly spec: SlideDocumentSpec
  readonly selectedId: string | null
  readonly onSelectId: (id: string | null) => void
  readonly onUpdateElement: (id: string, updater: (el: SlideElement) => SlideElement) => void
}

type DragInteraction =
  | {
      readonly mode: 'move-box'
      readonly id: string
      readonly startClientX: number
      readonly startClientY: number
      readonly origX: number
      readonly origY: number
    }
  | {
      readonly mode: 'resize-box'
      readonly id: string
      readonly startClientX: number
      readonly startClientY: number
      readonly origW: number
      readonly origH: number
    }
  | {
      readonly mode: 'arrow-p1' | 'arrow-p2'
      readonly id: string
      readonly startClientX: number
      readonly startClientY: number
      readonly origX: number
      readonly origY: number
    }

function ResizeHandle({ onStartResize }: Readonly<{ onStartResize: (e: ReactPointerEvent<HTMLElement>) => void }>) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        onStartResize(e)
      }}
      className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow-sm"
    />
  )
}

function TextLayerView({
  element,
  selected,
  editing,
  onSelect,
  onStartEdit,
  onStopEdit,
  onStartMove,
  onStartResize,
  onChangeText,
}: Readonly<{
  element: SlideTextElement
  selected: boolean
  editing: boolean
  onSelect: () => void
  onStartEdit: () => void
  onStopEdit: () => void
  onStartMove: (e: ReactPointerEvent<HTMLElement>) => void
  onStartResize: (e: ReactPointerEvent<HTMLElement>) => void
  onChangeText: (text: string) => void
}>) {
  const hasBg = element.backgroundColor !== '' && element.backgroundColor !== 'transparent'
  const hasBorder = element.borderColor !== '' && element.borderColor !== 'transparent'

  return (
    <div
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: hasBg ? element.backgroundColor : 'transparent',
        borderColor: hasBorder ? element.borderColor : 'transparent',
        borderWidth: hasBorder ? 2 : 0,
        borderStyle: 'solid',
        borderRadius: element.borderRadius,
        color: element.color,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        textAlign: element.align,
        padding: hasBg || hasBorder ? 14 : 4,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
        if (!editing) onStartMove(e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onStartEdit()
      }}
      className={cn('absolute cursor-move select-none', selected && 'ring-2 ring-primary ring-offset-1')}
    >
      {editing ? (
        <textarea
          aria-label="编辑幻灯片文本框"
          value={element.text}
          onBlur={onStopEdit}
          onChange={(e) => {
            onChangeText(e.target.value)
          }}
          style={{
            color: element.color,
            fontSize: element.fontSize,
            fontWeight: element.fontWeight,
            textAlign: element.align,
          }}
          className="h-full w-full resize-none bg-transparent leading-[1.4] outline-none"
        />
      ) : (
        <div className="h-full w-full overflow-hidden leading-[1.4] whitespace-pre-wrap">{element.text}</div>
      )}
      {selected && <ResizeHandle onStartResize={onStartResize} />}
    </div>
  )
}

function ImageLayerView({
  element,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
}: Readonly<{
  element: SlideImageElement
  selected: boolean
  onSelect: () => void
  onStartMove: (e: ReactPointerEvent<HTMLElement>) => void
  onStartResize: (e: ReactPointerEvent<HTMLElement>) => void
}>) {
  return (
    <div
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        borderRadius: element.borderRadius,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
        onStartMove(e)
      }}
      className={cn(
        'absolute cursor-move overflow-hidden select-none',
        selected && 'ring-2 ring-primary ring-offset-1',
      )}
    >
      <img
        src={element.dataUrl}
        alt={element.alt}
        draggable={false}
        className={cn(
          'pointer-events-none h-full w-full',
          element.objectFit === 'cover' ? 'object-cover' : 'object-contain',
        )}
      />
      {selected && <ResizeHandle onStartResize={onStartResize} />}
    </div>
  )
}

function ShapeLayerView({
  element,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
}: Readonly<{
  element: SlideShapeElement
  selected: boolean
  onSelect: () => void
  onStartMove: (e: ReactPointerEvent<HTMLElement>) => void
  onStartResize: (e: ReactPointerEvent<HTMLElement>) => void
}>) {
  const rx =
    element.shape === 'pill'
      ? Math.round(Math.min(element.width, element.height) / 2)
      : element.shape === 'rounded' || element.shape === 'callout'
        ? 14
        : 0

  return (
    <div
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        borderRadius: rx,
        backgroundColor: element.fill,
        borderColor: element.stroke,
        borderWidth: element.strokeWidth,
        borderStyle: element.dashed ? 'dashed' : 'solid',
        color: element.textColor,
        fontSize: element.fontSize,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
        onStartMove(e)
      }}
      className={cn(
        'absolute flex cursor-move items-center justify-center p-2 text-center font-bold whitespace-pre-wrap select-none',
        selected && 'ring-2 ring-primary ring-offset-1',
      )}
    >
      <span>{element.text}</span>
      {selected && <ResizeHandle onStartResize={onStartResize} />}
    </div>
  )
}

function ArrowLayerView({
  element,
  selected,
  onSelect,
  onStartEndpointDrag,
}: Readonly<{
  element: SlideArrowElement
  selected: boolean
  onSelect: () => void
  onStartEndpointDrag: (mode: 'arrow-p1' | 'arrow-p2', e: ReactPointerEvent<HTMLElement>) => void
}>) {
  const markerId = `stage-arrow-${element.id}`
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={element.color} />
          </marker>
        </defs>
        <line
          x1={element.x1}
          y1={element.y1}
          x2={element.x2}
          y2={element.y2}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          strokeDasharray={element.dashed ? '8 6' : undefined}
          markerEnd={`url(#${markerId})`}
          className="pointer-events-auto cursor-pointer"
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect()
          }}
        />
      </svg>
      {selected && (
        <>
          <div
            style={{ left: element.x1 - 6, top: element.y1 - 6 }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onStartEndpointDrag('arrow-p1', e)
            }}
            className="absolute size-3 cursor-grab rounded-full border-2 border-white bg-primary shadow"
          />
          <div
            style={{ left: element.x2 - 6, top: element.y2 - 6 }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onStartEndpointDrag('arrow-p2', e)
            }}
            className="absolute size-3 cursor-grab rounded-full border-2 border-white bg-rose-600 shadow"
          />
        </>
      )}
    </>
  )
}

interface StageElementItemProps {
  readonly el: SlideElement
  readonly selected: boolean
  readonly editing: boolean
  readonly interactionRef: RefObject<DragInteraction | null>
  readonly onSelectId: (id: string | null) => void
  readonly setEditingTextId: (id: string | null) => void
  readonly onUpdateElement: (id: string, updater: (curr: SlideElement) => SlideElement) => void
}

function SlideStageElementItem(props: Readonly<StageElementItemProps>) {
  const { el, selected, editing, interactionRef, onSelectId, setEditingTextId, onUpdateElement } = props
  const selectSelf = (): void => {
    onSelectId(el.id)
  }
  const makeMoveHandler =
    (origX: number, origY: number) =>
    (e: ReactPointerEvent<HTMLElement>): void => {
      interactionRef.current = { mode: 'move-box', id: el.id, startClientX: e.clientX, startClientY: e.clientY, origX, origY }
    }
  const makeResizeHandler =
    (origW: number, origH: number) =>
    (e: ReactPointerEvent<HTMLElement>): void => {
      interactionRef.current = { mode: 'resize-box', id: el.id, startClientX: e.clientX, startClientY: e.clientY, origW, origH }
    }

  if (el.kind === 'text') {
    return (
      <TextLayerView
        element={el}
        selected={selected}
        editing={editing}
        onSelect={selectSelf}
        onStartEdit={() => {
          onSelectId(el.id)
          setEditingTextId(el.id)
        }}
        onStopEdit={() => {
          setEditingTextId(null)
        }}
        onStartMove={makeMoveHandler(el.x, el.y)}
        onStartResize={makeResizeHandler(el.width, el.height)}
        onChangeText={(text) => {
          onUpdateElement(el.id, (curr) => (curr.kind === 'text' ? { ...curr, text } : curr))
        }}
      />
    )
  }
  if (el.kind === 'image') {
    return (
      <ImageLayerView element={el} selected={selected} onSelect={selectSelf} onStartMove={makeMoveHandler(el.x, el.y)} onStartResize={makeResizeHandler(el.width, el.height)} />
    )
  }
  if (el.kind === 'shape') {
    return (
      <ShapeLayerView element={el} selected={selected} onSelect={selectSelf} onStartMove={makeMoveHandler(el.x, el.y)} onStartResize={makeResizeHandler(el.width, el.height)} />
    )
  }
  return (
    <ArrowLayerView
      element={el}
      selected={selected}
      onSelect={selectSelf}
      onStartEndpointDrag={(mode, e) => {
        interactionRef.current = {
          mode,
          id: el.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origX: mode === 'arrow-p1' ? el.x1 : el.x2,
          origY: mode === 'arrow-p1' ? el.y1 : el.y2,
        }
      }}
    />
  )
}

function applyDragInteraction(
  active: DragInteraction,
  dx: number,
  dy: number,
  onUpdateElement: (id: string, updater: (el: SlideElement) => SlideElement) => void,
): void {
  if (active.mode === 'move-box') {
    onUpdateElement(active.id, (el) =>
      el.kind === 'arrow' ? el : { ...el, x: active.origX + dx, y: active.origY + dy },
    )
  } else if (active.mode === 'resize-box') {
    onUpdateElement(active.id, (el) =>
      el.kind === 'arrow'
        ? el
        : { ...el, width: Math.max(48, active.origW + dx), height: Math.max(32, active.origH + dy) },
    )
  } else if (active.mode === 'arrow-p1') {
    onUpdateElement(active.id, (el) =>
      el.kind === 'arrow' ? { ...el, x1: active.origX + dx, y1: active.origY + dy } : el,
    )
  } else {
    onUpdateElement(active.id, (el) =>
      el.kind === 'arrow' ? { ...el, x2: active.origX + dx, y2: active.origY + dy } : el,
    )
  }
}

export function SlideCanvasStage({
  spec,
  selectedId,
  onSelectId,
  onUpdateElement,
}: Readonly<SlideCanvasStageProps>) {
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const interactionRef = useRef<DragInteraction | null>(null)

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = interactionRef.current
    if (active === null) return
    const dx = Math.round(event.clientX - active.startClientX)
    const dy = Math.round(event.clientY - active.startClientY)
    applyDragInteraction(active, dx, dy, onUpdateElement)
  }

  const stopInteraction = (): void => {
    interactionRef.current = null
  }

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={stopInteraction}
      onPointerCancel={stopInteraction}
      onPointerDown={() => {
        onSelectId(null)
        setEditingTextId(null)
      }}
      className="flex flex-1 items-center justify-center overflow-auto bg-slate-200/70 p-6"
    >
      <div
        style={{ width: spec.width, height: spec.height, backgroundColor: spec.background }}
        className="relative shrink-0 overflow-hidden rounded-lg shadow-2xl ring-1 ring-slate-900/10"
      >
        {spec.elements.map((el) => (
          <SlideStageElementItem
            key={el.id}
            el={el}
            selected={el.id === selectedId}
            editing={editingTextId === el.id}
            interactionRef={interactionRef}
            onSelectId={onSelectId}
            setEditingTextId={setEditingTextId}
            onUpdateElement={onUpdateElement}
          />
        ))}
      </div>
    </div>
  )
}
