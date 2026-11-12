import { useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Pencil, Plus, Presentation, Trash2 } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { isSlideSvgPath, normalizeInboxLookupPath } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { resolveActiveImageIndex, resolveImageItems } from '@/shared/lib/mediaPages'
import type { ImageNodeContent, ImageSlideItem } from '@/shared/types/paper'
import { buildSlideItemFromInboxPath } from '../lib/inboxUpload'
import { FilePoolImagePickerModal } from './FilePoolImagePickerModal'
import type { FilePoolImagePickerMode } from './FilePoolImagePickerModal'

interface ImagePageControlsProps {
  readonly content: ImageNodeContent
  readonly onReplaceImagePage: (item: ImageSlideItem) => void
  readonly onAddImagePages: (items: readonly ImageSlideItem[]) => void
  readonly onDeleteImagePage: () => void
  readonly onMoveImagePage?: ((direction: 'left' | 'right') => void) | undefined
  readonly onCreateSlideForNode?: (() => void) | undefined
  readonly onEditSlidePath?: ((relPath: string) => void) | undefined
}

const PAGE_BTN_CLS =
  'h-8 border-slate-200/90 bg-white px-2.5 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50'

function applyPickedPoolEntries(
  mode: FilePoolImagePickerMode | null,
  entries: readonly InboxEntry[],
  onReplaceImagePage: (item: ImageSlideItem) => void,
  onAddImagePages: (items: readonly ImageSlideItem[]) => void,
): void {
  if (mode === null || entries.length === 0) return
  void Promise.all(entries.map((entry) => buildSlideItemFromInboxPath(entry.path, entry.name)))
    .then((slides) => {
      if (mode === 'replace') {
        const first = slides[0]
        if (first !== undefined) onReplaceImagePage(first)
        return
      }
      onAddImagePages(slides)
    })
    .catch(() => {
      window.alert('读取文件池图片失败')
    })
}

function SlidePageButtons({
  slideRelPath,
  onCreateSlideForNode,
  onEditSlidePath,
}: Readonly<{
  slideRelPath: string | null
  onCreateSlideForNode?: (() => void) | undefined
  onEditSlidePath?: ((relPath: string) => void) | undefined
}>) {
  return (
    <>
      {onCreateSlideForNode !== undefined && (
        <Button type="button" variant="outline" size="sm" className={PAGE_BTN_CLS} onClick={onCreateSlideForNode}>
          <Presentation className="size-4 text-primary" aria-hidden="true" />
          新建幻灯片页
        </Button>
      )}
      {slideRelPath !== null && onEditSlidePath !== undefined && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-primary/30 bg-primary/5 px-2.5 text-[13px] font-medium text-primary shadow-2xs hover:bg-primary/10"
          onClick={() => {
            onEditSlidePath(slideRelPath)
          }}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          编辑幻灯片
        </Button>
      )}
    </>
  )
}

function PageOrderButtons({
  activeIndex,
  totalCount,
  onMoveImagePage,
}: Readonly<{
  activeIndex: number
  totalCount: number
  onMoveImagePage?: ((direction: 'left' | 'right') => void) | undefined
}>) {
  if (onMoveImagePage === undefined) return null
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="当前页左移"
        disabled={activeIndex <= 0}
        className="h-8 w-8 border-slate-200/90 bg-white p-0 text-slate-600 shadow-2xs hover:bg-slate-50"
        onClick={() => {
          onMoveImagePage('left')
        }}
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="当前页右移"
        disabled={activeIndex >= totalCount - 1}
        className="h-8 w-8 border-slate-200/90 bg-white p-0 text-slate-600 shadow-2xs hover:bg-slate-50"
        onClick={() => {
          onMoveImagePage('right')
        }}
      >
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </>
  )
}

export function ImagePageControls({
  content,
  onReplaceImagePage,
  onAddImagePages,
  onDeleteImagePage,
  onMoveImagePage,
  onCreateSlideForNode,
  onEditSlidePath,
}: Readonly<ImagePageControlsProps>) {
  const [pickerMode, setPickerMode] = useState<FilePoolImagePickerMode | null>(null)
  const items = resolveImageItems(content).filter((item) => item.src.trim() !== '')
  const hasImage = items.length > 0
  const activeIndex = hasImage ? Math.min(resolveActiveImageIndex(content), items.length - 1) : 0
  const activeAlt = items[activeIndex]?.alt ?? ''
  const activeSrc = items[activeIndex]?.src ?? ''
  const slideRelPath = isSlideSvgPath(activeSrc) ? normalizeInboxLookupPath(activeSrc) : null

  return (
    <div className="flex h-8 items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={PAGE_BTN_CLS}
        onClick={() => {
          setPickerMode('replace')
        }}
      >
        <ImagePlus className="size-4 text-primary" aria-hidden="true" />
        更换图片
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={PAGE_BTN_CLS}
        onClick={() => {
          setPickerMode('add')
        }}
      >
        <Plus className="size-4 text-primary" aria-hidden="true" />
        添加图片页
      </Button>
      <SlidePageButtons
        slideRelPath={slideRelPath}
        onCreateSlideForNode={onCreateSlideForNode}
        onEditSlidePath={onEditSlidePath}
      />
      <PageOrderButtons
        activeIndex={activeIndex}
        totalCount={items.length}
        onMoveImagePage={onMoveImagePage}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasImage}
        className={PAGE_BTN_CLS}
        onClick={onDeleteImagePage}
      >
        <Trash2 className="size-4 text-slate-500" aria-hidden="true" />
        删除当前页
      </Button>
      <span className="max-w-36 truncate text-xs text-slate-400">
        {hasImage ? `${activeIndex + 1}/${items.length} · ${activeAlt || '未命名图片'}` : '未选择图片'}
      </span>
      {pickerMode !== null && (
        <FilePoolImagePickerModal
          mode={pickerMode}
          onConfirmEntries={(entries) => {
            const mode = pickerMode
            setPickerMode(null)
            applyPickedPoolEntries(mode, entries, onReplaceImagePage, onAddImagePages)
          }}
          onClose={() => {
            setPickerMode(null)
          }}
        />
      )}
    </div>
  )
}