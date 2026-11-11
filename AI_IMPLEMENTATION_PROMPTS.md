# PaperLoom 面向 AI 的实施提示词（文件池资源管理器 + 便捷文件操作 + PPT 伪图片画板）

本文档提供两个版本的 AI 提示词，用于驱动 AI 编码代理完整实现 **「顶栏文件菜单提示条修复与增强 + 常驻文件池资源管理器（支持多级文件夹/重命名/引用计数/一键清理未用文件） + 拖拽文件上画布全套快捷操作 + PPT 式单页伪图片（`.slide.svg`）编辑器」**：

- **版本一：概要级提示词（High-Level Prompt）** —— 适合直接发给具备全局探索能力的 AI 一次性或自主规划完成。
- **版本二：精确子代理分步编排提示词（Subagent Step-by-Step Orchestration Prompt）** —— 精确到主代理如何分 6 个阶段调度子代理（Subagents）、每个文件的 TypeScript 接口定义、Vite 服务端 REST API 协议、核心纯函数契约、UI 交互细节与 Playwright 端到端验收标准。

---

## 版本一：概要级提示词（High-Level Prompt）

```markdown
请阅读项目根目录下的 `FILE_POOL_AND_SLIDE_COMPOSER_PLAN.md`，在严格遵守项目 Oxlint（禁用 `as`、`any`、`!`、`no-negated-condition`，单文件 <= 500 行、单函数 <= 90 行、单文件 import <= 15 个）与 `.dependency-cruiser.js`（`app -> features -> shared`，禁止跨 feature 导入）架构红线的前提下，完整实现以下 4 大模块并补齐单元测试与浏览器端到端验证：

1. **修复顶栏「文件」下拉菜单提示条不消失 Bug 并扩展「文件」菜单**：
   - 修复 `ProjectPackageControls.tsx`、`useExport.ts`、`useRestore.ts` 中导出/取消/报错/复原提示条永不消失的问题：为 `useExport` 和 `useRestore` 增加 `dismiss()` 方法；为 `PackageFeedbackToast` 增加自动消失定时器（成功/取消 3.5 秒，错误 6 秒）、右侧手动 `×` 关闭按钮，并在重新打开「文件」菜单时自动清除旧提示；补齐导出成功时的绿色提示条。
   - 在「文件」下拉菜单顶部新增 **「打开文件池 / 关闭文件池」** 按钮（点击后切换常驻悬浮在画布左侧的文件池面板，直到手动关闭前始终保持悬浮），以及 **「新建幻灯片伪图片」**、**「快速同步导出（复用会话目录句柄并清理目标目录中已废弃的旧资源文件）」**、**「新建空白工程」** 与 **「从备份恢复 (.bak)」**。

2. **实现真正的文件池资源管理器（File Pool Explorer，映射 `./res/inbox/`）**：
   - 升级收件箱路径工具（`src/shared/lib/inbox.ts`）与 Vite 开发服务器中间件（拆分为 `viteInboxPlugin.ts`），支持 `./res/inbox/` 下的多级子文件夹、中文/英文/空格等合法文件名及防路径穿越校验。
   - 提供服务端接口：`GET /api/res/inbox/tree`（递归列出文件夹与文件）、`POST /api/res/inbox?path=...&overwrite=0|1`（上传/保存文件）、`POST /api/res/inbox/mkdir`（新建文件夹）、`POST /api/res/inbox/move`（重命名或移动文件/文件夹）、`POST /api/res/inbox/delete`（删除指定文件/文件夹，支持批量删除）以及 `GET /api/project/backup`（读取 `project.json.bak`）。
   - 在 `src/shared/lib/inboxReferences.ts` 实现文档级引用扫描 `collectDocumentInboxUsage` 与路径重写 `rewriteDocumentInboxPaths`：文件池内每个文件实时显示 `已用 N` 或 `未用` 角标；当在文件池中重命名文件或移动/重命名文件夹时，自动遍历更新 `PaperDocument`（含主画布与所有 `subCanvases`）中的所有引用路径，确保绝不断链；提供 **「清理未用 (N)」** 按钮一键删除全部 0 引用文件。

3. **支持从文件池或操作系统拖拽文件到画布的全套便捷文件操作**：
   - 支持直接从文件池拖出文件/文件夹到画布，或从操作系统直接拖入任意文件：
     - 拖单张图片或 `.slide.svg` 到画布空白处 → 创建自适应尺寸的 `image` 节点；拖到已有的 `image` 节点上 → 追加为该节点的新页面（按住 `Alt` 替换当前页）；
     - 拖多张图片或包含图片的文件夹到画布空白处 → 按文件名排序创建一个多页 `image` 节点（拖到已有 `image` 节点上则批量追加页面）；
     - 拖 `.md` / `.txt` / `.json` / `.py` / `.ts` 等文档或代码文件到画布空白处 → 创建 `file` 静态文件节点；拖到已有的 `file` 节点上 → 替换该节点的文件内容；
     - 拖 `.pdf` / `.html` 到画布空白处或已有的 `text` 节点上 → 自动挂载为本地参考资料链接（`localRef`）。
   - 选中多页图片节点时，在顶栏支持 `◀ 左移` / `▶ 右移` 调整当前图片页顺序。

4. **实现 PPT 式单页画板编辑器与 `.slide.svg` 自包含伪图片**：
   - 每一页幻灯片单独保存为一个 `.slide.svg` 伪图片文件（标准 SVG + `<metadata id="paperloom-slide-v1">` 内嵌图层 JSON + 内嵌图片转 Base64 Data URL），使现有的 `image` 节点、多页翻页器 `‹ 1/N ›`、跨节点联动事件 `switch-node-page`、双击看大图和离线导出包 `index.html` 无需任何额外解析器即可直接用 `<img src="...">` 原生高清渲染。
   - 实现 `SlideComposerModal.tsx` 画板编辑器：支持 `16:9 (960×540)` / `4:3 (800×600)` / `1:1 (720×720)` 画板比例，支持自由拖拽、缩放和编辑 **文本框（`text`）**、**图片框（`image`，支持从文件池选图或 `Ctrl+V` 粘贴）**、**形状/高亮标注框（`shape`）**、**指示箭头（`arrow`）** 四类元素；支持双击文件池中的 `.slide.svg` 或在顶栏选中伪图片页时点击「编辑幻灯片」随时二次编辑，保存后自动刷新画布上所有引用该伪图片的节点；支持「另存为下一页」与「保存并追加到当前图片节点」。
```

