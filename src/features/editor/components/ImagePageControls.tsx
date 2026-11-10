import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { resolveActiveImageIndex, resolveImageItems } from '@/shared/lib/mediaPages'
import type { ImageNodeContent, ImageSlideItem } from '@/shared/types/paper'
import { INBOX_SAVE_FAILED, saveImageSlideToInbox } from '../lib/inboxUpload'

interface ImagePageControlsProps {
  readonly content: ImageNodeContent
  readonly onReplaceImagePage: (item: ImageSlideItem) => void
  readonly onAddImagePages: (items: readonly ImageSlideItem[]) => void
  readonly onDeleteImagePage: () => void
}

const PAGE_BTN_CLS =
  'h-8 border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50'

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

export function ImagePageControls({
  content,
  onReplaceImagePage,
  onAddImagePages,
  onDeleteImagePage,
}: Readonly<ImagePageControlsProps>) {
  const { replaceInputRef, addInputRef, handleReplace, handleAdd } = useSlideFilePicking(
    onReplaceImagePage,
    onAddImagePages,
  )
  const items = resolveImageItems(content)
  const activeIndex = resolveActiveImageIndex(content)
  const activeAlt = items[activeIndex]?.alt ?? ''

  return (
    <div className="flex h-8 items-center gap-2">
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
      <span className="max-w-48 truncate text-xs text-slate-400">
        {activeIndex + 1}/{items.length} · {activeAlt || '未命名图片'}
      </span>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleReplace}
      />
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleAdd}
      />
    </div>
  )
}
