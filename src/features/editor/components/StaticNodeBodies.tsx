import { GitBranch, Link2 } from 'lucide-react'

import type { FileNodeContent, TitleNodeContent } from '@/shared/types/paper'
import { renderStaticMarkdownHtml } from '../lib/staticMarkdown'

interface TitleNodeBodyProps {
  readonly content: TitleNodeContent
  readonly fontSize: number
}

interface FileNodeBodyProps {
  readonly content: FileNodeContent
  readonly fontSize: number
}

/** 节点右上角标识角标：提示已绑定支线画布，或当前为支线画布内的同源起点（默认双击返回上级画布） */
export function NodeBadge({
  hasSubCanvas,
  isHostRoot,
}: Readonly<{ hasSubCanvas: boolean; isHostRoot: boolean }>) {
  if (hasSubCanvas) {
    return (
      <span
        aria-label="已绑定支线画布，双击展开"
        className="pointer-events-none absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-md border border-primary/25 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-2xs backdrop-blur-xs"
      >
        <GitBranch className="size-2.5" aria-hidden="true" />
        <span>支线</span>
      </span>
    )
  }
  if (isHostRoot) {
    return (
      <span
        aria-label="与上级画布实时同步的同源起点节点，双击返回上级画布"
        className="pointer-events-none absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50/95 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 shadow-2xs backdrop-blur-xs"
      >
        <Link2 className="size-2.5" aria-hidden="true" />
        <span>同源起点</span>
      </span>
    )
  }
  return null
}

/** 纯标题节点正文：以默认样式居中展示主标题与可选副标题（在顶部工具栏中直接输入） */
export function TitleNodeBody({ content, fontSize }: Readonly<TitleNodeBodyProps>) {
  const title = content.title.trim()
  const subtitle = content.subtitle.trim()

  if (title === '' && subtitle === '') {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <span className="text-xs font-medium text-slate-400">空白标题</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden text-center">
      <span className="mb-2 h-1 w-7 shrink-0 rounded-full bg-primary/25" aria-hidden="true" />
      {title !== '' && (
        <div
          className="w-full truncate font-bold tracking-tight text-slate-900"
          style={{ fontSize: Math.round(fontSize * 1.15) }}
        >
          {title}
        </div>
      )}
      {subtitle !== '' && (
        <div
          className="mt-1 line-clamp-2 w-full leading-snug text-slate-500"
          style={{ fontSize: Math.max(12, Math.round(fontSize * 0.82)) }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

/** 静态文件节点正文：顶部展示文件名与类型标签，下方只读展示源代码或 Markdown */
export function FileNodeBody({ content, fontSize }: Readonly<FileNodeBodyProps>) {
  const badge = content.format === 'markdown' ? 'MD' : 'CODE'

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50/60">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-100/90 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] font-semibold text-slate-700">
          {content.fileName || '未命名文件'}
        </span>
        <span className="shrink-0 font-mono text-[10px] font-medium text-slate-400">
          · {badge}
        </span>
      </div>

      {content.format === 'markdown' ? (
        <div
          className="node-rich-text min-h-0 flex-1 overflow-hidden px-3 py-2 leading-relaxed text-slate-600"
          style={{ fontSize: Math.max(12, Math.round(fontSize * 0.85)) }}
          dangerouslySetInnerHTML={{ __html: renderStaticMarkdownHtml(content.text) }}
        />
      ) : (
        <pre
          className="m-0 min-h-0 flex-1 overflow-hidden px-3 py-2 font-mono leading-snug break-all whitespace-pre-wrap text-slate-700"
          style={{ fontSize: Math.max(11, Math.round(fontSize * 0.78)) }}
        >
          {content.text}
        </pre>
      )}
    </div>
  )
}
