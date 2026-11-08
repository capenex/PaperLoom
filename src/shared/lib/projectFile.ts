/**
 * 工程文件的序列化与校验
 *
 * 工程文件只存文档与 res/ 下的资源链接，不内嵌任何二进制；
 * 载入时先校验结构与树关系（含节点事件绑定与支线子画布），避免把半残数据推进画布。
 */

import type {
  CanvasId,
  DocumentDefaults,
  DocumentMeta,
  NodeContent,
  NodeEventAction,
  NodeEventBinding,
  NodeEventTrigger,
  NodeId,
  NodeLayout,
  PaperDocument,
  PaperNode,
  SubCanvas,
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

function isEventTarget(value: unknown): boolean {
  return (
    value === undefined ||
    value === 'node' ||
    value === 'reference' ||
    value === 'reference-popup'
  )
}

function isEventTrigger(value: unknown): value is NodeEventTrigger {
  return value === 'double-click' || value === 'second-click' || value === 'click'
}

function isEventAction(value: unknown): value is NodeEventAction {
  if (!isRecord(value)) return false
  if (
    value.type === 'edit-node' ||
    value.type === 'open-detail' ||
    value.type === 'open-reference-preview'
  ) {
    return true
  }
  if (value.type === 'open-canvas') return isText(value.canvasId) && value.canvasId.trim() !== ''
  return false
}

function isNodeEventBinding(value: unknown): value is NodeEventBinding {
  if (!isRecord(value)) return false
  return (
    isText(value.id) &&
    isEventTarget(value.target) &&
    isEventTrigger(value.trigger) &&
    isEventAction(value.action)
  )
}

function isOptionalEvents(value: unknown): value is readonly NodeEventBinding[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(isNodeEventBinding))
}

function isPaperNode(value: unknown): value is PaperNode {
  if (!isRecord(value)) return false
  return (
    isText(value.id) &&
    (value.parentId === null || isText(value.parentId)) &&
    isNodeContent(value.content) &&
    isNodeLayout(value.layout) &&
    isOptionalEvents(value.events)
  )
}

function isSubCanvas(value: unknown): value is SubCanvas {
  if (!isRecord(value)) return false
  return (
    isText(value.id) &&
    isText(value.hostNodeId) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isPaperNode) &&
    Array.isArray(value.rootIds) &&
    value.rootIds.every(isText)
  )
}

function isOptionalSubCanvases(
  value: unknown,
): value is Readonly<Record<CanvasId, SubCanvas>> | undefined {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  return Object.entries(value).every(([key, item]) => isSubCanvas(item) && item.id === key)
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
  const { meta, defaults, nodes, rootIds, subCanvases } = raw
  if (!isDocumentMeta(meta) || !isDocumentDefaults(defaults)) return null
  if (!Array.isArray(nodes) || !nodes.every(isPaperNode)) return null
  if (!Array.isArray(rootIds) || !rootIds.every(isText)) return null
  if (!isOptionalSubCanvases(subCanvases)) return null
  return subCanvases === undefined
    ? { meta, defaults, nodes, rootIds }
    : { meta, defaults, nodes, rootIds, subCanvases }
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

function describeTreeProblem(
  nodes: readonly PaperNode[],
  rootIds: readonly NodeId[],
): string | null {
  const ids = new Set<NodeId>()
  for (const node of nodes) {
    if (ids.has(node.id)) return `节点 ID 重复：${node.id}`
    ids.add(node.id)
  }

  if (rootIds.length === 0) return '至少要有一个根节点'
  const rootIdSet = new Set<NodeId>(rootIds)
  for (const rootId of rootIds) {
    if (!ids.has(rootId)) return `根节点不存在：${rootId}`
  }

  for (const node of nodes) {
    if (rootIdSet.has(node.id) && node.parentId !== null) {
      return `节点 ${node.id} 既是根节点又有父节点`
    }
    if (node.parentId !== null && !ids.has(node.parentId)) {
      return `父节点不存在：${node.parentId}`
    }
  }

  for (const node of nodes) {
    if (hasParentCycle(nodes, node.id)) return `节点存在循环引用：${node.id}`
  }
  return null
}

/** 校验主画布与所有支线子画布的节点引用关系 */
function describeDocumentProblem(document: PaperDocument): string | null {
  const mainProblem = describeTreeProblem(document.nodes, document.rootIds)
  if (mainProblem !== null) return mainProblem
  if (document.subCanvases === undefined) return null

  for (const sub of Object.values(document.subCanvases)) {
    const subProblem = describeTreeProblem(sub.nodes, sub.rootIds)
    if (subProblem !== null) return `支线画布 ${sub.id}：${subProblem}`
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
