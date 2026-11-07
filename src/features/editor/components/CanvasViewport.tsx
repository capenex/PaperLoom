import type { ReactNode } from 'react'
import { cn } from 'cn'

import { useCanvasViewport } from '../hooks/useCanvasViewport'

interface CanvasViewportProps {
  readonly onBackgroundClick: () => void
  readonly onBackgroundContextMenu: () => void
  /** 额外的空白点击抑制条件：节点拖动结束后的余波点击不应取消选中 */
  readonly shouldIgnoreBackgroundClick: () => boolean
  readonly children: ReactNode
}

/** 可平移缩放的画布视口，节点与连线作为被变换的世界层内容 */
export function CanvasViewport({
  onBackgroundClick,
  onBackgroundContextMenu,
  shouldIgnoreBackgroundClick,
  children,
}: Readonly<CanvasViewportProps>) {
  const {
    viewportRef,
    worldStyle,
    gridStyle,
    panning,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    shouldIgnoreClick,
  } = useCanvasViewport()

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 画布空白处点击仅用于取消选中，键盘等价操作是 Escape
    <div
      ref={viewportRef}
      role="application"
      aria-label="演示画布"
      className={cn(
        'absolute inset-0 touch-none overflow-hidden',
        panning ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={gridStyle}
      onClick={() => {
        if (shouldIgnoreClick() || shouldIgnoreBackgroundClick()) return
        onBackgroundClick()
      }}
      onContextMenu={onBackgroundContextMenu}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        onBackgroundClick()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div style={worldStyle}>{children}</div>
      </div>
    </div>
  )
}
