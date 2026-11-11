# PaperLoom 文件池资源管理器、便捷文件操作与 PPT 式伪图片（`.slide.svg`）详细设计方案

## 1. 背景与设计目标

在完成「富文本节点分页」「多媒体节点多图翻页（`items` / `activeIndex`）」「关注列表与跨节点联动翻页（`switch-node-page`）」及「图片黄金视觉框自适应尺寸」之后，PaperLoom 的画布表现力已经具备多维联动能力。但在日常高频创作中，仍存在三大痛点：

1. **缺乏可视化的文件池（Asset / File Explorer）**：`./res/inbox/` 下的图片、PDF、HTML、代码/文档缺乏统一的文件资源管理器，无法建文件夹分类、无法重命名、无法查看哪些文件正被使用或一键清理未使用的冗余文件，也无法直接从文件池往画布拖拽复用。
2. **图文混排节点的性价比与跑版难题**：如果在主画布上专门新增第四种“图文混排节点”，不仅要重写布局、连线、缩放、详情栏和离线导出器，而且节点框缩放时极易发生文字换行跑版。通过引入 **「PPT 式单页画板编辑器 → 导出单页 `.slide.svg` 伪图片进入文件池 → 直接由现有 `image` 节点显示与多页翻页」**，能够 100% 零成本复用图片节点的翻页、跨节点事件联动、双击看大图和离线导出能力，且在任何缩放比例下绝对不跑版。
3. **顶栏「文件」下拉菜单交互缺陷与外部文件快捷操作补齐**：当前「文件」下拉菜单在导出或复原后弹出的状态提示条（成功/取消/失败）永远不会消失，除非刷新整个页面；同时缺少从操作系统或文件池直接拖拽任意文件到画布/节点上的直觉式操作，以及导出到已有文件夹时的旧废文件清理与一键快速同步。

本方案将上述需求统一规划为 **四大核心模块**，在不破坏现有架构红线（`app -> features -> shared`、Oxlint 零断言、顶栏恒定 `127px` 高度）的前提下完成演进。

---

## 2. 总体架构与核心模块划分

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 顶栏「文件」菜单 (ProjectPackageControls)                                     │
│  ├─ [打开/关闭文件池] (常驻悬浮开关)                                          │
│  ├─ [快速同步导出] (复用会话文件夹句柄 + 自动清理目标目录冗余旧文件)           │
│  ├─ [导出文件夹] / [下载 zip] / [文件夹复原] / [zip 复原]                      │
│  ├─ [新建空白工程] / [从自动备份 .bak 恢复]                                   │
│  └─ 状态提示条 (PackageFeedbackToast：支持自动定时消退 + 手动 × 关闭)          │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ 打开 / 常驻悬浮
                ▼
┌───────────────────────────────────────┐      双击 .slide.svg / 点「新建幻灯片」
│ 画布常驻悬浮「文件池资源管理器」         │ ─────────────────────────────────────┐
│ (FilePoolExplorer: 映射 ./res/inbox/) │                                      ▼
│  ├─ 多级文件夹树、面包屑导航、搜索过滤   │                        ┌───────────────────────────┐
│  ├─ 新建文件夹 / 上传文件 / 新建幻灯片   │                        │ PPT 式单页画板编辑器       │
│  ├─ 任意重命名 / 移动文件 (自动重写引用) │ ◀───────────────────── │ (SlideComposerModal)      │
│  ├─ 引用计数角标 (已用 N / 未用)        │   保存为独立伪图片文件   │  ├─ 16:9 / 4:3 / 1:1 画板 │
│  └─ 单删文件 & [一键清理未使用文件]      │   xxx.slide.svg        │  ├─ 自由文本框 / 内嵌图片  │
└───────────────┬───────────────────────┘                        │  ├─ 形状高亮框 / 指示箭头  │
                │ 直接拖拽文件或文件夹到画布                       │  └─ <metadata> 内嵌源码   │
                ▼                                                └───────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ 主画布与支线子画布 (Editor / EditorNode)                                      │
