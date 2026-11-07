interface SizeSliderProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
}

/** 带数值回显的尺寸滑块；节点尺寸与文档预设共用同一套控件 */
export function SizeSlider({ label, value, min, max, onChange }: Readonly<SizeSliderProps>) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50/80 px-2 py-1 text-xs font-medium text-slate-600">
      <span className="shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={8}
        value={value}
        className="w-16 cursor-pointer accent-primary"
        onChange={(event) => {
          onChange(Number(event.target.value))
        }}
      />
      <span className="w-10 shrink-0 text-right font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
        {value}px
      </span>
    </label>
  )
}
