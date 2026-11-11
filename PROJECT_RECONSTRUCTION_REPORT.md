# PaperLoom 项目开发历程重建报告

> 生成日期：2026-11-11
> 方法：软件考古（Software Archaeology）——基于本地 git 历史、仓库内规划文档与工程配置逆向重建。
> 证据来源：
> - **Git 提交历史**：19 个提交（`45ce037` → `05775fd`），单一作者 capenex，main 分支，与 origin/main 同步，工作区干净。
> - **规划文档**：PROJECT.md、FILE_PLAN.md、EVENT_AND_SUBCANVAS_PLAN.md、PAGINATION_AND_RIBBON_PLAN.md、SLIDES_FEATURE_AND_UI_PLAN.md、MEDIA_PAGINATION_AND_LINKAGE_PLAN.md（README.md 仍为 Vite 模板样板，无项目信息）。
> - **工程配置**：package.json、vite.config.ts、.dependency-cruiser.js、.oxlintrc.json、.gitignore。
> - **会话记录**：未提供本地对话 transcript；提交正文（commit body）承担了大部分"开发对话"的证据功能。凡无直接记录支撑的判断均标注 `[Inferred]`。

---

## 1. 执行摘要（Executive Summary）

**PaperLoom 是什么**：一个基于浏览器的通用内容展示工具（PROJECT.md 定义）。用户在本地编辑思维导图式的演示结构，定稿后导出为静态文件包（`index.html` + `assets/` + `data.js`），拷贝到任意电脑双击即可离线演示——无需服务器、无需安装。

**时间跨度**：git 记录覆盖 **2026-11-06 21:21 → 2026-11-11 15:51，约 5 天（跨 6 个自然日）**，共 21 个提交，累计约 +38,100 / −4,600 行。首个提交即包含 47 个文件、7,508 行可运行的编辑器 + 离线导出器，说明 git 化之前已有原型开发 `[Inferred：原型在 Google AI Studio 中完成，依据是后续多个 "sync AI Studio baseline" 提交与 .gitignore 对 AI Studio 产物（.aistudio/、metadata.json、bun.lock）的排除]`。

**开发模式**：计划文档先行（7 份 PLAN/PROJECT 文档）→ 在 AI Studio 中迭代 → 导出 zip 覆盖本地 `src/` → `npm run check` 质量门禁 → 提交。期间发生过一次明确的**基线重置**（`fbb9d5e`：放弃未提交的本地迭代，以 AI Studio zip 为权威基线）。

**最终状态**：编辑器功能完整且高度工程化——155 个 src 文件、25,913 行源码（生产代码 138 文件 / 22,905 行，测试 17 文件 / 3,008 行）；支持四类节点、混合 Markdown 富文本、多父节点结构、子画布、事件绑定、隐藏节点中继、Ribbon 工具栏、复制粘贴、富文本/图片多页翻页、关注列表跨节点联动、常驻文件池资源管理器、PPT 式 `.slide.svg` 单页画板编辑器、工程自动保存、导出包导出/复原双向闭环。代码中无 TODO/FIXME 残留。

---

## 2. 统一开发时间线（Unified Development Timeline）

### 阶段 0：原型与基线入库（2026-11-06）

| 提交 | 时间 | 事件 |
|---|---|---|
| `45ce037` | 11-06 21:21 | **里程碑 M1**：Initial commit。画布编辑器 + 离线导出器一次性入库（47 文件 / 7,508 行），同捆 PROJECT.md 与 FILE_PLAN.md——立项之初即有产品定位与三层架构规划 |
| `c14f393` | 11-06 21:25 | chore：gitignore 媒体资源格式（工作数据不入库的约定自此确立） |

`[Inferred]` 首提交并非"第一天写的代码"，而是 AI Studio 原型阶段的快照：代码已含完整的 editor/exporter 双 feature、shadcn/ui 基础设施与架构文档。

### 阶段 1：资料引用体系与离线阅读（2026-11-07）

| 提交 | 时间 | 事件 |
|---|---|---|
| `427e2bc` | 11-07 14:16 | **里程碑 M2**：本地引用链接（page/pdf/image）+ 悬停预览卡 + 右侧详情面板（30%–70% 可拖分隔）+ pdf.js 阅读器。导出包内联 pdf.js 经典脚本、PDF 字节 base64 内嵌，保证 `file://` 全离线（73 文件 / +5,349） |

### 阶段 2：节点体系与工程持久化（2026-11-08 白天）

