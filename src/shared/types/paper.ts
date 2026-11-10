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

/** 支线子画布唯一标识 */
export type CanvasId = string

// ============================================================================
// 节点事件绑定
// ============================================================================

/** 节点事件的作用对象：整张节点卡片、节点内引用链接，或引用预览小窗 */
export type NodeEventTarget = 'node' | 'reference' | 'reference-popup'

/** 节点事件触发时机 */
export type NodeEventTrigger =
  | 'double-click'
  | 'second-click'
  | 'click'

/** 画布层级面包屑项 */
export interface BreadcrumbItem {
  readonly canvasId: CanvasId | null
  readonly label: string
}

export type PageSwitchMode = 'first' | 'last' | 'next-loop' | 'prev-loop' | 'index'

/** 节点事件执行动作 */
export type NodeEventAction =
  | {
      readonly type: 'edit-node'
    }
  | {
      readonly type: 'open-detail'
    }
  | {
      readonly type: 'open-reference-preview'
    }
  | {
      readonly type: 'open-canvas'
      readonly canvasId: CanvasId
    }
  | {
      readonly type: 'return-parent-canvas'
    }
  | {
      readonly type: 'switch-node-page'
      readonly targetNodeId: NodeId
      readonly mode: PageSwitchMode
      readonly pageIndex?: number
    }

/** 绑定在节点上的单条交互事件 */
export interface NodeEventBinding {
  readonly id: string
  /** 事件绑定的目标对象；缺省为 'node'（节点本身） */
  readonly target?: NodeEventTarget
  readonly trigger: NodeEventTrigger
  readonly action: NodeEventAction
}

// ============================================================================
// 节点
// ============================================================================

/** 文本节点内容 */
export interface TextNodeContent {
  readonly kind: 'text'
  /** 富文本内容（HTML，由编辑器生成） */
  readonly richText: string
  readonly activePageIndex?: number
}

/** 纯标题节点内容：以默认样式展示主标题，可配副标题 */
export interface TitleNodeContent {
  readonly kind: 'title'
  /** 主标题纯文本 */
  readonly title: string
  /** 副标题纯文本（可为空字符串） */
  readonly subtitle: string
}

export interface ImageSlideItem {
  readonly src: string
  readonly alt: string
  readonly naturalWidth?: number
  readonly naturalHeight?: number
}

/** 图片节点内容 */
export interface ImageNodeContent {
  readonly kind: 'image'
  /** 图片地址（应用内绝对路径或导出包相对路径） */
  readonly src: string
  /** 图片替代文本 */
  readonly alt: string
  readonly items?: readonly ImageSlideItem[]
  readonly activeIndex?: number
}

/** 静态文件展示格式：Markdown 文档或源代码/纯文本 */
export type StaticFileFormat = 'markdown' | 'code'

/** 静态文件节点内容：仅静态展示导入的源代码或 Markdown 文件 */
export interface FileNodeContent {
  readonly kind: 'file'
  /** 文件名（如 README.md、main.ts） */
  readonly fileName: string
  /** 展示格式 */
  readonly format: StaticFileFormat
  /** 文件原始文本内容 */
  readonly text: string
}

/** 节点内容（富文本、纯标题、图片多媒体或静态文件） */
export type NodeContent =
  | TextNodeContent
  | TitleNodeContent
  | ImageNodeContent
  | FileNodeContent

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
  /** 父节点列表（分层 DAG）：空数组=根节点；首位为主父节点；所有父必须同层且为上一层 */
  readonly parentIds: readonly NodeId[]
  readonly content: NodeContent
  readonly layout: NodeLayout
  /** 绑定在该节点上的交互事件列表；未设置时按节点类型使用默认事件 */
  readonly events?: readonly NodeEventBinding[]
  /** 隐藏节点：照常占位与排版、连线横穿而过，可充当跨层中继；编辑器淡显，演示包内不可见。缺省为可见 */
  readonly isHidden?: boolean
}

/** 独立于主画布的支线子画布（宿主节点同时存在于上级画布与该子画布中） */
export interface SubCanvas {
  readonly id: CanvasId
  /** 关联的宿主节点 ID（两侧共享最新 content，各自拥有独立 layout 与子树） */
  readonly hostNodeId: NodeId
  readonly nodes: readonly PaperNode[]
  readonly rootIds: readonly NodeId[]
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
  /** 支线子画布字典（按 canvasId 索引） */
  readonly subCanvases?: Readonly<Record<CanvasId, SubCanvas>>
  readonly watchlistNodeIds?: readonly NodeId[]
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
  | { readonly type: 'add-parent'; readonly nodeId: NodeId; readonly parentId: NodeId }
  | { readonly type: 'remove-parent'; readonly nodeId: NodeId; readonly parentId: NodeId }
