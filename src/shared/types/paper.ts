/**
 * PaperLoom 核心数据契约
 *
 * 编辑器、导出器、演示器共享同一份类型定义。
 */

// ============================================================================
// 标识符
// ============================================================================

/** 节点唯一标识 */
export type NodeId = string

/** 文档唯一标识 */
export type DocumentId = string

// ============================================================================
// 节点
// ============================================================================

/** 文本节点内容 */
export interface TextNodeContent {
  readonly kind: 'text'
  /** 富文本内容（HTML，由编辑器生成） */
  readonly richText: string
}

/** 图片节点内容 */
export interface ImageNodeContent {
  readonly kind: 'image'
  /** 图片地址（应用内绝对路径或导出包相对路径） */
  readonly src: string
  /** 图片替代文本 */
  readonly alt: string
}

/** 节点内容（文本或图片） */
export type NodeContent = TextNodeContent | ImageNodeContent

// ============================================================================
// 本地引用
// ============================================================================

/** 引用种类：page = 本地 HTML 页面，pdf = 本地 PDF，image = 本地图片 */
export type ReferenceKind = 'page' | 'pdf' | 'image'

/**
 * 本地引用：由富文本锚点的 data-pl-* 属性族携带，与常规 HTML 超链接区分。
 * 引用在演示中不做跳转：单击弹出预览，双击（PDF）或点击弹窗进入右侧详情。
 */
export interface PaperReference {
  readonly kind: ReferenceKind
  /** 主资源地址（编辑器内为可 fetch 的地址，导出包内被改写为相对路径） */
  readonly src: string
  /** 引用显示名（文件名或选区文字） */
  readonly label: string
  /** PDF 引用页码（从 1 起）：双击跳转与切图定位 */
  readonly page?: number
  /** PDF 单击预览图（应用内切图工具裁出的 PNG 地址） */
  readonly previewSrc?: string
}

/** 节点布局（视图状态） */
export interface NodeLayout {
  /** X 坐标（画布逻辑坐标；根节点上是它在画布中的锚点，子节点坐标由布局算法推算） */
  readonly x: number
  /** Y 坐标（画布逻辑坐标；根节点上是它在画布中的锚点，子节点坐标由布局算法推算） */
  readonly y: number
  /** 是否折叠（隐藏子节点） */
  readonly collapsed: boolean
  /** 节点宽度（像素，缺省使用文档预设） */
  readonly width?: number
  /** 节点高度（像素，缺省使用文档预设） */
  readonly height?: number
}

/** 演示节点 */
export interface PaperNode {
  readonly id: NodeId
  readonly parentId: NodeId | null
  readonly content: NodeContent
  readonly layout: NodeLayout
}

// ============================================================================
// 文档
// ============================================================================

/** 文档元信息 */
export interface DocumentMeta {
  readonly id: DocumentId
  /** 文档标题（仅作为导出页签标题，不参与画布编辑） */
  readonly title: string
  readonly author: string
  readonly description?: string
  /** 创建时间（ISO 8601） */
  readonly createdAt: string
  /** 更新时间（ISO 8601） */
  readonly updatedAt: string
}

/** 文档级预设：节点未单独设置尺寸、文字未单独设置字号时以此为准 */
export interface DocumentDefaults {
  /** 预设节点宽度（像素） */
  readonly nodeWidth: number
  /** 预设节点高度（像素） */
  readonly nodeHeight: number
  /** 预设文字字号（像素） */
  readonly fontSize: number
}

/** 演示文档 */
export interface PaperDocument {
  readonly meta: DocumentMeta
  readonly nodes: readonly PaperNode[]
  /** 根节点 ID 列表（每棵树的起点，至少保留一个，不可删除最后一个） */
  readonly rootIds: readonly NodeId[]
  /** 文档级预设（节点尺寸与文字字号） */
  readonly defaults: DocumentDefaults
}

// ============================================================================
// 树结构工具类型
// ============================================================================

/** 节点映射（快速查找） */
export type NodeMap = Readonly<Record<NodeId, PaperNode>>

/** 节点及其子树 */
export interface NodeTree {
  readonly node: PaperNode
  readonly children: readonly NodeTree[]
}

// ============================================================================
// 编辑操作（用于历史记录/撤销）
// ============================================================================

export type EditOperation =
  | { readonly type: 'add-node'; readonly node: PaperNode }
  | { readonly type: 'remove-node'; readonly nodeId: NodeId }
  | { readonly type: 'update-content'; readonly nodeId: NodeId; readonly content: NodeContent }
  | { readonly type: 'update-layout'; readonly nodeId: NodeId; readonly layout: Partial<NodeLayout> }
  | { readonly type: 'move-node'; readonly nodeId: NodeId; readonly newParentId: NodeId }
