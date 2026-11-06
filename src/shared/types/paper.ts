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

/** 节点内容（用户编辑），所有节点统一只承载富文本 */
export interface NodeContent {
  /** 富文本内容（HTML，由编辑器生成） */
  readonly richText: string
}

/** 节点布局（视图状态） */
export interface NodeLayout {
  /** X 坐标（画布逻辑坐标） */
  readonly x: number
  /** Y 坐标（画布逻辑坐标） */
  readonly y: number
  /** 是否折叠（隐藏子节点） */
  readonly collapsed: boolean
  /** 节点宽度（像素，缺省使用默认值） */
  readonly width?: number
  /** 节点高度（像素，缺省使用默认值） */
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

/** 演示文档 */
export interface PaperDocument {
  readonly meta: DocumentMeta
  readonly nodes: readonly PaperNode[]
  /** 根节点 ID（结构上的起点，不可删除） */
  readonly rootId: NodeId
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
  | { readonly type: 'update-content'; readonly nodeId: NodeId; readonly content: Partial<NodeContent> }
  | { readonly type: 'update-layout'; readonly nodeId: NodeId; readonly layout: Partial<NodeLayout> }
  | { readonly type: 'move-node'; readonly nodeId: NodeId; readonly newParentId: NodeId }