---

## 版本二：精确子代理分步编排提示词（Subagent Step-by-Step Orchestration Prompt）

```markdown
你现在是主控架构师代理（Lead Orchestrator Agent）。请严格按照以下 **6 个阶段（Steps）** 调度子代理（Subagents）或按序分步执行，完成 PaperLoom 的「文件菜单提示修复与增强 + 常驻文件池资源管理器 + 拖拽文件全套快捷操作 + PPT 式单页伪图片（`.slide.svg`）编辑器」。

---

### 全局架构与代码质量红线（所有子代理必须 100% 遵守）
1. **依赖方向红线（`npm run lint:deps`）**：
   - 严格遵循 `src/app` -> `src/features/*` -> `src/shared/*`。
   - `shared` 严禁导入 `features`；`features/editor` 与 `features/exporter` 之间严禁互相导入。
2. **Oxlint 严格红线（`npm run lint`）**：
   - 严禁使用任何 `as` 类型断言（包括 `as const`）、严禁 `any`、严禁 `!` 非空断言。
   - 严禁否定条件三元表达式 `no-negated-condition`（必须写 `cond ? a : b`，禁止写 `!cond ? b : a` 或 `x !== null ? a : b`）。
   - 单文件非空行数 `<= 500` 行，单函数行数 `<= 90` 行，单文件 `import` 语句 `<= 15` 个。
3. **UI 恒定高度红线**：
   - 顶部编辑栏（`header`）展开时总高度必须恒定为 `127px`（顶栏 `40px` + 功能区 `86px` + 底边框 `1px`），任何交互下不得发生 `1px` 高度跳动。

---

### Step 1：派发子代理 1 —— 核心共享契约：多级收件箱路径、引用追踪重写与 `.slide.svg` 序列化引擎（`src/shared` 层）

**任务目标**：在 `src/shared` 下构建文件池条目类型、多级相对路径解析、文档级资源引用计数与自动重写纯函数，以及 `.slide.svg` 伪图片的 SVG 序列化/反序列化纯函数。

#### 1.1 升级 `src/shared/lib/inbox.ts` 支持多级目录与中文/可读文件名
1. 新增文件池条目接口（或在 `src/shared/types/inbox.ts` 中定义并由 `inbox.ts` 导出）：
   ```ts
   export type InboxAssetCategory = 'slide' | 'image' | 'document' | 'reference' | 'other'

   export interface InboxEntry {
     /** 相对于 res/inbox 的路径，使用正斜杠，如 "第一章/架构图.slide.svg" */
     readonly path: string
     /** 文件或文件夹名称，如 "架构图.slide.svg" */
     readonly name: string
     /** 父目录相对路径，根目录为 "" */
     readonly parentPath: string
     readonly kind: 'file' | 'folder'
     readonly size: number
     readonly updatedAt: number
     /** 小写扩展名，含点号；伪图片固定识别为 ".slide.svg" */
     readonly ext: string
     readonly category: InboxAssetCategory
   }
   ```
2. 实现安全相对路径校验与归一化纯函数：
   - `sanitizeInboxSegment(name: string): string`：去除首尾空白，将 `<>:"/\\|?*` 及控制字符替换为 `-`，禁止 `.` 与 `..`。
   - `isSafeInboxRelativePath(relPath: string): boolean`：按 `/` 切分路径段，要求至少 1 段，且每一段非空、不为 `.` 或 `..`、不含反斜杠与控制字符。
   - `normalizeInboxLookupPath(source: string): string | null`：
     - 从任意节点 `src` 或 `href`（如 `/res/inbox/%E7%AC%AC%E4%B8%80%E7%AB%A0/a.slide.svg?t=123` 或 `./res/inbox/a.png`）中剥离 query/hash、执行 `decodeURIComponent`，提取出相对于 `res/inbox/` 的内部路径（如 `"第一章/a.slide.svg"` 或 `"a.png"`）；若非收件箱路径则返回 `null`。
   - 更新 `extractInboxRelativePath(source: string): string | null`：基于 `normalizeInboxLookupPath` 返回 `"res/inbox/<relPath>"`，兼容多级子目录与中文文件名。
   - `buildInboxUrl(relPath: string, cacheBust?: number): string`：将相对路径按段执行 `encodeURIComponent` 拼接为 `"/res/inbox/" + encodedPath`（若传入 `cacheBust` 则附加 `?t=${cacheBust}`）。
   - 更新 `uploadBlobToInbox(blob: Blob, fileName?: string, nowMs?: number, folderPath?: string): Promise<string>`：
     - 若传入了可读 `fileName`（如用户拖入的 `"架构设计.png"`），保留可读主文件名（经 `sanitizeInboxSegment` 净化），通过 `POST /api/res/inbox?path=${encodeURIComponent(relPath)}&overwrite=0` 写入指定目录（缺省根目录），返回服务端响应的 `src`。

