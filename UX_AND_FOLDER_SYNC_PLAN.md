# PaperLoom 使用体验优化与本地文件夹双向同步改动方案文档

> **当前基线状态**：已拉取并合并 GitHub `origin/main` 最新提交（`6204e20 feat(ui): replace native selects with custom popover SelectMenu`），同时完整保留了此前修复的「多媒体类型切换栏宽度拉伸」与「节点类型切换内容缓存及单页图片清空」两项改动，全量编译、Oxlint 与 Dependency Cruiser 校验均已通过。

---

## 一、 改动需求总览

本次迭代共包含 **7 项核心体验与架构改动**：

1. **富文本本地引用（`插入本地引用`）改为从文件池选择文件**，不再直接弹出系统原生文件选择框。
2. **「文件夹复原」升级为「打开文件夹」工作区模式 + 画布外部文件拖入逻辑重构**：
   - 通过 File System Access API (`window.showDirectoryPicker({ mode: 'readwrite' })`) 打开本地项目文件夹并保持可写句柄绑定，后续画布编辑与文件池操作直接实时同步修改该本地文件夹；
   - 从操作系统拖入画布的外部文件全部存入文件池（并同步写入本地已打开文件夹），**除图片文件（`image/*` 及 `.slide.svg`）直接生成/追加画布图片节点外，其余文件一律不直接成为画布节点**，仅存入文件池并在界面弹出轻提示 **`「已保存到文件池」`**。
3. **修复对带有公式（`$...$`）的文字添加本地引用失败的问题**。
4. **删除富文本工具栏中的「添加超链接」按钮**（`LinkControl`）。
5. **优化行内数学公式（`$...$`）视觉样式并支持字号缩放**：去除生硬的灰底药丸边框，改为学术出版级无衬线/衬线混排数学排版，且选中含公式文本修改字号时公式同步放大/缩小。
6. **节点尺寸与「贴合内容」精确度优化**：
   - 幻灯片伪图片（`.slide.svg`）默认节点尺寸从 `360 × 203` 提升至 **`560 × 315`**（标准 16:9 高清阅读比例）；
   - 修复富文本节点点击「贴合内容」后底部经常残留大段空白的问题；
   - 节点最小高度 `MIN_NODE_HEIGHT` 从 `64` 缩小至 **`40`**。
7. **文件池交互重构、文件夹实时双向同步与 SHA-256 哈希去重**：
   - 双击文件池中的文件改为**在右侧详情栏（`DetailPanel`）打开预览**，而非插入画布；
   - 移除文件池条目右侧的 **`+`（插入到画布）** 按钮；
   - 文件池（`res/inbox/`）与本地打开的文件夹始终保持一致，且所有入池/同步文件通过 **SHA-256 内容哈希值对比去重**。

---

## 二、 逐项根因分析与详细技术方案

### 需求 1：富文本「插入本地引用」改为从文件池选文件

#### 1. 现状与痛点
- 当前 `src/features/editor/components/ReferenceControl.tsx` 在点击「插入本地引用」按钮时，直接触发隐藏的 `<input type="file" accept=".pdf,.html,.htm,image/*" />`，每次从操作系统选文件都会走 `/__paperloom/file-upload` 重新上传一份，既无法复用文件池里已整理好的文献/图片/网页，也容易造成重复文件。