| 提交 | 时间 | 事件 |
|---|---|---|
| `4b449c9` | 11-08 00:56 | **里程碑 M3**：节点扩为富文本/纯标题/多媒体/静态文件四类；图片粘贴拖入自动写 `res/inbox`；工程自动保存（/api/project 原子写、防抖、pagehide 冲刷）。同提交修复三个 bug（见第 4 节）。FILE_PLAN.md 更新 |
| `994ed14` | 11-08 17:14 | chore：gitignore AI Studio 导出产物与 bun.lock——**AI Studio zip 覆盖式迭代流程的书面证据** |

### 阶段 3：事件绑定、子画布与导出复原闭环（2026-11-08 下午至夜间）

| 提交 | 时间 | 事件 |
|---|---|---|
| `d35c705` | 11-08 17:14 | **里程碑 M4a**：节点 click/double-click 事件绑定（编辑/详情/引用预览/跳画布）、多子画布 + 面包屑导航、图片 lightbox。EVENT_AND_SUBCANVAS_PLAN.md 入库 |
| `7463b6d` | 11-08 18:00 | **里程碑 M4b**：引用附件从 blob: 改为持久化到 res/inbox；导出包（文件夹/.zip）可**复原回可编辑工程**（解析 data.js、资源重入库、路径重写）。**首次引入测试**（node:test + tsx） |
| `6ddd20e` | 11-08 21:57 | AI Studio 基线同步：**混合 Markdown 源码编辑器**（块级字面源码 + 行内富格式，编辑即编译为标准 HTML）；标题编辑上移工具栏；图片详情进右栏；**节点尺寸贴合取代 lightbox**（方案废弃点） |

### 阶段 4：富文本编译器深化与多父结构（2026-11-09 凌晨至下午）

| 提交 | 时间 | 事件 |
|---|---|---|
| `a6454e4` | 11-09 00:27 | 反斜杠转义编译（`\$` 不再触发公式）+ 反编译重转义保证存档往返；"语法免疫"富文本选区 |
| `95a80f1` | 11-09 00:27 | **里程碑 M5**：多父节点（parentIds，旧 parentId 存档载入时迁移）；同根树、父节点必须上一层防环；删除级联规则；每棵根树独立布局 + 自上而下对齐 pass；离线演示端镜像同布局 |
| `8637a4d` | 11-09 01:03 | fix：纯标题节点去掉占位副标题（旧存档载入时清理，用户自写内容不动） |
| `a112402` | 11-09 01:03 | 主/子画布相机解耦，各记各的 pan/zoom；首次进入子画布按宿主节点左偏 22% 取景 |
| `f088c51` | 11-09 16:03 | 工具栏"武装式"结构移动（点击替代 Alt-drag 加父/拆离）与贴合内容 |
| `6619c75` | 11-09 16:03 | docs：**SLIDES_FEATURE_AND_UI_PLAN.md 入库**（11-08 建议稿，P0 估算 17–25 人日，未实施） |
| `70ea39b` | 11-09 16:35 | fix：Chrome 文件夹导出取消时静默失败 → 提示 + zip 下载通道 + 文件夹复原本修复 |
| `c8a7a99` | 11-09 16:35 | 可选隐藏节点：保留布局占位、直线桥接贯穿，充当跨层中继 |

### 阶段 5：基线重置——Ribbon、剪贴板与分页（2026-11-10 凌晨）

| 提交 | 时间 | 事件 |
|---|---|---|
| `fbb9d5e` | 11-10 01:53 | **里程碑 M6 / 关键转向**：提交正文明确"Replace uncommitted local iterations with the 2026-11-09 AI Studio zip as the authoritative baseline"——**放弃未提交的本地迭代**，换入选项卡式 Ribbon、节点复制粘贴、行内事件编辑器、分页导出包与 PAGINATION_AND_RIBBON_PLAN.md；删除并忽略 .env.example |
| `91fbebc` | 11-10 02:54 | 隐藏节点无可见侧时连线淡出（编辑器 10%，演示端省略）；贯穿桥要求两侧均可见 |

### 阶段 6：多媒体翻页与跨节点联动（2026-11-10 夜间）

| 提交 | 时间 | 事件 |
|---|---|---|
| `05775fd` | 11-10 23:09 | **里程碑 M7**：图片节点多页（items/activeIndex + 翻页器 + 换图/加页/删页）；文档级关注列表 + `switch-node-page` 跨节点联动（画布点选目标）；黄金视觉框智能尺寸；图片默认事件改双击、详情栏左键不缩回；离线演示与复原全量往返；旧存档默认事件迁移。MEDIA_PAGINATION_AND_LINKAGE_PLAN.md 同提交入库，其 5 个模块全部落地 |

### 阶段 7：文件池资源管理器与 PPT 式画板合成器（2026-11-11 下午）