#### 1.2 新建 `src/shared/lib/inboxReferences.ts`（引用计数与重命名/移动自动重写）
实现以下纯函数（同时覆盖 `document.nodes` 与 `document.subCanvases`）：
1. `collectDocumentInboxUsage(document: PaperDocument): ReadonlyMap<string, readonly NodeId[]>`
   - 扫描所有节点：
     - `node.content.kind === 'image'`：遍历 `resolveImageItems(node.content)` 的 `item.src`；
     - `node.content.kind === 'text'`：用正则或 DOM/属性提取 `richText` 中所有 `/res/inbox/...` 或 `res/inbox/...` 的 `href` 与 `data-ref-preview`；
   - 通过 `normalizeInboxLookupPath` 转为相对路径 `relPath`（如 `"slides/p1.slide.svg"`），汇总每个 `relPath` 被哪些 `NodeId` 引用。
2. `rewriteDocumentInboxPaths(document: PaperDocument, fromRelPath: string, toRelPath: string, cacheBust?: number): PaperDocument`
   - 当文件或文件夹从 `fromRelPath` 重命名/移动到 `toRelPath`（或当同一个 `.slide.svg` 被重新保存需要附加 `cacheBust` 时间戳刷新，此时 `fromRelPath === toRelPath`）时：
   - 若某路径归一化后等于 `fromRelPath`，则替换为 `buildInboxUrl(toRelPath, cacheBust)`；
   - 若某路径归一化后以 `${fromRelPath}/` 开头（即重命名/移动了非空文件夹），则将前缀替换为 `${toRelPath}/` 并生成新 URL；
   - 同时若 `ImageSlideItem.alt` 等于旧文件名（去扩展名），同步更新为新文件名。

