/** 把 pdf.js 的 ESM 产物改写成 classic script：导出包要在 file:// 下离线运行，模块脚本与 Worker 都会被 CORS 拦掉 */

interface ModuleExportEntry {
  readonly local: string
  readonly name: string
}

const TRAILING_EXPORT = /export\{([^}]*)\};?\s*$/u
const CHUNK = 0x8000

/** classic script 里没有 import.meta，用加载时记录的脚本地址顶替（wasm 等相对路径要靠它） */
const PROLOGUE =
  'globalThis.__plModuleUrl=(document.currentScript&&document.currentScript.src)||location.href;'

function parseEntries(list: string): readonly ModuleExportEntry[] {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const [local, alias] = part.split(' as ')
      return { local: local ?? part, name: alias ?? local ?? part }
    })
}

function splitTrailingExport(source: string): { body: string; entries: string } {
  const matched = TRAILING_EXPORT.exec(source)
  if (matched === null) throw new Error('pdf.js 产物缺少尾部导出语句，无法改写为 classic script')
  return { body: source.slice(0, matched.index), entries: matched[1] ?? '' }
}

function wrap(body: string, footer: string): string {
  const patched = body.replaceAll('import.meta.url', 'globalThis.__plModuleUrl')
  return `(function(){'use strict';${PROLOGUE}${patched}${footer}})();\n`
}

/** 主库：导出名挂到 window.pdfjsLib 供演示器调用 */
export function toClassicLibraryScript(source: string): string {
  const { body, entries } = splitTrailingExport(source)
  const mapping = parseEntries(entries)
    .map((entry) => `${entry.name}:${entry.local}`)
    .join(',')
  return wrap(body, `window.pdfjsLib={${mapping}};`)
}

/** worker：产物自身会挂 globalThis.pdfjsWorker，pdf.js 见到它就走主线程，不再新建 Worker */
export function toClassicWorkerScript(source: string): string {
  return wrap(splitTrailingExport(source).body, '')
}

/** PDF 字节内联成 base64 脚本：file:// 页面 fetch 本地文件会被浏览器拦截 */
export async function toBase64Script(key: string, blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  const registry = '(window.__PL_PDF_BYTES__=window.__PL_PDF_BYTES__||{})'
  return `${registry}[${JSON.stringify(key)}]=${JSON.stringify(btoa(binary))}\n`
}