│  ├─ 拖到空白处：图片/.slide.svg → 创建图片节点；文件夹 → 创建多页图片节点；     │
│  │             .md/代码 → 创建静态文件节点；.pdf/.html → 创建带引用文本节点    │
│  └─ 拖到已有节点：图片/.slide.svg 拖入图片节点 → 追加新页 (Alt 替换当前页)；    │
│                  .md/代码 拖入文件节点 → 替换文件内容；.pdf/.html → 挂载引用  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 模块一：顶栏「文件」菜单提示条 Bug 修复与菜单升级

### 3.1 导出/复原提示条不消失 Bug 根因与修复方案
- **根因定位**：
  - `src/features/exporter/hooks/useExport.ts` 与 `useRestore.ts` 在将 `status` 设为 `'success'`、`'cancelled'` 或 `'error'` 后，没有任何重置回 `'idle'` 的机制；
  - `src/features/exporter/components/ProjectPackageControls.tsx` 中的 `PackageFeedbackToast` 既没有自动消失定时器，也没有手动关闭按钮，导致提示框永久遮挡在「文件」按钮正下方。
- **修复设计**：
  1. 在 `useExport` 和 `useRestore` 返回对象中新增 `dismiss: () => void`（重置 `status = 'idle'`、`message = ''`）。
  2. 在 `PackageFeedbackToast` 中：
     - 补齐 `exportStatus === 'success'` 时的绿色成功提示（`已成功导出到文件夹` / `已生成并下载 zip 导出包`）；
     - 增加 `useEffect` 自动消退定时器：`'success'` 与 `'cancelled'` 状态在 `3500ms` 后自动调用 `dismiss()`；`'error'` 状态在 `6000ms` 后自动调用 `dismiss()`；
     - 在提示条右侧渲染显式的 `×` 关闭按钮（`aria-label="关闭提示"`），点击立即调用 `dismiss()`；
     - 当用户再次点击顶栏「文件」按钮打开下拉菜单时，自动调用 `exportCtrl.dismiss()` 与 `restoreCtrl.dismiss()`。

### 3.2 「文件」下拉菜单新增项与布局
在 `PackageDropdownMenu` 中按逻辑分组提供以下菜单项：
1. **资源与画板组**：
   - **`打开文件池` / `关闭文件池`**：带文件夹图标与开启状态指示，点击后切换 `filePoolOpen` 状态并收起下拉菜单。
   - **`新建幻灯片伪图片`**：直接打开 PPT 式单页画板编辑器，保存后自动存入文件池当前目录。
2. **导出与同步组**：
   - **`快速同步导出`**（仅当当前会话已通过 `showDirectoryPicker` 选择过目标目录句柄时激活）：无需再次弹出系统目录选择框，直接向已选目录增量覆盖写入，并清理目标目录中已废弃的旧资源文件。
   - **`导出文件夹`**：调用 `showDirectoryPicker` 选择文件夹并写入完整演示包，同时缓存目录句柄供后续「快速同步导出」使用。
   - **`下载 zip`**：打包并下载 `.zip` 离线演示包。
3. **复原与工程组**：
   - **`文件夹复原`** / **`zip 复原`**：从导出包还原工程。
   - **`从备份恢复 (.bak)`**：读取服务端 `project.json.bak` 快照恢复画布（防误操作后悔药）。
   - **`新建空白工程`**：先将当前工程自动备份至 `project.json.bak`，随后重置为初始空白画布。

### 3.3 导出到已有文件夹时的干净清理策略（`writeDirectory.ts`）
当用户导出到已有旧演示包的文件夹时：
- 先根据本次导出的 `ExportFile[]` 计算出最新的相対路径集合 `expectedPaths`；
- 递归扫描目标文件夹下的受管子目录（`res/inbox/`、`assets/media/`、`assets/refs/`、`assets/pdfjs/`）；
- 对于不在 `expectedPaths` 中的旧文件（如已从画布删除的旧图片、旧 PDF 转换脚本），调用 `parentDirHandle.removeEntry(name, { recursive: true })` 自动清理，确保导出的文件夹干净无冗余，同时绝不误删用户在导出包根目录放的其他个人文件（如自定义 README 或讲义）。