#### 1.3 新建 `src/shared/types/slide.ts` 与 `src/shared/lib/slideSvg.ts`（PPT 伪图片引擎）
1. 在 `src/shared/types/slide.ts` 中定义 `SlideAspectPreset`（`'16:9' | '4:3' | '1:1'`）、`SlideTextElement`、`SlideImageElement`、`SlideShapeElement`、`SlideArrowElement`、`SlideElement` 与 `SlideDocumentSpec`（详见方案文档 6.2 节）。
2. 在 `src/shared/lib/slideSvg.ts` 中实现纯函数：
   - `createDefaultSlideSpec(title?: string, aspect?: SlideAspectPreset): SlideDocumentSpec`：生成带默认居中大标题文本框与副标题框的初始画板（默认 `16:9`，`960×540`，白底 `#ffffff`）。
   - `serializeSlideToSvg(spec: SlideDocumentSpec): string`：
     - 输出合法的独立 SVG 字符串（含 `xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}"`）；
     - 在 `<metadata id="paperloom-slide-v1">` 中写入 XML 安全转义后的 `JSON.stringify(spec)`；
     - 渲染背景 `<rect>` 及按数组顺序排列的 `elements`（文本支持多行换行 `<tspan>`、背景框与对齐；形状支持圆角、填充、描边、虚线与居中文字；箭头支持 `<defs><marker>` 箭头与虚线；内嵌图片渲染为 `<image href="${el.dataUrl}" ... />`）。
   - `parseSlideFromSvg(svgText: string): SlideDocumentSpec | null`：
     - 从 `<metadata id="paperloom-slide-v1">` 提取并验证还原 `SlideDocumentSpec`，格式不匹配时返回 `null`。
   - `isSlideSvgPath(pathOrUrl: string): boolean`：判断去掉 query 参数后是否以 `.slide.svg` 结尾。

**Step 1 阶段验收**：编写 `src/shared/lib/inboxReferences.test.ts` 与 `src/shared/lib/slideSvg.test.ts`，运行 `npm test` 与 `npm run lint:deps` 全部通过。

---

### Step 2：派发子代理 2 —— Vite 服务端文件资源管理器中间件与工程备份接口（`viteInboxPlugin.ts` & `vite.config.ts`）

**任务目标**：将 `vite.config.ts` 的服务端持久化与文件池 REST API 模块化，支持完整的文件资源管理操作。

#### 2.1 新建 `viteInboxPlugin.ts` 并简化 `vite.config.ts`
在项目根目录新建 `viteInboxPlugin.ts`（由 `vite.config.ts` 导入挂载），实现以下服务端路由：
1. **`GET /api/res/inbox/tree`**：
   - 递归扫描 `./res/inbox/`（若目录不存在则视为空列表），返回 `{ entries: InboxEntry[] }`（文件夹排在前面，同级按名称自然排序）。
2. **`POST /api/res/inbox`**（支持 `?path=<relPath>&overwrite=<0|1>`，兼容旧版 `?name=<fileName>`）：
   - 校验相对路径位于 `INBOX_DIR` 内部；
   - 若 `overwrite !== '1'` 且目标文件已存在，自动在主文件名后追加 ` (1)`、` (2)` 直至不冲突；
   - 自动 `mkdirSync(dirname(targetPath), { recursive: true })` 并写入文件字节；
   - 返回 `{ src: buildInboxUrl(finalRelPath), path: "res/inbox/" + finalRelPath, relPath: finalRelPath }`。
3. **`POST /api/res/inbox/mkdir`**：
   - 读取 JSON `{ path: string }`，校验安全相对路径（如重名自动追加序号），创建目录并返回 `{ ok: true, path: finalRelPath }`。
4. **`POST /api/res/inbox/move`**：
   - 读取 JSON `{ fromPath: string, toPath: string }`，校验源路径存在且目标路径合法；
   - 创建目标父目录后执行 `renameSync`，返回 `{ ok: true, fromPath, toPath }`。
5. **`POST /api/res/inbox/delete`**：
   - 读取 JSON `{ paths: readonly string[] }`，逐一校验位于 `INBOX_DIR` 内部后调用 `rmSync(target, { recursive: true, force: true })`，返回 `{ ok: true, deletedCount }`。
