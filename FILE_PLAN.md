# PaperLoom 文件规划

## 目录结构

```
PaperLoom/
├── src/
│   ├── app/                          # 应用组装层
│   │   ├── App.tsx                   # 根组件，路由与布局
│   │   └── providers.tsx             # 全局 Provider（主题、状态等）
│   │
│   ├── features/                     # 功能模块（业务隔离）
│   │   ├── editor/                   # 编辑器模块
│   │   │   ├── components/           # 编辑器 UI
│   │   │   ├── hooks/                # 编辑器状态
│   │   │   ├── data/                 # 编辑器数据操作
│   │   │   └── index.ts              # 公开入口
│   │   │
│   │   ├── whiteboard/               # 白板模块（已有）
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── data/
│   │   │   └── index.ts
│   │   │
│   │   ├── exporter/                 # 导出器模块
│   │   │   ├── components/           # 导出配置 UI
│   │   │   ├── hooks/                # 导出状态
│   │   │   ├── data/                 # 导出逻辑（生成 data.js、打包资源）
│   │   │   └── index.ts
│   │   │
│   │   └── presenter/                # 演示器模块
│   │       ├── components/           # 演示 UI（导航、全屏）
│   │       ├── hooks/                # 演示状态（播放、进度）
│   │       ├── data/                 # 演示数据加载（读取全局变量）
│   │       └── index.ts
│   │
│   ├── shared/                       # 共享层（无业务）
│   │   ├── types/                    # 核心数据契约
│   │   │   ├── paper.ts              # 演示文档与节点
│   │   │   ├── export.ts             # 导出配置与包结构
│   │   │   └── presentation.ts       # 演示配置
│   │   │
│   │   ├── components/               # 共享 UI 组件
│   │   │   └── ui/                   # shadcn/ui 组件
│   │   │
│   │   ├── lib/                      # 工具函数
│   │   │   ├── id.ts                 # ID 生成
│   │   │   ├── tree.ts               # 树结构操作
│   │   │   └── storage.ts            # 本地存储
│   │   │
│   │   └── hooks/                    # 共享 hooks
│   │
│   └── main.tsx                      # 入口
│
├── public/                           # 静态资源
├── index.html
├── PROJECT.md                        # 项目说明
├── FILE_PLAN.md                      # 本文件
└── package.json
```

## 模块依赖规则

```
app → features → shared
```

- **app**：只组装功能模块，不包含业务逻辑。
- **features**：业务模块，只能依赖 shared，不能跨模块引用。
- **shared**：纯工具与类型，不能依赖 app 或 features。

## 文件约束

- 单个 TypeScript 文件不超过 **1000 行**。
- 超过 300 行的文件应考虑拆分。
- 每个功能模块通过 `index.ts` 暴露公开 API。

## 数据流

```
编辑器（editor）
    ↓ 产生
PaperDocument（shared/types/paper）
    ↓ 导出
导出器（exporter）→ data.js + index.html + assets/
    ↓ 加载
演示器（presenter）→ 浏览器渲染
```

## 关键设计

### 编辑器与演示器共享数据契约

编辑器和演示器使用同一份 `PaperDocument` 类型，确保导出后数据结构一致。

### 多根节点与相对定位

`PaperDocument.rootIds` 是一份有序列表，文档可以同时存在多棵树。每棵树的子节点位置都由布局算法相对自己的根节点推算，根节点的 `layout.x/y` 是它在画布上的锚点；新增根节点时锚点自动排在现有内容下方。

### 锚点即舞台坐标

根节点锚点直接就是舞台坐标，不做整体归一化：只有内容越出舞台左上角内边距时，`ensureStageBounds` 才把所有根节点锚点整体平移回来。这样用户拖出来的位置会原样保留，画布也只在触碰到上/左边界时才重排。导出包里的演示器使用同一套公式，因此两边渲染结果逐像素一致。

### 结构编辑只属于编辑器

按住 Alt 拖动节点可以移动整棵树、挂到别的节点下、或拖到空白处脱离为新根，这些操作由 `editor/data/nodeDrag.ts`（纯拖动模型）+ `editor/lib/dragHitTest.ts`（DOM 命中）+ `editor/hooks/useNodeDrag.ts`（状态）实现，导出包里不包含任何一份，导出的演示器只能平移、缩放和选中。

### 文档级预设

`PaperDocument.defaults`（节点宽高、文字字号）是全局预设：节点没有单独设置尺寸时按预设渲染，文字没有单独设置字号时按预设字号渲染。预设属于宏观操作，只在未选中节点时的编辑栏里调整。

### 导出为零依赖静态包

- `data.js` 通过 `<script>` 挂载全局变量，避免 file:// 协议 CORS 问题。
- `index.html` 内联或引用本地资源，双击即用。
- 演示器代码打包为独立 bundle，不依赖编辑器。

### 节点布局与内容分离

- `NodeContent`：标题、摘要、正文（用户编辑）。
- `NodeLayout`：坐标、折叠状态（视图状态）。
- 两者合并为 `PaperNode`，但可独立更新。