#### 2. 改动方案
- **新增文件池引用选择器弹窗 `FilePoolReferencePickerModal.tsx`**（或下拉浮层）：
  - 点击 `ReferenceControl` 的「插入本地引用」按钮前，先调用 `saveSelection()` 保存当前富文本选区；
  - 打开文件池文件选择器，复用 `useFilePool` 的目录树与搜索过滤能力，仅展示支持作为引用的文件类型（**PDF `.pdf`、网页 `.html/.htm`、图片 `image/*` 及 `.slide.svg`**），支持文件夹层级浏览与关键字搜索；
  - 选择器顶部同时保留一个辅助按钮 **「+ 上传新文件到文件池」**（方便文件不在池中时直接上传入池并自动选中）；
  - **选中文件后的分支处理**：
    - 若选中 **图片（`image` / `.slide.svg`）或网页（`html`）**：直接构造 `RichTextReferencePayload { kind: 'image' | 'html', src: entry.src, label: entry.name }` 并调用 `onReference(payload)` 写入 `<a data-pl-ref="...">`；
    - 若选中 **PDF（`.pdf`）**：通过 `fetch(entry.src)` 获取文件池中的 PDF Blob，构造 `File` 对象传入现有的 `PdfCropDialog` 进行框选截图，裁剪产出的 PNG 同样存入文件池（带 SHA-256 去重）后完成引用绑定。

---

### 需求 2：「文件夹复原」改为「打开文件夹」实时同步 + 拖入画布文件行为重构

#### 1. 现状与痛点
- **只读一次性导入**：当前 `ProjectPackageControls.tsx` 的「文件夹复原」使用 `<input type="file" webkitdirectory />`（`readDirectoryFiles`），浏览器只给一次性只读 `FileList`，复原后画布上的任何修改、文件池增删都不会写回原文件夹，用户必须反复手动点「导出到文件夹」并重新授权。
- **外部拖入画布污染节点**：当前 `src/features/editor/lib/inboxUpload.ts` 的 `ingestExternalFileToCanvas` 会把拖入的 `.md`/`.txt`/代码直接生成 `file` 静态文件节点，把 `.pdf`/`.html` 生成带引用的 `text` 富文本节点。当用户一次性拖入多篇参考文献 PDF 或资料时，画布上会瞬间堆满不需要的节点。

#### 2. 改动方案 A：「打开文件夹」与实时双向同步（Workspace Directory Binding）
- **UI 文案与入口升级**：
  - 将 `ProjectPackageControls.tsx`（位于顶部「文件」下拉菜单中）的 **`「文件夹复原」`** 按钮正式更名为 **`「打开文件夹」`**（当已绑定工作区文件夹时显示 `已打开：<文件夹名>` 状态标识）。
- **核心句柄管理（`src/features/exporter/data/workspaceDirectory.ts`）**：
  - 点击「打开文件夹」时优先调用 `window.showDirectoryPicker({ mode: 'readwrite' })` 获取 `FileSystemDirectoryHandle`（若浏览器不支持 `showDirectoryPicker`，则优雅降级为 `<input webkitdirectory>` 只读导入并提示当前浏览器不支持自动写回）。
  - **打开时的双向合并与初始化**：
    1. 读取该文件夹下的 `data.js`（或 `project.json`）恢复画布文档状态；
    2. 扫描该文件夹下的 `res/inbox/` 与 `assets/`，将本地文件夹中的文件按相对路径与 SHA-256 哈希同步至开发服务器内存/磁盘的 `res/inbox/`（使预览服务器 `/res/inbox/...` 与本地文件夹完全一致）。
  - **后续编辑实时写回（Auto-Sync）**：
    1. **文档自动保存**：当存在已绑定的 `workspaceDirectoryHandle` 时，监听 `EditorDocument` 变更（带 `600ms` 防抖），自动向该文件夹更新写入最新的 `data.js`、`index.html` 与引用的 `assets/`；
    2. **文件池变更实时同步**：在 `useFilePool` 的所有写操作（上传文件、新建文件夹 `mkdir`、重命名/移动 `move`、删除 `delete`、一键清理未使用文件 `cleanup`）完成后，同步调用 `syncFilePoolToDirectoryHandle(dirHandle, entries)`，在本地文件夹的 `res/inbox/` 下执行对应的文件写入、目录创建、重命名或删除，确保**文件池与本地文件夹始终 100% 一致**。

