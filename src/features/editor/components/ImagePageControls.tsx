import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Pencil, Plus, Presentation, Trash2 } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { isSlideSvgPath, normalizeInboxLookupPath } from '@/shared/lib/inbox'
import { resolveActiveImageIndex, resolveImageItems } from '@/shared/lib/mediaPages'
import type { ImageNodeContent, ImageSlideItem } from '@/shared/types/paper'
import { INBOX_SAVE_FAILED, saveImageSlideToInbox } from '../lib/inboxUpload'

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

function ingestSlides(
  files: readonly File[],
  onSlides: (slides: readonly ImageSlideItem[]) => void,
): void {
  void Promise.all(files.map((file) => saveImageSlideToInbox(file)))
    .then(onSlides)
    .catch(() => {
      window.alert(INBOX_SAVE_FAILED)
    })
}

function useSlideFilePicking(
  onReplaceImagePage: (item: ImageSlideItem) => void,
  onAddImagePages: (items: readonly ImageSlideItem[]) => void,
) {
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const handleReplace = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (file === null) return
    ingestSlides([file], (slides) => {
      const slide = slides[0]
      if (slide !== undefined) onReplaceImagePage(slide)
    })
  }

  const handleAdd = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    ingestSlides(files, onAddImagePages)
  }

  return { replaceInputRef, addInputRef, handleReplace, handleAdd }
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
  const { replaceInputRef, addInputRef, handleReplace, handleAdd } = useSlideFilePicking(
    onReplaceImagePage,
    onAddImagePages,
  )
  const items = resolveImageItems(content)
  const activeIndex = resolveActiveImageIndex(content)
  const activeItem = items[activeIndex]
  const activeAlt = activeItem?.alt ?? ''
  const activeSrc = activeItem?.src ?? content.src
  const slideRelPath = isSlideSvgPath(activeSrc) ? normalizeInboxLookupPath(activeSrc) : null

  return (
    <div className="flex h-8 items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={PAGE_BTN_CLS}
        onClick={() => {
          replaceInputRef.current?.click()
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
          addInputRef.current?.click()
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
        disabled={items.length <= 1}
        className={PAGE_BTN_CLS}
        onClick={onDeleteImagePage}
      >
        <Trash2 className="size-4 text-slate-500" aria-hidden="true" />
        删除当前页
      </Button>
      <span className="max-w-36 truncate text-xs text-slate-400">
        {activeIndex + 1}/{items.length} · {activeAlt || '未命名图片'}
      </span>
      <input ref={replaceInputRef} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" className="hidden" onChange={handleReplace} />
      <input ref={addInputRef} type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" className="hidden" onChange={handleAdd} />
    </div>
  )
}
