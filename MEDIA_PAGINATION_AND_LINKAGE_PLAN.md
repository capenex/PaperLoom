# PaperLoom 详细设计方案：多媒体节点翻页 + 关注列表与跨节点联动 + 图片智能自适应尺寸 + 详情栏交互升级

> **文档状态**：当前有效主方案（只落盘方案，暂未修改业务代码）。
> **已清理历史文档**：`EVENT_AND_SUBCANVAS_PLAN.md`、`SLIDES_FEATURE_AND_UI_PLAN.md`、`PAGINATION_AND_RIBBON_PLAN.md`（其中已落地的富文本翻页、1000×800 尺寸与双层固定高度 Ribbon 编辑栏已合入主干；预留的虚拟鼠标队列并入本文档第六节）。

---

## 一、 需求全貌与核心设计目标

本次迭代围绕 **「演示过程中的多图切换与跨节点联动」** 展开，共包含 5 个核心模块：

1. **多媒体节点多图翻页（Media Node Pagination）**
   - 多媒体节点（`kind === 'image'`）支持维护多张图片列表（向后兼容单图 `src` / `alt`），当图片数量 $\ge 2$ 时，节点卡片右下角渲染与富文本节点同款的 `‹ 1/N ›` 翻页控件。
   - 选中多媒体节点时，顶部功能区（「开始」与「插入与类型」选项卡第二行）提供 3 个紧凑按钮：**`更换图片`**（替换当前页）、**`+ 添加图片页`**（追加新页并切到新页）、**`删除当前页`**（页数 $>1$ 时可用）。
2. **文档级「关注列表（Watchlist / 焦点位节点）」机制**
   - 用户可将画布中作为重点展示位的节点（如左侧核心多媒体节点、多页富文本节点或关键跳转节点）一键加入/移出 **文档级关注列表（`watchlistNodeIds`）**。
   - 关注列表跨主画布与所有支线子画布全局共享，方便在配置跨节点联动事件（以及后续的虚拟鼠标指令队列）时直接从下拉框中选择目标节点，无需记 ID 或跨画布寻找。
3. **跨节点联动翻页事件（`switch-node-page`）**
   - 新增节点事件动作 `switch-node-page`：当点击/双击触发节点 A（如讲解步骤标题节点）时，自动改变目标节点 B（多媒体节点或多页富文本节点）当前展示的页码（支持 **`指定第 N 页`**、**`下一页（循环）`**、**`上一页（循环）`**）。
   - 在「交互与事件」功能区内联编辑器中，选择该动作后可从 **「★ 关注列表 / 当前画布多页节点」下拉框** 选择目标节点，也支持点击 **`⌖ 点选`** 按钮直接在画布上左键点选目标节点。
4. **图片节点 `Ctrl + 左键`（及「贴合内容」）智能视觉框自适应尺寸**
   - 解决 `2000×2000` 超大图或 `60×60` 极小图直接按原始像素缩放导致节点过大/过小的问题。
   - 采用 **「画布黄金视觉框（Bounding Box）等比缩放 + 多页包络最大值」** 算法：根据每张图片的真实自然宽高比 $\text{naturalWidth} / \text{naturalHeight}$，将其等比缩放到 `[最小短边 120px ~ 最大长边 380px]` 的舒适视觉框内；多张图片时取所有页面计算出的最大宽与最大高（$\max(w_i) \times \max(h_i)$）。
5. **图片节点默认事件与右侧详情栏缩回规则调整**
   - **图片节点默认双击看大图**：多媒体节点默认事件从 `second-click -> open-detail` 改为 **`double-click -> open-detail`**（双击弹出右栏大图详情，单击仅做选中或触发单击联动事件，不再因单击/二次单击误触详情栏）。
   - **右侧详情栏左键不缩回**：无论是左键点击画布空白处，还是左键点击画布上的其他节点，右侧详情栏（大图 / PDF / 静态文件全文）**均保持展开状态不缩回**；只有 **① 点击详情栏左上角「收起」按钮**、**② 在画布上按鼠标右键**、或 **③ 按 `Esc` 键** 时才缩回详情栏。

---

## 二、 核心数据契约设计（`src/shared/types/paper.ts`）

### 2.1 多媒体节点多页图片结构（100% 向后兼容）

