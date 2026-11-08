import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from 'react'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 3
const WHEEL_ZOOM_SPEED = 0.001
const DRAG_THRESHOLD = 4
const GRID_SIZE = 24

interface CanvasView {
  readonly zoom: number
  readonly x: number
  readonly y: number
}

interface DragState {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  readonly panX: number
  readonly panY: number
}

interface CanvasPanState {
  readonly panning: boolean
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly shouldIgnoreClick: () => boolean
}

export interface ViewportFocusTarget {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly stageWidth: number
  readonly stageHeight: number
}

export interface CanvasViewportState extends CanvasPanState {
  readonly viewportRef: RefObject<HTMLDivElement | null>
  readonly zoom: number
  readonly resetView: () => void
  readonly worldStyle: CSSProperties
  readonly gridStyle: CSSProperties
}

const INITIAL_VIEW: CanvasView = { zoom: 1, x: 0, y: 0 }
const BOTTOM_EDITOR_FOCUS_OFFSET_Y = -135

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[data-node-id], dialog, button, a, input, [contenteditable="true"]') !== null
}

/** 以指针位置为锚点缩放，保持指针下的画布内容不动 */
function zoomedViewAt(
  view: CanvasView,
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
  factor: number,
): CanvasView {
  const zoom = clampZoom(view.zoom * factor)
  const ratio = zoom / view.zoom
  return {
    zoom,
    x: (pointerX - centerX) * (1 - ratio) + view.x * ratio,
    y: (pointerY - centerY) * (1 - ratio) + view.y * ratio,
  }
}

/** 将正在编辑的节点平移到下侧编辑器正上方居中位置，确保实时渲染清晰可见 */
function focusedViewForTarget(current: CanvasView, target: ViewportFocusTarget): CanvasView {
  const zoom = Math.max(current.zoom, 1)
  const dx = target.x - target.stageWidth / 2
  const dy = target.y - target.stageHeight / 2
  return {
    zoom,
    x: -dx * zoom,
    y: BOTTOM_EDITOR_FOCUS_OFFSET_Y - dy * zoom,
  }
}

function useWheelZoom(
  viewportRef: RefObject<HTMLDivElement | null>,
  setView: Dispatch<SetStateAction<CanvasView>>,
): void {
  useEffect(() => {
    const element = viewportRef.current
    if (element === null) return undefined
    const handleWheel = (event: WheelEvent): void => {
      if (event.target instanceof Element && event.target.closest('dialog') !== null) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED)
      setView((current) =>
        zoomedViewAt(
          current,
          event.clientX - rect.left,
          event.clientY - rect.top,
          rect.width / 2,
          rect.height / 2,
          factor,
        ),
      )
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [setView, viewportRef])
}

function useCanvasPan(
  view: CanvasView,
  setView: Dispatch<SetStateAction<CanvasView>>,
): CanvasPanState {
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)
  const [panning, setPanning] = useState(false)
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return
      movedRef.current = false
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: view.x,
        panY: view.y,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      setPanning(true)
    },
    [view.x, view.y],
  )
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true
      setView((current) => ({ ...current, x: drag.panX + dx, y: drag.panY + dy }))
    },
    [setView],
  )
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setPanning(false)
  }, [])

  const shouldIgnoreClick = useCallback(() => movedRef.current, [])

  return { panning, onPointerDown, onPointerMove, onPointerUp, shouldIgnoreClick }
}

/** 画布视口：拖动空白处平移、滚轮以指针为中心缩放，网格随视口同步移动 */
export function useCanvasViewport(focusTarget?: ViewportFocusTarget | null): CanvasViewportState {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState<CanvasView>(INITIAL_VIEW)
  const [lastFocusKey, setLastFocusKey] = useState<string | null>(null)
  const targetKey = focusTarget?.key ?? null
  if (targetKey !== lastFocusKey) {
    setLastFocusKey(targetKey)
    if (focusTarget !== null && focusTarget !== undefined) {
      setView((current) => focusedViewForTarget(current, focusTarget))
    }
  }
  useWheelZoom(viewportRef, setView)
  const pan = useCanvasPan(view, setView)
  const resetView = useCallback(() => {
    setView(INITIAL_VIEW)
  }, [])

  return {
    viewportRef,
    zoom: view.zoom,
    resetView,
    worldStyle: {
      transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
      transformOrigin: 'center center',
    },
    gridStyle: {
      backgroundColor: '#fbfcfe',
      backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
      backgroundSize: `${GRID_SIZE * view.zoom}px ${GRID_SIZE * view.zoom}px`,
      backgroundPosition: `calc(50% + ${view.x}px) calc(50% + ${view.y}px)`,
    },
    ...pan,
  }
}
