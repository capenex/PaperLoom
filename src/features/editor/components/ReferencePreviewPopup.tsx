import { useEffect } from 'react'

import type { PaperReference } from '@/shared/types/paper'
import type { ReferencePreview } from '../lib/referencePreview'

interface ReferencePreviewPopupProps {
  readonly preview: ReferencePreview
  readonly onOpenDetail: () => void
  readonly onDoubleClickDetail?: (() => void) | undefined
  readonly onClose: () => void
}

const POPUP_WIDTH = 360

function kindTag(reference: PaperReference): string {
  if (reference.kind === 'pdf') {
    return reference.page === undefined ? 'PDF' : `PDF · 第 ${reference.page} 页`
  }
  return reference.kind === 'page' ? '页面' : '图片'
}

function PreviewBody({ reference }: Readonly<{ reference: PaperReference }>) {
  if (reference.kind === 'page') {
    return (
      <div className="h-52 overflow-hidden bg-white">
        <iframe
          src={reference.src}
          title={reference.label}
          tabIndex={-1}
          aria-hidden="true"
          sandbox="allow-same-origin"
          className="pointer-events-none origin-top-left scale-[0.36] border-0 bg-white"
          style={{ width: 1000, height: 700 }}
        />
      </div>
    )
  }

  const src = reference.kind === 'pdf' ? reference.previewSrc : reference.src
  if (src === undefined) {
    return <div className="flex h-32 items-center justify-center text-xs text-slate-400">无预览图</div>
  }

  return (
    <img
      src={src}
      alt={reference.label}
      draggable={false}
      className="mx-auto block max-h-60 w-auto select-none object-contain"
    />
  )
}

/** 单击引用锚点后的预览弹窗：再点击弹窗内容进入右侧详情 */
export function ReferencePreviewPopup(props: Readonly<ReferencePreviewPopupProps>) {
  const { preview, onOpenDetail, onDoubleClickDetail, onClose } = props
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const { reference } = preview
  return (
    <dialog
      open
      aria-label={`引用预览：${reference.label}`}
      className="fixed z-40 m-0 max-h-none max-w-none overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl outline-none"
      style={{ left: preview.x, top: preview.y, width: POPUP_WIDTH }}
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
          {reference.label}
        </span>
        <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
          {kindTag(reference)}
        </span>
      </header>
      <button
        type="button"
        title="触发预览小窗绑定事件（默认在右侧展开）"
        className="block w-full cursor-pointer bg-slate-50 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onOpenDetail}
        onDoubleClick={onDoubleClickDetail}
      >
        <PreviewBody reference={reference} />
      </button>
      <footer className="px-3 py-1.5 text-[11px] text-slate-400">
        {reference.kind === 'pdf'
          ? '点击触发小窗事件（默认右侧展开） · 可在「⚡ 事件」中自定义'
          : '点击在右侧展开 · 可在「⚡ 事件」中自定义'}
      </footer>
    </dialog>
  )
}