```ts
/** 单张图片条目 */
export interface ImageSlideItem {
  readonly src: string
  readonly alt: string
  /** 可选缓存的图片原始像素宽高（上传或首次加载时记录，供纯函数快速计算贴合尺寸） */
  readonly naturalWidth?: number
  readonly naturalHeight?: number
}

/** 图片节点内容（兼容单图旧字段与多页 items 列表） */
export interface ImageNodeContent {
  readonly kind: 'image'
  /** 当前主页或第一页图片地址（始终与 items[activeIndex ?? 0].src 保持同步，确保旧逻辑零改动兼容） */
  readonly src: string
  /** 当前主页或第一页替代文本 */
  readonly alt: string
  /** 多页图片列表；缺省或长度为 0 时等价于 [{ src, alt }] */
  readonly items?: readonly ImageSlideItem[]
  /** 当前激活展示的图片页下标（0-based，缺省为 0） */
  readonly activeIndex?: number
}
```

> **向后兼容与同步原则**：
> - 提供纯工具函数 `resolveImageItems(content: ImageNodeContent): readonly ImageSlideItem[]` 与 `resolveActiveImageIndex(content: ImageNodeContent): number`。
> - 每当通过「更换图片」「添加图片页」「删除当前页」或「翻页」更新 `ImageNodeContent` 时，同步将 `content.src` 和 `content.alt` 更新为当前激活页 `items[activeIndex]` 的 `src` 和 `alt`。这样右侧大图详情栏（`DetailPanel`）无需修改协议即可直接展示当前激活页的大图！

### 2.2 跨节点翻页事件动作与文档关注列表

```ts
/** 跨节点/本节点翻页目标模式 */
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
      /** 目标节点 ID（可为关注列表中的节点、当前画布节点，或节点自身） */
      readonly targetNodeId: NodeId
      /** 翻页模式：指定页码 'index'，或 'next-loop' / 'prev-loop' / 'first' / 'last' */
      readonly mode: PageSwitchMode
      /** 当 mode === 'index' 时的目标页码（0-based，如 0 代表第 1 页） */
      readonly pageIndex?: number
    }
```

在 `PaperDocument` 上新增可选的关注列表字段：
```ts
export interface PaperDocument {
  readonly meta: DocumentMeta
  readonly nodes: readonly PaperNode[]
  readonly rootIds: readonly NodeId[]
  readonly defaults: DocumentDefaults
  readonly subCanvases?: Readonly<Record<CanvasId, SubCanvas>>
  /** 用户手动添加至关注列表（焦点位）的节点 ID 有序集合（跨画布共享） */
  readonly watchlistNodeIds?: readonly NodeId[]
}
```

---

## 三、 图片节点智能自适应尺寸算法（`src/features/editor/lib/fitNodeSize.ts`）

### 3.1 为什么不能直接用图片的原始像素？
用户导入的图片可能是手机拍的 `4000×3000`、高分屏截图 `2000×2000`，也可能是小图标 `64×64`。如果直接用原始像素，大图会瞬间撑爆到 `1000×800` 上限，小图则会缩成看不清的方块。

### 3.2 「黄金视觉框等比缩放 + 多页包络」算法规则
1. **定义画布单图黄金视觉边界常量**：
   - `IMAGE_FIT_TARGET_LONG_EDGE = 360`（单张图片自适应时的理想长边像素，既清晰又不喧宾夺主）
   - `IMAGE_FIT_MAX_WIDTH = 440`、`IMAGE_FIT_MAX_HEIGHT = 360`（单图自动贴合时的最大宽高上限，用户仍可手动在滑块输入到 `1000×800`）
   - `IMAGE_FIT_MIN_WIDTH = 160`、`IMAGE_FIT_MIN_HEIGHT = 120`（单图自动贴合时的最小宽高下限）
2. **单张图片尺寸映射函数 `computeIdealImageBox(naturalW: number, naturalH: number): NodeSize`**：
   - 若 `naturalW <= 0 || naturalH <= 0`，回退返回默认尺寸 `{ width: 240, height: 180 }`。
   - 计算宽高比 $r = \text{naturalW} / \text{naturalH}$：
     - 若 $r \ge 1$（横图或正方形）：以 `width = IMAGE_FIT_TARGET_LONG_EDGE`（`360`）为基准，`height = Math.round(360 / r)`；
     - 若 $r < 1$（竖图）：以 `height = IMAGE_FIT_TARGET_LONG_EDGE`（`360`）为基准，`width = Math.round(360 * r)`；
   - 若短边小于下限（如超长横幅图 `height < 120` 或超细竖图 `width < 160`），将短边提升至下限，长边限制在 `IMAGE_FIT_MAX_WIDTH`（`440`）/ `IMAGE_FIT_MAX_HEIGHT`（`360`）以内。
   - 例如：
     - `2000 × 2000` ($r = 1$) $\rightarrow$ **`320 × 320`**（正方形对角线视觉平衡修正为 `320×320`）
     - `1920 × 1080` ($r = 1.78$) $\rightarrow$ **`360 × 202`**
     - `1080 × 1920` ($r = 0.56$) $\rightarrow$ **`202 × 360`**
     - `60 × 60` ($r = 1$) $\rightarrow$ **`320 × 320`**（不会变成 60px 的小点）
