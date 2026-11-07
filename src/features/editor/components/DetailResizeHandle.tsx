/* eslint-disable jsx-a11y/prefer-tag-over-role -- 分界线要能聚焦并响应拖动与方向键，hr 承载不了交互角色 */
import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const MIN_WIDTH_PERCENT = 30
const MAX_WIDTH_PERCENT = 70
const KEYBOARD_STEP_PERCENT = 2

function clampDetailWidth(percent: number): number {
  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, percent))
}

function widthPercentAt(clientX: number): number {
  return ((window.innerWidth - clientX) / window.innerWidth) * 100
}

interface DetailResizeHandleProps {
  readonly widthPercent: number
  readonly onWidthPercentChange: (percent: number) => void
}

/** 面板分界线：指针拖动或左右方向键调整宽度，横向范围 30%-70% */
export function DetailResizeHandle({
  widthPercent,
  onWidthPercentChange,
}: Readonly<DetailResizeHandleProps>) {
  const resizingRef = useRef(false)

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    event.preventDefault()
    resizingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!resizingRef.current) return
    onWidthPercentChange(clampDetailWidth(widthPercentAt(event.clientX)))
  }

  function handlePointerUp(): void {
    resizingRef.current = false
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowLeft') {
      onWidthPercentChange(clampDetailWidth(widthPercent + KEYBOARD_STEP_PERCENT))
    } else if (event.key === 'ArrowRight') {
      onWidthPercentChange(clampDetailWidth(widthPercent - KEYBOARD_STEP_PERCENT))
    } else {
      return
    }
    event.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整面板宽度"
      tabIndex={0}
      className="absolute left-0 top-0 z-10 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none hover:bg-primary/40 focus-visible:bg-primary/60"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  )
}
