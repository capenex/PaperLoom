import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, RefObject } from 'react'

import type {
  FileNodeContent,
  ImageNodeContent,
  ImageSlideItem,
  NodeId,
  PaperDocument,
  StaticFileFormat,
} from '@/shared/types/paper'
import type { InboxEntry } from '@/shared/lib/inbox'
import type { AddImageNodeTarget } from '../data/document'
import type { DocumentLayout, Point } from '../data/layout'
import { cardIdAtPoint, measureWorldZoom } from '../lib/dragHitTest'
import { readDraggedInboxPayload } from '../lib/inboxClient'
import {
  INBOX_SAVE_FAILED,
  applyImageItemsToCanvas,
  dispatchInboxEntryToCanvas,
  extractAllDroppedFiles,
  extractPastedImageFile,
  hasFilesInDataTransfer,
  ingestExternalFileToCanvas,
  saveImageSlideToInbox,
} from '../lib/inboxUpload'
import type { CanvasFileDropCallbacks } from '../lib/inboxUpload'

const MULTI_DROP_OFFSET_Y = 160

interface ImagePasteDropOptions {
  readonly document: PaperDocument
  readonly selectedNodeId: NodeId | null
  readonly layout: DocumentLayout
  readonly stageRef: RefObject<HTMLDivElement | null>
  readonly inboxEntries?: readonly InboxEntry[] | undefined
  readonly currentInboxFolder?: string | undefined
  readonly onRefreshInbox?: (() => Promise<void>) | undefined
  readonly onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
  readonly onAddImagePages?: ((nodeId: NodeId, items: readonly ImageSlideItem[]) => void) | undefined
  readonly onReplaceImagePage?: ((nodeId: NodeId, item: ImageSlideItem) => void) | undefined
  readonly onAddFile?: ((content: FileNodeContent, target?: AddImageNodeTarget) => void) | undefined
  readonly onUpdateFile?:
    | ((nodeId: NodeId, fileName: string, format: StaticFileFormat, text: string) => void)
    | undefined
  readonly onAddRichText?: ((richText: string, target?: AddImageNodeTarget) => void) | undefined
  readonly onUpdateContent?: ((nodeId: NodeId, richText: string) => void) | undefined
}

export interface ImagePasteDropControls {
  readonly fileDropping: boolean
  readonly onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void
  readonly onDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void
  readonly onDrop: (event: ReactDragEvent<HTMLDivElement>) => void
}

function resolveDropAnchor(
  clientX: number,
  clientY: number,
  stage: HTMLDivElement | null,
  origin: Point,
): Point | undefined {
  if (stage === null) return undefined
  const rect = stage.getBoundingClientRect()
  const zoom = measureWorldZoom(stage)
  const stageX = (clientX - rect.left) / zoom
  const stageY = (clientY - rect.top) / zoom
  return {
    x: Math.round(stageX - origin.x),
    y: Math.round(stageY - origin.y),
  }
}

function toDropCallbacks(options: Readonly<ImagePasteDropOptions>): CanvasFileDropCallbacks {
  return {
    nodes: options.document.nodes,
    inboxEntries: options.inboxEntries,
    currentInboxFolder: options.currentInboxFolder,
    onRefreshInbox: options.onRefreshInbox,
    onAddImage: options.onAddImage,
    onAddImagePages: options.onAddImagePages,
    onReplaceImagePage: options.onReplaceImagePage,
    onAddFile: options.onAddFile,
    onUpdateFile: options.onUpdateFile,
    onAddRichText: options.onAddRichText,
    onUpdateContent: options.onUpdateContent,
  }
}

