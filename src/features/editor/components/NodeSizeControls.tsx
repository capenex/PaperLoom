import {
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'

interface NodeSizeControlsProps {
  readonly width: number
  readonly height: number
  readonly onWidthChange: (width: number) => void
  readonly onHeightChange: (height: number) => void
}

interface SizeFieldProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
}

function SizeField({ label, value, min, max, onChange }: Readonly<SizeFieldProps>) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={8}
        value={value}
        className="w-24 cursor-pointer accent-primary"
        onChange={(event) => {
          onChange(Number(event.target.value))
        }}
      />
      <span className="w-10 shrink-0 text-right font-medium text-slate-600 tabular-nums">
        {value}px
      </span>
    </label>
  )
}

export function NodeSizeControls({
  width,
  height,
  onWidthChange,
  onHeightChange,
}: Readonly<NodeSizeControlsProps>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SizeField
        label="宽度"
        value={width}
        min={MIN_NODE_WIDTH}
        max={MAX_NODE_WIDTH}
        onChange={onWidthChange}
      />
      <SizeField
        label="高度"
        value={height}
        min={MIN_NODE_HEIGHT}
        max={MAX_NODE_HEIGHT}
        onChange={onHeightChange}
      />
    </div>
  )
}
