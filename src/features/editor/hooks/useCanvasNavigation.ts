import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type {
  BreadcrumbItem,
  CanvasId,
  NodeEventAction,
  NodeId,
  PaperDocument,
  PaperNode,
} from '@/shared/types/paper'
import { activeCanvasDocument, ensureSubCanvasForNode } from '../data/document'
import { plainTextFromHtml } from '../lib/richText'

interface CanvasNavigationOptions {
  readonly document: PaperDocument
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly resetCanvasSelection: () => void
  readonly openMediaDetail: (nodeId: NodeId) => void
  readonly startEditing: (nodeId: NodeId) => void
}

function summarizeNodeTitle(node: PaperNode | undefined): string {
  if (node === undefined) return '支线画布'
  if (node.content.kind === 'title') return node.content.title.trim() || '未命名标题'
  if (node.content.kind === 'image') return node.content.alt.trim() || '图片支线'
  if (node.content.kind === 'file') return node.content.fileName.trim() || '文件支线'
  const text = plainTextFromHtml(node.content.richText)
  if (text === '') return '支线探索'
  return text.length > 18 ? `${text.slice(0, 18)}…` : text
}

function findNodeAcrossDocument(document: PaperDocument, nodeId: NodeId): PaperNode | undefined {
  const inMain = document.nodes.find((node) => node.id === nodeId)
  if (inMain !== undefined) return inMain
  if (document.subCanvases === undefined) return undefined
  for (const sub of Object.values(document.subCanvases)) {
    const found = sub.nodes.find((node) => node.id === nodeId)
    if (found !== undefined) return found
  }
  return undefined
}

function buildBreadcrumbs(
  document: PaperDocument,
  canvasStack: readonly CanvasId[],
): readonly BreadcrumbItem[] {
  if (canvasStack.length === 0) return []
  const items: BreadcrumbItem[] = [{ canvasId: null, label: '主画布' }]
  for (const canvasId of canvasStack) {
    const sub = document.subCanvases?.[canvasId]
    const hostNode = sub === undefined ? undefined : findNodeAcrossDocument(document, sub.hostNodeId)
    items.push({ canvasId, label: `支线：${summarizeNodeTitle(hostNode)}` })
  }
  return items
}

function useCanvasStackActions({
  activeCanvasId,
  validStackLength,
  setCanvasStack,
  setDocument,
  resetCanvasSelection,
}: Readonly<{
  activeCanvasId: CanvasId | null
  validStackLength: number
  setCanvasStack: Dispatch<SetStateAction<readonly CanvasId[]>>
  setDocument: Dispatch<SetStateAction<PaperDocument>>
  resetCanvasSelection: () => void
}>) {
  const enterSubCanvas = useCallback(
    (nodeId: NodeId, canvasId: CanvasId) => {
      if (canvasId === activeCanvasId) return
      setDocument((curr) => ensureSubCanvasForNode(curr, activeCanvasId, nodeId, canvasId).document)
      resetCanvasSelection()
      setCanvasStack((prev) => [...prev.filter((id) => id !== canvasId), canvasId])
    },
    [activeCanvasId, resetCanvasSelection, setCanvasStack, setDocument],
  )

  const navigateToCanvas = useCallback(
    (targetCanvasId: CanvasId | null) => {
      if (targetCanvasId === activeCanvasId) return
      resetCanvasSelection()
      if (targetCanvasId === null) {
        setCanvasStack([])
        return
      }
      setCanvasStack((prev) => {
        const idx = prev.indexOf(targetCanvasId)
        return idx === -1 ? prev : prev.slice(0, idx + 1)
      })
    },
    [activeCanvasId, resetCanvasSelection, setCanvasStack],
  )

  const popSubCanvas = useCallback(() => {
    if (validStackLength === 0) return
    resetCanvasSelection()
    setCanvasStack((prev) => prev.slice(0, -1))
  }, [resetCanvasSelection, setCanvasStack, validStackLength])

  return { enterSubCanvas, navigateToCanvas, popSubCanvas }
}

/** 管理主画布与支线子画布的导航栈、面包屑路径以及节点事件动作派发 */
export function useCanvasNavigation(options: Readonly<CanvasNavigationOptions>) {
  const { document, setDocument, resetCanvasSelection, openMediaDetail, startEditing } = options
  const [canvasStack, setCanvasStack] = useState<readonly CanvasId[]>([])

  const validStack = useMemo(
    () => canvasStack.filter((id) => document.subCanvases?.[id] !== undefined),
    [canvasStack, document.subCanvases],
  )
  const activeCanvasId: CanvasId | null = validStack[validStack.length - 1] ?? null
  const activeDocument = useMemo(
    () => activeCanvasDocument(document, activeCanvasId),
    [document, activeCanvasId],
  )
  const activeHostNodeId: NodeId | null =
    activeCanvasId === null ? null : (document.subCanvases?.[activeCanvasId]?.hostNodeId ?? null)
  const breadcrumbs = useMemo(() => buildBreadcrumbs(document, validStack), [document, validStack])

  const stackActions = useCanvasStackActions({
    activeCanvasId,
    validStackLength: validStack.length,
    setCanvasStack,
    setDocument,
    resetCanvasSelection,
  })

  const triggerNodeEvent = useCallback(
    (nodeId: NodeId, action: NodeEventAction) => {
      if (action.type === 'edit-node') startEditing(nodeId)
      else if (action.type === 'open-detail') openMediaDetail(nodeId)
      else if (action.type === 'open-canvas') stackActions.enterSubCanvas(nodeId, action.canvasId)
    },
    [openMediaDetail, stackActions, startEditing],
  )

  return {
    activeCanvasId,
    activeDocument,
    activeHostNodeId,
    breadcrumbs,
    ...stackActions,
    triggerNodeEvent,
  }
}
