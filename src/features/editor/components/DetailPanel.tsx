import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'

import type { DetailContent } from '../lib/detailContent'
import { DetailBody } from './DetailBody'
import { DetailResizeHandle } from './DetailResizeHandle'

interface DetailPanelProps {
  readonly detail: DetailContent
  readonly onCollapse: () => void
}

const DEFAULT_WIDTH_PERCENT = 40

/** 左侧详情面板：图片大图、PDF、静态文件与网页统一在可拖拽宽度的左栏中展示 */
export function DetailPanel({ detail, onCollapse }: Readonly<DetailPanelProps>) {
  const [widthPercent, setWidthPercent] = useState(DEFAULT_WIDTH_PERCENT)

  return (
    <aside
      aria-label="引用详情"
      className="relative z-20 flex shrink-0 items-center justify-center bg-[#fbfcfe]/85 p-3 pr-2 backdrop-blur-xs"
      style={{ width: `${widthPercent}%` }}
    >
      <DetailResizeHandle widthPercent={widthPercent} onWidthPercentChange={setWidthPercent} />

      <button
        type="button"
        aria-label="收起左侧详情"
        title="收起左侧详情"
        className="absolute top-1/2 right-2 z-20 flex size-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-md transition-all hover:scale-105 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        onClick={onCollapse}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>

      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.12),0_2px_6px_-1px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5">
        <DetailBody detail={detail} />
      </div>
    </aside>
  )
}
