/**
 * 导出相关类型
 *
 * 定义导出配置、导出包结构，以及 data.js 的全局变量格式。
 */

import type { PaperDocument } from './paper'
import type { PresentationConfig } from './presentation'

// ============================================================================
// 导出配置
// ============================================================================

/** 导出格式：static-html 静态包、json 数据备份 */
export type ExportFormat =
  | 'static-html'
  | 'json'

/** 导出配置 */
export interface ExportConfig {
  readonly format: ExportFormat
  /** 是否内联 CSS/JS 到 index.html（减少文件数） */
  readonly inlineAssets: boolean
  /** 是否包含演示者备注 */
  readonly includeSpeakerNotes: boolean
  /** 演示配置 */
  readonly presentation: PresentationConfig
}

/** 默认导出配置 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: 'static-html',
  inlineAssets: false,
  includeSpeakerNotes: false,
  presentation: {
    autoPlay: false,
    intervalMs: 5000,
    showNavigation: true,
    showProgress: true,
    theme: 'light',
  },
}

// ============================================================================
// 导出包结构
// ============================================================================

/** 导出包文件清单 */
export interface ExportPackageManifest {
  /** 入口文件（固定为 index.html） */
  readonly entry: 'index.html'
  /** 数据文件（固定为 data.js） */
  readonly data: 'data.js'
  /** 资源目录 */
  readonly assets: readonly string[]
  /** 导出版本 */
  readonly version: string
  /** 导出时间（ISO 8601） */
  readonly exportedAt: string
}

/** 导出结果 */
export interface ExportResult {
  readonly success: boolean
  readonly manifest?: ExportPackageManifest
  readonly error?: string
}

// ============================================================================
// data.js 全局变量格式
// ============================================================================

/**
 * data.js 挂载到 window 的数据结构
 *
 * 生成的 data.js 内容示例：
 * ```js
 * window.PAPERLOOM_DATA = { ... }
 * ```
 */
export interface PaperLoomGlobalData {
  /** 数据格式版本（用于兼容性检查） */
  readonly version: string
  /** 演示文档 */
  readonly document: PaperDocument
  /** 演示配置 */
  readonly presentation: PresentationConfig
}

/** 全局变量名 */
export const PAPERLOOM_GLOBAL_KEY = 'PAPERLOOM_DATA'

/** 数据格式版本 */
export const PAPERLOOM_DATA_VERSION = '1.0.0'

// ============================================================================
// 导出器接口
// ============================================================================

/** 导出器参数 */
export interface ExportParams {
  readonly document: PaperDocument
  readonly config: ExportConfig
}

/** 导出器函数类型 */
export type Exporter = (params: ExportParams) => Promise<ExportResult>

// ============================================================================
// 全局声明（用于演示器读取）
// ============================================================================

declare global {
  interface Window {
    [PAPERLOOM_GLOBAL_KEY]?: PaperLoomGlobalData
  }
}