#### 3. 改动方案 B：外部文件拖入画布逻辑重构
- 修改 `src/features/editor/lib/inboxUpload.ts` 中的 `ingestExternalFileToCanvas` 与 `CanvasStage` 拖放回调：
  - **文件池内部拖出（`hasFilePoolDragPayload`）**：从文件池面板主动拖到画布上的文件，保持现有直觉行为（允许把文件池里的文件拖到画布上建立节点/引用）。
  - **从操作系统外部拖入画布（`dataTransfer.files`）**：
    1. 所有拖入的外部文件一律先调用 `uploadToInbox(file)`（含 SHA-256 哈希去重）存入文件池 `res/inbox/`，并同步写入已打开的本地文件夹，刷新文件池列表；
    2. **判断文件类型**：
       - **若是图片文件（`file.type.startsWith('image/')` 或 `.slide.svg`）**：保持原有逻辑，在落点直接新建图片节点或追加到目标图片节点；
       - **若是非图片文件（PDF、HTML、Markdown、TXT、JSON、代码等）**：**不再在画布上创建任何节点**，而是在画布顶部/右下角弹出自动消失的轻提示 Toast：**`「已保存到文件池」`**（若一次拖入多个非图片文件，提示 `「已保存到文件池（共 N 个文件）」`）。

---

### 需求 3：修复对带有公式的文字添加引用失败

#### 1. 根因定位（已精确定位到具体代码行）
经过源码排查，对带有公式（`$...$`）的选中文本点击「插入本地引用」失败由 **3 处连锁拦截** 导致：
1. **第一重拦截（核心直接原因）**：
   - 当富文本进入编辑态时，`RichTextEditor.tsx` 调用 `decompileRichTextToEditableHtml` 将 `.pl-math` 节点还原为原始 `$...$` 文本。
   - 用户选中包含 `$...$` 的文字并点击「插入本地引用」时，`applyReference`（`src/features/editor/lib/richText.ts:272`）首先调用 `guardSelectionAgainstMarkdownSyntax()`（`richText.ts:145-190`）。
   - `collectMarkdownSyntaxSpans` 会将 `$...$` 的首尾 `$` 标记为语法区间 `SyntaxSpan`。
   - 随后在 **`src/features/editor/lib/richText.ts` 第 179 行**：
     ```ts
     if (startSpans.some((span) => span.start >= newStart && span.end <= newEnd)) return false
     ```
     只要选区内部包含了完整的 `$...$` 公式，`span.start >= newStart && span.end <= newEnd` 必然为 `true`，函数直接返回 `false`，导致 `applyReference` **静默中止、完全不执行任何操作**！
2. **第二重问题**：
   - 即便放行 `guardSelectionAgainstMarkdownSyntax`，若编辑态 DOM 中存在 `<span class="pl-math" contenteditable="false">`，浏览器原生 `document.execCommand('createLink', false, url)` 遇到 `contenteditable="false"` 子节点时会截断 `<a href>` 或拒绝包裹。
3. **第三重问题**：
   - 在退出编辑态执行 `compileMarkdownRichTextHtml`（`src/features/editor/lib/markdownRichTextCompile.ts`）时，需要确保 `<a data-pl-ref="...">` 内部的 `$...$` 依然能被 `renderInlineMarkdown` 编译为 `<span class="pl-math">`，且 `decompileRichTextToEditableHtml` 在还原时不会破坏外层 `<a data-pl-ref>` 标签。

#### 2. 改动方案
1. **重构 `guardSelectionAgainstMarkdownSyntax`（`src/features/editor/lib/richText.ts`）**：
   - 区分「选区边界恰好劈开了某个 `$` 或 Markdown 标记」与「选区完整包含了一对配对的 `$...$` 公式」：
   - 若选区边界落在某个语法定界符内部（`span.start < offset && offset < span.end`），自动将选区边界向外扩展以包裹完整公式；
   - **移除对选区内部已完整配对的 `$...$` 公式的 `return false` 拦截**，允许包含公式的选区正常执行 `applyReference` 与 `applyFontSize`。