---

## 4. 模块二：文件池资源管理器（File Pool Explorer）

### 4.1 物理目录与安全路径规范（`./res/inbox/`）
文件池直接以项目根目录下的 `./res/inbox/` 作为物理根目录，不做虚假的内存文件系统，确保开发环境、刷新页面与离线导出包完全一致。
- **支持多级子文件夹与任意合法文件名**：
  - 允许中文、英文字母、数字、空格、下划线、连字符、圆括号、点号（如 `第一章 绪论/图1-系统架构.slide.svg`）。
  - 路径安全校验函数 `isSafeInboxRelativePath(relPath: string): boolean`：
    - 拒绝空字符串、以 `/` 开头或结尾、包含 `..` 或 `.` 路径段、包含反斜杠 `\`、包含控制字符或文件名非法字符（`<>:"|?*\0`）；
    - 在服务端通过 `const fullPath = resolve(INBOX_DIR, relPath)` 后，强制校验 `fullPath.startsWith(INBOX_DIR + sep)`，从根源杜绝目录穿越。

### 4.2 服务端文件资源管理器 REST API（`viteInboxPlugin.ts`）
为严守单文件 `<= 500` 行红线，将 `vite.config.ts` 中的收件箱中间件拆分为独立的 `viteInboxPlugin.ts`，提供以下接口：

| 方法与路径 | 请求参数 / Body | 返回结果 | 说明 |
| :--- | :--- | :--- | :--- |
| `GET /api/res/inbox/tree` | 无 | `{ entries: readonly InboxEntry[] }` | 递归扫描 `res/inbox/` 下所有文件夹与文件（含大小、修改时间、扩展名） |
| `POST /api/res/inbox?path=<relPath>&overwrite=<0\|1>` | 二进制流 Body | `{ src: string, path: string }` | 写入文件到指定相对路径；`overwrite=0` 且重名时自动追加 ` (1)` |
| `POST /api/res/inbox/mkdir` | `{ path: string }` | `{ ok: true, path: string }` | 创建新文件夹（若同名已存在自动追加序号） |
| `POST /api/res/inbox/move` | `{ fromPath: string, toPath: string }` | `{ ok: true, fromPath: string, toPath: string }` | 重命名或移动文件/文件夹 |
| `POST /api/res/inbox/delete` | `{ paths: readonly string[] }` | `{ ok: true, deletedCount: number }` | 删除指定的文件或文件夹（支持批量清理） |
| `GET /res/inbox/<...relPath>` | URL 路径（支持 `decodeURIComponent`） | 文件二进制流 | 支持子目录访问；对 `.slide.svg` 与文本文件返回 `Cache-Control: no-cache` |

### 4.3 引用计数追踪与重命名自动重写（`inboxReferences.ts`）
为了让用户清楚知道文件池里哪些文件正在被画布使用、并在文件重命名或移动文件夹时不断链，在 `src/shared/lib/inboxReferences.ts` 提供纯函数：
1. **`collectDocumentInboxUsage(document: PaperDocument): ReadonlyMap<string, readonly NodeId[]>`**
   - 遍历主画布 `document.nodes` 与所有子画布 `document.subCanvases[*].nodes`：
     - `image` 节点：检查 `resolveImageItems(node.content)` 中每一页的 `src`；
     - `text` 节点：解析 `richText` 中所有 `a[data-ref-kind]` 的 `href` 与 `data-ref-preview`；
     - `file` 节点：检查可选的关联路径 `node.content.inboxPath`；
   - 归一化提取出相对于 `res/inbox/` 的路径（忽略 `?t=...` 缓存时间戳参数并解码 URI），返回 `相对路径 -> 引用该文件的节点 ID 列表`。
2. **`rewriteDocumentInboxPaths(document: PaperDocument, fromRelPath: string, toRelPath: string): PaperDocument`**
   - 当用户在文件池中重命名某个文件（如 `a.png` -> `架构图.png`）或重命名/移动整个文件夹（如 `旧目录` -> `第一章/配图`）时：
   - 自动匹配文档中所有等于 `/res/inbox/${fromRelPath}` 或以 `/res/inbox/${fromRelPath}/` 开头的路径（兼容 URL 编码形式与相对形式），无损替换为新路径 `/res/inbox/${toRelPath}`，并同步更新关联页面的 `alt` 或文件名显示。

