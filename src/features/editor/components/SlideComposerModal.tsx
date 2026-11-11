import { useCallback, useEffect, useState } from 'react'

import { createId } from '@/shared/lib/id'
import { buildInboxUrl, sanitizeInboxSegment } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import {
  createDefaultSlideSpec,
  dimensionsForSlideAspect,
} from '@/shared/lib/slideSvg'
import type {
  SlideAspectPreset,
  SlideDocumentSpec,
  SlideElement,
} from '@/shared/types/slide'
import {
  loadSlideSpecFromInbox,
  saveSlideSvgToInbox,
} from '../lib/inboxClient'
import { extractPastedImageFile } from '../lib/inboxUpload'
import { SlideCanvasStage } from './SlideCanvasStage'
import { SlideInspectorBar } from './SlideInspectorBar'

export interface SlideComposerTarget {
  /** 编辑已有 .slide.svg 时传入其相对于 res/inbox 的路径；新建时为 null */
  readonly existingRelPath: string | null
  /** 新建时默认存放的目录 */
  readonly folderPath: string
}

interface SlideComposerModalProps {
  readonly target: SlideComposerTarget | null
  readonly inboxEntries: readonly InboxEntry[]
  readonly onClose: () => void
  readonly onSavedSlide: (
    relPath: string,
    src: string,
    spec: SlideDocumentSpec,
    insertToCanvas: boolean,
  ) => void
}

function extractStemAndFolder(
  target: SlideComposerTarget,
): { readonly folder: string; readonly stem: string } {
  if (target.existingRelPath === null) {
    return { folder: target.folderPath, stem: `幻灯片-${Date.now().toString().slice(-4)}` }
  }
  const slash = target.existingRelPath.lastIndexOf('/')
  const folder = slash === -1 ? '' : target.existingRelPath.slice(0, slash)
  const rawName =
    slash === -1 ? target.existingRelPath : target.existingRelPath.slice(slash + 1)
  const stem = rawName.toLowerCase().endsWith('.slide.svg')
    ? rawName.slice(0, -'.slide.svg'.length)
    : rawName
  return { folder, stem }
}

function nextSequentialStem(stem: string): string {
  const match = /^(.*?)-?(\d+)$/u.exec(stem)
  if (match !== null && match[1] !== undefined && match[2] !== undefined) {
    const prefix = match[1] === '' ? '幻灯片' : match[1]
    const nextNum = Number(match[2]) + 1
    return `${prefix}-${nextNum}`
  }
  return `${stem}-2`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to encode data URL'))
      }
    }
    reader.onerror = () => {
      reject(new Error('Failed to read blob'))
    }
    reader.readAsDataURL(blob)
  })
}

async function fetchInboxImageAsDataUrl(relPath: string): Promise<string> {
  const res = await fetch(buildInboxUrl(relPath, Date.now()))
  if (!res.ok) throw new Error('读取文件池图片失败')
  const blob = await res.blob()
  return blobToDataUrl(blob)
}

function createTextLayerElement(isHeading: boolean): SlideElement {
  return {
    id: `slide-txt-${createId()}`,
    kind: 'text',
    x: 96,
    y: isHeading ? 64 : 180,
    width: isHeading ? 640 : 480,
    height: isHeading ? 64 : 120,
    text: isHeading ? '新章节标题' : '双击或使用顶部输入框编辑文本内容',
    fontSize: isHeading ? 30 : 20,
    fontWeight: isHeading ? 'bold' : 'normal',
    color: '#0f172a',
    align: 'left',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 8,
  }
}

function createShapeLayerElement(shape: 'rounded' | 'pill'): SlideElement {
  return {
    id: `slide-shp-${createId()}`,
    kind: 'shape',
    shape,
    x: 240,
    y: 200,
    width: shape === 'pill' ? 180 : 280,
    height: shape === 'pill' ? 52 : 130,
    fill: shape === 'pill' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(59, 130, 246, 0.14)',
    stroke: shape === 'pill' ? '#059669' : '#2563eb',
    strokeWidth: 2,
    dashed: shape !== 'pill',
    text: shape === 'pill' ? '核心指标' : '重点高亮区域',
    textColor: shape === 'pill' ? '#065f46' : '#1e40af',
    fontSize: 18,
  }
}

function createArrowLayerElement(): SlideElement {
  return {
    id: `slide-arr-${createId()}`,
    kind: 'arrow',
    x1: 220,
    y1: 260,
    x2: 480,
    y2: 260,
    color: '#dc2626',
    strokeWidth: 3,
    dashed: false,
    doubleHeaded: false,
  }
}

