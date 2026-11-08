/* eslint-disable react/iframe-missing-sandbox -- 引用的本地页面来自用户自己的文件，沙箱会让其中脚本失效 */
import type { DetailContent } from '../lib/detailContent'
import { renderStaticMarkdownHtml } from '../lib/staticMarkdown'
import { PdfDetailView } from './PdfDetailView'

interface DetailBodyProps {
  readonly detail: DetailContent
}

/** 详情正文：图片直接展示，静态文件只读展示，本地页面内嵌展示，PDF 用 pdf.js 定位到引用页 */
export function DetailBody({ detail }: Readonly<DetailBodyProps>) {
  if (detail.type === 'image') {
    return (
      <img
        src={detail.src}
        alt={detail.alt}
        draggable={false}
        className="h-full w-full select-none object-contain p-6"
      />
    )
  }
  if (detail.type === 'page') {
    return <iframe src={detail.src} title={detail.label} className="h-full w-full border-0 bg-white" />
  }
  if (detail.type === 'file') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-white text-slate-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-5 py-2.5">
          <span className="truncate font-mono text-xs font-semibold text-slate-800">
            {detail.fileName || '未命名文件'}
          </span>
          <span className="font-mono text-xs text-slate-400">
            · {detail.format === 'markdown' ? 'Markdown' : 'Source Code'}
          </span>
        </div>
        {detail.format === 'markdown' ? (
          <div
            className="node-rich-text min-h-0 flex-1 overflow-y-auto p-6 text-base leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: renderStaticMarkdownHtml(detail.text) }}
          />
        ) : (
          <pre className="m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-6 font-mono text-xs leading-relaxed text-slate-100">
            {detail.text}
          </pre>
        )}
      </div>
    )
  }
  return (
    <PdfDetailView
      key={`${detail.src}#${detail.page}`}
      src={detail.src}
      page={detail.page}
      label={detail.label}
    />
  )
}