function handleCanvasDrop(
  event: ReactDragEvent<HTMLDivElement>,
  options: Readonly<ImagePasteDropOptions>,
): void {
  const { document: doc, layout, stageRef } = options
  const hitNodeId = cardIdAtPoint(event.clientX, event.clientY, new Set())
  const hitNode = hitNodeId === null ? undefined : doc.nodes.find((n) => n.id === hitNodeId)
  const baseAnchor =
    hitNodeId === null
      ? resolveDropAnchor(event.clientX, event.clientY, stageRef.current, layout.origin)
      : undefined
  const callbacks = toDropCallbacks(options)

  const inboxPayload = readDraggedInboxPayload(event.dataTransfer)
  if (inboxPayload !== null) {
    event.preventDefault()
    const target: AddImageNodeTarget | undefined =
      hitNodeId === null
        ? baseAnchor === undefined
          ? undefined
          : { anchor: baseAnchor }
        : { parentId: hitNodeId }
    void dispatchInboxEntryToCanvas(inboxPayload, hitNode, event.altKey, target, callbacks)
    return
  }

  const files = extractAllDroppedFiles(event.dataTransfer)
  if (files.length === 0) return
  event.preventDefault()

  void (async () => {
    let failed = false
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      if (file === undefined) continue
      const target: AddImageNodeTarget | undefined =
        hitNodeId === null
          ? baseAnchor === undefined
            ? undefined
            : { anchor: { x: baseAnchor.x, y: baseAnchor.y + index * MULTI_DROP_OFFSET_Y } }
          : { parentId: hitNodeId }
      try {
        await ingestExternalFileToCanvas(file, hitNode, event.altKey, target, callbacks)
      } catch {
        failed = true
      }
    }
    if (options.onRefreshInbox !== undefined) {
      await options.onRefreshInbox()
    }
    if (failed) window.alert(INBOX_SAVE_FAILED)
  })()
}

function useWindowImagePaste(latestRef: RefObject<Readonly<ImagePasteDropOptions>>): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent): void => {
      if (event.defaultPrevented) return
      const isEditingText =
        event.target instanceof Element &&
        event.target.closest('input, textarea, [contenteditable="true"], dialog, [role="dialog"]') !==
          null
      if (isEditingText) return
      const file = extractPastedImageFile(event.clipboardData)
      if (file === null) return
      event.preventDefault()
      const current = latestRef.current
      const { document: doc, selectedNodeId } = current
      const selectedNode =
        selectedNodeId === null ? undefined : doc.nodes.find((n) => n.id === selectedNodeId)
      const callbacks = toDropCallbacks(current)

      void saveImageSlideToInbox(file, Date.now(), current.currentInboxFolder ?? '')
        .then(async (slideItem) => {
          applyImageItemsToCanvas(
            [slideItem],
            selectedNode,
            false,
            selectedNodeId === null ? undefined : { parentId: selectedNodeId },
            callbacks,
          )
          await current.onRefreshInbox?.()
        })
        .catch(() => {
          window.alert(INBOX_SAVE_FAILED)
        })
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [latestRef])
}

/**
 * 编辑器文件粘贴与拖拽入库（支持外部文件拖入及文件池条目/文件夹拖出）：
 * - 拖到空白处：创建自适应图片节点 / 多页图片节点 / 静态文件节点 / 引用文本节点
 * - 拖到已有节点：向图片节点追加新页（Alt 替换当前页）、替换文件节点内容或挂载引用
 */
export function useImagePasteDrop(
  options: Readonly<ImagePasteDropOptions>,
): ImagePasteDropControls {
  const [fileDropping, setFileDropping] = useState(false)
  const latestRef = useRef(options)
  useEffect(() => {
    latestRef.current = options
  })

  useWindowImagePaste(latestRef)

  const onDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFilesInDataTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setFileDropping(true)
  }, [])

  const onDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const related = event.relatedTarget
    if (related instanceof Node && event.currentTarget.contains(related)) return
    setFileDropping(false)
  }, [])

  const onDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    setFileDropping(false)
    handleCanvasDrop(event, latestRef.current)
  }, [])

  return { fileDropping, onDragOver, onDragLeave, onDrop }
}