function duplicateSlideElement(selectedElement: SlideElement): SlideElement {
  const copyId = `slide-copy-${createId()}`
  if (selectedElement.kind === 'arrow') {
    return {
      ...selectedElement,
      id: copyId,
      x1: selectedElement.x1 + 24,
      y1: selectedElement.y1 + 24,
      x2: selectedElement.x2 + 24,
      y2: selectedElement.y2 + 24,
    }
  }
  return {
    ...selectedElement,
    id: copyId,
    x: selectedElement.x + 24,
    y: selectedElement.y + 24,
  }
}

function reorderSlideElements(
  elements: readonly SlideElement[],
  selectedId: string,
  direction: 'up' | 'down',
): readonly SlideElement[] {
  const idx = elements.findIndex((el) => el.id === selectedId)
  if (idx === -1) return elements
  const targetIdx = direction === 'up' ? idx + 1 : idx - 1
  if (targetIdx < 0 || targetIdx >= elements.length) return elements
  const next = [...elements]
  const currentItem = next[idx]
  const swapItem = next[targetIdx]
  if (currentItem === undefined || swapItem === undefined) return elements
  next[idx] = swapItem
  next[targetIdx] = currentItem
  return next
}

function SlidePoolImagePickerBar({
  entries,
  onPickEntry,
}: Readonly<{
  entries: readonly InboxEntry[]
  onPickEntry: (entry: InboxEntry) => void
}>) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-100/90 px-4 py-2">
      <span className="shrink-0 text-xs font-medium text-slate-600">点击文件池图片插入画板：</span>
      {entries.length === 0 ? (
        <span className="text-xs text-slate-400">文件池暂无图片</span>
      ) : (
        entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            onClick={() => {
              onPickEntry(entry)
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-2xs hover:border-primary"
          >
            <img
              src={buildInboxUrl(entry.path, entry.updatedAt)}
              alt={entry.name}
              className="size-6 rounded object-cover"
            />
            <span className="max-w-28 truncate">{entry.name}</span>
          </button>
        ))
      )}
    </div>
  )
}

function useSlideClipboardPaste(
  insertImageDataUrl: (dataUrl: string, alt: string, inboxSrc?: string) => void,
): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent): void => {
      const file = extractPastedImageFile(event.clipboardData)
      if (file === null) return
      event.preventDefault()
      event.stopPropagation()
      void blobToDataUrl(file).then((dataUrl) => {
        insertImageDataUrl(dataUrl, file.name || '粘贴图片')
      })
    }
    window.addEventListener('paste', handlePaste, true)
    return () => {
      window.removeEventListener('paste', handlePaste, true)
    }
  }, [insertImageDataUrl])
}

