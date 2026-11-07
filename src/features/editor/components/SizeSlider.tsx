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