6. **`GET|HEAD /res/inbox/<...relPath>`**：
   - 解码 URL 路径并校验位于 `INBOX_DIR` 内；
   - 扩展 `MIME_BY_EXT` 支持 `.svg` (`image/svg+xml`)、`.md` / `.txt` / `.py` / `.ts` / `.js` / `.csv` (`text/plain; charset=utf-8`)、`.json` (`application/json; charset=utf-8`)、图片、`.pdf`、`.html`；
   - 对 `.svg`、`.md`、文本/代码文件设置 `Cache-Control: no-cache`，确保编辑保存后浏览器立即拉取最新内容。
7. **`GET /api/project/backup`**：
   - 读取 `./project.json.bak` 并返回 JSON（不存在则返回 `404`），供顶栏「文件 -> 从备份恢复 (.bak)」调用。

**Step 2 阶段验收**：运行 `npm test`、`npm run lint`、`npm run build` 通过。

---

### Step 3：派发子代理 3 —— 顶栏「文件」下拉菜单 Bug 修复、快速同步导出与图片页序调整（`src/features/exporter` & `src/features/editor`）

**任务目标**：彻底解决「文件」菜单提示条不消失的 Bug，接入「打开/关闭文件池」开关、「快速同步导出（含清理目标目录旧冗余文件）」、「新建空白工程」与「从备份恢复」，并为多页图片节点补齐左右移页功能。

#### 3.1 修复提示条不消失 Bug 并升级 `useExport.ts` / `useRestore.ts` / `writeDirectory.ts`
1. `src/features/exporter/data/writeDirectory.ts`：
   - 新增模块级会话缓存 `let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null`，并提供 `hasCachedDirectoryHandle(): boolean`。
   - `writeExportToDirectory(document: PaperDocument, reuseCachedHandle = false): Promise<void>`：
     - 当 `reuseCachedHandle && cachedDirectoryHandle !== null` 时直接复用该句柄，否则调用 `window.showDirectoryPicker({ mode: 'readwrite' })` 并更新 `cachedDirectoryHandle`；
     - **清理目标文件夹内已废弃的受管旧资源**：在写入新文件前，针对受管子目录 `'res/inbox'`、`'assets/media'`、`'assets/refs'`、`'assets/pdfjs'`，递归遍历已存在的条目（若浏览器 `FileSystemDirectoryHandle` 支持异步迭代 `entries()`），删除不在本次 `files` 路径集合中的旧文件与空子目录。
2. `src/features/exporter/hooks/useExport.ts` 与 `useRestore.ts`：
   - 均增加 `dismiss: () => void` 方法（将 `status` 设为 `'idle'`、`message` 设为 `''`）；
   - `useExport` 新增 `canQuickSync: boolean` 与 `run(document, target: 'folder' | 'quick-folder' | 'zip')`。
3. `src/features/exporter/components/ProjectPackageControls.tsx`：
   - 扩展 Props：
     ```ts
     interface ProjectPackageControlsProps {
       readonly document: PaperDocument
       readonly onRestoreDocument: (document: PaperDocument) => void
       readonly filePoolOpen?: boolean
       readonly onToggleFilePool?: () => void
       readonly onOpenNewSlideComposer?: () => void
       readonly onResetBlankProject?: () => void
     }
     ```
   - 在 `PackageFeedbackToast` 中：
     - 增加 `useEffect`：当 `exportStatus` 或 `restoreStatus` 处于 `'success' | 'cancelled'` 时，3500ms 后自动调用 `dismiss()`；处于 `'error'` 时，6000ms 后自动调用 `dismiss()`；
     - 渲染 `exportStatus === 'success'` 时的绿色成功提示条（如 `已成功导出演示包`）；
     - 每个提示条右侧均带有 `×` 关闭按钮，点击立即调用 `dismiss()`；
     - 点击「文件」按钮打开下拉菜单时，立即调用 `exportCtrl.dismiss()` 和 `restoreCtrl.dismiss()`。
   - 在 `PackageDropdownMenu` 中顶部加入：
     - **`打开文件池` / `关闭文件池`**（根据 `filePoolOpen` 动态切换文字与高亮图标）；
     - **`新建幻灯片伪图片`**；
     - 当 `exportCtrl.canQuickSync` 为真时，展示 **`快速同步导出`**；
     - 底部加入 **`从备份恢复 (.bak)`** 与 **`新建空白工程`**。

#### 3.2 多页图片节点页序调整（`mediaDocument.ts` & `ImagePageControls.tsx`）
- 在 `src/features/editor/data/mediaDocument.ts` 新增：
  - `moveActiveImagePageInNode(document: PaperDocument, nodeId: NodeId, direction: 'left' | 'right', canvasId?: CanvasId | null): PaperDocument`
