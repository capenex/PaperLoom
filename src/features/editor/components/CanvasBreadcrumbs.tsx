import { useEffect } from 'react'
import { ArrowLeft, GitBranch } from 'lucide-react'

import type { BreadcrumbItem, CanvasId } from '@/shared/types/paper'

interface CanvasBreadcrumbsProps {
  readonly breadcrumbs: readonly BreadcrumbItem[]
  readonly canPopWithEscape: boolean
  readonly onNavigate: (canvasId: CanvasId | null) => void
  readonly onPop: () => void
}

function BreadcrumbButton({
  crumb,
  index,
  isLast,
  onNavigate,
}: Readonly<{
  crumb: BreadcrumbItem
  index: number
  isLast: boolean
  onNavigate: (canvasId: CanvasId | null) => void
}>) {
  return (
    <div className="flex items-center gap-1">
      {index > 0 && <span className="text-slate-300">/</span>}
      <button
        type="button"
        disabled={isLast}
        onClick={() => {
          onNavigate(crumb.canvasId)
        }}
        className={
          isLast
            ? 'inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary'
            : 'cursor-pointer rounded-md px-1.5 py-0.5 font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800'
        }
      >
        {index > 0 && <GitBranch className="size-3" aria-hidden="true" />}
        <span>{crumb.label}</span>
      </button>
    </div>
  )
}

/** 支线子画布左上角悬浮面包屑导航栏：支持点击任意层级跳转或按 Esc 返回上一级画布 */
export function CanvasBreadcrumbs({
  breadcrumbs,
  canPopWithEscape,
  onNavigate,
  onPop,
}: Readonly<CanvasBreadcrumbsProps>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (breadcrumbs.length === 0 || !canPopWithEscape || event.key !== 'Escape') return
      event.preventDefault()
      onPop()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [breadcrumbs.length, canPopWithEscape, onPop])

  if (breadcrumbs.length === 0) return null

  return (
    <nav
      aria-label="画布层级导航"
      className="pointer-events-auto absolute top-3.5 left-4 z-30 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs shadow-[0_8px_24px_-4px_rgba(15,23,42,0.1)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onPop}
        title="返回上一级画布 (Esc)"
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        <span>返回上级</span>
      </button>
      <span className="mx-0.5 h-3.5 w-px bg-slate-200" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-1">
        {breadcrumbs.map((crumb, index) => (
          <BreadcrumbButton
            key={crumb.canvasId ?? 'main'}
            crumb={crumb}
            index={index}
            isLast={index === breadcrumbs.length - 1}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}
