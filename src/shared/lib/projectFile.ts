/**
 * 工程文件的序列化与校验
 *
 * 工程文件只存文档与 res/ 下的资源链接，不内嵌任何二进制；
 * 载入时先校验结构与树关系，避免把半残数据推进画布。
 */

import type {
  DocumentDefaults,
  DocumentMeta,
  NodeContent,
  NodeLayout,
  NodeId,
  PaperDocument,
  PaperNode,
} from '../types/paper'
import { PROJECT_FORMAT_VERSION } from '../types/project'
import type { PaperLoomProject } from '../types/project'

export type ProjectFileResult =
  | { readonly ok: true; readonly project: PaperLoomProject }
  | { readonly ok: false; readonly reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || isText(value)
}

function isOptionalSize(value: unknown): value is number | undefined {
  return value === undefined || (isFiniteNumber(value) && value > 0)
}

function isNodeLayout(value: unknown): value is NodeLayout {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    typeof value.collapsed === 'boolean' &&
    isOptionalSize(value.width) &&
    isOptionalSize(value.height)
  )
}

function isNodeContent(value: unknown): value is NodeContent {
  if (!isRecord(value)) return false
  if (value.kind === 'text') return isText(value.richText)
  if (value.kind === 'title') return isText(value.title) && isText(value.subtitle)
  if (value.kind === 'image') return isText(value.src) && isText(value.alt)
  if (value.kind === 'file') {
    return (
      isText(value.fileName) &&
      isText(value.text) &&
      (value.format === 'markdown' || value.format === 'code')
    )
  }
  return false
}

function isPaperNode(value: unknown): value is PaperNode {
  if (!isRecord(value)) return false
  return (
    isText(value.id) &&
    (value.parentId === null || isText(value.parentId)) &&
    isNodeContent(value.content) &&
    isNodeLayout(value.layout)
  )
}

function isDocumentMeta(value: unknown): value is DocumentMeta {
  if (!isRecord(value)) return false
  return (
    isText(value.id) &&
    isText(value.title) &&
    isText(value.author) &&
    isOptionalText(value.description) &&
    isText(value.createdAt) &&
    isText(value.updatedAt)
  )
}

function isDocumentDefaults(value: unknown): value is DocumentDefaults {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value.nodeWidth) &&
    isFiniteNumber(value.nodeHeight) &&
    isFiniteNumber(value.fontSize)
  )
}

function toDocument(raw: unknown): PaperDocument | null {
  if (!isRecord(raw)) return null
  const meta = raw.meta
  const defaults = raw.defaults
  const nodes = raw.nodes
  const rootIds = raw.rootIds
  if (!isDocumentMeta(meta)) return null
  if (!isDocumentDefaults(defaults)) return null
  if (!Array.isArray(nodes) || !nodes.every(isPaperNode)) return null
  if (!Array.isArray(rootIds) || !rootIds.every(isText)) return null
  return { meta, defaults, nodes, rootIds }
}

function hasParentCycle(nodes: readonly PaperNode[], startId: NodeId): boolean {
  const byId = new Map<NodeId, PaperNode>()
  for (const node of nodes) byId.set(node.id, node)

  const seen = new Set<NodeId>([startId])
  let currentId = startId
  for (let steps = 0; steps < nodes.length; steps += 1) {
    const parentId = byId.get(currentId)?.parentId ?? null
    if (parentId === null) return false
    if (seen.has(parentId)) return true
    seen.add(parentId)
    currentId = parentId
  }
  return true
}

/** 校验节点引用关系：ID 唯一、父节点存在、根节点非空且自洽、无循环引用 */
function describeDocumentProblem(document: PaperDocument): string | null {
  const ids = new Set<NodeId>()
  for (const node of document.nodes) {
    if (ids.has(node.id)) return `节点 ID 重复：${node.id}`
    ids.add(node.id)
  }

  if (document.rootIds.length === 0) return '至少要有一个根节点'
  const rootIds = new Set<NodeId>(document.rootIds)
  for (const rootId of document.rootIds) {
    if (!ids.has(rootId)) return `根节点不存在：${rootId}`
  }

  for (const node of document.nodes) {
    if (rootIds.has(node.id) && node.parentId !== null) {
      return `节点 ${node.id} 既是根节点又有父节点`
    }
    if (node.parentId === null) continue
    if (!ids.has(node.parentId)) return `父节点不存在：${node.parentId}`
  }

  for (const node of document.nodes) {
    if (hasParentCycle(document.nodes, node.id)) return `节点存在循环引用：${node.id}`
  }
  return null
}

export function createProjectFile(document: PaperDocument): PaperLoomProject {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    document,
  }
}

export function serializeProjectFile(project: PaperLoomProject): string {
  return JSON.stringify(project, null, 2)
}

export function parseProjectFile(text: string): ProjectFileResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: '工程文件不是合法的 JSON' }
  }

  if (!isRecord(raw)) return { ok: false, reason: '工程文件不是对象' }
  if (raw.formatVersion !== PROJECT_FORMAT_VERSION) {
    return { ok: false, reason: `不支持的工程文件版本：${String(raw.formatVersion)}` }
  }

  const document = toDocument(raw.document)
  if (document === null) {
    return { ok: false, reason: '文档结构不完整（需要 meta/defaults/nodes/rootIds）' }
  }

  const problem = describeDocumentProblem(document)
  if (problem !== null) return { ok: false, reason: problem }

  return {
    ok: true,
    project: {
      formatVersion: PROJECT_FORMAT_VERSION,
      savedAt: isText(raw.savedAt) ? raw.savedAt : new Date().toISOString(),
      document,
    },
  }
}