2. **使用 DOM Range 安全包裹替代脆弱的 `execCommand('createLink')`**：
   - 在 `applyReference` 中，当选区有效时，优先使用自定义 DOM Range 包裹函数 `wrapRangeWithReferenceAnchor(range, reference)`：提取 `range.extractContents()`，清除内部可能嵌套的旧同名 `<a>`，用 `<a href="..." data-pl-ref="..." data-pl-ref-kind="..." data-pl-ref-label="...">` 完整包裹选区内容（无论其中包含纯文本、字号 `<span>` 还是 `$...$` 公式），再插回 `range` 并触发 `input` 事件。
3. **补充单元测试**：
   - 在 `src/features/editor/lib/richText.test.ts` 中新增针对「纯公式 `$E=mc^2$` 添加引用」与「图文公式混排 `计算 $\Delta\Phi = \Phi_{(011)} - \Phi_{(001)}$ 结果` 添加引用并往返编译/反编译」的断言测试。

---

### 需求 4：删除富文本工具栏「添加超链接」按钮

#### 1. 改动方案
- 在 `src/features/editor/components/RichTextToolbar.tsx` 中移除 `<LinkControl onLink={onLink} />` 渲染及其 import；
- 清理 `RichTextFormatBarProps`、`useRichTextCommands.ts` 中仅服务于外链按钮的无用透传接口，并删除不再使用的 `src/features/editor/components/LinkControl.tsx`，使富文本工具栏更加紧凑清爽。

---

### 需求 5：公式视觉样式重设计 & 支持修改公式大小

#### 1. 现状与痛点
- **样式难看**：当前 `src/index.css`（第 280–294 行）为 `.pl-math` 设置了灰底渐变背景、圆角边框与内阴影（`background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.06em 0.38em;`），导致行内公式看起来像一个突兀的灰色按键/代码标签，且硬编码了 `color: #0f172a` 无法跟随文字颜色。
- **无法改大小**：
  1. 与需求 3 相同，`applyFontSize`（`src/features/editor/lib/richText.ts:207`）调用了 `guardSelectionAgainstMarkdownSyntax()`，一旦选中内容包含 `$...$` 就直接 `return false` 拒绝修改字号！
  2. 此外，若用户先输入 `$...$` 再选中改字号，生成的 `<span style="font-size: 24px;">$...$</span>` 在 `compileMarkdownRichTextHtml` 编译或 `decompileRichTextToEditableHtml` 反编译时，需确保外层 `font-size` 样式与内部 `.pl-math` 的相对字号（`1em` / `inherit`）无缝继承。

#### 2. 改动方案
1. **重设计 `.pl-math` 学术级排版样式（`src/index.css`）**：
   - 彻底移除 `.pl-math` 的背景色 `background`、边框 `border`、圆角 `border-radius` 和 `box-shadow`；
   - 采用标准 LaTeX / KaTeX 学术衬线数学字体栈：
     ```css
     .pl-math {
       display: inline;
       margin: 0 0.08em;
       padding: 0;
       font-family: "KaTeX_Main", "Latin Modern Math", "STIX Two Math", "Cambria Math", "Times New Roman", serif;
       font-size: 1.06em;
       line-height: inherit;
       color: inherit;
       letter-spacing: 0.01em;
       font-variant-numeric: lining-nums;
     }
     ```
   - 如此一来，公式不仅拥有纯正的学术论文质感，还能 100% 继承外层或自身的 `font-size` 与文字颜色。
2. **打通公式字号调整（`applyFontSize`）**：
   - 修复 `guardSelectionAgainstMarkdownSyntax` 后，选中含 `$...$` 的文本选择任意字号（如 `18px`、`24px`、`32px`）即可正常包裹 `<span style="font-size: 24px">...</span>`；
   - 若选区中包含已渲染的 `.pl-math` 节点或内部子元素，`applyFontSize` 自动清理内部冲突的 `font-size` 内联样式并统一由外层 `span` 控制字号；
   - 确保 `compileMarkdownRichTextHtml` 在编译 `<span style="font-size: ...">$...$</span>` 时保留外层 `font-size` 样式。