3. **多页图片节点的最大包络尺寸（Envelope Max Size）**：
   - 遍历 `resolveImageItems(node.content)` 中的全部图片页：
     - 在浏览器 DOM 环境下（`measureImageNodeInDom` 或读取已缓存的 `naturalWidth/naturalHeight` / 页面内 `<img>` 元素 / 内存 `Image` 对象尺寸），计算每一页图片的 `computeIdealImageBox(w_i, h_i)`；
     - 取所有图片页的最大宽度 `maxW = Math.max(...boxes.map(b => b.width))` 与最大高度 `maxH = Math.max(...boxes.map(b => b.height))`。
     - 最终 clamp 到 `[MIN_NODE_WIDTH, MAX_NODE_WIDTH]` 与 `[MIN_NODE_HEIGHT, MAX_NODE_HEIGHT]`。
4. **多图不同比例时的卡片内渲染**：
   - 当多媒体节点只有 1 张图时，`<img>` 使用 `object-cover`；当有多张图且比例不同时，或用户翻页时，卡片背景为柔和浅灰/白底，图片居中展示，右下角浮现 `‹ 1/N ›` 翻页胶囊。

---

## 四、 交互规则与 UI 详细设计

### 4.1 多媒体节点顶栏按钮与卡片翻页器
1. **顶栏第二行（`NodeTypeControl.tsx` 中 `content?.kind === 'image'`）**：
   - 保持 `h-8`（`32px`）高度，放置 3 个按钮与页码指示：
     - **`更换图片`**：打开文件选择器，替换当前页 `activeIndex` 的图片；
     - **`+ 添加图片页`**：打开文件选择器（支持多选 `multiple`），将选中的图片追加到 `items` 末尾，并将 `activeIndex` 切换到最新添加的一页；
     - **`删除当前页`**：当 `items.length > 1` 时可用（只有 1 页时 `disabled` 虚化），删除 `activeIndex` 所在页并将 `activeIndex` 前移；
     - 右侧简短显示当前图片名与页码（如 `2/3 · 实验结果图`）。
2. **卡片右下角翻页器（`EditorNode.tsx` & 导出端 `presenterRenderScript.ts`）**：
   - 复用 `NodePageTurnControls` 组件：当 `items.length > 1` 时，在图片卡片右下角显示 `‹ 1/N ›`。
   - 点击 `‹` 或 `›` 时更新该节点的当前激活页（或组件内/文档内 `activeIndex`），同时若右侧大图详情栏正打开着该节点（`detailMediaNodeId === node.id`），右侧大图**实时同步切换**为新页面的图片！

### 4.2 关注列表（Watchlist）与跨节点联动事件编辑器
1. **关注按钮（`★ 关注` / `★ 已关注`）**：
   - 在功能区「交互与事件」左侧操作列（或「开始」栏）提供 **`★ 关注`** 切换按钮（选中节点时可用，未选中时虚化 `disabled`）。
   - 点击后调用 `onToggleWatchlist(node.id)`：将该节点 ID 加入或移出 `document.watchlistNodeIds`。
2. **「交互与事件」内联编辑器支持 `switch-node-page`**：
   - 在 `执行动作` 下拉框中新增选项：**`切换目标节点页码`**（`value="switch-node-page"`）。
   - 当选中 `切换目标节点页码` 时，同行右侧紧跟两个紧凑选择器和一个点选按钮（全部高度 `h-8`，保持工具栏总高度 `127px` 恒定不变）：
     - **`目标节点` 下拉框**：
       - 分组 1（优先展示）：`★ 关注列表` 中的所有节点（显示格式：`★ [多媒体] 架构图 (3页)`）；
       - 分组 2：`当前画布多页节点`（自动列出当前画布内所有图片页数 $\ge 1$ 的多媒体节点与页数 $\ge 2$ 的富文本节点）；
     - **`⌖ 点选` 按钮**：
       - 点击后进入 `pending: { kind: 'pick-event-target', sourceNodeId, bindingId }` 待命状态，顶部画布浮现轻提示「点击画布上的目标节点以绑定联动；右键 / Esc 取消」，用户在画布上左键点一下目标多媒体节点即完成绑定！
     - **`页码动作` 下拉框**：
       - 可选：`下一页（循环）`、`上一页（循环）`、`第 1 页`、`第 2 页` … `第 N 页`（根据所选目标节点的实际总页数动态生成页码选项，最少提供第 1~5 页）。