### 4.4 文件池悬浮窗口 UI 与交互细节（`FilePoolPanel.tsx`）
- **常驻悬浮机制**：
  - 打开后悬浮于画布区域左侧（`absolute top-3 left-3 bottom-3 z-30 w-80`），拥有独立的毛玻璃白底卡片、阴影与边框；
  - 顶部标题栏支持鼠标按住拖拽位置，右侧提供「最小化折叠」与「`×` 关闭」按钮；
  - 在用户手动点击 `×` 或在「文件」菜单中点击「关闭文件池」之前，无论在画布上点击、编辑节点还是切换子画布，文件池均保持常驻打开。
- **完整的资源管理器体验**：
  1. **面包屑导航栏 + 搜索框**：显示 `根目录 / 子目录A / 子目录B`，点击任意层级直接跳转，且面包屑每一层都可作为拖拽放置目标（把文件拖到面包屑的「根目录」即可移回上级）。
  2. **四大工具按钮**：
     - `[+ 上传]`：上传任意本地文件到当前文件夹；
     - `[+ 文件夹]`：在当前目录新建文件夹并立即进入内联重命名；
     - `[+ 幻灯片]`：在当前目录创建单页 `.slide.svg` 伪图片并打开 PPT 画板；
     - `[清理未用 (N)]`：实时显示当前 `0` 引用文件数量 `N`，点击后一键调用 `/api/res/inbox/delete` 删除全部未引用文件。
  3. **列表项能力**：
     - **缩略图与类型角标**：`.slide.svg` 显示矢量缩略图 + 紫色 `PPT` 角标；普通图片显示缩略图；`.pdf`、`.md`、代码文件显示类型徽标。
     - **引用计数标签**：正在被画布节点引用的文件显示绿色 `已用 N` 角标（悬停或点击可高亮/定位引用节点）；未被引用的文件显示灰色 `未用` 角标。
     - **内联重命名**：点击重命名按钮或双击文件名即可直接输入新名称，回车后调用 `/api/res/inbox/move` 并自动重写画布所有引用。
     - **文件池内部拖拽归档**：将文件直接拖到文件池内的某个文件夹行上，即可将该文件移入该文件夹（同样自动重写画布引用）。

---

## 5. 模块三：从文件池 / 操作系统拖拽文件到画布的全套快捷操作

支持两种拖拽来源：**从文件池内部拖出条目**（`DataTransfer` 携带 `application/x-paperloom-inbox-entry` JSON）与 **从操作系统文件夹直接拖入外部文件**（先自动上传至文件池当前目录，再执行相同画布落点逻辑）：

| 拖拽内容类型 | 拖到画布空白处（以鼠标落点为锚点） | 拖到画布已有的节点卡片上 |
| :--- | :--- | :--- |
| **单张图片 / 单个 `.slide.svg` 伪图片** | 创建新的 `image` 节点，读取图片真实宽高并按 `computeIdealImageBox` 自动贴合黄金视觉尺寸 | - 若目标为 **`image` 节点**：默认**追加为该图片节点的新一页**并切换到新页（若按住 `Alt` 键拖入，则**替换当前激活页**），同时更新多页包络尺寸<br>- 若目标为 **`text` 节点**：作为本地图片参考资料锚点追加到文末 |
| **多张图片 / 多个 `.slide.svg` / 包含图片的文件夹** | 按文件名自然排序提取全部图片与 `.slide.svg`，在落点处创建一个**多页 `image` 节点（`items`）** | - 若目标为 **`image` 节点**：将所有图片批量追加到该节点的 `items` 页列表中 |
| **文档或代码文件（`.md`, `.txt`, `.json`, `.py`, `.ts`, `.js`, `.csv` 等）** | 读取文件文本内容，在落点处创建 `file` 静态文件节点（自动识别 `markdown` 或代码格式） | - 若目标为 **`file` 节点**：直接用该文件的内容、文件名与格式替换目标节点 |
| **参考资料文件（`.pdf`, `.html`, `.htm`）** | 在落点处创建一个包含该本地参考资料链接（`localRef`）的新 `text` 节点（PDF 自动生成首页缩略预览图） | - 若目标为 **`text` 节点**：直接将该 PDF/HTML 作为本地参考资料锚点挂载到该节点 |

