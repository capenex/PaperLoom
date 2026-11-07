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
    <label className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50/80 px-2.5 py-1 text-xs font-medium text-slate-600">
      <span className="shrink-0">预设字号</span>
      <select
        value={value}
        className="h-6 cursor-pointer rounded-md border border-slate-200/90 bg-white px-1.5 text-xs font-semibold text-slate-700 tabular-nums shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-primary"
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

/** 文档级预设：新增节点与未单独调整过的节点都按这里的字号和尺寸渲染 */
function DefaultsPresets({ defaults, onUpdateDefaults }: Readonly<DefaultsPresetsProps>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FontSizePreset
        value={defaults.fontSize}
        onChange={(fontSize) => {
          onUpdateDefaults({ fontSize })
        }}
      />
      <SizeSlider
        label="预设宽度"
        value={defaults.nodeWidth}
        min={MIN_NODE_WIDTH}
        max={MAX_NODE_WIDTH}
        onChange={(nodeWidth) => {
          onUpdateDefaults({ nodeWidth })
        }}
      />
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
  )
}

/** 未选中节点时的宏观操作区：新增根节点、设置文档级预设 */
export function DocumentToolbar({
  defaults,
  onAddRoot,
  onUpdateDefaults,
}: Readonly<DocumentToolbarProps>) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
        title="在现有内容下方新增一棵树的根节点"
        onClick={onAddRoot}
      >
        <Network className="text-primary" aria-hidden="true" />
        添加根节点
      </Button>

      <span className="hidden h-5 w-px bg-slate-200/80 sm:block" aria-hidden="true" />

      <DefaultsPresets defaults={defaults} onUpdateDefaults={onUpdateDefaults} />

      <span className="ml-auto hidden text-xs text-slate-400 2xl:block">
        按住 Alt 拖动节点：移动整棵树 · 挂到其他节点 · 拖到空白处脱离为新根
      </span>
    </div>
  )
}
