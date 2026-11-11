import type { ChangeEvent } from "react"
import {
  Bold,
  Eraser,
  FilePlus2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Underline,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
  SelectMenu,
  type SelectMenuOption,
} from "@/shared/components/ui/select-menu"
import { FONT_SIZE_OPTIONS } from "@/shared/lib/nodeDefaults"
import type { PaperReference } from "@/shared/types/paper"
import { LinkControl } from "./LinkControl"
import { ReferenceControl } from "./ReferenceControl"

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
  { command: "bold", label: "加粗", icon: Bold },
  { command: "italic", label: "斜体", icon: Italic },
  { command: "underline", label: "下划线", icon: Underline },
  { command: "strikeThrough", label: "删除线", icon: Strikethrough },
  { command: "insertUnorderedList", label: "无序列表", icon: List },
  { command: "insertOrderedList", label: "有序列表", icon: ListOrdered },
]

const FONT_SIZE_MENU_OPTIONS: readonly SelectMenuOption[] =
  FONT_SIZE_OPTIONS.map((size) => ({
    value: String(size),
    label: `${size}px`,
  }))

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
}

function FormatButton({
  command,
  label,
  icon: Icon,
  onCommand,
}: Readonly<FormatButtonProps>) {
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
        onClick={(event) => {
          onCommand(command, event.currentTarget.value)
        }}
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
  return (
    <SelectMenu
      ariaLabel="字号"
      title="字号"
      value=""
      placeholder="字号"
      options={FONT_SIZE_MENU_OPTIONS}
      preserveSelectionOnMouseDown={true}
      triggerClassName="h-6 bg-white px-2 text-xs font-medium text-slate-600 tabular-nums"
      contentClassName="w-24"
      onValueChange={(nextValue) => {
        const size = Number(nextValue)
        if (size <= 0) return
        onFontSize(size)
      }}
    />
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

      <ToolbarDivider />
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label="新建页"
        title="新建页（插入 --- 分隔线）"
        className="h-6 gap-1 px-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        onClick={() => {
          onCommand("insertPageBreak")
        }}
      >
        <FilePlus2 className="size-3.5 text-primary" aria-hidden="true" />
        新建页
      </Button>
    </div>
  )
}
