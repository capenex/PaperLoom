/**
 * 工程文件（可再次编辑的画布快照）数据契约
 *
 * 与导出包的 PAPERLOOM_DATA_VERSION 是两套版本：导出包是只读演示，
 * 工程文件是编辑器的存档，两者各自演进。
 */

import type { PaperDocument } from './paper'

/** 工程文件格式版本 */
export const PROJECT_FORMAT_VERSION = 1

/** 工程文件：只存文档与链接，资源字节全部在 res/ 下 */
export interface PaperLoomProject {
  readonly formatVersion: number
  /** 保存时间（ISO 8601） */
  readonly savedAt: string
  readonly document: PaperDocument
}