---

### 需求 6：幻灯片伪图片默认尺寸放大、富文本「贴合内容」消除空白、最小高度缩至 40

#### 1. 现状与痛点
1. **幻灯片伪图片（`.slide.svg`）默认太小**：
   - 当前 `src/features/editor/lib/fitNodeSize.ts` 中 `SLIDE_DEFAULT_WIDTH = 360`、`SLIDE_DEFAULT_HEIGHT = 203`，且新建幻灯片或拖入幻灯片时回退到普通图片默认尺寸（`236 × 172`），导致 16:9 幻灯片在画布上字迹过小、难以阅读。
2. **富文本节点「贴合内容」经常留下大段空白**：
   - 定位到 `src/features/editor/lib/fitNodeSize.ts` 第 118–119 行：
     ```ts
     width: Math.max(maxIntrinsicWidth + CARD_PAD_X + 6, fallback.width),
     height: Math.max(maxWrappedHeight + CARD_PAD_Y + 4 + pagerExtra, fallback.height),
     ```
   - **根因**：`measureRichTextInDom` 虽然在隐藏 DOM 容器中精确测量了真实渲染高度 `maxWrappedHeight`，但最后却用了 `Math.max(..., fallback.height)` 与启发式估算值 `estimateRichTextSize` 取最大值！而 `estimateRichTextSize` 会把 HTML 字符串按正则粗暴折行并加上高额行距与 `CARD_PAD_Y = 28`，估算值往往比真实 DOM 高度大 40%–80%，导致 `Math.max` 永远采用虚高的 `fallback.height`，从而在富文本卡片底部留下大段空白！
   - 同时，`CARD_PAD_X = 36`、`CARD_PAD_Y = 28` 也大于 `EditorNode.tsx` 实际的内边距（`px-3.5 py-2.5` 即水平 `28px`、垂直 `20px`）。
3. **最小高度过大**：
   - 当前 `src/shared/lib/nodeDefaults.ts` 中 `MIN_NODE_HEIGHT = 64`，单行短文本节点贴合内容后上下仍显空旷。

#### 2. 改动方案
1. **最小高度调整为 `40`**：
   - 在 `src/shared/lib/nodeDefaults.ts` 中将 `MIN_NODE_HEIGHT` 从 `64` 修改为 **`40`**（同时检查 `fitNodeSize.ts` 等引用处统一使用 `MIN_NODE_HEIGHT = 40`）。
2. **放大幻灯片伪图片默认尺寸**：
   - 在 `src/shared/lib/nodeDefaults.ts` 与 `src/features/editor/lib/fitNodeSize.ts` 中，将 `.slide.svg` 幻灯片伪图片的默认尺寸统一设为 **`560 × 315`**（标准 16:9 比例，面积约为原来的 2.4 倍）；
   - 当新建幻灯片页、从文件池拖入 `.slide.svg` 或将空节点首次设为 `.slide.svg` 时，若节点仍处于初始默认小尺寸（`236 × 172`），自动应用 `560 × 315` 默认尺寸。
3. **修复富文本 `measureRichTextInDom` 贴合算法**：
   - 在 `measureRichTextInDom` 成功测量到真实 DOM 宽高（`maxWrappedHeight > 0`）时，**直接采纳真实 DOM 测量值**，不再与虚高的 `fallback.height` / `fallback.width` 取 `Math.max`（`fallback` 仅在无 `document` 的纯 Node.js 测试环境下作为兜底）；
   - 将测量容器的内边距常量对齐 `EditorNode.tsx` 真实样式：`CARD_PAD_X = 28`（`14px * 2`）、`CARD_PAD_Y = 20`（`10px * 2`），预留 `2px` 边框余量，彻底消除底部多余空白。

