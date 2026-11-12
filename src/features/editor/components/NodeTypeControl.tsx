import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { FileCode, FileText, Heading, Image, Pencil } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import type { ImageSlideItem, NodeContent, StaticFileFormat } from '@/shared/types/paper'
import { detectStaticFileFormat } from '../lib/staticMarkdown'
import { ImagePageControls } from './ImagePageControls'

interface NodeTypeControlProps {
  readonly content: NodeContent | undefined
  readonly onChangeKind: (kind: NodeContent['kind']) => void
  readonly onUpdateTitle: (title: string, subtitle: string) => void
  readonly onReplaceImagePage: (item: ImageSlideItem) => void
  readonly onAddImagePages: (items: readonly ImageSlideItem[]) => void
  readonly onDeleteImagePage: () => void
  readonly onMoveImagePage?: ((direction: 'left' | 'right') => void) | undefined
  readonly onCreateSlideForNode?: (() => void) | undefined
  readonly onEditSlidePath?: ((relPath: string) => void) | undefined
  readonly onPickFile: (fileName: string, format: StaticFileFormat, text: string) => void
  readonly onEditText?: (() => void) | undefined
}

interface NodeKindButtonsProps {
  readonly kind: NodeContent['kind'] | undefined
  readonly disabled: boolean
  readonly onChangeKind: (kind: NodeContent['kind']) => void
}

interface PickStaticFileButtonProps {
  readonly fileName: string
  readonly onPickFile: (fileName: string, format: StaticFileFormat, text: string) => void
}

const STATIC_FILE_ACCEPT =
  '.md,.markdown,.mdx,.txt,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.c,.cpp,.h,.json,.yaml,.yml,.toml,.sh,.css,.html,.sql,.xml'

const NODE_KIND_ITEMS = [
  {
    value: 'text',
    label: '富文本',
    Icon: FileText,
  },
  {
    value: 'title',
    label: '纯标题',
    Icon: Heading,
  },
  {
    value: 'image',
    label: '多媒体',
    Icon: Image,
  },
  {
    value: 'file',
    label: '静态文件',
    Icon: FileCode,
  },
] satisfies readonly {
  readonly value: NodeContent['kind']
  readonly label: string
  readonly Icon: typeof FileText
}[]

const TITLE_INPUT_CLS =
  'h-8 rounded-md border border-slate-200/90 bg-white px-2.5 text-[13px] text-slate-800 shadow-2xs transition-colors outline-none placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100/70 disabled:opacity-45'

function NodeKindButtons({ kind, disabled, onChangeKind }: Readonly<NodeKindButtonsProps>) {
  return (
    <fieldset
      aria-label="节点类型"
      disabled={disabled}
      className={cn(
        'm-0 inline-flex h-8 w-fit items-center gap-0.5 self-start rounded-lg border border-slate-200/80 bg-slate-100/90 p-0.5 shadow-inner',
        disabled && 'opacity-45',
      )}
    >
      {NODE_KIND_ITEMS.map(({ value, label, Icon }) => {
        const isCurrent = !disabled && kind === value
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={isCurrent}
            onClick={() => {
              onChangeKind(value)
            }}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
              isCurrent
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/75 hover:text-slate-900',
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        )
      })}
    </fieldset>
  )
}

function InlineTitleInputs({
  title,
  subtitle,
  disabled,
  onUpdateTitle,
}: Readonly<{
  title: string
  subtitle: string
  disabled: boolean
  onUpdateTitle: (title: string, subtitle: string) => void
}>) {
  return (
    <div className="flex h-8 items-center gap-1.5">
      <input
        type="text"
        aria-label="主标题"
        disabled={disabled}
        placeholder="输入主标题…"
        value={title}
        onChange={(event) => {
          onUpdateTitle(event.target.value, subtitle)
        }}
        className={`${TITLE_INPUT_CLS} w-36 font-semibold`}
      />
      <input
        type="text"
        aria-label="副标题"
        disabled={disabled}
        placeholder="输入副标题（可选）…"
        value={subtitle}
        onChange={(event) => {
          onUpdateTitle(title, event.target.value)
        }}
        className={`${TITLE_INPUT_CLS} w-44 text-slate-600`}
      />
    </div>
  )
}

function PickStaticFileButton({ fileName, onPickFile }: Readonly<PickStaticFileButtonProps>) {
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
    <div className="flex h-8 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50"
        onClick={() => {
          fileInputRef.current?.click()
        }}
      >
        <FileCode className="size-4 text-primary" aria-hidden="true" />
        选择文件
      </Button>
      <span className="max-w-44 truncate text-xs text-slate-400">
        {fileName || '未选择文件'}
      </span>
      <input
        ref={fileInputRef}
        type="file"
        accept={STATIC_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

/** 节点类型与内容编辑区（上下两行结构：第一行节点类型选择，第二行标题输入/正文编辑/媒体替换） */
export function NodeTypeControl({
  content,
  onChangeKind,
  onUpdateTitle,
  onReplaceImagePage,
  onAddImagePages,
  onDeleteImagePage,
  onMoveImagePage,
  onCreateSlideForNode,
  onEditSlidePath,
  onPickFile,
  onEditText,
}: Readonly<NodeTypeControlProps>) {
  const disabled = content === undefined

  return (
    <div className="flex h-[70px] flex-col items-start justify-between gap-1.5">
      <NodeKindButtons
        kind={content?.kind}
        disabled={disabled}
        onChangeKind={onChangeKind}
      />
      {content === undefined && (
        <InlineTitleInputs
          title=""
          subtitle=""
          disabled
          onUpdateTitle={onUpdateTitle}
        />
      )}
      {content?.kind === 'title' && (
        <InlineTitleInputs
          title={content.title}
          subtitle={content.subtitle}
          disabled={false}
          onUpdateTitle={onUpdateTitle}
        />
      )}
      {content?.kind === 'text' && (
        <div className="flex h-8 items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50"
            onClick={onEditText}
          >
            <Pencil className="size-4 text-primary" aria-hidden="true" />
            编辑正文
          </Button>
        </div>
      )}
      {content?.kind === 'image' && (
        <ImagePageControls
          content={content}
          onReplaceImagePage={onReplaceImagePage}
          onAddImagePages={onAddImagePages}
          onDeleteImagePage={onDeleteImagePage}
          onMoveImagePage={onMoveImagePage}
          onCreateSlideForNode={onCreateSlideForNode}
          onEditSlidePath={onEditSlidePath}
        />
      )}
      {content?.kind === 'file' && (
        <PickStaticFileButton fileName={content.fileName} onPickFile={onPickFile} />
      )}
    </div>
  )
}
