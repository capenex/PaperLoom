import { PAPERLOOM_DATA_VERSION, PAPERLOOM_GLOBAL_KEY } from '@/shared/types/export'
import type { PaperLoomGlobalData } from '@/shared/types/export'
import { REFERENCE_KIND_ATTR, REFERENCE_PREVIEW_ATTR } from '@/shared/lib/reference'
import { DEFAULT_PRESENTATION_CONFIG } from '@/shared/types/presentation'
import type { PaperDocument } from '@/shared/types/paper'
import { PRESENTER_SCRIPT } from './presenterScript'
import { PRESENTER_STYLES } from './presenterStyles'
import { toBase64Script, toClassicLibraryScript, toClassicWorkerScript } from './pdfjsClassic'

export interface ExportFile {
  readonly path: string
  readonly content: string | Blob
}

interface MediaAssetFile {
  readonly source: string
  readonly path: string
  readonly blob: Blob
}

const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

/** 引用资源扩展名：图片之外还有 PDF 与本地 HTML 页面 */
const REFERENCE_EXTENSIONS: Readonly<Record<string, string>> = {
  ...IMAGE_EXTENSIONS,
  'application/pdf': 'pdf',
  'text/html': 'html',
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

export function createIndexHtml(
  document: PaperDocument,
  preScripts: readonly string[] = [],
): string {
  const title = escapeHtml(document.meta.title)
  const preTags = preScripts.map((src) => `    <script src="./${src}"></script>`).join('\n')
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
${preTags}
    <script src="./data.js"></script>
    <script src="./assets/presenter.js"></script>
  </body>
</html>
`
}

function shouldWriteMediaFile(source: string): boolean {
  const trimmed = source.trim()
  return trimmed !== '' && !trimmed.startsWith('data:')
}

function collectMediaSources(document: PaperDocument): readonly string[] {
  const sources: string[] = []
  for (const node of document.nodes) {
    if (node.content.kind !== 'image') continue
    const source = node.content.src
    if (!shouldWriteMediaFile(source) || sources.includes(source)) continue
    sources.push(source)
  }
  return sources
}

function referenceAnchorsOf(richText: string): NodeListOf<HTMLAnchorElement> {
  const parsed = new DOMParser().parseFromString(richText, 'text/html')
  return parsed.querySelectorAll(`a[${REFERENCE_KIND_ATTR}]`)
}

/** 收集富文本引用锚点的主资源与 PDF 预览图地址 */
function collectReferenceSources(document: PaperDocument): readonly string[] {
  const sources: string[] = []
  for (const node of document.nodes) {
    if (node.content.kind !== 'text') continue
    referenceAnchorsOf(node.content.richText).forEach((anchor) => {
      for (const source of [
        anchor.getAttribute('href'),
        anchor.getAttribute(REFERENCE_PREVIEW_ATTR),
      ]) {
        if (source === null || !shouldWriteMediaFile(source) || sources.includes(source)) continue
        sources.push(source)
      }
    })
  }
  return sources
}

async function loadMediaAsset(source: string, index: number): Promise<MediaAssetFile> {
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error(`无法读取图片资源：${source}`)
  }

  const blob = await response.blob()
  const extension = IMAGE_EXTENSIONS[blob.type] ?? 'bin'
  return {
    source,
    path: `assets/media/image-${index + 1}.${extension}`,
    blob,
  }
}

async function loadReferenceAsset(source: string, index: number): Promise<MediaAssetFile> {
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error(`无法读取引用资源：${source}`)
  }

  const blob = await response.blob()
  const extension = REFERENCE_EXTENSIONS[blob.type] ?? 'bin'
  return {
    source,
    path: `assets/refs/ref-${index + 1}.${extension}`,
    blob,
  }
}

function createMediaAssets(document: PaperDocument): Promise<readonly MediaAssetFile[]> {
  const sources = collectMediaSources(document)
  return Promise.all(sources.map((source, index) => loadMediaAsset(source, index)))
}

function createReferenceAssets(document: PaperDocument): Promise<readonly MediaAssetFile[]> {
  const sources = collectReferenceSources(document)
  return Promise.all(sources.map((source, index) => loadReferenceAsset(source, index)))
}

/** 导出包内使用相对路径；data: URL 保持原样，不写入额外文件 */
function rewriteMediaSources(
  document: PaperDocument,
  assets: readonly MediaAssetFile[],
): PaperDocument {
  if (assets.length === 0) return document

  const pathBySource = new Map<string, string>()
  for (const asset of assets) {
    pathBySource.set(asset.source, asset.path)
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (node.content.kind !== 'image') return node
      const path = pathBySource.get(node.content.src)
      if (path === undefined) return node
      return { ...node, content: { ...node.content, src: `./${path}` } }
    }),
  }
}

function rewriteRichTextReferences(richText: string, pathBySource: Map<string, string>): string | null {
  const parsed = new DOMParser().parseFromString(richText, 'text/html')
  const anchors = parsed.querySelectorAll(`a[${REFERENCE_KIND_ATTR}]`)
  if (anchors.length === 0) return null

  let changed = false
  anchors.forEach((anchor) => {
    for (const attribute of ['href', REFERENCE_PREVIEW_ATTR]) {
      const source = anchor.getAttribute(attribute)
      const path = source === null ? undefined : pathBySource.get(source)
      if (path === undefined) continue
      anchor.setAttribute(attribute, `./${path}`)
      changed = true
    }
  })
  return changed ? parsed.body.innerHTML : null
}

/** 把引用锚点里的编辑器地址改写成导出包相对路径 */
function rewriteReferenceSources(
  document: PaperDocument,
  assets: readonly MediaAssetFile[],
): PaperDocument {
  if (assets.length === 0) return document

  const pathBySource = new Map<string, string>()
  for (const asset of assets) {
    pathBySource.set(asset.source, asset.path)
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (node.content.kind !== 'text') return node
      const rewritten = rewriteRichTextReferences(node.content.richText, pathBySource)
      if (rewritten === null) return node
      return { ...node, content: { ...node.content, richText: rewritten } }
    }),
  }
}

/** 按需加载 pdf.js 源码文本：只在真正导出时才把这一大块字符串拉进内存 */
async function loadPdfjsSources(): Promise<{ library: string; worker: string }> {
  const [library, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs?raw'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw'),
  ])
  return { library: library.default, worker: worker.default }
}

/** 生成完整导出包的所有文件（含图片与引用资源，不含写盘） */
export async function createExportFiles(document: PaperDocument): Promise<readonly ExportFile[]> {
  const mediaAssets = await createMediaAssets(document)
  const withMedia = rewriteMediaSources(document, mediaAssets)
  const referenceAssets = await createReferenceAssets(withMedia)
  const exportedDocument = rewriteReferenceSources(withMedia, referenceAssets)

  const pdfAssets = referenceAssets.filter((asset) => asset.path.endsWith('.pdf'))
  const plainAssets = referenceAssets.filter((asset) => !asset.path.endsWith('.pdf'))
  const pdfBytesFiles = await Promise.all(
    pdfAssets.map(
      async (asset): Promise<ExportFile> => ({
        path: `${asset.path}.js`,
        content: await toBase64Script(`./${asset.path}`, asset.blob),
      }),
    ),
  )

  let pdfjsFiles: readonly ExportFile[] = []
  let preScripts: readonly string[] = []
  if (pdfAssets.length > 0) {
    const sources = await loadPdfjsSources()
    pdfjsFiles = [
      { path: 'assets/pdfjs/pdf.worker.js', content: toClassicWorkerScript(sources.worker) },
      { path: 'assets/pdfjs/pdf.js', content: toClassicLibraryScript(sources.library) },
    ]
    preScripts = [...pdfjsFiles.map((file) => file.path), ...pdfBytesFiles.map((file) => file.path)]
  }

  return [
    { path: 'index.html', content: createIndexHtml(exportedDocument, preScripts) },
    { path: 'data.js', content: createDataJs(exportedDocument) },
    { path: 'assets/presenter.js', content: PRESENTER_SCRIPT },
    { path: 'assets/presenter.css', content: PRESENTER_STYLES },
    ...pdfjsFiles,
    ...pdfBytesFiles,
    ...mediaAssets.map((asset): ExportFile => ({ path: asset.path, content: asset.blob })),
    ...plainAssets.map((asset): ExportFile => ({ path: asset.path, content: asset.blob })),
  ]
}
