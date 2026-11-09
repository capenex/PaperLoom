import { useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { cn } from 'cn'

interface SizeSliderProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly disabled?: boolean
  readonly onChange: (value: number) => void
}

function clampSize(raw: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(raw)))
}

/** 带滑块与手动数字输入的尺寸控件（高度 32px / h-8）；支持未选中节点时虚化禁用 */
export function SizeSlider({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: Readonly<SizeSliderProps>) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayValue = draft ?? String(value)

  function commitDraft(rawText: string): void {
    setDraft(null)
    if (disabled) return
    const trimmed = rawText.trim()
    if (trimmed === '') return
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return
    const next = clampSize(parsed, min, max)
    if (next !== value) {
      onChange(next)
    }
  }

  function handleNumberChange(event: ChangeEvent<HTMLInputElement>): void {
    if (disabled) return
    const nextText = event.target.value
    setDraft(nextText)
    const parsed = Number(nextText)
    if (nextText.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      onChange(Math.round(parsed))
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitDraft(event.currentTarget.value)
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(null)
      event.currentTarget.blur()
    }
  }

  return (
    <div
      className={cn(
        'flex h-8 items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[13px] font-medium text-slate-700 shadow-2xs',
        disabled && 'pointer-events-none opacity-45 select-none',
      )}
    >
      <span className="shrink-0 text-[13px]">{label}</span>
      <input
        type="range"
        aria-label={`${label}滑块`}
        min={min}
        max={max}
        step={8}
        disabled={disabled}
        value={value}
        className="w-20 cursor-pointer accent-primary disabled:cursor-not-allowed"
        onChange={(event) => {
          setDraft(null)
          onChange(Number(event.target.value))
        }}
      />
      <div className="flex items-center gap-1">
        <input
          type="number"
          aria-label={`${label}数值`}
          min={min}
          max={max}
          disabled={disabled}
          value={displayValue}
          className="h-6 w-14 rounded border border-slate-200/90 bg-slate-50/70 px-1.5 text-right font-mono text-xs font-semibold text-slate-700 tabular-nums outline-none focus:border-primary focus:bg-white disabled:cursor-not-allowed"
          onFocus={(event) => {
            setDraft(String(value))
            event.currentTarget.select()
          }}
          onChange={handleNumberChange}
          onBlur={(event) => {
            commitDraft(event.currentTarget.value)
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="text-xs text-slate-400">px</span>
      </div>
    </div>
  )
}