此外，在顶部编辑栏选中多页 `image` 节点时，新增 **`◀ 左移页`** 与 **`▶ 右移页`** 按钮，方便随时调整多页图片或伪图片的播放顺序。

---

## 6. 模块四：PPT 式单页画板编辑器与 `.slide.svg` 伪图片规范

### 6.1 为什么每一页单独做成一个 `.slide.svg` 伪图片文件？
1. **粒度最清晰、组合最自由**：每一页幻灯片就是文件池里的一个独立文件（如 `01-问题背景.slide.svg`、`02-实验对比.slide.svg`）。配合文件池的「文件夹」功能，用户可以建一个 `实验分析幻灯片/` 文件夹存放这组页面；既可以单张拖上画布，也可以把整个文件夹拖上画布生成多页图片节点，还可以把某一张伪图片与普通 PNG 实验截图混排在同一个图片节点的不同页里！
2. **原生兼容所有 `<img>` 与离线导出**：`.slide.svg` 本质上是合法的 SVG 矢量图文件。画布上的 `EditorNode`、右下角 `‹ 1/N ›` 翻页、双击打开的右侧大图详情栏、以及导出的离线 `index.html` 演示包，全都直接通过原生 `<img src="...">` 渲染，**零额外运行时依赖、放大任意倍数依然锐利清晰**。
3. **自包含源码，随时二次编辑**：SVG 内部包含 `<metadata id="paperloom-slide-v1">` 标签，完整保存了该页幻灯片的 JSON 图层模型。任何时候在文件池双击该文件、或在选中该图片页时点击顶栏「编辑幻灯片」，都能无损还原所有文本框、图片、高亮框和箭头图层继续修改！

### 6.2 `.slide.svg` 数据模型与序列化契约（`src/shared/types/slide.ts` & `src/shared/lib/slideSvg.ts`）

```ts
export type SlideAspectPreset = '16:9' | '4:3' | '1:1'

export interface SlideTextElement {
  readonly id: string
  readonly kind: 'text'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly text: string
  readonly fontSize: number
  readonly fontWeight: 'normal' | 'bold'
  readonly color: string
  readonly align: 'left' | 'center' | 'right'
  readonly backgroundColor: string // 'transparent' 或色值
  readonly borderColor: string     // 'transparent' 或色值
  readonly borderRadius: number
}

export interface SlideImageElement {
  readonly id: string
  readonly kind: 'image'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** 文件池原路径（如 /res/inbox/chart.png），便于溯源 */
  readonly inboxSrc?: string
  /** 序列化进 SVG <image href="..."> 的内联 Data URL，确保 <img> 独立渲染不破图 */
  readonly dataUrl: string
  readonly alt: string
  readonly objectFit: 'contain' | 'cover'
  readonly borderRadius: number
}

export interface SlideShapeElement {
  readonly id: string
  readonly kind: 'shape'
  readonly shape: 'rect' | 'rounded' | 'pill' | 'callout'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
  readonly stroke: string
  readonly strokeWidth: number
  readonly dashed: boolean
  readonly text: string
  readonly textColor: string
  readonly fontSize: number
}

export interface SlideArrowElement {
  readonly id: string
  readonly kind: 'arrow'
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly color: string
  readonly strokeWidth: number
  readonly dashed: boolean
  readonly doubleHeaded: boolean
}

export type SlideElement =
  | SlideTextElement
  | SlideImageElement
  | SlideShapeElement
  | SlideArrowElement

export interface SlideDocumentSpec {
  readonly version: 1
  readonly aspect: SlideAspectPreset
  readonly width: number   // 16:9 -> 960, 4:3 -> 800, 1:1 -> 720
  readonly height: number  // 16:9 -> 540, 4:3 -> 600, 1:1 -> 720
  readonly background: string
  readonly elements: readonly SlideElement[]
}
```