| 提交 | 时间 | 事件 |
|---|---|---|
| `78d056e` | 11-11 15:51 | **里程碑 M8**：新增常驻文件池资源管理器（映射 `./res/inbox/`、多级文件夹、引用计数、重命名/移动自动重写引用、一键清理未用资源、全类型拖拽上画布）；新增 PPT 式 `.slide.svg` 画板编辑器（16:9/4:3/1:1、文本/图片/形状/箭头图层、`<metadata>` 内嵌工程源码，100% 复用图片节点翻页与导出）；修复文件菜单提示条不消失，扩展快速同步导出、新建空白工程与 `.bak` 恢复入口。FILE_POOL_AND_SLIDE_COMPOSER_PLAN.md 入库 |
| `a45128b` | 11-11 15:51 | **fix（当前 HEAD）**：固定幻灯片画板工具栏第二行高度为恒定 80px、属性区常驻占位，避免选中/取消选中图层时撑高工具栏导致画布上下跳动 |

**节奏观察** `[Inferred]`：提交集中在深夜/凌晨（00:27、01:03、01:53、02:54），单日多次"feat + fix 成对同秒提交"（如 11-09 01:03:49 两条），符合"AI Studio 一轮迭代 → zip 覆盖 → 拆主题提交"的工作流，而非逐行手写节奏。

---

## 3. 关键架构与技术决策（Key Architectural & Technical Decisions）

| # | 问题 | 选择 | 记录中的理由 | 证据 |
|---|---|---|---|---|
| 1 | `file://` 下双击即用 | 导出静态包，数据用 `data.js` `<script>` 挂全局变量，**不用 data.json** | 浏览器拦截 file:// 的 fetch（CORS） | PROJECT.md |
| 2 | PDF 离线阅读 | pdf.js 以经典脚本内联（主线程 worker），PDF 字节 base64 内嵌 | 避免 fetch 与 module CORS | `427e2bc` |
| 3 | 三层架构 | app → features → shared；feature 互不引用、经 index.ts 公开 API；dependency-cruiser 强制（无循环、shared 不上依） | 模块边界机器可验证 | FILE_PLAN.md、.dependency-cruiser.js |
| 4 | 工程持久化 | Vite dev server 内置中间件当后端：/api/project 原子写（tmp+rename+.bak）、防抖落盘、pagehide 冲刷、8MB 上限；资源走 res/inbox，存档只存链接不存字节 | 本地单机工具无需真后端 | `4b449c9`、vite.config.ts |
| 5 | 引用附件寿命 | blob: URL → 上传 res/inbox 真实文件 | blob: 刷新即失效 | `7463b6d` |
| 6 | 富文本存储形态 | 混合 Markdown 源码：块级结构以字面 Markdown 行呈现，行内保留富格式；每次编辑编译为标准 HTML 供卡片与存储；反编译重转义保证往返 | 源码可读 + 存档可迁移 | `6ddd20e`、`a6454e4` |
| 7 | 结构模型 | parentId → **parentIds 多父**；所有父节点须同根树且上一层（天然防环）；全父死亡才级联删除；Alt-drag 加父 | 表达共享子节点，杜绝环 | `95a80f1` |
| 8 | 布局 | Content/Layout 分离；锚点即舞台坐标；每棵根树独立布局 + 自由锚点 + 对齐 pass；**编辑器与导出端布局公式必须一致**（文档明示错位风险） | 双端渲染同一份数据 | FILE_PLAN.md、`95a80f1` |
| 9 | 子画布 | 宿主节点同源投射：content 双向同步、layout 独立、宿主根不可删、禁自我递归；面包屑导航栈；相机各画布独立 | 一处编辑多处呈现 | EVENT_AND_SUBCANVAS_PLAN.md、`d35c705`、`a112402` |
| 10 | 分页编码 | 富文本 `---` 编码为 `<hr data-pl-page-break>` 存于 richText；节点尺寸取全页包络最大值 | 天然兼容现有存储，无新字段 | PAGINATION_AND_RIBBON_PLAN.md |
| 11 | 多页图片 | `items` + `activeIndex`，`src/alt` 始终与激活页同步 | 旧逻辑零改动向后兼容 | MEDIA_PLAN、`05775fd` |
| 12 | 隐藏节点 | 隐藏但保留布局占位，直线桥贯穿作跨层中继；无可见侧时连线淡出 | 演示时精简画面而不塌布局 | `c8a7a99`、`91fbebc` |
| 13 | 导出通道 | 文件夹 + zip（fflate）双通道 | Chrome 文件夹选择器取消/拒绝时静默失败 | `70ea39b` |
| 14 | 质量门禁 | oxlint（type-aware，禁 as/any/!，文件≤500 行/函数≤90 行/导入≤15）+ dependency-cruiser + node:test/tsx/happy-dom；`npm run check` = lint + lint:deps + build | 约束随阶段收紧：1000 行→300 行/50 行→现行 500/90 | FILE_PLAN、EVENT_PLAN、.oxlintrc.json、package.json |
| 15 | 迭代流程 | AI Studio 生成 → zip 覆盖 src/ → check 验证 → 提交；**以 AI Studio 基线为权威**，必要时丢弃本地未提交迭代 | 提交正文直接记录该决策 | `994ed14`、`6ddd20e`、`fbb9d5e` |
| 16 | 图文混排与幻灯片形态 | 以 PPT 式单页画板生成 `.slide.svg` 伪图片存入文件池，直接交由 `image` 节点展示与多页翻页 | 100% 零成本复用图片节点翻页、跨节点联动、放大与离线导出，且任意缩放绝不跑版 | FILE_POOL_AND_SLIDE_COMPOSER_PLAN.md、`78d056e` |

