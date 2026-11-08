import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { FileCode, FileText, Heading, Image, ImagePlus } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import type { NodeContent, StaticFileFormat, TitleNodeContent } from '@/shared/types/paper'
import { INBOX_SAVE_FAILED, saveImageFileToInbox } from '../lib/inboxUpload'
import { detectStaticFileFormat } from '../lib/staticMarkdown'

interface NodeTypeControlProps {
  readonly content: NodeContent
  readonly onChangeKind: (kind: NodeContent['kind']) => void
  readonly onUpdateTitle: (title: string, subtitle: string) => void
  readonly onPickImage: (src: string, alt: string) => void
  readonly onPickFile: (fileName: string, format: StaticFileFormat, text: string) => void
}

interface NodeKindButtonsProps {
  readonly kind: NodeContent['kind']
  readonly onChangeKind: (kind: NodeContent['kind']) => void
}

interface ReplaceImageButtonProps {
  readonly onPickImage: (src: string, alt: string) => void
}

interface PickStaticFileButtonProps {
  readonly onPickFile: (fileName: string, format: StaticFileFormat, text: string) => void
}

const STATIC_FILE_ACCEPT =
  '.md,.markdown,.mdx,.txt,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.c,.cpp,.h,.json,.yaml,.yml,.toml,.sh,.css,.html,.sql,.xml'

const NODE_KIND_ITEMS = [
  {
    value: 'text',
    label: '富文本',
    title: '切换为富文本节点（支持 Markdown 快捷语法与行内公式）',
    Icon: FileText,
  },
  {
    value: 'title',
    label: '纯标题',
    title: '切换为纯标题节点（专为触发事件设计，在顶部工具栏直接输入主副标题）',
    Icon: Heading,
  },
  {
    value: 'image',
    label: '多媒体',
    title: '切换为多媒体节点（展示图片，单击放大，再次点击查看详情）',
    Icon: Image,
  },
  {
    value: 'file',
    label: '静态文件',
    title: '切换为静态文件节点（仅静态展示源代码或 Markdown 文件，双击在右侧展开）',
    Icon: FileCode,
  },
] satisfies readonly {
  readonly value: NodeContent['kind']
  readonly label: string
  readonly title: string
  readonly Icon: typeof FileText
}[]

const TITLE_INPUT_CLS =
  'h-7 rounded-lg border border-slate-200/90 bg-white px-2.5 text-xs text-slate-800 shadow-2xs transition-colors outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20'

function NodeKindButtons({ kind, onChangeKind }: Readonly<NodeKindButtonsProps>) {
  return (
    <fieldset
      aria-label="节点类型"
      className="m-0 inline-flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-slate-100/90 p-0.5 shadow-inner"
    >
      {NODE_KIND_ITEMS.map(({ value, label, title, Icon }) => (
        <Button
          key={value}
          type="button"
          variant={kind === value ? 'default' : 'ghost'}
          size="xs"
          aria-pressed={kind === value}
          title={title}
          className={
            kind === value
              ? 'shadow-xs'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }
          onClick={() => {
            onChangeKind(value)
          }}
        >
          <Icon aria-hidden="true" />
          {label}
        </Button>
      ))}
    </fieldset>
  )
}

function InlineTitleInputs({
  content,
  onUpdateTitle,
}: Readonly<{
  content: TitleNodeContent
  onUpdateTitle: (title: string, subtitle: string) => void
}>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        aria-label="主标题"
        placeholder="输入主标题…"
        value={content.title}
        onChange={(event) => {
          onUpdateTitle(event.target.value, content.subtitle)
        }}
        className={`${TITLE_INPUT_CLS} w-32 font-semibold sm:w-36`}
      />
      <input
        type="text"
        aria-label="副标题"
        placeholder="输入副标题（可选）…"
        value={content.subtitle}
        onChange={(event) => {
          onUpdateTitle(content.title, event.target.value)
        }}
        className={`${TITLE_INPUT_CLS} w-36 text-slate-600 sm:w-44`}
      />
    </div>
  )
}

function ReplaceImageButton({ onPickImage }: Readonly<ReplaceImageButtonProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (file === null) return
    void saveImageFileToInbox(file)
      .then((content) => {
        onPickImage(content.src, content.alt)
      })
      .catch(() => {
        window.alert(INBOX_SAVE_FAILED)
      })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
        title="从本地选择图片替换当前多媒体节点内容"
        onClick={() => {
          fileInputRef.current?.click()
        }}
      >
        <ImagePlus className="text-primary" aria-hidden="true" />
        更换图片
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  )
}

function PickStaticFileButton({ onPickFile }: Readonly<PickStaticFileButtonProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (file === null) return
    const format = detectStaticFileFormat(file.name)
    void file.text().then((text) => {
      onPickFile(file.name, format, text)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
        title="选择本地源代码或 Markdown 文件进行静态展示"
        onClick={() => {
          fileInputRef.current?.click()
        }}
      >
        <FileCode className="text-primary" aria-hidden="true" />
        选择文件
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={STATIC_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  )
}

/** 节点操作栏中的节点类型切换（富文本 / 纯标题 / 多媒体 / 静态文件）、标题行内编辑及资源导入 */
export function NodeTypeControl({
  content,
  onChangeKind,
  onUpdateTitle,
  onPickImage,
  onPickFile,
}: Readonly<NodeTypeControlProps>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="hidden text-xs text-slate-500 2xl:inline">节点类型</span>
      <NodeKindButtons kind={content.kind} onChangeKind={onChangeKind} />
      {content.kind === 'title' && (
        <InlineTitleInputs content={content} onUpdateTitle={onUpdateTitle} />
      )}
      {content.kind === 'image' && <ReplaceImageButton onPickImage={onPickImage} />}
      {content.kind === 'file' && <PickStaticFileButton onPickFile={onPickFile} />}
    </div>
  )
}