- **序列化函数 `serializeSlideToSvg(spec: SlideDocumentSpec): string`**：
  - 生成带 `width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}"` 的标准 SVG 文本；
  - 将 `spec` JSON 进行 XML 转义后写入 `<metadata id="paperloom-slide-v1">...</metadata>`；
  - 依次将 `background` 与 `elements` 渲染为标准 SVG 图元（多行文本按换行符拆分为 `<tspan>` 并处理自动折行，形状渲染为 `<rect>` + 居中 `<text>`，箭头渲染为 `<line>` + `<marker>` 箭头头部，内嵌图片渲染为 `<image href="${el.dataUrl}" preserveAspectRatio="..." />`）。
- **反序列化函数 `parseSlideFromSvg(svgText: string): SlideDocumentSpec | null`**：
  - 提取 `<metadata id="paperloom-slide-v1">` 内的 JSON 并校验还原为 `SlideDocumentSpec`；若不是 `.slide.svg` 则返回 `null`。

### 6.3 PPT 式单页画板编辑器交互设计（`SlideComposerModal.tsx`）
1. **顶部工具栏**：
   - 文件名输入框（自动补齐 `.slide.svg` 后缀）+ 所属文件池目录指示；
   - 画板比例切换：`16:9 (960×540)`、`4:3 (800×600)`、`1:1 (720×720)` + 画板背景色选择；
   - 插入元素按钮组：`[+ 标题/文本框]`、`[+ 从文件池插图]`、`[+ 上传/粘贴图片]`、`[+ 矩形/高亮框]`、`[+ 指示箭头]`；
   - 选中元素样式栏：字号、加粗、文字色、填充色、边框色、虚线开关、上移一层/下移一层、复制元素、删除元素。
2. **中央交互式画板**：
   - 等比居中展示当前画板，支持鼠标点选图层、拖拽移动、8 控制点拖拽调整宽高（箭头图层支持首尾 2 个端点自由拖拽定位）；
   - 双击文本框或形状框直接进入原位多行文字编辑；
   - 在画板内按 `Ctrl+V` 直接把剪贴板截图作为图片图层插入画板中央。
3. **底部保存动作栏**：
   - **`保存`**：将当前画板保存回 `res/inbox/<当前路径>.slide.svg`（`overwrite=1`），并自动刷新画布上所有引用该伪图片的 `image` 节点（更新 `?t=<timestamp>` 缓存戳使其立即重绘）；
   - **`另存为下一页`**：自动按文件名递增序号（如 `架构图-1.slide.svg` -> `架构图-2.slide.svg`）保存为新文件，方便连续制作系列翻页幻灯片；
   - **`保存并追加到当前图片节点`**（当画布正选中某个 `image` 节点时显示）：保存 `.slide.svg` 后直接将其追加为当前选中图片节点的新页面。

---

## 7. 模块边界与代码质量保障

1. **架构分层零违规（`.dependency-cruiser.js`）**：
   - `src/shared/types/slide.ts`、`src/shared/lib/inbox.ts`、`src/shared/lib/inboxReferences.ts`、`src/shared/lib/slideSvg.ts` 全部位于 `shared` 层，纯函数无副作用，供 `editor` 与 `exporter` 共同使用。
   - 文件池 UI（`FilePoolPanel.tsx`）与 PPT 画板编辑器（`SlideComposerModal.tsx`）按职责拆分小组件，确保每个文件 `<= 500` 行、每个函数 `<= 90` 行、每个文件 `import <= 15` 个。
2. **Oxlint 严格合规（`.oxlintrc.json`）**：
   - 全程禁止 `as` 类型断言、`any`、`!` 非空断言与否定条件三元表达式。
3. **顶栏高度恒定守则**：
   - 顶部编辑栏（`header`）在展开状态下高度恒定为 `127px`；文件池作为画布内的常驻悬浮面板存在，PPT 编辑器作为模态弹窗存在，绝不影响顶栏高度。
