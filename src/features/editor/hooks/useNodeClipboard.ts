import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type { CanvasId, NodeId, PaperDocument } from '@/shared/types/paper'
import { activeCanvasDocument, applyInCanvas, canDeleteNodeInCanvas } from '../data/document'
import {
  copyNodeToClipboard,
  pasteClipboardIntoDocument,
} from '../data/nodeClipboard'
import type { CopyNodeMode } from '../data/nodeClipboard'
import {
  NODE_CLIPBOARD_MIME,
  resolveCanvasPasteIntent,
} from '../lib/clipboardResolution'
import type { NodeClipboardSession } from '../lib/clipboardResolution'
import { extractPastedImageFile } from '../lib/inboxUpload'

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

function isEditableOrDialogTarget(target: EventTarget | null): boolean {
  if (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]') !==
      null
  ) {
    return true
  }
  if (typeof document !== 'undefined') {
    return document.querySelector('dialog[open][aria-modal="true"]') !== null
  }
  return false
}

function hasNonEmptyTextSelection(): boolean {
  if (typeof window === 'undefined') return false
  const selection = window.getSelection()
  return selection !== null && selection.toString().trim() !== ''
}

function clearSystemClipboardOnShortcut(): void {
  if (typeof navigator === 'undefined') return
  const clipboard = navigator.clipboard
  if (clipboard === undefined || typeof clipboard.writeText !== 'function') return
  void clipboard.writeText('').catch(() => undefined)
}

function useNodeKeyboardShortcuts(
  latestRef: RefObject<Readonly<UseNodeClipboardOptions>>,
  copyWithMode: (mode: CopyNodeMode, viaCopyEvent: boolean) => NodeClipboardSession | null,
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      const { editingNodeId, selectedNodeId, document, activeCanvasId, onDeleteNode } =
        latestRef.current
      if (
        editingNodeId !== null ||
        isEditableOrDialogTarget(event.target) ||
        hasNonEmptyTextSelection()
      ) {
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
      if (event.key.toLowerCase() === 'c' && event.shiftKey) {
        if (copyWithMode('subtree', false) !== null) {
          event.preventDefault()
          clearSystemClipboardOnShortcut()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [latestRef, copyWithMode])
}

function useNodeClipboardEvents(
  latestRef: RefObject<Readonly<UseNodeClipboardOptions>>,
  sessionRef: RefObject<NodeClipboardSession | null>,
  copyWithMode: (mode: CopyNodeMode, viaCopyEvent: boolean) => NodeClipboardSession | null,
  pasteCopiedNode: () => NodeId | null,
): void {
  useEffect(() => {
    const handleCopy = (event: ClipboardEvent): void => {
      if (event.defaultPrevented) return
      const { editingNodeId } = latestRef.current
      if (
        editingNodeId !== null ||
        isEditableOrDialogTarget(event.target) ||
        hasNonEmptyTextSelection()
      ) {
        return
      }
      const session = copyWithMode('single', true)
      if (session === null || event.clipboardData === null) return
      event.clipboardData.setData(NODE_CLIPBOARD_MIME, session.token)
      event.preventDefault()
    }

    const handlePaste = (event: ClipboardEvent): void => {
      const { editingNodeId } = latestRef.current
      if (editingNodeId !== null || isEditableOrDialogTarget(event.target)) {
        return
      }
      const hasImageFile = extractPastedImageFile(event.clipboardData) !== null
      const hasOtherFiles = (event.clipboardData?.files.length ?? 0) > 0
      const intent = resolveCanvasPasteIntent(
        event.clipboardData,
        sessionRef.current,
        hasImageFile,
        hasOtherFiles,
      )
      if (intent === 'image') {
        sessionRef.current = null
        return
      }
      if (event.defaultPrevented || intent !== 'node') return
      if (pasteCopiedNode() !== null) {
        event.preventDefault()
      }
    }

    window.addEventListener('copy', handleCopy)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('copy', handleCopy)
      window.removeEventListener('paste', handlePaste)
    }
  }, [latestRef, sessionRef, copyWithMode, pasteCopiedNode])
}

/**
 * 画布节点键盘快捷键与剪贴板协同（复制、粘贴与 Delete 删除）：
 * - Delete：删除当前选中节点（当未处于文本输入框、富文本编辑态或模态弹窗且该节点允许删除时）
 * - Ctrl/Cmd + C：通过原生 copy 事件仅复制当前选中节点本身（single）并写入节点标识覆盖旧系统剪贴板
 * - Ctrl/Cmd + Shift + C：复制当前选中节点及其整棵子树（subtree）
 * - Ctrl/Cmd + V：在 paste 事件中按系统剪贴板最新内容决策，若用户在复制节点后截图则优先粘贴图片
 */
export function useNodeClipboard(
  options: Readonly<UseNodeClipboardOptions>,
): NodeClipboardControls {
  const sessionRef = useRef<NodeClipboardSession | null>(null)
  const latestRef = useRef(options)
  useEffect(() => {
    latestRef.current = options
  })

  const copyWithMode = useCallback(
    (mode: CopyNodeMode, viaCopyEvent: boolean): NodeClipboardSession | null => {
      const { document, activeCanvasId, selectedNodeId } = latestRef.current
      if (selectedNodeId === null) return null
      const slice = activeCanvasDocument(document, activeCanvasId)
      const payload = copyNodeToClipboard(slice, selectedNodeId, mode)
      if (payload === null) return null
      const session: NodeClipboardSession = {
        token: createId(),
        viaCopyEvent,
        payload,
      }
      sessionRef.current = session
      return session
    },
    [],
  )

  const copySelectedNode = useCallback(
    (mode: CopyNodeMode = 'single'): boolean => copyWithMode(mode, false) !== null,
    [copyWithMode],
  )

  const pasteCopiedNode = useCallback((): NodeId | null => {
    const session = sessionRef.current
    if (session === null) return null
    const { document, activeCanvasId, selectedNodeId, setDocument, setSelectedNodeId } =
      latestRef.current
    const currentSlice = activeCanvasDocument(document, activeCanvasId)
    const previewResult = pasteClipboardIntoDocument(currentSlice, session.payload, selectedNodeId)
    if (previewResult === null) return null

    setDocument((prev) =>
      applyInCanvas(prev, activeCanvasId, () => previewResult.document),
    )
    setSelectedNodeId(previewResult.pastedRootId)
    return previewResult.pastedRootId
  }, [])

  useNodeKeyboardShortcuts(latestRef, copyWithMode)
  useNodeClipboardEvents(latestRef, sessionRef, copyWithMode, pasteCopiedNode)

  return {
    copySelectedNode,
    pasteCopiedNode,
  }
}