**废弃 / 转向的方案**：
- **图片 lightbox 弹窗**（`d35c705` 引入）→ 被"节点尺寸贴合 + 右栏详情"取代（`6ddd20e`）。
- **占位副标题**：纯标题节点不再注入默认副标题，旧存档载入时清洗（`8637a4d`）。
- **本地未提交迭代**：整批让位于 AI Studio 2026-11-09 zip 基线（`fbb9d5e`）——记录中唯一一次明确的工作丢弃。
- **Slides 方案中的明确不做清单**：pptx 导入导出、AI 生成、音视频、母版、多选/组合/旋转、与画布双向同步（SLIDES_FEATURE_AND_UI_PLAN.md）。

---

## 4. 重大挑战与突破（Major Challenges & Breakthroughs）

1. **`file://` 离线三重封锁**（CORS fetch、module worker、资源加载）→ 突破：data.js 全局脚本 + pdf.js 经典脚本主线程 worker + base64 内嵌 + 全资源内联。这是整个导出架构的第一约束（PROJECT.md、`427e2bc`）。
2. **自动保存连环 bug**（`4b449c9` 正文记录）：粘贴重复建节点；自动保存写盘触发 Vite 整页重载；缺失资源被 SPA fallback 伪装成 200。三者同提交修复，是记录中信息量最大的一次调试。
3. **Chrome 文件夹导出"按钮装死"**（`70ea39b`）：picker 取消或系统文件夹被拒时浏览器静默中止 → 增加取消提示 + zip 下载绕开权限流程。
4. **富文本语法与编辑的冲突**（`a6454e4`）：`$` 等语法字符误触发公式、选区破坏语法 span → 转义编译器（双反斜杠渲染一个字面反斜杠）+ 反编译重转义 + 语法免疫选区守卫，存档往返闭合。
5. **多父结构的环与级联语义**（`95a80f1`）：用"同根树 + 父节点必须上一层"的几何约束天然排除环；删除仅在全父死亡时级联；折叠可见性跟随任一展开父节点。
6. **旧存档兼容三连迁移**：parentId→parentIds（`95a80f1`）、占位副标题清洗（`8637a4d`）、图片默认事件 second-click→double-click（`05775fd`）——形成"载入时迁移"的固定模式。
7. **测试环境与类型库冲突**（`7463b6d`）：node 测试的 DOM shim 与 TS6 lib 类型冲突 → skipLibCheck；测试经 tsx 跑 tsconfig 路径别名。
8. **同级排序 bug**（PAGINATION_AND_RIBBON_PLAN.md 记录）：addParentNode 移至数组末尾修复。
9. **基线分歧**（`fbb9d5e`）：本地迭代与 AI Studio 产出分叉 → 以 zip 为权威整体重置，代价是丢弃未提交本地工作。
10. **文档与仓库状态漂移**（考古发现）：MEDIA_PAGINATION_AND_LINKAGE_PLAN.md 宣称"已清理"三份历史 PLAN 文档，但三者至今仍在 HEAD 中 `[Inferred：AI Studio 侧删除了文件，而 zip 覆盖只替换/新增、不会删除本地已跟踪文件]`。

---

## 5. 项目架构与演进图（Project Architecture & Evolution Map）

### 首日结构（`45ce037`，47 文件 / 7,508 行）

```
src/
├── app/App.tsx
├── features/
│   ├── editor/        # 13 组件 + 3 hooks + data/document.ts + lib/richText.ts
│   └── exporter/      # generate.ts + presenterTemplate.ts + writeDirectory.ts
└── shared/            # types(paper/presentation/export) + lib(id/nodeDefaults) + ui/button
```

