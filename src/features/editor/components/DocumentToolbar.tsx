import { Network } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import {
  FONT_SIZE_OPTIONS,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults } from '@/shared/types/paper'
import { SizeSlider } from './SizeSlider'

interface DocumentToolbarProps {
  readonly defaults: DocumentDefaults
  readonly onAddRoot: () => void
  readonly onUpdateDefaults: (patch: Partial<DocumentDefaults>) => void
}

interface DefaultsPresetsProps {
  readonly defaults: DocumentDefaults
  readonly onUpdateDefaults: (patch: Partial<DocumentDefaults>) => void
}

interface FontSizePresetProps {
  readonly value: number
  readonly onChange: (fontSize: number) => void
}

/** 预设字号：作用于所有没有单独设置字号的节点文字 */
function FontSizePreset({ value, onChange }: Readonly<FontSizePresetProps>) {
  return (
    <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[13px] font-medium text-slate-700 shadow-2xs">
      <span className="shrink-0">预设字号</span>
      <select
        value={value}
        className="h-6 cursor-pointer rounded border border-slate-200/90 bg-slate-50/70 px-1.5 text-xs font-semibold text-slate-700 tabular-nums outline-none transition-colors hover:border-slate-300 focus:border-primary"
        onChange={(event) => {
          const fontSize = Number(event.target.value)
          if (fontSize <= 0) return
          onChange(fontSize)
        }}
      >
        {FONT_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>
    </label>
  )
}

/** 文档级预设（双行布局）：第一行预设宽度+预设字号，第二行预设高度 */
export function DefaultsPresets({ defaults, onUpdateDefaults }: Readonly<DefaultsPresetsProps>) {
  return (
    <div className="flex h-[70px] flex-col justify-between gap-1.5">
      <div className="flex h-8 items-center gap-2">
        <SizeSlider
          label="预设宽度"
          value={defaults.nodeWidth}
          min={MIN_NODE_WIDTH}
          max={MAX_NODE_WIDTH}
          onChange={(nodeWidth) => {
            onUpdateDefaults({ nodeWidth })
          }}
        />
        <FontSizePreset
          value={defaults.fontSize}
          onChange={(fontSize) => {
            onUpdateDefaults({ fontSize })
          }}
        />
      </div>
      <div className="flex h-8 items-center gap-2">
        <SizeSlider
          label="预设高度"
          value={defaults.nodeHeight}
          min={MIN_NODE_HEIGHT}
          max={MAX_NODE_HEIGHT}
          onChange={(nodeHeight) => {
            onUpdateDefaults({ nodeHeight })
          }}
        />
      </div>
    </div>
  )
}

/** 未选中节点时的宏观操作区：新增根节点、设置文档级预设 */
export function DocumentToolbar({
  defaults,
  onAddRoot,
  onUpdateDefaults,
}: Readonly<DocumentToolbarProps>) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
        onClick={onAddRoot}
      >
        <Network className="size-4 text-primary" aria-hidden="true" />
        添加根节点
      </Button>
      <DefaultsPresets defaults={defaults} onUpdateDefaults={onUpdateDefaults} />
    </div>
  )
}
