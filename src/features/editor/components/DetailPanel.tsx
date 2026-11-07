import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

import type { DetailContent } from '../lib/detailContent'
import { DetailBody } from './DetailBody'
import { DetailResizeHandle } from './DetailResizeHandle'

interface DetailPanelProps {
  readonly detail: DetailContent
  readonly onCollapse: () => void
}

const DEFAULT_WIDTH_PERCENT = 40

/** 右侧详情面板：分界线可左右拖动，横向范围 30%-70% */
export function DetailPanel({ detail, onCollapse }: Readonly<DetailPanelProps>) {
  const [widthPercent, setWidthPercent] = useState(DEFAULT_WIDTH_PERCENT)

  return (
    <aside
      aria-label="引用详情"
      className="relative flex shrink-0 items-center justify-center border-l border-slate-800 bg-slate-950"
      style={{ width: `${widthPercent}%` }}
    >
      <DetailResizeHandle widthPercent={widthPercent} onWidthPercentChange={setWidthPercent} />

      <button
        type="button"
        aria-label="收起右侧详情"
        title="收起右侧详情"
        className="absolute left-0 top-1/2 z-20 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 shadow-lg transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onCollapse}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>

      <DetailBody detail={detail} />
    </aside>
  )
}