### 最终结构（`a45128b`，155 个 src 文件 / 25,913 行，17 个测试文件）

```
src/
├── app/                     # 组装层（仅经 feature index 引入）
├── features/
│   ├── editor/
│   │   ├── components/      # ~40：Ribbon 面板、详情栏、PDF 裁剪、事件编辑、
│   │   │                    #        子画布面包屑、图片页控件、关注列表点选…
│   │   ├── hooks/           # ~25：视口/导航/拖拽/剪贴板/持久化/引用预览…
│   │   ├── data/            # document、layout、subCanvas、nodeVisibility、
│   │   │                    # nodeClipboard、mediaDocument、connectionGeometry（均带测试）
│   │   └── lib/             # Markdown 编译器套件（richText/decompile/escapes/
│   │                        # syntaxSpans/shortcuts/clean）、mathFormula、pdfCrop、
│   │                        # projectStorage、inboxUpload、fitNodeSize、canvasView…
│   └── exporter/
│       ├── data/            # generate、restore（导出↔复原闭环）、writeZip、
│       │                    # pdfjsClassic、presenter*Script 拆分为
│       │                    # render/layout/interaction/reference 四脚本
│       └── hooks/           # useExport、useRestore
└── shared/                  # types(+project)、lib(nodeTree/nodeEvents/mediaPages/
                             # projectFile/inbox/reference/html)、ui
```

### 演进脉络

1. **骨架期**（11-06）：editor/exporter 双 feature + shared 契约（PaperDocument、rootIds 多根）一次成型，FILE_PLAN 先行。
2. **横向扩张期**（11-07~08）：引用/详情/PDF 子系统、四类节点、持久化中间件、事件与子画布——组件数翻倍，导出端开始拆分 presenter 脚本。
3. **纵深编译期**（11-08 夜~09）：richText 单文件演化为 Markdown 编译/反编译/转义/语法 span 套件；结构模型升级多父；data 层纯函数化并配套测试（测试从 0 → 15）。
4. **基线重置期**（11-10 凌晨）：Ribbon/剪贴板/分页整批换入，工具栏状态独立为 ribbonToolbarState（带测试）。
5. **联动收尾期**（11-10 夜）：mediaPages/mediaDocument/关注列表把"翻页"从节点内提升为文档级联动机制；导出/复原/演示三端同步往返。
6. **资源池与画板合成期**（11-11 下午）：通过常驻文件池（FilePoolPanel + inboxReferences）统一治理本地媒体资产，并用 `.slide.svg` 画板合成器（SlideComposerModal + slideSvg）以伪图片方案优雅解决 PPT 式图文混排需求。

**不变的骨架**：三层依赖方向、Content/Layout 分离、"编辑器与导出端公式一致"原则、存档只存链接不存字节——自首日 FILE_PLAN 确立后从未动摇。

---

## 6. 下一步 / 未完成事项（Next Steps / Unfinished Items）

| 事项 | 状态 | 证据 |
|---|---|---|
| **Slides 幻灯片模式** | 核心图文混排痛点已由更轻量的 **`.slide.svg` 单页画板编辑器 + 多页图片节点** 方案落地解决；原重型双工作区方案（SLIDES_FEATURE_AND_UI_PLAN.md）降级为远期备选 | FILE_POOL_AND_SLIDE_COMPOSER_PLAN.md、`78d056e` |
| 多布局模式（大纲、时间线等） | 仅立项声明，无方案无代码 | PROJECT.md"当前阶段" |
| 演示模式（全屏、自动播放、导航控制） | 仅立项声明 | PROJECT.md |
| 虚拟鼠标指令队列 | 预留设计，未实现 | MEDIA_PLAN 第六节、PAGINATION_PLAN |
| 文档同步 | `README.md` 与 `PROJECT.md` 已同步更新至最新功能与代码规模统计；历史 PLAN 文档保留在仓库供架构追溯 | HEAD 文件清单 |
| 流程观察 | `npm run check` 不含 `npm test`，测试是独立门禁 `[Inferred：可能是有意拆分，记录未说明]` | package.json |

代码层面无 TODO/FIXME 残留；最近一轮 MEDIA 计划的 5 个模块已全部落地并通过导出/复原往返验证（提交正文声明）。

---

*报告边界说明：本报告全部结论限于 git 记录与仓库内文档；AI Studio 侧的原始对话、未入库的本地迭代细节（尤其 fbb9d5e 丢弃的内容）不可考，相关推断均已标注。*