- 在 `src/features/editor/components/ImagePageControls.tsx` 中：
  - 新增 `◀ 左移`、`▶ 右移` 按钮（页数 `<= 1` 时 `disabled`）；
  - 当检测到当前激活页 `isSlideSvgPath(activeItem.src)` 为真时，显示醒目的 **`编辑幻灯片`** 按钮，点击直接打开 PPT 画板编辑器修改当前页！

**Step 3 阶段验收**：编写单元测试验证 `moveActiveImagePageInNode`，运行 `npm test` 与 `npm run lint:deps` 通过。

---

### Step 4：派发子代理 4 —— 常驻文件池资源管理器与全类型拖拽上画布（`src/features/editor`）

**任务目标**：实现常驻悬浮在画布上的「文件池资源管理器（File Pool Explorer）」，并打通从文件池或操作系统拖拽任意文件/文件夹到画布或已有节点上的快捷操作。

#### 4.1 新建文件池客户端 API 与 Hook（`src/features/editor/lib/inboxClient.ts` & `hooks/useFilePool.ts`）
- `inboxClient.ts` 封装对 `/api/res/inbox/tree`、`/api/res/inbox`、`/api/res/inbox/mkdir`、`/api/res/inbox/move`、`/api/res/inbox/delete` 及读取文本文件 `fetchInboxText(relPath)` 的调用。
- `useFilePool(document: PaperDocument, onReplaceDocument: (doc: PaperDocument) => void)`：
  - 管理 `isOpen`（默认 `false`，由顶栏「文件 -> 打开/关闭文件池」或面板右上角 `×` 切换）、`currentFolder`（默认 `""`）、`searchQuery`、`entries`、`loading`；
  - 结合 `collectDocumentInboxUsage(document)` 实时计算每个文件的引用次数 `usageMap` 以及 `unusedFiles`（0 引用文件列表）；
  - 提供操作方法：
    - `uploadFiles(files: readonly File[], targetFolder?: string): Promise<readonly string[]>`
    - `createFolder(name?: string): Promise<void>`
    - `renameOrMoveEntry(fromRelPath: string, toRelPath: string): Promise<void>`（服务端移动成功后，立即调用 `rewriteDocumentInboxPaths(document, fromRelPath, toRelPath)` 更新画布文档，绝不断链！）
    - `deleteEntry(relPath: string): Promise<void>`
    - `cleanupUnusedFiles(): Promise<number>`（一键删除所有引用数为 0 的文件并返回清理数量）。

#### 4.2 新建常驻文件池悬浮面板组件（`FilePoolPanel.tsx` & `FilePoolItemRow.tsx`）
- 为遵守单文件 `<= 500` 行限制，拆分为：
  - `src/features/editor/components/FilePoolPanel.tsx`：外框悬浮面板（`absolute top-3 left-3 bottom-3 z-30 flex w-84 flex-col rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur-md`）、顶部标题栏与 `×` 关闭按钮、面包屑导航栏、搜索框、四个快捷操作按钮（`上传`、`新建文件夹`、`新建幻灯片`、`清理未用 (N)`）及底栏状态提示。
  - `src/features/editor/components/FilePoolItemRow.tsx`：文件夹行与文件卡片行：
    - 设置 `draggable={true}`，在 `onDragStart` 中向 `event.dataTransfer` 写入自定义 MIME `'application/x-paperloom-inbox'`（JSON `{ kind: entry.kind, path: entry.path, name: entry.name, ext: entry.ext, category: entry.category }`）；
    - 文件夹行支持双击进入、支持作为拖拽目标（将文件拖到文件夹行上直接调用 `renameOrMoveEntry` 移入该目录）；
    - 文件行展示：左侧缩略图（图片与 `.slide.svg` 直接用 `<img src={buildInboxUrl(entry.path)}>` 预览，`.slide.svg` 叠加 `PPT` 徽标）、中间文件名（支持内联重命名输入框）、右侧 **`已用 N`（绿色） / `未用`（灰色）** 角标，以及悬停操作按钮（`.slide.svg` 显示「编辑」按钮、所有项显示「重命名」与「删除」按钮；双击 `.slide.svg` 直接触发 `onEditSlide(entry.path)`）。

