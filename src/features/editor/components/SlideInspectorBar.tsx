import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bold,
  Copy,
  FilePlus,
  Heading,
  Image as ImageIcon,
  Layers,
  Plus,
  Save,
  Square,
  Tag,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import type {
  SlideAspectPreset,
  SlideDocumentSpec,
  SlideElement,
} from '@/shared/types/slide'

interface SlideInspectorBarProps {
  readonly fileStem: string
  readonly folderPath: string
  readonly spec: SlideDocumentSpec
  readonly selectedElement: SlideElement | undefined
  readonly saving: boolean
  readonly onChangeFileStem: (stem: string) => void
  readonly onChangeAspect: (aspect: SlideAspectPreset) => void
  readonly onChangeBackground: (bg: string) => void
  readonly onAddText: (isHeading: boolean) => void
  readonly onAddShape: (shape: 'rounded' | 'pill') => void
  readonly onAddArrow: () => void
  readonly onTogglePoolPicker: () => void
  readonly onPickLocalImage: (file: File) => void
  readonly onUpdateSelected: (updater: (el: SlideElement) => SlideElement) => void
  readonly onReorderSelected: (direction: 'up' | 'down') => void
  readonly onDuplicateSelected: () => void
  readonly onDeleteSelected: () => void
  readonly onSaveOnly: () => void
  readonly onSaveAsNextPage: () => void
  readonly onSaveAndInsert: () => void
  readonly onClose: () => void
}

const ASPECT_OPTIONS: readonly SlideAspectPreset[] = ['16:9', '4:3', '1:1']

const BG_SWATCHES: readonly { readonly label: string; readonly value: string }[] = [
  { label: '纯白', value: '#ffffff' },
  { label: '浅灰', value: '#f8fafc' },
  { label: '暖米', value: '#fefce8' },
  { label: '淡蓝', value: '#eff6ff' },
  { label: '薄荷', value: '#f0fdf4' },
  { label: '深色', value: '#0f172a' },
]

const COLOR_SWATCHES: readonly string[] = [
  '#0f172a',
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#ffffff',
]

const FILL_SWATCHES: readonly string[] = [
  'transparent',
  '#f8fafc',
  'rgba(59, 130, 246, 0.14)',
  'rgba(239, 68, 68, 0.14)',
  'rgba(16, 185, 129, 0.14)',
  'rgba(245, 158, 11, 0.18)',
]

