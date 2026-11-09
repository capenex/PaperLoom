# PaperLoom 架构与功能设计方案：富文本节点翻页 + 尺寸升级 + PPT 式分组折叠编辑栏 + 虚拟鼠标队列

> **文档状态**：方案已落盘归档（暂未修改业务代码，供后续按模块分步实施）。
> **参考交互附图**：`/public/assets/aistudio/image_fd5a4e72.png`（WPS / PPT Ribbon 顶部选项卡与大图标分组工具栏）

---

## 一、 富文本节点翻页与尺寸上限升级方案

### 1.1 功能目标
1. **节点右下方翻页按钮**：当富文本节点包含多页内容时，在节点卡片**右下方**显示翻页控制器（如 `‹ 1 / 3 ›`），支持在画布与导出静态演示包中直接点击翻页。
2. **编辑器内 `---` 分隔线 + 工具栏「新建页」按钮**：
   - 在底部富文本编辑器（`RichTextEditor`）中，单独一行输入 `---` 即代表分页。
   - 在富文本编辑器工具栏（`RichTextToolbar`）中新增 **`[+ 新建页]`** 按钮，点击后自动在当前光标行下方插入 `---` 分隔线并创建新页首行。
3. **节点宽高取所有页面的最大宽高**：
   - 多页富文本节点的宽高由**所有页面中最大的宽度与最大的高度**（Envelope Max Size）共同决定，避免翻页时卡片尺寸跳动。
4. **节点宽高上限提升至 `1000 × 800` 并支持手动输入**：
   - 最大宽度 `MAX_NODE_WIDTH` 提升至 **`1000`**（原为 `640`）。
   - 最大高度 `MAX_NODE_HEIGHT` 提升至 **`800`**（原为 `480`）。
   - 尺寸控件（`SizeSlider`）除滑块外支持**手动键盘输入具体数值**。

---

### 1.2 数据契约与分页编译设计

#### （1）核心类型扩展（`src/shared/types/paper.ts`）
保持 `richText` 字段向下兼容，在 `TextNodeContent` 中可选挂载 `pages`（或由编译产物的 `<hr data-pl-page-break>` 切分）：
```ts
export interface TextNodeContent {
  readonly kind: 'text'
  /** 完整富文本 HTML（多页之间以 <hr data-pl-page-break="true" /> 分隔，单页时与原格式完全一致） */
  readonly richText: string
}
```
> **设计优势**：将分页符编码为 `<hr data-pl-page-break="true">` 存储在 `richText` 中（并提供纯函数 `splitRichTextPages(richText: string): readonly string[]`），无需修改历史存档结构、子画布宿主节点同步逻辑（`syncHostNodeContent`）以及导出器序列化格式，所有链路天然 100% 兼容！

#### （2）编译器与反编译器改造（`src/features/editor/lib/markdownRichText.ts`）
- **识别 `---` 分页线**：
  - 在 `compileMarkdownRichTextHtml(editorHtml)` 中，当某一行去除零宽字符与空白后匹配 `/^-{3,}$/u`（即 `---`）时，先 flush 当前列表状态，并输出 `<hr data-pl-page-break="true">`（在编辑器内若想显示视觉分隔，也可在 CSS 中为只含 `---` 的行添加虚线底边框提示）。
- **反编译还原 `---`**：
  - 在 `decompileRichTextToEditableHtml(renderedHtml)` 中，遇到 `hr[data-pl-page-break]`（或普通 `<hr>`）时，还原为独立行 `<div>---</div>`。
- **切页辅助函数**：
  ```ts
  export function splitRichTextPages(richText: string): readonly string[] {
    if (richText.trim() === '') return ['']
    const parts = richText.split(/<hr\b[^>]*data-pl-page-break[^>]*>/iu)
    return parts.length > 0 ? parts : [richText]
  }
  ```

