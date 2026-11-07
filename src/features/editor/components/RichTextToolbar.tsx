import { useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Bold,
  Eraser,
  Highlighter,
  Italic,
  List,
  Palette,
  Strikethrough,
  Underline,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { FONT_SIZE_OPTIONS } from '@/shared/lib/nodeDefaults'
import type { PaperReference } from '@/shared/types/paper'
import { LinkControl } from './LinkControl'
import { ReferenceControl } from './ReferenceControl'

interface RichTextToolbarProps {
  readonly onCommand: (command: string, value?: string) => void
  readonly onFontSize: (sizePx: number) => void
  readonly onLink: (url: string) => boolean
  readonly onReference: (reference: PaperReference) => void
}

interface ToolbarAction {
  readonly command: string
  readonly label: string
  readonly icon: LucideIcon
}

interface FormatButtonProps {
  readonly command: string
  readonly label: string
  readonly icon: LucideIcon
  readonly onCommand: (command: string) => void
}

interface ColorButtonProps {
  readonly label: string
  readonly command: string
  readonly defaultValue: string
  readonly icon: LucideIcon
  readonly onCommand: (command: string, value: string) => void
}

interface ColorControlsProps {
  readonly onCommand: (command: string, value: string) => void
}

interface FontSizeSelectProps {
  readonly onFontSize: (sizePx: number) => void
}

const TEXT_ACTIONS: readonly ToolbarAction[] = [
  { command: 'bold', label: '加粗', icon: Bold },
  { command: 'italic', label: '斜体', icon: Italic },
  { command: 'underline', label: '下划线', icon: Underline },
  { command: 'strikeThrough', label: '删除线', icon: Strikethrough },
  { command: 'insertUnorderedList', label: '无序列表', icon: List },
]

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
}

function FormatButton({ command, label, icon: Icon, onCommand }: Readonly<FormatButtonProps>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={() => {
        onCommand(command)
      }}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}

function ColorButton({
  label,
  command,
  defaultValue,
  icon: Icon,
  onCommand,
}: Readonly<ColorButtonProps>) {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onCommand(command, event.target.value)
  }

  return (
    <label
      className="relative flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-accent"
      title={label}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <input
        type="color"
        aria-label={label}
        defaultValue={defaultValue}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={handleChange}
      />
    </label>
  )
}

function ColorControls({ onCommand }: Readonly<ColorControlsProps>) {
  return (
    <>
      <ColorButton
        label="文字颜色"
        command="foreColor"
        defaultValue="#7c3aed"
        icon={Palette}
        onCommand={onCommand}
      />
      <ColorButton
        label="高亮颜色"
        command="hiliteColor"
        defaultValue="#fef08a"
        icon={Highlighter}
        onCommand={onCommand}
      />
    </>
  )
}

function FontSizeSelect({ onFontSize }: Readonly<FontSizeSelectProps>) {
  const [value, setValue] = useState('')

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const size = Number(event.target.value)
    setValue('')
    if (size <= 0) return
    onFontSize(size)
  }

  return (
    <select
      aria-label="字号"
      title="字号"
      value={value}
      className="h-6 rounded-md border border-slate-200 bg-white px-1 text-xs text-slate-600 outline-none focus:border-primary"
      onChange={handleChange}
    >
      <option value="">字号</option>
      {FONT_SIZE_OPTIONS.map((size) => (
        <option key={size} value={size}>
          {size}px
        </option>
      ))}
    </select>
  )
}

export function RichTextToolbar({
  onCommand,
  onFontSize,
  onLink,
  onReference,
}: Readonly<RichTextToolbarProps>) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
      {TEXT_ACTIONS.map((action) => (
        <FormatButton
          key={action.command}
          command={action.command}
          label={action.label}
          icon={action.icon}
          onCommand={onCommand}
        />
      ))}

      <ToolbarDivider />
      <FontSizeSelect onFontSize={onFontSize} />
      <ToolbarDivider />
      <ColorControls onCommand={onCommand} />
      <ToolbarDivider />
      <LinkControl onLink={onLink} />
      <ReferenceControl onReference={onReference} />

      <FormatButton
        command="removeFormat"
        label="清除格式"
        icon={Eraser}
        onCommand={onCommand}
      />
    </div>
  )
}
