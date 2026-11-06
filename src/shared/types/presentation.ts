/**
 * 演示相关类型
 *
 * 定义演示配置、演示状态和导航。
 */

import type { NodeId } from './paper'

// ============================================================================
// 演示配置
// ============================================================================

/** 演示主题 */
export type PresentationTheme = 'light' | 'dark' | 'auto'

/** 演示配置 */
export interface PresentationConfig {
  /** 自动播放 */
  readonly autoPlay: boolean
  /** 自动播放间隔（毫秒） */
  readonly intervalMs: number
  /** 显示导航控件 */
  readonly showNavigation: boolean
  /** 显示进度指示 */
  readonly showProgress: boolean
  /** 主题 */
  readonly theme: PresentationTheme
}

/** 默认演示配置 */
export const DEFAULT_PRESENTATION_CONFIG: PresentationConfig = {
  autoPlay: false,
  intervalMs: 5000,
  showNavigation: true,
  showProgress: true,
  theme: 'light',
}

// ============================================================================
// 演示状态
// ============================================================================

/** 演示模式：overview 总览、focus 聚焦、slide 幻灯片 */
export type PresentationMode =
  | 'overview'
  | 'focus'
  | 'slide'

/** 演示状态 */
export interface PresentationState {
  readonly mode: PresentationMode
  /** 当前聚焦的节点 ID */
  readonly currentNodeId: NodeId | null
  /** 是否正在播放 */
  readonly playing: boolean
  /** 是否全屏 */
  readonly fullscreen: boolean
}

/** 初始演示状态 */
export const INITIAL_PRESENTATION_STATE: PresentationState = {
  mode: 'overview',
  currentNodeId: null,
  playing: false,
  fullscreen: false,
}

// ============================================================================
// 演示导航
// ============================================================================

/** 导航方向：next 下一节点、previous 上一节点、parent 父节点、first-child 首个子节点、root 根节点 */
export type NavigationDirection =
  | 'next'
  | 'previous'
  | 'parent'
  | 'first-child'
  | 'root'

/** 导航事件 */
export interface NavigationEvent {
  readonly direction: NavigationDirection
  readonly fromNodeId: NodeId | null
  readonly toNodeId: NodeId | null
}

// ============================================================================
// 幻灯片（从文档生成的播放序列）
// ============================================================================

/** 单个幻灯片 */
export interface Slide {
  readonly nodeId: NodeId
  readonly title: string
  readonly body?: string
  readonly speakerNotes?: string
}

/** 幻灯片序列 */
export interface SlideDeck {
  readonly slides: readonly Slide[]
  readonly totalCount: number
}

// ============================================================================
// 演示器接口
// ============================================================================

/** 演示器控制接口 */
export interface PresenterControls {
  readonly play: () => void
  readonly pause: () => void
  readonly navigate: (direction: NavigationDirection) => void
  readonly setMode: (mode: PresentationMode) => void
  readonly toggleFullscreen: () => void
}
