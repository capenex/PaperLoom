import type {
  FileNodeContent,
  ImageNodeContent,
  NodeContent,
  NodeId,
  PaperDocument,
  PaperNode,
  StaticFileFormat,
  TitleNodeContent,
} from '@/shared/types/paper'

/** 初始文档及切换为多媒体节点时默认展示的图片内容 */
export const SAMPLE_IMAGE: ImageNodeContent = {
  kind: 'image',
  src: '/media/oxcq2cmh.jpg',
  alt: '示例图片',
}

const SAMPLE_TITLE: TitleNodeContent = {
  kind: 'title',
  title: '核心主题',
  subtitle: '双击编辑主标题与副标题',
}

const SAMPLE_FILE: FileNodeContent = {
  kind: 'file',
  fileName: 'example.ts',
  format: 'code',
  text: '// 点击顶部「选择文件」导入本地代码或 Markdown\nexport function greet(name: string): string {\n  return `Hello, ${name}!`\n}',
}

function replaceNodes(document: PaperDocument, nodes: readonly PaperNode[]): PaperDocument {
  return {
    ...document,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
    nodes,
  }
}

function defaultContentForKind(kind: NodeContent['kind']): NodeContent {
  if (kind === 'image') return SAMPLE_IMAGE
  if (kind === 'title') return SAMPLE_TITLE
  if (kind === 'file') return SAMPLE_FILE
  return { kind: 'text', richText: '' }
}

/** 更新文字节点的富文本内容；其他类型节点不会被修改 */
export function updateTextNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  richText: string,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind !== 'text') return document

  const nodes = document.nodes.map((node) => {
    if (node.id !== nodeId) return node
    return { ...node, content: { ...target.content, richText } }
  })

  return replaceNodes(document, nodes)
}

/** 更新纯标题节点的主标题与副标题 */
export function updateTitleNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  title: string,
  subtitle: string,
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind !== 'title') return document
  const content: TitleNodeContent = { kind: 'title', title, subtitle }
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}

/** 切换节点类型（富文本 / 纯标题 / 多媒体 / 静态文件）；类型未变时保持原样 */
export function changeNodeKind(
  document: PaperDocument,
  nodeId: NodeId,
  kind: NodeContent['kind'],
): PaperDocument {
  const target = document.nodes.find((node) => node.id === nodeId)
  if (target === undefined || target.content.kind === kind) return document
  const content = defaultContentForKind(kind)
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}

/** 更新多媒体（图片）节点的资源地址与替代文本 */
export function updateImageNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  src: string,
  alt: string,
): PaperDocument {
  if (!document.nodes.some((node) => node.id === nodeId)) return document
  const content: ImageNodeContent = { kind: 'image', src, alt }
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}

/** 更新静态文件节点的文件名、展示格式与文本内容 */
export function updateFileNodeContent(
  document: PaperDocument,
  nodeId: NodeId,
  fileName: string,
  format: StaticFileFormat,
  text: string,
): PaperDocument {
  if (!document.nodes.some((node) => node.id === nodeId)) return document
  const content: FileNodeContent = { kind: 'file', fileName, format, text }
  return replaceNodes(
    document,
    document.nodes.map((node): PaperNode => (node.id === nodeId ? { ...node, content } : node)),
  )
}