#### （3）富文本工具栏新增「新建页」按钮（`src/features/editor/components/RichTextToolbar.tsx`）
- 在列表或引用按钮旁增加 **`[+ 新建页]`** 按钮（使用 `FilePlus2` 或 `SeparatorHorizontal` 图标，标题：`插入分页符 (---)`）。
- 点击触发 `insertPageBreak(editor)`：
  - 定位当前光标所在的顶层行 `<div>`；
  - 若当前行非空，在其后插入 `<div>---</div>` 与一个新的空行 `<div><br></div>`；
  - 若当前行本身为空行，则将当前行设为 `<div>---</div>` 并在其后插入 `<div><br></div>`；
  - 将光标自动落在新页的第一行 `<div><br></div>` 内，并立即触发 `emitContent` 实时更新上方节点卡片。

---

### 1.3 节点右下方翻页器与全页最大宽高计算

#### （1）节点卡片右下方翻页控件（`EditorNode.tsx` & 导出端 `presenterRenderScript.ts`）
- `TextNodeBody` 通过 `splitRichTextPages(content.richText)` 获取 `pages` 数组，并在组件内维护 `pageIndex` 状态（当 `pageIndex >= pages.length` 时自动 clamp 到最后一页）。
- 当 `pages.length > 1` 时：
  - 正文区域底部预留 `pb-6` 空间，防止文字被右下角翻页器遮挡。
  - 在节点卡片**右下方**（`absolute right-2.5 bottom-2 z-20`）渲染紧凑翻页胶囊：
    ```tsx
    <div
      className="flex items-center gap-1 rounded-md border border-slate-200/90 bg-white/95 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs backdrop-blur-xs"
      onPointerDown={(e) => { e.stopPropagation() }}
      onClick={(e) => { e.stopPropagation() }}
      onDoubleClick={(e) => { e.stopPropagation() }}
    >
      <button type="button" disabled={safeIndex <= 0} onClick={prevPage}>‹</button>
      <span className="tabular-nums">{safeIndex + 1}/{pages.length}</span>
      <button type="button" disabled={safeIndex >= pages.length - 1} onClick={nextPage}>›</button>
    </div>
    ```
  - 导出器（`presenterRenderScript.ts`、`presenterInteractionScript.ts`、`presenterStyles.ts`）同步支持 `splitRichTextPages` 与右下角翻页按钮事件委托。

#### （2）按所有页面最大宽高确定节点尺寸（`src/features/editor/lib/fitNodeSize.ts`）
- 修改 `estimateRichTextSize` 与 `measureRichTextInDom`：
  - 先调用 `const pages = splitRichTextPages(content.richText)` 获取全部页面。
  - 对每一页 `pageHtml` 分别计算其所需的 `{ width, height }`。
  - 取所有页面的包络最大值：
    - `maxWidth = Math.max(...pageSizes.map(s => s.width))`
    - `maxHeight = Math.max(...pageSizes.map(s => s.height)) + (pages.length > 1 ? 24 : 0)`（多页时额外加 `24px` 底部翻页器安全高度）。
  - 最终按 `[MIN_NODE_WIDTH, MAX_NODE_WIDTH]`（`120 ~ 1000`）与 `[MIN_NODE_HEIGHT, MAX_NODE_HEIGHT]`（`64 ~ 800`）进行 clamp。

#### （3）提升宽高限制至 `1000 × 800` 并支持手动输入（`nodeDefaults.ts` & `SizeSlider.tsx`）
- **`src/shared/lib/nodeDefaults.ts`**：
  ```ts
  export const MIN_NODE_WIDTH = 120
  export const MAX_NODE_WIDTH = 1000
  export const MIN_NODE_HEIGHT = 64
  export const MAX_NODE_HEIGHT = 800
  ```
- **`src/features/editor/components/SizeSlider.tsx`**：
  - 保留 `<input type="range" min={min} max={max} step={8} ... />` 方便快速拖动。
  - 将右侧原本只读的 `<span>{value}px</span>` 替换为可编辑的 `<input type="number">`：
    - 支持用户直接键入任意数值（如 `850`、`600`）。
    - 在输入过程中保存本地草稿字符串 `draftValue`，按 `Enter` 或失焦 `onBlur` 时解析数字并 clamp 到 `[min, max]` 后调用 `onChange(clamped)`，既能流畅清空重输，又能严格保证宽高不越界。