#### 4.3 升级画布拖拽与粘贴处理器（`src/features/editor/hooks/useImagePasteDrop.ts` 及辅助模块 `canvasFileDrop.ts`）
扩展画布 `onDragOver` / `onDrop`，同时识别 **文件池内部拖拽（`application/x-paperloom-inbox`）** 与 **操作系统外部文件拖入（`event.dataTransfer.files`）**：
1. 外部文件拖入时，先自动上传至文件池当前激活目录（`currentFolder`），转化为文件池条目后再执行统一的画布落点分发。
2. 落点分发规则（通过 `cardIdAtPoint` 检测鼠标落点是否命中已有节点 `hitNode`）：
   - **当拖入的是图片或 `.slide.svg`（或包含图片/伪图片的文件夹）**：
     - 若命中已有节点且 `hitNode.content.kind === 'image'`：
       - 若按住 `event.altKey` 且只有 1 张图：调用 `onReplaceImagePage(hitNode.id, item)` 替换当前激活页；
       - 否则：调用 `onAddImagePages(hitNode.id, items)` **直接追加为该图片节点的新页面**！
     - 若落在画布空白处（或命中非图片节点）：
       - 若有多张图（例如拖入了一个装有多张幻灯片伪图片的文件夹）：在落点处创建一个包含全部页面 `items` 的多页 `image` 节点！
   - **当拖入的是 `.md` / `.txt` / `.json` / `.py` / `.ts` / `.js` 等文本或代码文件**：
     - 读取文件文本内容与推断 `StaticFileFormat`（`.md` -> `'markdown'`，`.json` -> `'json'`，`.py` -> `'python'`，其余 -> `'text'`）；
     - 若命中已有的 `file` 节点：调用 `onUpdateNodeFile(hitNode.id, fileName, format, text)` 替换其内容；
     - 否则：在落点坐标处创建新的 `file` 节点！
   - **当拖入的是 `.pdf` / `.html` 参考资料文件**：
     - 若命中已有的 `text` 节点：生成本地引用芯片 HTML 并追加到该节点的 `richText`；
     - 否则：在落点处创建一个带该本地引用链接的新 `text` 节点。

**Step 4 阶段验收**：运行 `npm test`、`npm run lint`、`npm run lint:deps` 通过。

---

### Step 5：派发子代理 5 —— PPT 式单页伪图片画板编辑器（`SlideComposerModal.tsx`）

**任务目标**：实现轻量、直观、零跑版的 PPT 式单页画板编辑器，将排版结果保存为文件池中的独立 `.slide.svg` 伪图片文件，并与画布上的 `image` 节点无缝联动。

#### 5.1 拆分构建 PPT 画板编辑器组件（`src/features/editor/components/SlideComposerModal.tsx`、`SlideCanvasStage.tsx`、`SlideInspectorBar.tsx`）
为确保单文件 `<= 500` 行与单函数 `<= 90` 行，拆分为 3 个组件文件：
1. **`SlideInspectorBar.tsx`（顶部工具栏与属性栏）**：
   - 第一行：文件名输入框（如 `架构图解`，自动显示 `.slide.svg` 后缀）、画板比例切换（`16:9` / `4:3` / `1:1`）、画板背景色选择器、右上角按钮组：
     - **`保存`**（保存到当前路径 `overwrite=1`）
     - **`另存为下一页`**（自动递增文件名序号如 `幻灯片-2.slide.svg` 保存为新文件并切换过去，方便连续做多页）
     - **`保存并插入画布`**（若当前正选中 `image` 节点则追加为新页，否则在画布创建新图片节点）
     - **`关闭`**
   - 第二行：
     - 左侧插入组：`[+ 标题]`、`[+ 文本框]`、`[+ 文件池图片]`、`[+ 本地图片]`、`[+ 矩形/高亮框]`、`[+ 指示箭头]`；
     - 右侧选中图层属性组：根据当前选中的 `SlideElement` 动态调整字号、加粗、文字颜色、对齐、填充底色、边框颜色、圆角、虚线、图层上移/下移、复制与删除。
