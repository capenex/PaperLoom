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
import { describeLevelProblem } from './nodeTree'
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
    value.type === 'open-reference-preview' ||
    value.type === 'return-parent-canvas'
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

/** 旧格式节点：单父 parentId */
interface LegacyPaperNode extends Omit<PaperNode, 'parentIds'> {
  readonly parentId: NodeId | null
}

interface RawSubCanvas {
  readonly id: CanvasId
  readonly hostNodeId: NodeId
  readonly nodes: readonly (PaperNode | LegacyPaperNode)[]
  readonly rootIds: readonly NodeId[]
}

function isPaperNode(value: unknown): value is PaperNode | LegacyPaperNode {
  if (!isRecord(value)) return false
  const parentsOk = Array.isArray(value.parentIds)
    ? value.parentIds.every(isText)
    : value.parentId === null || isText(value.parentId)
  return (
    isText(value.id) &&
    parentsOk &&
    isNodeContent(value.content) &&
    isNodeLayout(value.layout) &&
    isOptionalEvents(value.events)
  )
}

/** 旧存档的单父 parentId 迁移为 parentIds 数组 */
function normalizeNode(node: PaperNode | LegacyPaperNode): PaperNode {
  if ('parentIds' in node) return node
  const { parentId, ...rest } = node
  return { ...rest, parentIds: parentId === null ? [] : [parentId] }
}

function isSubCanvas(value: unknown): value is RawSubCanvas {
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
): value is Readonly<Record<CanvasId, RawSubCanvas>> | undefined {
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
  const normalizedNodes = nodes.map(normalizeNode)
  if (subCanvases === undefined) {
    return { meta, defaults, nodes: normalizedNodes, rootIds }
  }
  const normalizedSubs: Record<CanvasId, SubCanvas> = {}
  for (const [key, sub] of Object.entries(subCanvases)) {
    normalizedSubs[key] = { ...sub, nodes: sub.nodes.map(normalizeNode) }
  }
  return { meta, defaults, nodes: normalizedNodes, rootIds, subCanvases: normalizedSubs }
}

/** 校验主画布与所有支线子画布的节点引用关系 */
function describeDocumentProblem(document: PaperDocument): string | null {
  const mainProblem = describeLevelProblem(document.nodes, document.rootIds)
  if (mainProblem !== null) return mainProblem
  if (document.subCanvases === undefined) return null

  for (const sub of Object.values(document.subCanvases)) {
    const subProblem = describeLevelProblem(sub.nodes, sub.rootIds)
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