---

## 二、 顶部编辑栏分类与折叠方案（参考 WPS / PPT Ribbon 风格）

> 参考截图：`/public/assets/aistudio/image_fd5a4e72.png`

### 2.1 现有顶栏痛点分析
目前顶部工具栏将「文档标题、保存/导入/导出、添加子节点/同级/删除、节点类型切换、主副标题输入、事件绑定、宽高滑块」全部平铺在单层横条中：
- 控件过多时在中等宽度屏幕上容易挤压换行；
- 低频操作（如文档默认尺寸、高级事件、未来新增的虚拟鼠标动画、格式工具）与高频操作混在一起，缺乏视觉层级；
- 缺少类似 PPT 的「按工作流分选项卡（Tab）+ 上图标下文字的大按钮分组 + 一键收起/展开功能区」能力。

---

### 2.2 PPT 式双层 Ribbon 架构设计

将顶部区域重构为紧凑的 **「顶栏选项卡导航条（Top Tab Bar） + 可折叠功能面板区（Collapsible Ribbon Deck）」** 两层结构：

```
+---------------------------------------------------------------------------------------------------+
| [PaperLoom] [💾保存] [📂打开]  |  [开始]  [插入]  [设计]  [交互与动画]  [视图]  |  [📤导出静态包] [⌃] |
+---------------------------------------------------------------------------------------------------+
|  [➕]      [📑]     [🗑️]   |  [📝]     [🔤]   [🖼️]   [📄]  |  [✏️ 编辑富文本 / 标题输入框]         |
| 添加子节点  添加同级   删除    | 富文本    纯标题  图片   静态文件 |  当前节点核心内容快捷编辑             |
| ──────── 节点结构 ────────  | ──────── 节点类型 ─────────── | ──────────── 内容编辑 ────────────  |
+---------------------------------------------------------------------------------------------------+
```

#### 第一层：顶部选项卡与全局快捷栏（高度 `36px`，始终常驻）
1. **左侧快捷存取区（Quick Access Toolbar）**：
   - 应用标识 / 项目文件名
   - `[💾 保存项目]`、`[📂 导入项目]`
2. **中间一级分类选项卡（Ribbon Tabs）**：
   - **`开始`（Home）**：最常用的节点增删、节点类型切换、当前节点文字/标题直接编辑。
   - **`插入`（Insert）**：完全对标附图 PPT「插入」栏——新建子节点/根分支、新建支线子画布、插入图片、插入静态文件、插入 PDF/图片本地引用、插入超链接、插入公式、插入分页符。
   - **`设计`（Design / Layout）**：当前节点宽高调节（滑块 + `1000×800` 手动输入框）、一键自适应内容大小（`Ctrl+左键`）、文档级默认宽高与默认字号预设。
   - **`交互与动画`（Interactions & Animation）**：节点事件绑定管理（单击/双击/二次点击）、支线子画布跳转管理、以及后续的「虚拟鼠标指令队列（Auto-Pilot）」编排与录制。
   - **`视图`（View）**：画布缩放比例控制、一键归中、展开/收起右侧详情预览栏、画布网格背景开关。
3. **右侧全局操作与折叠开关**：
   - `[📤 导出离线演示包]` 主按钮
   - `[⌃ 折叠功能区 / 📌 固定功能区]` 切换按钮：
     - **展开模式（Pinned）**：第二层功能面板常驻显示，画布位于其下方。
     - **折叠模式（Collapsed）**：第二层功能面板收起，仅保留 `36px` 顶栏，最大化画布视野；点击任意 Tab 时，第二层面板以浮层抽屉（Overlay Drawer）形式临时弹出，点击画布后自动收回（与 PPT / WPS 的双击 Tab 折叠体验完全一致）。

#### 第二层：PPT 式「上图标 + 下文字」功能分组面板（高度约 `68px`）
每个 Tab 内部采用竖向分隔线（Divider）划分为若干个**功能组（Ribbon Group）**，每个按钮采用 PPT 经典布局（上方 `20px` 图标，下方 `11px` 中文标签）：

