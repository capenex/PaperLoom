import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, RefObject } from 'react'

import type { ImageNodeContent, NodeId } from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import type { DocumentLayout, Point } from '../data/layout'
import { cardIdAtPoint, measureWorldZoom } from '../lib/dragHitTest'
import {
  INBOX_SAVE_FAILED,
  extractImageFiles,
  extractPastedImageFile,
  hasFilesInDataTransfer,
  saveImageFileToInbox,
} from '../lib/inboxUpload'

const MULTI_DROP_OFFSET_Y = 160

interface ImagePasteDropOptions {
  readonly selectedNodeId: NodeId | null
  readonly layout: DocumentLayout
  readonly stageRef: RefObject<HTMLDivElement | null>
  readonly onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
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

async function ingestImageFiles(
  files: readonly File[],
  resolveTarget: (index: number) => AddImageNodeTarget | undefined,
  onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void,
): Promise<void> {
  let failed = false
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    if (file === undefined) continue
    try {
      const content = await saveImageFileToInbox(file)
      onAddImage(content, resolveTarget(index))
    } catch {
      failed = true
    }
  }
  // 一次拖入多张时失败也只提示一次
  if (failed) window.alert(INBOX_SAVE_FAILED)
}

function handleCanvasImageDrop(
  event: ReactDragEvent<HTMLDivElement>,
  options: Readonly<ImagePasteDropOptions>,
): void {
  const files = extractImageFiles(event.dataTransfer)
  if (files.length === 0) return
  event.preventDefault()

  const { layout, stageRef, onAddImage } = options
  const hitNodeId = cardIdAtPoint(event.clientX, event.clientY, new Set())
  const baseAnchor =
    hitNodeId === null
      ? resolveDropAnchor(event.clientX, event.clientY, stageRef.current, layout.origin)
      : undefined

  void ingestImageFiles(
    files,
    (index) => {
      if (hitNodeId !== null) return { parentId: hitNodeId }
      if (baseAnchor === undefined) return undefined
      return {
        anchor: { x: baseAnchor.x, y: baseAnchor.y + index * MULTI_DROP_OFFSET_Y },
      }
    },
    onAddImage,
  )
}

function useWindowImagePaste(latestRef: RefObject<Readonly<ImagePasteDropOptions>>): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent): void => {
      // 粘贴只认一张图：截图与多格式剪贴板会把同一张图拆成多个文件项
      const file = extractPastedImageFile(event.clipboardData)
      if (file === null) return
      event.preventDefault()
      const { selectedNodeId, onAddImage } = latestRef.current
      void ingestImageFiles(
        [file],
        () => (selectedNodeId === null ? undefined : { parentId: selectedNodeId }),
        onAddImage,
      )
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [latestRef])
}

/**
 * 编辑器图片粘贴与拖拽入库：
 * 粘贴或拖入画布的图片自动存入 res/inbox/<timestamp>.<ext> 并创建多媒体节点。
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
    handleCanvasImageDrop(event, latestRef.current)
  }, [])

  return { fileDropping, onDragOver, onDragLeave, onDrop }
}
