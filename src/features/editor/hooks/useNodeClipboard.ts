import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { CanvasId, NodeId, PaperDocument } from '@/shared/types/paper'
import { activeCanvasDocument, applyInCanvas, canDeleteNodeInCanvas } from '../data/document'
import {
  copyNodeToClipboard,
  pasteClipboardIntoDocument,
} from '../data/nodeClipboard'
import type { CopyNodeMode, NodeClipboardPayload } from '../data/nodeClipboard'

interface UseNodeClipboardOptions {
  readonly document: PaperDocument
  readonly activeCanvasId: CanvasId | null
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly onDeleteNode?: (nodeId: NodeId) => void
}

export interface NodeClipboardControls {
  readonly copySelectedNode: (mode?: CopyNodeMode) => boolean
  readonly pasteCopiedNode: () => NodeId | null
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

function hasNonEmptyTextSelection(): boolean {
  if (typeof window === 'undefined') return false
  const selection = window.getSelection()
  return selection !== null && selection.toString().trim() !== ''
}

/**
 * 画布节点键盘快捷键（复制、粘贴与 Delete 删除）：
 * - Delete：删除当前选中节点（当未处于文本输入框或富文本编辑态且该节点允许删除时）
 * - Ctrl/Cmd + C：仅复制当前选中节点本身（single）
 * - Ctrl/Cmd + Shift + C：复制当前选中节点及其整棵子树（subtree）
 * - Ctrl/Cmd + V：若当前选中了节点，将复制的节点/子树追加为该选中节点的最后一个子节点；否则作为新根节点追加
 */
export function useNodeClipboard(
  options: Readonly<UseNodeClipboardOptions>,
): NodeClipboardControls {
  const clipboardRef = useRef<NodeClipboardPayload | null>(null)
  const latestRef = useRef(options)
  useEffect(() => {
    latestRef.current = options
  })

  const copySelectedNode = useCallback((mode: CopyNodeMode = 'single'): boolean => {
    const { document, activeCanvasId, selectedNodeId } = latestRef.current
    if (selectedNodeId === null) return false
    const slice = activeCanvasDocument(document, activeCanvasId)
    const payload = copyNodeToClipboard(slice, selectedNodeId, mode)
    if (payload === null) return false
    clipboardRef.current = payload
    return true
  }, [])

  const pasteCopiedNode = useCallback((): NodeId | null => {
    const payload = clipboardRef.current
    if (payload === null) return null
    const { document, activeCanvasId, selectedNodeId, setDocument, setSelectedNodeId } =
      latestRef.current
    const currentSlice = activeCanvasDocument(document, activeCanvasId)
    const previewResult = pasteClipboardIntoDocument(currentSlice, payload, selectedNodeId)
    if (previewResult === null) return null

    setDocument((prev) =>
      applyInCanvas(prev, activeCanvasId, () => previewResult.document),
    )
    setSelectedNodeId(previewResult.pastedRootId)
    return previewResult.pastedRootId
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      const { editingNodeId, selectedNodeId, document, activeCanvasId, onDeleteNode } =
        latestRef.current
      if (editingNodeId !== null || isEditableTarget(event.target) || hasNonEmptyTextSelection()) {
        return
      }

      if (
        event.key === 'Delete' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (selectedNodeId !== null && onDeleteNode !== undefined) {
          const slice = activeCanvasDocument(document, activeCanvasId)
          const target = slice.nodes.find((item) => item.id === selectedNodeId)
          if (target !== undefined && canDeleteNodeInCanvas(document, activeCanvasId, target)) {
            event.preventDefault()
            onDeleteNode(selectedNodeId)
          }
        }
        return
      }

      if (!(event.ctrlKey || event.metaKey) || event.altKey) return

      const key = event.key.toLowerCase()
      if (key === 'c') {
        const mode: CopyNodeMode = event.shiftKey ? 'subtree' : 'single'
        if (copySelectedNode(mode)) {
          event.preventDefault()
        }
        return
      }

      if (key === 'v' && !event.shiftKey) {
        if (clipboardRef.current !== null && pasteCopiedNode() !== null) {
          event.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [copySelectedNode, pasteCopiedNode])

  return {
    copySelectedNode,
    pasteCopiedNode,
  }
}
