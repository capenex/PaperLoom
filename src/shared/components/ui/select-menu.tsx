import { useState } from "react"
import type { MouseEvent } from "react"
import { Check, ChevronDown, Star } from "lucide-react"
import { Popover } from "radix-ui"
import { cn } from "cn"

export interface SelectMenuOption<T extends string = string> {
  readonly value: T
  readonly label: string
  readonly triggerLabel?: string
  readonly prefixTag?: string
  readonly badge?: string
  readonly starred?: boolean
}

export interface SelectMenuGroup<T extends string = string> {
  readonly label: string
  readonly options: readonly SelectMenuOption<T>[]
}

export interface SelectMenuProps<T extends string = string> {
  readonly value: T
  readonly onValueChange: (value: T) => void
  readonly options?: readonly SelectMenuOption<T>[]
  readonly groups?: readonly SelectMenuGroup<T>[]
  readonly placeholder?: string
  readonly ariaLabel?: string
  readonly title?: string
  readonly disabled?: boolean
  readonly triggerClassName?: string
  readonly contentClassName?: string
  readonly preserveSelectionOnMouseDown?: boolean
}

function flattenOptions<T extends string>(
  options: readonly SelectMenuOption<T>[] | undefined,
  groups: readonly SelectMenuGroup<T>[] | undefined,
): readonly SelectMenuOption<T>[] {
  if (groups !== undefined && groups.length > 0) {
    return groups.flatMap((group) => group.options)
  }
  return options ?? []
}

function preventIfRequested(
  event: MouseEvent<HTMLElement>,
  preserve: boolean | undefined,
): void {
  if (preserve === true) {
    event.preventDefault()
  }
}

function OptionItemRow<T extends string>({
  option,
  selected,
  preserveSelectionOnMouseDown,
  onSelect,
}: Readonly<{
  option: SelectMenuOption<T>
  selected: boolean
  preserveSelectionOnMouseDown: boolean | undefined
  onSelect: (value: T) => void
}>) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        preventIfRequested(event, preserveSelectionOnMouseDown)
      }}
      onClick={() => {
        onSelect(option.value)
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors outline-none",
        selected
          ? "bg-primary/10 font-semibold text-primary"
          : "font-medium text-slate-700 hover:bg-slate-100/90 hover:text-slate-950",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {option.starred === true && (
          <Star
            className="size-3 shrink-0 fill-amber-400 text-amber-500"
            aria-hidden="true"
          />
        )}
        {option.prefixTag !== undefined && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold",
              selected
                ? "bg-primary/15 text-primary"
                : "bg-slate-100 text-slate-500 group-hover:bg-white/90 group-hover:text-slate-600",
            )}
          >
            {option.prefixTag}
          </span>
        )}
        <span className="truncate">{option.label}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {option.badge !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums",
              selected
                ? "bg-primary/15 text-primary"
                : "bg-slate-100 text-slate-500 group-hover:bg-white",
            )}
          >
            {option.badge}
          </span>
        )}
        <Check
          className={cn(
            "size-3.5 shrink-0 transition-opacity",
            selected ? "text-primary opacity-100" : "opacity-0",
          )}
          aria-hidden="true"
        />
      </span>
    </button>
  )
}

function MenuOptionsBody<T extends string>({
  value,
  options,
  groups,
  preserveSelectionOnMouseDown,
  onSelect,
}: Readonly<{
  value: T
  options: readonly SelectMenuOption<T>[] | undefined
  groups: readonly SelectMenuGroup<T>[] | undefined
  preserveSelectionOnMouseDown: boolean | undefined
  onSelect: (value: T) => void
}>) {
  if (groups !== undefined && groups.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {groupIndex > 0 && <div className="my-0.5 h-px bg-slate-100" />}
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-slate-400 select-none">
              {group.label}
            </div>
            {group.options.map((option) => (
              <OptionItemRow
                key={option.value}
                option={option}
                selected={option.value === value}
                preserveSelectionOnMouseDown={preserveSelectionOnMouseDown}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {(options ?? []).map((option) => (
        <OptionItemRow
          key={option.value}
          option={option}
          selected={option.value === value}
          preserveSelectionOnMouseDown={preserveSelectionOnMouseDown}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function SelectTriggerContent<T extends string>({
  activeOption,
  displayLabel,
}: Readonly<{
  activeOption: SelectMenuOption<T> | undefined
  displayLabel: string
}>) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-1 truncate">
        {activeOption?.starred === true && (
          <Star
            className="size-3 shrink-0 fill-amber-400 text-amber-500"
            aria-hidden="true"
          />
        )}
        {activeOption?.prefixTag !== undefined && (
          <span className="shrink-0 rounded bg-slate-200/75 px-1 py-0.5 text-[10px] leading-none font-semibold text-slate-600 group-data-[state=open]:bg-primary/15 group-data-[state=open]:text-primary">
            {activeOption.prefixTag}
          </span>
        )}
        <span className="truncate">{displayLabel}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {activeOption?.badge !== undefined && (
          <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-slate-600 tabular-nums group-data-[state=open]:bg-primary/15 group-data-[state=open]:text-primary">
            {activeOption.badge}
          </span>
        )}
        <ChevronDown
          className="size-3.5 shrink-0 text-slate-400 transition-transform duration-150 group-hover:text-slate-600 group-data-[state=open]:rotate-180 group-data-[state=open]:text-primary"
          aria-hidden="true"
        />
      </span>
    </>
  )
}

export function SelectMenu<T extends string = string>({
  value,
  onValueChange,
  options,
  groups,
  placeholder = "请选择",
  ariaLabel,
  title,
  disabled = false,
  triggerClassName,
  contentClassName,
  preserveSelectionOnMouseDown,
}: Readonly<SelectMenuProps<T>>) {
  const [open, setOpen] = useState(false)
  const allOptions = flattenOptions(options, groups)
  const activeOption = allOptions.find((item) => item.value === value)
  const displayLabel =
    activeOption?.triggerLabel ?? activeOption?.label ?? placeholder

  return (
    <Popover.Root open={disabled ? false : open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          title={title ?? displayLabel}
          onMouseDown={(event) => {
            preventIfRequested(event, preserveSelectionOnMouseDown)
          }}
          className={cn(
            "group inline-flex h-6 cursor-pointer items-center justify-between gap-1.5 rounded-md border border-slate-200/90 bg-slate-50/80 px-2 text-xs font-semibold text-slate-700 outline-none transition-all hover:border-slate-300 hover:bg-slate-100/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 data-[state=open]:border-primary/50 data-[state=open]:bg-primary/8 data-[state=open]:text-primary disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
          )}
        >
          <SelectTriggerContent
            activeOption={activeOption}
            displayLabel={displayLabel}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            if (preserveSelectionOnMouseDown === true) {
              event.preventDefault()
            }
          }}
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_14px_34px_-6px_rgba(15,23,42,0.16),0_4px_12px_-2px_rgba(15,23,42,0.08)] backdrop-blur-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            contentClassName,
          )}
        >
          <MenuOptionsBody
            value={value}
            options={options}
            groups={groups}
            preserveSelectionOnMouseDown={preserveSelectionOnMouseDown}
            onSelect={(nextValue) => {
              onValueChange(nextValue)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