---

### 需求 7：双击文件池文件打开右侧预览、移除 `+` 号、文件夹同步与 SHA-256 哈希去重

#### 1. 现状与痛点
- 当前双击文件池中的条目（`FilePoolItemRow.tsx`）会直接调用 `onInsertEntry(entry)` 把文件变成画布节点；而每个文件右侧还有一个 `+` 号按钮（`插入到画布`），由于已经有直观的「拖拽到画布」操作，`+` 号显得冗余且容易误触。
- 当前文件上传接口（`vite.config.ts` 中的 `handleInboxUpload`）仅靠文件名冲突加 `(1)` 后缀（`uniqueFilePath`），如果用户把同一个图片或 PDF 拖入两次（或者本地文件夹同步时），会在 `res/inbox/` 下生成多份重复副本。

#### 2. 改动方案
1. **移除文件池条目右侧的 `+` 号按钮**：
   - 在 `src/features/editor/components/FilePoolItemRow.tsx` 的 `EntryActionButtons` 中删除 `onQuickInsertToCanvas`（`+` 号按钮），仅保留：
     - `.slide.svg` 专属的「编辑幻灯片」图标按钮；
     - 「重命名」按钮；
     - 「删除」按钮。
2. **双击文件池文件改为打开右侧预览（`DetailPanel`）**：
   - 当双击文件夹时：保持进入该子文件夹（`onEnterFolder(entry.relPath)`）；
   - 当双击任何文件（图片、`.slide.svg` 幻灯片、PDF、HTML、Markdown、TXT、代码文件）时：触发 `onPreviewEntry(entry)`，将右侧 `DetailPanel` 打开并切换至该文件的预览视图（复用/扩展 `DetailBody` 的图片预览、HTML 沙盒预览、PDF 内嵌预览与静态代码/Markdown 预览能力），不再往画布插入节点！
3. **全链路 SHA-256 哈希计算与去重**：
   - **服务端（`vite.config.ts` `filePoolPlugin`）**：
     - 在 `scanInboxDirectory` 返回的 `FilePoolEntry` 结构中新增 `sha256: string` 字段（利用 Node `node:crypto` 的 `createHash('sha256')` 计算每个文件内容的哈希）；
     - 在 `handleInboxUpload` 接收上传文件时，先计算上传 `Buffer` 的 SHA-256 哈希值，扫描 `res/inbox/`（优先匹配当前目标子目录，其次匹配整个文件池）：**若已存在相同 SHA-256 哈希的文件，直接跳过写入并返回已有文件的 `{ src, name, relPath, sha256, deduplicated: true }`**，从根源杜绝重复文件副本！
   - **客户端与本地文件夹双向同步（`src/features/exporter/data/workspaceDirectory.ts` & `useFilePool.ts`）**：
     - 使用 Web Crypto API (`crypto.subtle.digest('SHA-256', arrayBuffer)`) 计算本地文件夹中文件的 SHA-256；
     - 当通过「打开文件夹」将本地文件夹与文件池同步，或定期校验同步时：
       - 按 `relPath` 与 `sha256` 双向比对本地文件夹 `res/inbox/` 与内存/服务端文件池；
       - 哈希一致的文件直接复用不重写；本地新增的文件自动同步入池（若池中已有同 SHA-256 文件则自动去重合并）；池中新增/重命名/删除的文件实时同步到本地文件夹。

---

## 三、 涉及新增与修改的文件清单

