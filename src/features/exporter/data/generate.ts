import { PAPERLOOM_DATA_VERSION, PAPERLOOM_GLOBAL_KEY } from '@/shared/types/export'
import type { PaperLoomGlobalData } from '@/shared/types/export'
import { DEFAULT_PRESENTATION_CONFIG } from '@/shared/types/presentation'
import type { PaperDocument } from '@/shared/types/paper'
import { PRESENTER_SCRIPT, PRESENTER_STYLES } from './presenterTemplate'

export interface ExportFile {
  readonly path: string
  readonly content: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function createGlobalData(document: PaperDocument): PaperLoomGlobalData {
  return {
    version: PAPERLOOM_DATA_VERSION,
    document,
    presentation: DEFAULT_PRESENTATION_CONFIG,
  }
}

/** 生成 data.js：通过 script 标签挂载全局变量，规避 file:// 下的 fetch CORS 限制 */
export function createDataJs(document: PaperDocument): string {
  const json = JSON.stringify(createGlobalData(document))
  if (json === undefined) {
    throw new Error('无法序列化文档数据')
  }
  const safeJson = json.replaceAll('<', '\\u003c')
  return `window.${PAPERLOOM_GLOBAL_KEY} = ${safeJson}\n`
}

export function createIndexHtml(document: PaperDocument): string {
  const title = escapeHtml(document.meta.title)
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="./assets/presenter.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="./data.js"></script>
    <script src="./assets/presenter.js"></script>
  </body>
</html>
`
}

/** 生成完整导出包的所有文件（不含写盘） */
export function createExportFiles(document: PaperDocument): readonly ExportFile[] {
  return [
    { path: 'index.html', content: createIndexHtml(document) },
    { path: 'data.js', content: createDataJs(document) },
    { path: 'assets/presenter.js', content: PRESENTER_SCRIPT },
    { path: 'assets/presenter.css', content: PRESENTER_STYLES },
  ]
}