### 4.3 图片节点双击看大图 & 右栏缩回条件收紧
1. **默认事件修改（`src/shared/lib/nodeEvents.ts`）**：
   - `DEFAULT_IMAGE_EVENTS` 的 `trigger` 从 `'second-click'` 改为 `'double-click'`。
   - 在 `parseProjectFile` 读取旧文档时，若图片节点未自定义非默认事件或仍为旧版默认 `default-image-open-detail`，自动对齐为 `'double-click'`。
2. **右栏缩回条件修改（`useEditorSelection.ts`、`useDetailSlot.ts`、`useMediaExpansion.ts`、`Editor.tsx`、`presenterInteractionScript.ts`）**：
   - **左键绝不缩回右栏**：
     - 在 `useEditorSelection.ts` 的 `selectNode(nodeId)` 中，移除关闭详情栏的调用（不再清除 `detailMediaNodeId` 和 `detailReference`），仅更新 `selectedNodeId` 并收起画布内临时放大态 `expandedMediaNodeId`。
     - 在导出端 `presenterInteractionScript.ts` 的 `selectNode(nodeId)` 中，移除 `closeDetail()` 调用。
   - **右键与收起按钮缩回右栏**：
     - 在 `Editor.tsx` 的 `onBackgroundContextMenu`（画布右键）中，调用 `props.onCollapseDetail()` 与 `props.onCollapseExpandedMedia()`。
     - 在 `EditorNode` / `cardHandlers.ts` 的节点右键 `onContextMenu` 中，允许右键冒泡到画布或直接触发收起右栏，保证在画布任意位置按鼠标右键都能顺畅缩回右栏。
     - 点击右栏左上角「收起」按钮或按 `Esc` 键照常缩回右栏。

---

## 五、 离线导出与工程复原闭环（`exporter`）

1. **导出资源收集（`src/features/exporter/data/generate.ts`）**：
   - `collectMediaSources` 与 `rewriteMediaSources` 遍历图片节点的 `resolveImageItems(node.content)` 全部页面图片（而不仅是单个 `node.content.src`），确保多页图片节点里的每一张图片都被打包进 `res/inbox/` 或 `assets/media/`，并改写为相对路径 `./...`。
2. **导出端放映交互（`presenterRenderScript.ts` & `presenterInteractionScript.ts`）**：
   - `presenterRenderScript.ts`：当图片节点的 `items.length > 1` 时，渲染右下角 `‹ 1/N ›` 翻页按钮，并提供 `setNodePage(nodeId, nextPageIndex)` 辅助函数（更新卡片图片 DOM、页码文字，且若当前右侧详情栏正展示该节点大图，同步更新 `detailImage.src`）。
   - `presenterInteractionScript.ts`：
     - 在 `ACTION_HANDLERS` 中注册 `'switch-node-page'` 处理器，触发时调用 `setNodePage` 切换目标节点的图片页或富文本页；
     - 移除 `selectNode` 中的 `closeDetail()`，保留 `canvas.addEventListener('contextmenu', ...)` 与 `detailCollapse` 按钮关闭右栏。
3. **工程复原（`src/features/exporter/data/restore.ts` & `src/shared/lib/projectFile.ts`）**：
   - `parseProjectFile` 校验并保留 `ImageNodeContent.items`、`ImageNodeContent.activeIndex`、`PaperDocument.watchlistNodeIds` 与 `switch-node-page` 事件动作。
   - `rewriteNodeSource` 在复原时同步重写 `node.content.src` 与 `node.content.items` 中每一页的 `src`。

---

## 六、 预留扩展方案：虚拟鼠标 + 动作指令队列（留待后续阶段）

- 将**虚拟鼠标（Virtual Cursor）**作为绑定在节点上的事件动作 `play-virtual-cursor`。
- 依托本次建立的 **文档级关注列表（`watchlistNodeIds`）**，后续编排虚拟鼠标动作队列（如 `移动到目标节点 -> 停顿 -> 触发点击/翻页`）时，可直接从关注列表中选取目标节点。
- 首次触发开始按队列播放虚拟鼠标动画，播放途中再次触发或按 `Esc` 立即终止播放。