function TextAndFontControls({
  element,
  onUpdate,
}: Readonly<{
  element: SlideElement
  onUpdate: (updater: (el: SlideElement) => SlideElement) => void
}>) {
  if (element.kind !== 'text' && element.kind !== 'shape') return null
  return (
    <>
      <input
        type="text"
        aria-label="图层文字内容"
        value={element.text}
        placeholder="输入图层文字…"
        onChange={(e) => {
          const val = e.target.value
          onUpdate((curr) =>
            curr.kind === 'text' || curr.kind === 'shape' ? { ...curr, text: val } : curr,
          )
        }}
        className="h-7 w-40 rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-primary"
      />
      <button
        type="button"
        aria-label="减小字号"
        onClick={() => {
          onUpdate((curr) =>
            curr.kind === 'text' || curr.kind === 'shape'
              ? { ...curr, fontSize: Math.max(12, curr.fontSize - 2) }
              : curr,
          )
        }}
        className="h-7 cursor-pointer rounded border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50"
      >
        A-
      </button>
      <span className="text-xs font-medium text-slate-600">{element.fontSize}px</span>
      <button
        type="button"
        aria-label="增大字号"
        onClick={() => {
          onUpdate((curr) =>
            curr.kind === 'text' || curr.kind === 'shape'
              ? { ...curr, fontSize: Math.min(72, curr.fontSize + 2) }
              : curr,
          )
        }}
        className="h-7 cursor-pointer rounded border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50"
      >
        A+
      </button>
      {element.kind === 'text' && (
        <button
          type="button"
          aria-label="切换粗体"
          onClick={() => {
            onUpdate((curr) =>
              curr.kind === 'text'
                ? { ...curr, fontWeight: curr.fontWeight === 'bold' ? 'normal' : 'bold' }
                : curr,
            )
          }}
          className={cn(
            'inline-flex size-7 cursor-pointer items-center justify-center rounded border text-xs',
            element.fontWeight === 'bold'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-slate-600',
          )}
        >
          <Bold className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </>
  )
}

function ColorAndFillControls({
  element,
  onUpdate,
}: Readonly<{
  element: SlideElement
  onUpdate: (updater: (el: SlideElement) => SlideElement) => void
}>) {
  return (
    <>
      {(element.kind === 'text' || element.kind === 'shape' || element.kind === 'arrow') && (
        <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`颜色 ${swatch}`}
              onClick={() => {
                onUpdate((curr) => {
                  if (curr.kind === 'text') return { ...curr, color: swatch }
                  if (curr.kind === 'shape') return { ...curr, stroke: swatch, textColor: swatch }
                  if (curr.kind === 'arrow') return { ...curr, color: swatch }
                  return curr
                })
              }}
              style={{ backgroundColor: swatch }}
              className="size-4 cursor-pointer rounded-full border border-slate-300"
            />
          ))}
        </div>
      )}
      {(element.kind === 'text' || element.kind === 'shape') && (
        <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1">
          {FILL_SWATCHES.map((fill) => (
            <button
              key={fill}
              type="button"
              aria-label={`填充底色 ${fill}`}
              onClick={() => {
                onUpdate((curr) => {
                  if (curr.kind === 'text') {
                    return {
                      ...curr,
                      backgroundColor: fill,
                      borderColor: fill === 'transparent' ? 'transparent' : '#cbd5e1',
                    }
                  }
                  if (curr.kind === 'shape') return { ...curr, fill }
                  return curr
                })
              }}
              style={{ backgroundColor: fill === 'transparent' ? '#ffffff' : fill }}
              className={cn(
                'size-4 cursor-pointer rounded border border-slate-300',
                fill === 'transparent' &&
                  'relative after:absolute after:inset-0 after:rotate-45 after:border-t after:border-red-400',
              )}
            />
          ))}
        </div>
      )}
    </>
  )
}

