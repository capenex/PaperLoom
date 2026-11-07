import { Check } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import type { TitleNodeContent } from '@/shared/types/paper'

interface TitleNodeEditorProps {
  readonly content: TitleNodeContent
  readonly fontSize: number
  readonly onChange: (title: string, subtitle: string) => void
  readonly onDone: () => void
}

/** 纯标题节点的编辑框：主标题与可选副标题 */
export function TitleNodeEditor({
  content,
  fontSize,
  onChange,
  onDone,
}: Readonly<TitleNodeEditorProps>) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center gap-1.5 rounded-xl border-2 border-primary bg-white px-3.5 py-2.5 shadow-lg">
      <div className="absolute -top-11 right-0 z-30 flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-[0_12px_28px_-6px_rgba(15,23,42,0.14)] backdrop-blur-md">
        <span className="px-1.5 text-xs font-medium text-slate-500">编辑纯标题</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-primary hover:bg-primary/10 hover:text-primary"
          aria-label="完成编辑"
          title="完成编辑（Esc）"
          onClick={onDone}
        >
          <Check aria-hidden="true" />
        </Button>
      </div>

      <input
        type="text"
        aria-label="主标题"
        placeholder="输入主标题…"
        value={content.title}
        style={{ fontSize: Math.round(fontSize * 1.15) }}
        className="w-full border-b border-slate-100 bg-transparent pb-1 text-center font-bold tracking-tight text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300 focus:border-primary"
        onChange={(event) => {
          onChange(event.target.value, content.subtitle)
        }}
      />

      <input
        type="text"
        aria-label="副标题"
        placeholder="输入副标题（可选）…"
        value={content.subtitle}
        style={{ fontSize: Math.max(12, Math.round(fontSize * 0.82)) }}
        className="w-full bg-transparent text-center text-slate-500 outline-none placeholder:text-slate-300"
        onChange={(event) => {
          onChange(content.title, event.target.value)
        }}
      />
    </div>
  )
}
