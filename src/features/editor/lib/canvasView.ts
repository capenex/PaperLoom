/** 进入子画布时入口节点的目标屏幕位置：横向靠左、纵向居中 */
const ENTRY_HOST_X_RATIO = 0.22
const ENTRY_HOST_MIN_X = 140

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export interface EntryTarget {
  readonly x: number
  readonly y: number
  readonly stageWidth: number
  readonly stageHeight: number
}

export interface CanvasView {
  readonly zoom: number
  readonly x: number
  readonly y: number
}

/**
 * 入口节点 framing：世界点屏幕坐标 = 视口中心 + (p - 舞台中心) * zoom + view.xy，
 * 反解出把入口节点放到 (靠左, 纵向居中) 所需的平移量。
 */
export function entryViewForHost(
  host: EntryTarget,
  viewport: ViewportSize,
  zoom = 1,
): CanvasView {
  const screenX = Math.max(ENTRY_HOST_MIN_X, viewport.width * ENTRY_HOST_X_RATIO)
  return {
    zoom,
    x: screenX - viewport.width / 2 - (host.x - host.stageWidth / 2) * zoom,
    y: -(host.y - host.stageHeight / 2) * zoom,
  }
}

/** 世界点在视口内的屏幕坐标（与 CanvasViewport 的 transform 约定一致） */
export function screenPositionOf(
  point: { readonly x: number; readonly y: number },
  stage: ViewportSize,
  viewport: ViewportSize,
  view: CanvasView,
): { readonly x: number; readonly y: number } {
  return {
    x: viewport.width / 2 + (point.x - stage.width / 2) * view.zoom + view.x,
    y: viewport.height / 2 + (point.y - stage.height / 2) * view.zoom + view.y,
  }
}