function useSlideComposerState(target: SlideComposerTarget) {
  const initialMeta = extractStemAndFolder(target)
  const [folderPath] = useState(initialMeta.folder)
  const [fileStem, setFileStem] = useState(initialMeta.stem)
  const [isExistingFile, setIsExistingFile] = useState(target.existingRelPath !== null)
  const [spec, setSpec] = useState<SlideDocumentSpec>(() => createDefaultSlideSpec(initialMeta.stem))
  const [selectedId, setSelectedId] = useState<string | null>('slide-title-1')
  const [poolPickerOpen, setPoolPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const existingRelPath = target.existingRelPath
    if (existingRelPath === null) return undefined
    let cancelled = false
    void loadSlideSpecFromInbox(existingRelPath).then((loaded) => {
      if (!cancelled && loaded !== null) {
        setSpec(loaded)
        setSelectedId(loaded.elements[0]?.id ?? null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [target.existingRelPath])

  const appendElement = useCallback((el: SlideElement) => {
    setSpec((curr) => ({ ...curr, elements: [...curr.elements, el] }))
    setSelectedId(el.id)
  }, [])

  const insertImageDataUrl = useCallback(
    (dataUrl: string, alt: string, inboxSrc?: string) => {
      appendElement({
        id: `slide-img-${createId()}`,
        kind: 'image',
        x: 180,
        y: 120,
        width: 420,
        height: 280,
        ...(inboxSrc === undefined ? {} : { inboxSrc }),
        dataUrl,
        alt,
        objectFit: 'contain',
        borderRadius: 10,
      })
    },
    [appendElement],
  )

  useSlideClipboardPaste(insertImageDataUrl)

  const performSave = useCallback(
    async (desiredStem: string, overwrite: boolean): Promise<{ readonly relPath: string; readonly src: string }> => {
      const cleanStem = sanitizeInboxSegment(desiredStem) || '未命名幻灯片'
      const fileName = `${cleanStem}.slide.svg`
      const relPath = folderPath === '' ? fileName : `${folderPath}/${fileName}`
      setSaving(true)
      try {
        const saved = await saveSlideSvgToInbox(relPath, spec, overwrite)
        setIsExistingFile(true)
        return saved
      } finally {
        setSaving(false)
      }
    },
    [folderPath, spec],
  )

  return {
    folderPath,
    fileStem,
    setFileStem,
    isExistingFile,
    spec,
    setSpec,
    selectedId,
    setSelectedId,
    poolPickerOpen,
    setPoolPickerOpen,
    saving,
    appendElement,
    insertImageDataUrl,
    performSave,
  }
}

interface DialogSessionProps {
  readonly target: SlideComposerTarget
  readonly inboxEntries: readonly InboxEntry[]
  readonly onClose: () => void
  readonly onSavedSlide: (relPath: string, src: string, spec: SlideDocumentSpec, insertToCanvas: boolean) => void
}

function SlideComposerDialogSession({ target, inboxEntries, onClose, onSavedSlide }: Readonly<DialogSessionProps>) {
  const state = useSlideComposerState(target)
  const selectedElement = state.spec.elements.find((item) => item.id === state.selectedId)
  const imagePoolEntries = inboxEntries.filter(
    (item) => item.kind === 'file' && (item.category === 'image' || item.category === 'slide'),
  )
  const runSave = (stem: string, overwrite: boolean, insertToCanvas: boolean): void => {
    void state.performSave(stem, overwrite).then((saved) => {
      onSavedSlide(saved.relPath, saved.src, state.spec, insertToCanvas)
      if (insertToCanvas) onClose()
    })
  }

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="PPT 伪图片画板编辑器"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-h-none max-w-none items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="relative flex h-[90vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <SlideInspectorBar
          fileStem={state.fileStem}
          folderPath={state.folderPath}
          spec={state.spec}
          selectedElement={selectedElement}
          saving={state.saving}
          onChangeFileStem={state.setFileStem}
          onChangeAspect={(aspect: SlideAspectPreset) => {
            const dims = dimensionsForSlideAspect(aspect)
            state.setSpec((curr) => ({ ...curr, aspect, width: dims.width, height: dims.height }))
          }}
          onChangeBackground={(background) => { state.setSpec((curr) => ({ ...curr, background })) }}
          onAddText={(isHeading) => { state.appendElement(createTextLayerElement(isHeading)) }}
          onAddShape={(shape) => { state.appendElement(createShapeLayerElement(shape)) }}
          onAddArrow={() => { state.appendElement(createArrowLayerElement()) }}
          onTogglePoolPicker={() => { state.setPoolPickerOpen((prev) => !prev) }}
          onPickLocalImage={(file) => {
            void blobToDataUrl(file).then((dataUrl) => { state.insertImageDataUrl(dataUrl, file.name) })
          }}
          onUpdateSelected={(updater) => {
            if (state.selectedId === null) return
            state.setSpec((curr) => ({ ...curr, elements: curr.elements.map((el) => (el.id === state.selectedId ? updater(el) : el)) }))
          }}
          onReorderSelected={(direction) => {
            if (state.selectedId === null) return
            const id = state.selectedId
            state.setSpec((curr) => ({ ...curr, elements: reorderSlideElements(curr.elements, id, direction) }))
          }}
          onDuplicateSelected={() => {
            if (selectedElement !== undefined) state.appendElement(duplicateSlideElement(selectedElement))
          }}
          onDeleteSelected={() => {
            if (state.selectedId === null) return
            state.setSpec((curr) => ({ ...curr, elements: curr.elements.filter((el) => el.id !== state.selectedId) }))
            state.setSelectedId(null)
          }}
          onSaveOnly={() => { runSave(state.fileStem, state.isExistingFile, false) }}
          onSaveAsNextPage={() => {
            const nextStem = nextSequentialStem(state.fileStem)
            state.setFileStem(nextStem)
            runSave(nextStem, false, false)
          }}
          onSaveAndInsert={() => { runSave(state.fileStem, state.isExistingFile, true) }}
          onClose={onClose}
        />
        {state.poolPickerOpen && (
          <SlidePoolImagePickerBar
            entries={imagePoolEntries}
            onPickEntry={(entry) => {
              state.setPoolPickerOpen(false)
              void fetchInboxImageAsDataUrl(entry.path).then((dataUrl) => {
                state.insertImageDataUrl(dataUrl, entry.name, buildInboxUrl(entry.path))
              })
            }}
          />
        )}
        <SlideCanvasStage
          spec={state.spec}
          selectedId={state.selectedId}
          onSelectId={state.setSelectedId}
          onUpdateElement={(id, updater) => {
            state.setSpec((curr) => ({ ...curr, elements: curr.elements.map((el) => (el.id === id ? updater(el) : el)) }))
          }}
        />
      </div>
    </dialog>
  )
}

export function SlideComposerModal({
  target,
  inboxEntries,
  onClose,
  onSavedSlide,
}: Readonly<SlideComposerModalProps>) {
  if (target === null) return null
  const sessionKey = `${target.folderPath}::${target.existingRelPath ?? 'new'}`
  return (
    <SlideComposerDialogSession
      key={sessionKey}
      target={target}
      inboxEntries={inboxEntries}
      onClose={onClose}
      onSavedSlide={onSavedSlide}
    />
  )
}
