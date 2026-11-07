/**
 * 工程文件读写通道：只负责和本地开发服务交换 JSON，
 * 工程文件的结构与业务校验都在 shared/lib/projectFile。
 */

import { REFERENCE_KIND_ATTR, parseReferenceAnchor } from '@/shared/lib/reference'
import { parseProjectFile, serializeProjectFile } from '@/shared/lib/projectFile'
import type { PaperDocument } from '@/shared/types/paper'
import type { PaperLoomProject } from '@/shared/types/project'

const PROJECT_ENDPOINT = '/api/project'
// fetch 的 keepalive 请求体上限约 64KB，超出会被浏览器直接拒绝
const KEEPALIVE_BODY_LIMIT = 60 * 1024

export type ProjectLoadResult =
  | { readonly status: 'loaded'; readonly project: PaperLoomProject }
  | { readonly status: 'missing' }
  | { readonly status: 'failed'; readonly reason: string }

export async function loadProjectFile(): Promise<ProjectLoadResult> {
  let response: Response
  try {
    response = await fetch(PROJECT_ENDPOINT)
  } catch {
    return { status: 'failed', reason: '无法连接本地开发服务，请用 npm run dev 启动' }
  }

  if (response.status === 404) return { status: 'missing' }
  if (!response.ok) {
    return { status: 'failed', reason: `读取工程文件失败（HTTP ${response.status}）` }
  }

  const parsed = parseProjectFile(await response.text())
  if (!parsed.ok) return { status: 'failed', reason: parsed.reason }
  return { status: 'loaded', project: parsed.project }
}

export async function saveProjectFile(project: PaperLoomProject): Promise<boolean> {
  try {
    const response = await fetch(PROJECT_ENDPOINT, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: serializeProjectFile(project),
    })
    return response.ok
  } catch {
    return false
  }
}

/** 页面卸载时冲掉未保存的改动；请求体超过 keepalive 上限时退回普通请求 */
export function saveProjectFileOnExit(project: PaperLoomProject): void {
  const body = serializeProjectFile(project)
  void fetch(PROJECT_ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: new TextEncoder().encode(body).length <= KEEPALIVE_BODY_LIMIT,
  }).catch(() => undefined)
}

/** 只探测站内资源路径：data:/blob: 是会话内地址，站外 http 也不归本地资源管 */
function isLocalResourcePath(source: string): boolean {
  return source.startsWith('/') && !source.startsWith('//')
}

function collectResourcePaths(document: PaperDocument): readonly string[] {
  const paths = new Set<string>()
  for (const node of document.nodes) {
    if (node.content.kind === 'image') {
      if (isLocalResourcePath(node.content.src)) paths.add(node.content.src)
      continue
    }
    if (node.content.kind !== 'text') continue

    const parsed = new DOMParser().parseFromString(node.content.richText, 'text/html')
    parsed.querySelectorAll(`a[${REFERENCE_KIND_ATTR}]`).forEach((anchor) => {
      const reference = parseReferenceAnchor(anchor)
      if (reference === null) return
      if (isLocalResourcePath(reference.src)) paths.add(reference.src)
      if (reference.previewSrc !== undefined && isLocalResourcePath(reference.previewSrc)) {
        paths.add(reference.previewSrc)
      }
    })
  }
  return [...paths]
}

/** 探测文档里的本地资源是否仍可达，返回缺失的路径；链接断了要明说，不能只显示破图 */
export async function findMissingResources(document: PaperDocument): Promise<readonly string[]> {
  const checked = await Promise.all(
    collectResourcePaths(document).map(async (path) => {
      // no-store：收件箱文件带 immutable 缓存头，删掉后缓存里仍然存在，必须绕过缓存探测
      const ok = await fetch(path, { method: 'HEAD', cache: 'no-store' })
        .then((response) => response.ok)
        .catch(() => false)
      return ok ? null : path
    }),
  )
  return checked.filter((path): path is string => path !== null)
}