| 选项卡 (Tab) | 包含的功能分组 (Ribbon Groups) | 选中节点 vs 未选中节点行为 |
| :--- | :--- | :--- |
| **开始** | 1. **节点结构**（添加根节点 / 添加子节点 / 添加同级 / 删除）<br>2. **节点类型**（富文本 / 纯标题 / 图片 / 静态文件）<br>3. **内容快编**（标题主副输入框 / 打开富文本编辑器 / 更换媒体） | 未选中节点时：「节点类型」与「内容快编」置灰或显示文档概览；选中节点时自动激活对应控件。 |
| **插入** | 1. **结构与画布**（新建根分支 / 新建支线子画布）<br>2. **媒体与文档**（上传图片 / 导入 Markdown 或代码文件）<br>3. **富文本元素**（插入分页 `---` / 本地 PDF 切图引用 / 超链接 / 公式） | 点击媒体或引用按钮可直接为当前节点挂载或新建对应类型的子节点。 |
| **设计** | 1. **当前节点尺寸**（宽度滑块+手动输入 `120~1000` / 高度滑块+手动输入 `64~800` / 适应内容大小）<br>2. **文档全局预设**（默认节点宽 / 默认节点高 / 默认字号） | 选中节点时主调当前节点尺寸；未选中时主调文档全局预设。 |
| **交互与动画** | 1. **触发事件**（绑定单击 / 双击 / 选中再点动作、恢复默认事件）<br>2. **支线导航**（进入关联子画布 / 返回上级画布）<br>3. **虚拟鼠标动画（预留）**（编排指令队列 / 触发与终止设置） | 直观展示当前节点已绑定的事件角标数量与触发详情。 |
| **视图** | 1. **画布镜头**（100% 原始比例 / 适应全部节点）<br>2. **辅助面板**（打开/关闭右侧详情栏、子画布面包屑定位） | 全局生效，不依赖节点选中状态。 |

---

## 三、 预留扩展方案：虚拟鼠标 + 动作指令队列事件（留待后续迭代）

### 3.1 核心交互设想
- 将**虚拟鼠标（Virtual Cursor）**作为绑定在某个节点（如纯标题节点）上的一条事件动作（`play-virtual-cursor`）。
- **触发与再次触发终止（Toggle 机制）**：
  - 当该节点首次被触发（如双击或单击）时，画布生成虚拟鼠标指针并开始按预设的**动作指令队列**依次执行（平滑移动到目标节点 $\rightarrow$ 停顿 $\rightarrow$ 模拟点击/双击触发目标节点的展开详情、翻页或进入子画布）。
  - 在播放过程中，**再次触发该节点事件（或按 `Esc`）会立即终止播放**，清空剩余队列并隐藏虚拟鼠标。

### 3.2 指令队列数据结构草案
```ts
export type VirtualCursorStep =
  | { readonly type: 'move-to-node'; readonly targetNodeId: NodeId; readonly durationMs: number }
  | { readonly type: 'move-by-offset'; readonly dx: number; readonly dy: number; readonly durationMs: number }
  | { readonly type: 'click'; readonly clickKind: 'single' | 'double' }
  | { readonly type: 'turn-page'; readonly targetNodeId: NodeId; readonly direction: 'next' | 'prev' }
  | { readonly type: 'wait'; readonly durationMs: number }

export type NodeEventAction =
  | { readonly type: 'edit-node' }
  | { readonly type: 'open-detail' }
  | { readonly type: 'open-reference-preview' }
  | { readonly type: 'open-canvas'; readonly canvasId: CanvasId }
  | { readonly type: 'return-parent-canvas' }
  | {
      readonly type: 'play-virtual-cursor'
      readonly steps: readonly VirtualCursorStep[]
    }
```

---

## 四、 节点复制粘贴与同级重连末尾排序方案（已实现）

