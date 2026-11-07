import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { FileCode, FileText, Heading, Image, ImagePlus } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import type { NodeContent, StaticFileFormat } from '@/shared/types/paper'
import { INBOX_SAVE_FAILED, saveImageFileToInbox } from '../lib/inboxUpload'
import { detectStaticFileFormat } from '../lib/staticMarkdown'

interface NodeTypeControlProps {
  readonly kind: NodeContent['kind']
  readonly onChangeKind: (kind: NodeContent['kind']) => void
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
    title: '切换为纯标题节点（默认样式展示主标题与可选副标题）',
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

/** 节点操作栏中的节点类型切换（富文本 / 纯标题 / 多媒体 / 静态文件）及资源导入 */
export function NodeTypeControl({
  kind,
  onChangeKind,
  onPickImage,
  onPickFile,
}: Readonly<NodeTypeControlProps>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="hidden text-xs text-slate-500 2xl:inline">节点类型</span>
      <NodeKindButtons kind={kind} onChangeKind={onChangeKind} />
      {kind === 'image' && <ReplaceImageButton onPickImage={onPickImage} />}
      {kind === 'file' && <PickStaticFileButton onPickFile={onPickFile} />}
    </div>
  )
}
