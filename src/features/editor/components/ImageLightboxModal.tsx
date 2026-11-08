import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ImageLightboxModalProps {
  readonly src: string
  readonly alt: string
  readonly onClose: () => void
}

function CloseModalButton({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <button
      type="button"
      aria-label="关闭图片弹窗"
      title="关闭 (Esc)"
      onClick={onClose}
      className="absolute top-4 right-4 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}

/** 现代化图片详情弹窗：圆角白底卡片，尺寸自适应图片真实宽高比，取代原本的大黑框侧边栏 */
export function ImageLightboxModal({ src, alt, onClose }: Readonly<ImageLightboxModalProps>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const caption = alt.trim()
  const dialogLabel = caption === '' ? '图片详情预览' : `图片详情：${caption}`

  return (
    <dialog
      open
      aria-label={dialogLabel}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-6"
    >
      <button
        type="button"
        aria-label="点击背景关闭图片弹窗"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-slate-900/25 backdrop-blur-[2px]"
      />
      <div className="relative z-10 inline-flex max-h-[88vh] max-w-[88vw] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.28)] ring-1 ring-black/5 backdrop-blur-md">
        <CloseModalButton onClose={onClose} />
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="block h-auto max-h-[80vh] w-auto max-w-[84vw] rounded-xl bg-slate-50/60 object-contain select-none"
        />
        {caption !== '' && (
          <div className="mt-2 flex items-center justify-between px-2 pb-0.5 text-xs text-slate-500">
            <span className="truncate font-medium text-slate-700">{caption}</span>
            <span className="ml-4 shrink-0 text-[11px] text-slate-400">按 Esc 或点击空白处关闭</span>
          </div>
        )}
      </div>
    </dialog>
  )
}