2. **`SlideCanvasStage.tsx`（中央固定坐标系交互画板）**：
   - 按 `spec.width × spec.height` 等比缩放显示在弹窗中央；
   - 渲染所有 `spec.elements`，点击任意元素选中并显示高亮拖拽框与缩放控制点；
   - 支持鼠标拖拽移动元素坐标 `(x, y)`、拖拽控制点调整 `(width, height)` 或箭头端点 `(x1, y1, x2, y2)`；
   - 双击文本框或形状框直接在画板原位弹出 `<textarea>` 编辑多行文字；
   - 支持在画板内按 `Ctrl+V` 直接将剪贴板图片转为 Base64 Data URL 插入为 `SlideImageElement`，也支持从弹窗内的快捷文件池图片选择器点选已有图片（自动读取并转为内联 Data URL 存入 `SlideImageElement.dataUrl`）。
3. **`SlideComposerModal.tsx`（主容器与保存编排）**：
   - 当打开已有 `.slide.svg` 时，通过 `fetch` 读取 SVG 文本并调用 `parseSlideFromSvg` 还原 `SlideDocumentSpec`；
   - 点击「保存」时，调用 `serializeSlideToSvg(spec)` 生成 SVG 字节流，通过 `POST /api/res/inbox?path=${encodeURIComponent(relPath)}&overwrite=1` 写盘；
   - 写盘成功后，调用 `rewriteDocumentInboxPaths(document, relPath, relPath, Date.now())` 为画布上所有引用该 `.slide.svg` 的节点刷新 `?t=` 时间戳，使画布卡片与右侧大图详情栏**立即无感刷新为最新画面**，并刷新文件池列表！

**Step 5 阶段验收**：确认新建幻灯片、添加图文/高亮框/箭头、保存为 `.slide.svg`、双击重新编辑、拖入图片节点翻页全链路畅通。

---

### Step 6：派发子代理 6 —— 离线导出包与工程复原对多级目录及 `.slide.svg` 的兼容同步（`src/features/exporter`）

**任务目标**：确保离线导出的 `index.html` + `data.js` 演示包与工程复原完整支持多级文件池路径（`res/inbox/子目录/xxx.slide.svg`）。

#### 6.1 检查并更新 `src/features/exporter/data/generate.ts` 与 `restore.ts`
- `generate.ts`：
  - `loadMediaAsset` 使用升级后的 `extractInboxRelativePath(source)`（会自动剥离 `?t=...` 缓存参数并保留 `res/inbox/<子目录>/<文件名>` 相对路径）；
  - `rewriteExportedSource` 在匹配 `pathBySource` 时同时兼容带或不带 `?t=...` 的源地址。
- `restore.ts`：
  - `restorePlainAssets` 在将导出包内 `res/inbox/<relPath>` 还原回开发服务器时，保留原有的子目录相对路径 `relPath`（调用 `/api/res/inbox?path=${encodeURIComponent(relPath)}&overwrite=1`），确保复原工程后文件池的文件夹结构与文件名 100% 原样保留！

---

### Step 7：主代理最终联合验收（Final Verification Checklist）

所有子代理完成后，主代理必须依次执行以下验证：
1. **自动化单测与架构检查**：
   - 运行 `npm test`（确保包含多级路径解析、引用计数与重命名路径重写、`.slide.svg` 序列化与反序列化、图片页左右移动、导出与复原保留目录结构等全部单元测试 100% 通过）。
   - 同时运行 `npm run lint`、`npm run lint:deps`、`npm run build`，确保 **0 warnings, 0 errors**。
2. **Playwright 真实浏览器端到端验收**：
   - 验证点 1（顶栏恒定高度）：展开状态下 `header` 高度恒定为 `127px`，打开/关闭文件池或 PPT 编辑器时顶栏高度保持 `127px` 不变。
   - 验证点 2（「文件」菜单提示条可关闭/自动消失）：触发导出取消或完成提示，确认提示条带 `×` 关闭按钮且可正常消失，不再永久卡住。
   - 验证点 3（文件池资源管理器完整闭环）：从「文件 -> 打开文件池」呼出常驻文件池；点击「新建文件夹」创建子文件夹；点击「新建幻灯片」打开 PPT 画板编辑器，添加文本框与高亮框后保存为 `.slide.svg`；验证文件池中出现该 `.slide.svg` 且显示 `未用` 角标。
   - 验证点 4（拖拽伪图片上画布 & 引用计数 & 重命名自动同步）：将该 `.slide.svg` 关联或拖入画布图片节点，验证图片节点正常渲染矢量伪图片，且文件池中该文件角标变为 `已用 1`；在文件池中重命名该文件，验证画布图片节点的 `src` 自动同步更新不断链；双击该文件可再次打开 PPT 编辑器修改文字并保存刷新。
```