### 4.1 复制与粘贴交互规则（`nodeClipboard.ts` & `useNodeClipboard.ts`）
1. **`Ctrl / Cmd + C`（单节点复制 `mode: 'single'`）**：
   - 仅复制当前选中的单个节点（包含其内容、宽高尺寸、隐藏状态 `isHidden` 及安全事件），不包含其下方的后代子节点。
2. **`Ctrl / Cmd + Shift + C`（整棵子树复制 `mode: 'subtree'`）**：
   - 复制当前选中节点及其向下可达的**整棵子树**。
3. **`Ctrl / Cmd + V`（追加粘贴）**：
   - **当画布上有选中节点 `selectedNodeId` 时**：将新节点或新子树追加到该选中节点之后（作为 `selectedNodeId` 的子节点，并排在其现有同级子节点的**最后位置**）。
   - **当未选中任何节点时**：将新节点或新子树作为新根节点追加到当前画布末尾（自动计算 `nextRootAnchor` 锚点）。
   - 粘贴完成后，选中态自动切换到新粘贴出的根卡片。

### 4.2 跨画布粘贴问题防范
1. **全新 ID 映射（防止宿主节点 `hostNodeId` 与同画布 ID 冲突）**：
   - 每次粘贴均为单节点或子树内的所有节点重新生成全新的 `NodeId`（`createId()`），并通过 `idMap: Map<OldNodeId, NewNodeId>` 重写子树内部所有父子连线 `parentIds`。
2. **跨子树边界的多父连线裁剪（保证分层 DAG 不变量 `describeLevelProblem`）**：
   - 若被复制子树内部的某个节点原本还连着子树外部的第二个父节点，粘贴时自动过滤掉不在 `idMap` 内的外部父节点 ID，仅保留子树内部的父节点映射，确保在任何画布、任何层级下粘贴都 100% 满足「父节点同层且为上一层」的分层不变量。
3. **跨画布事件清洗（`sanitizeClonedEvents`）**：
   - 自动剥离被复制节点上的 `open-canvas`（进入特定支线画布）与 `return-parent-canvas`（子画布入口宿主返回上级画布）事件，避免粘贴进子画布后产生自我递归跳转或两个节点争抢同一个 `subCanvas.hostNodeId`。

### 4.3 节点从父节点断开再接回时的同级顺序修复（`document.ts -> addParentNode`）
- **原因定位**：`buildChildrenMap` 是按照 `document.nodes` 数组的先后顺序收集每个父节点的子节点列表。原先 `addParentNode` 使用 `document.nodes.map(...)` 原地修改节点的 `parentIds`，导致排在前面的旧节点断开再重新接回父节点时，它在 `document.nodes` 数组中的下标仍然排在其它兄弟节点前面，因此会回到原来的相对位置。
- **修复方式**：在 `addParentNode` 中，将新接入父节点的节点移至 `document.nodes` 数组末尾（`[...document.nodes.filter(item => item.id !== nodeId), updated]`），从而保证**后接入的节点永远排在同级节点中的最后位置**。

---

## 五、 实施分期建议

1. **已完成**：节点单卡复制（`Ctrl+C`）、子树复制（`Ctrl+Shift+C`）、追加粘贴（`Ctrl+V`）、跨画布安全清洗、以及节点重连后置于同级末尾。
2. **第一阶段（富文本翻页 + 尺寸上限 1000×800 与手动输入）**：
   - 改动范围集中在 `nodeDefaults.ts`、`SizeSlider.tsx`、`markdownRichText.ts`、`RichTextToolbar.tsx`、`fitNodeSize.ts`、`EditorNode.tsx` 及导出器脚本。
3. **第二阶段（PPT 式双层 Ribbon 编辑栏重构）**：
   - 将现有 `EditorToolbar` / `DocumentToolbar` / `NodeInspector` 拆分为 `RibbonToolbar`（含 `RibbonTabBar` + 各分类面板组件），支持展开与折叠抽屉模式。
4. **第三阶段（富文本编辑器专项优化 + 虚拟鼠标动画指令队列）**：
   - 在「交互与动画」Ribbon 标签页中接入虚拟鼠标队列编辑器与画布播放状态机。