| 模块 | 文件路径 | 改动类型与说明 |
| :--- | :--- | :--- |
| **节点尺寸与贴合** | `src/shared/lib/nodeDefaults.ts` | `MIN_NODE_HEIGHT` 改为 `40`；新增/导出幻灯片默认尺寸常量 `DEFAULT_SLIDE_NODE_WIDTH = 560`、`DEFAULT_SLIDE_NODE_HEIGHT = 315` |
| **节点尺寸与贴合** | `src/features/editor/lib/fitNodeSize.ts` | 修复 `measureRichTextInDom` 与 `fallback.height` 取 `Math.max` 导致的底部空白 bug；校准 `CARD_PAD_X = 28`、`CARD_PAD_Y = 20`；`.slide.svg` 默认尺寸设为 `560 × 315` |
| **富文本与公式** | `src/features/editor/lib/richText.ts` | 修复 `guardSelectionAgainstMarkdownSyntax` 对含 `$...$` 选区的拦截；使用 DOM Range 包裹实现含公式文本的本地引用添加与字号缩放 |
| **富文本与公式** | `src/index.css` | 重设计 `.pl-math` 样式，移除灰色边框与药丸底色，改为学术衬线排版并支持继承外层 `font-size` 与颜色 |
| **富文本工具栏** | `src/features/editor/components/RichTextToolbar.tsx` | 移除 `LinkControl`（添加超链接按钮），删除 `LinkControl.tsx` |
| **文件池引用选择** | `src/features/editor/components/ReferenceControl.tsx` | 点击「插入本地引用」改为打开文件池引用选择弹窗 `FilePoolReferencePickerModal` |
| **文件池引用选择** | `src/features/editor/components/FilePoolReferencePickerModal.tsx` | **新增**：从文件池选择 PDF / HTML / 图片作为富文本引用的弹窗组件（支持池内搜索、目录切换及上传新文件入池） |
| **画布拖入逻辑** | `src/features/editor/lib/inboxUpload.ts` | 外部拖入画布的文件全部存入文件池；除图片外不生成画布节点，触发 `「已保存到文件池」` 轻提示 |
| **文件池交互与预览** | `src/features/editor/components/FilePoolItemRow.tsx` | 移除右侧 `+` 按钮；双击文件改为触发右侧详情栏（`DetailPanel`）预览 |
| **文件池交互与预览** | `src/features/editor/components/DetailPanel.tsx` / `DetailBody.tsx` | 支持展示双击的文件池条目预览（图片、幻灯片、PDF、HTML、Markdown/代码） |
| **SHA-256 与文件池** | `vite.config.ts` & `src/features/editor/hooks/useFilePool.ts` | 为文件池条目增加 `sha256` 哈希计算与上传去重逻辑，并与已打开的本地文件夹实时双向同步 |
| **打开文件夹同步** | `src/features/exporter/components/ProjectPackageControls.tsx` | 将「文件夹复原」改为「打开文件夹」，绑定本地文件夹句柄并在后续编辑中自动同步写回 |
| **打开文件夹同步** | `src/features/exporter/data/workspaceDirectory.ts` | **新增**：管理 `FileSystemDirectoryHandle`、双向同步 `res/inbox/`（含 SHA-256 去重）与自动写回 `data.js` / `assets/` |

---

## 四、 质量门禁与验证计划

1. **单元测试补充（Vitest）**：
   - `richText.test.ts`：验证选中含 `$...$` 公式的文字添加本地引用（图片/PDF/HTML）及修改字号均成功生效，且往返编译不丢属性；
   - `fitNodeSize.test.ts`：验证 `MIN_NODE_HEIGHT === 40`、`.slide.svg` 默认尺寸 `560 × 315` 以及富文本测量高度准确；
   - 文件池 SHA-256 哈希去重与引用路径重写测试。
2. **静态架构约束（Oxlint + Dependency Cruiser）**：
   - 所有新增/修改文件严格遵守单文件 `<= 500` 行、单函数 `<= 90` 行、单文件 import `<= 15` 个、`features/*` 跨模块隔离规则。
3. **真实浏览器端到端验证（Playwright CLI）**：
   - 逐项验证文件池选引用、外部非图片拖入画布仅入池并提示「已保存到文件池」、含公式文本加引用与改字号、超链接按钮移除、富文本贴合内容无多余空白、双击文件池打开右侧预览且无 `+` 号。