function SelectedElementControls({
  element,
  onUpdate,
  onReorder,
  onDuplicate,
  onDelete,
}: Readonly<{
  element: SlideElement
  onUpdate: (updater: (el: SlideElement) => SlideElement) => void
  onReorder: (direction: 'up' | 'down') => void
  onDuplicate: () => void
  onDelete: () => void
}>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TextAndFontControls element={element} onUpdate={onUpdate} />
      <ColorAndFillControls element={element} onUpdate={onUpdate} />
      {(element.kind === 'shape' || element.kind === 'arrow') && (
        <button
          type="button"
          onClick={() => {
            onUpdate((curr) =>
              curr.kind === 'shape' || curr.kind === 'arrow'
                ? { ...curr, dashed: !curr.dashed }
                : curr,
            )
          }}
          className={cn(
            'h-7 cursor-pointer rounded border px-2 text-xs',
            element.dashed
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-slate-600',
          )}
        >
          虚线
        </button>
      )}
      <button
        type="button"
        aria-label="上移一层"
        onClick={() => {
          onReorder('up')
        }}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <ArrowUp className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="下移一层"
        onClick={() => {
          onReorder('down')
        }}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <ArrowDown className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="复制图层"
        onClick={onDuplicate}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <Copy className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="删除图层"
        onClick={onDelete}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function SlideTopHeaderRow(props: Readonly<SlideInspectorBarProps>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
          PPT 伪图片画板
        </span>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
          {props.folderPath !== '' && (
            <span className="mr-1 text-xs text-slate-400">{props.folderPath}/</span>
          )}
          <input
            type="text"
            aria-label="幻灯片文件名"
            value={props.fileStem}
            onChange={(e) => {
              props.onChangeFileStem(e.target.value)
            }}
            className="w-40 bg-transparent text-xs font-semibold text-slate-800 outline-none"
          />
          <span className="text-xs text-slate-400">.slide.svg</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          {ASPECT_OPTIONS.map((aspect) => (
            <button
              key={aspect}
              type="button"
              onClick={() => {
                props.onChangeAspect(aspect)
              }}
              className={cn(
                'cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors',
                props.spec.aspect === aspect
                  ? 'bg-white text-primary shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {aspect}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
          <span className="text-[11px] text-slate-400">底色</span>
          {BG_SWATCHES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-label={`画板底色 ${item.label}`}
              onClick={() => {
                props.onChangeBackground(item.value)
              }}
              style={{ backgroundColor: item.value }}
              className={cn(
                'size-4 cursor-pointer rounded-full border border-slate-300',
                props.spec.background === item.value && 'ring-2 ring-primary ring-offset-1',
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" disabled={props.saving} className="h-8 bg-white px-3 text-xs" onClick={props.onSaveOnly}>
          <Save className="size-3.5 text-primary" aria-hidden="true" />
          保存到文件池
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={props.saving} className="h-8 bg-white px-3 text-xs" onClick={props.onSaveAsNextPage}>
          <FilePlus className="size-3.5 text-primary" aria-hidden="true" />
          另存为下一页
        </Button>
        <Button type="button" size="sm" disabled={props.saving} className="h-8 px-3 text-xs" onClick={props.onSaveAndInsert}>
          <Plus className="size-3.5" aria-hidden="true" />
          保存并插入画布
        </Button>
        <button
          type="button"
          aria-label="关闭幻灯片画板"
          onClick={props.onClose}
          className="ml-1 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function AddLayerButtonsBar({
  onAddText,
  onTogglePoolPicker,
  onTriggerLocalImage,
  onAddShape,
  onAddArrow,
}: Readonly<{
  onAddText: (isHeading: boolean) => void
  onTogglePoolPicker: () => void
  onTriggerLocalImage: () => void
  onAddShape: (shape: 'rounded' | 'pill') => void
  onAddArrow: () => void
}>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={() => {
          onAddText(true)
        }}
      >
        <Heading className="size-3.5 text-primary" aria-hidden="true" />+ 标题
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={() => {
          onAddText(false)
        }}
      >
        <Type className="size-3.5 text-primary" aria-hidden="true" />+ 文本框
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={onTogglePoolPicker}
      >
        <Layers className="size-3.5 text-primary" aria-hidden="true" />+ 文件池图片
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={onTriggerLocalImage}
      >
        <ImageIcon className="size-3.5 text-primary" aria-hidden="true" />+ 本地图片
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={() => {
          onAddShape('rounded')
        }}
      >
        <Square className="size-3.5 text-blue-600" aria-hidden="true" />+ 高亮框
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={() => {
          onAddShape('pill')
        }}
      >
        <Tag className="size-3.5 text-emerald-600" aria-hidden="true" />+ 胶囊标签
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-white px-2.5 text-xs"
        onClick={onAddArrow}
      >
        <ArrowUpRight className="size-3.5 text-rose-600" aria-hidden="true" />+ 指示箭头
      </Button>
    </div>
  )
}

export function SlideInspectorBar(props: Readonly<SlideInspectorBarProps>) {
  const localImgInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (file !== null) props.onPickLocalImage(file)
  }

  return (
    <div className="flex flex-col border-b border-slate-200 bg-slate-50/90">
      <SlideTopHeaderRow {...props} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <AddLayerButtonsBar
          onAddText={props.onAddText}
          onTogglePoolPicker={props.onTogglePoolPicker}
          onTriggerLocalImage={() => {
            localImgInputRef.current?.click()
          }}
          onAddShape={props.onAddShape}
          onAddArrow={props.onAddArrow}
        />
        {props.selectedElement !== undefined && (
          <SelectedElementControls
            element={props.selectedElement}
            onUpdate={props.onUpdateSelected}
            onReorder={props.onReorderSelected}
            onDuplicate={props.onDuplicateSelected}
            onDelete={props.onDeleteSelected}
          />
        )}
      </div>
      <input ref={localImgInputRef} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
