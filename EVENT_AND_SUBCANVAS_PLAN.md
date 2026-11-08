# PaperLoom 改动计划：图片 3x 挤压布局 + 节点事件绑定系统 + 支线子画布

> **说明**：本计划文件记录了待拉取 GitHub 最新代码后需要一并合入与实现的全部架构设计与改动清单。

---

## 一、 已完成待同步功能：图片节点扩大 50%（3x）并自动推开周围节点

在拉取 GitHub 最新版本后，需确保以下「图片 3x 放大 + 推开四周节点」改动完整保留：

1. **`src/shared/lib/nodeDefaults.ts`**
   - 导出常量 `export const EXPANDED_MEDIA_SCALE = 3`（由原 `2x` 扩大 50% 至 `3x`）。
2. **`src/features/editor/data/mediaExpansionLayout.ts`（独立纯算法模块）**
   - `displaceLayoutForExpandedMedia(baseLayout, nodes, defaults, expandedNodeId)`：
     - 保持 `baseLayout.width`、`baseLayout.height` 与放大图片节点的中心坐标 `center` 不变（防止画布跳动）。
     - 左侧列节点（`dx <= -halfW`）整体左推 `-pushX`，右侧列节点（`dx >= halfW`）整体右推 `+pushX`（其中 `pushX = (expW - baseW) / 2`）。
     - 同列上下方同级节点及其整棵子树（通过 `collectSubtreeIds`）分别向上/向下推开 `±pushY`（其中 `pushY = (expH - baseH) / 2`）。
     - 对仍有包围盒重叠的自由节点执行 `resolveResidualOverlap` 碰撞兜底（安全间距 `COLLISION_GAP = 24`）。
3. **`src/features/editor/components/EditorConnections.tsx`**
   - 接收 `expandedMediaNodeId`，计算连线起止宽度时对放大中的图片节点乘以 `EXPANDED_MEDIA_SCALE`。
   - `<svg>` 增加 `overflow-visible` 避免边缘连线被裁剪。
4. **`src/features/editor/components/EditorNode.tsx` & `EditorStage.tsx`**
   - `EditorNode` 使用 `scale(${EXPANDED_MEDIA_SCALE})`，并在非拖拽状态下开启 `transition-[transform,left,top,...] duration-250 ease-out` 实现平滑推开与归位过渡。
   - `EditorStage` 在 `viewLayoutOf` 中非拖拽时调用 `displaceLayoutForExpandedMedia`。
5. **离线导出器同步（`presenterStyles.ts` / `presenterRenderScript.ts` / `presenterInteractionScript.ts`）**
   - 同步 `scale(3)`、连线锚点动态重算与周围节点坐标推开。

---

## 二、 核心新功能设计：节点事件绑定系统（Node Event Binding）

### 1. 类型契约扩展（`src/shared/types/paper.ts`）

```ts
/** 子画布唯一标识 */
export type CanvasId = string

/** 节点事件触发方式 */
export type NodeEventTrigger =
  | 'double-click'   // 双击节点触发（默认推荐）
  | 'second-click'   // 选中状态下再次单击触发（兼容图片节点二次点击习惯）
  | 'click'          // 单击节点立即触发（适合轻量动画）

/** 节点事件执行动作 */
export type NodeEventAction =
  | {
      readonly type: 'open-detail'    // 在右侧详情栏展开（图片大图 / 静态文件全文）
    }
  | {
      readonly type: 'open-canvas'    // 展开并切换到关联的支线子画布
      readonly canvasId: CanvasId
    }
  | {
      readonly type: 'play-animation' // 播放节点视觉动效（为后续动画系统预留）
      readonly effect: 'pulse' | 'spotlight'
    }

/** 单个节点事件绑定项 */
export interface NodeEventBinding {
  readonly id: string
  readonly trigger: NodeEventTrigger
  readonly action: NodeEventAction
}

/** 支线子画布定义 */
export interface SubCanvas {
  readonly id: CanvasId
  /** 宿主节点 ID（该节点同时存在于上级画布与当前子画布中，两侧共享最新 content） */
  readonly hostNodeId: NodeId
  /** 子画布内的独立节点列表（包含 id === hostNodeId 的起始根节点及其支线子树） */
  readonly nodes: readonly PaperNode[]
  /** 子画布的根节点 ID 列表（默认包含 hostNodeId，也可在子画布中新增其他根节点） */
  readonly rootIds: readonly NodeId[]
}
```

并在 `PaperNode` 与 `PaperDocument` 上增加可选字段（向后兼容旧文档）：
- `PaperNode.events?: readonly NodeEventBinding[]`
- `PaperDocument.subCanvases?: Readonly<Record<CanvasId, SubCanvas>>`

---

### 2. 各类型节点的默认事件绑定（`src/features/editor/data/nodeEvents.ts`）

将原本硬编码在 `cardInteraction.ts` 里的「图片节点弹右栏」和「静态文件弹右栏」统一收敛为默认事件：

- **多媒体节点（`kind === 'image'`）**：
  - 创建图片节点或切换节点类型为 `image` 时，默认挂载事件：
    `{ id: createId(), trigger: 'second-click', action: { type: 'open-detail' } }`（支持在事件编辑器中一键改为 `'double-click'` 或替换为 `'open-canvas'`，也可删除）。
- **静态文件节点（`kind === 'file'`）**：
  - 创建或切换为 `file` 时，默认挂载事件：
    `{ id: createId(), trigger: 'double-click', action: { type: 'open-detail' } }`。
- **富文本 / 纯标题节点（`kind === 'text' | 'title'`）**：
  - 默认 `events: []`（双击默认进入文本编辑；当用户为其绑定了 `double-click` 事件如「展开支线画布」时，双击优先触发绑定事件）。

---

### 3. 支线子画布与「宿主节点同源投射」机制（`src/features/editor/data/subCanvas.ts`）

1. **创建并绑定支线画布（`ensureSubCanvasForNode`）**：
   - 当为某个节点 `node` 绑定 `open-canvas` 动作时，若其尚未关联 `canvasId`，自动生成一个新的 `SubCanvas`：
     - `hostNodeId: node.id`
     - 在子画布中放入一个同 ID（`node.id`）、相同 `content`、独立初始坐标 `{ x: 0, y: 0, collapsed: false }` 的根节点，以及一个初始支线子节点，方便打开即用。
2. **宿主节点跨画布内容双向同步（`syncHostNodeContent`）**：
   - 无论用户在**主画布**还是**支线子画布**中修改了 `hostNodeId` 的内容（富文本、标题、图片、静态文件、节点类型），同步更新主画布和对应子画布中该节点的 `content`。
   - 两侧的 `layout`（位置坐标）与父子连线（`parentId`）完全独立：主画布挂主线子节点，子画布挂支线探索子节点。
3. **子画布内宿主节点保护**：
   - 在子画布中，起始宿主节点（`node.id === subCanvas.hostNodeId`）不可被删除（`removeNode` 忽略宿主根），但允许自由拖动位置、修改内容、添加/删除其支线子节点。
4. **子画布内禁止自我递归跳转**：
   - 当已经处于 `activeCanvasId === canvasId` 的子画布内时，双击该宿主节点不再重复触发跳转到自身，而是直接进入常规内容编辑（双击即可改标题/富文本）。

---

### 4. 节点事件编辑器与画布导航 UI

1. **顶部操作栏「⚡ 事件」编辑器（`src/features/editor/components/NodeEventControl.tsx`）**：
   - 选中节点时在 `NodeInspector` 显示 `⚡ 事件 (N)` 按钮，点击展开事件编辑面板：
     - 列出当前节点的所有 `events`，每项可修改 **触发时机**（`双击节点` / `选中后再次单击` / `单击节点`）与 **执行动作**（`打开右侧详情栏` / `展开支线画布` / `播放脉冲高亮`）。
     - 当动作设为 `展开支线画布` 时，右侧显示 **`[ ↗ 进入画布 ]`** 按钮，可一键进入该支线画布。
     - 支持 **`[+ 添加事件]`**、**`[🗑 删除事件]`** 与 **`[恢复默认事件]`**。
   - 若富文本/纯标题节点的 `double-click` 被绑定事件占用，工具栏额外显示一个 **`[✏️ 编辑文字]`** 按钮（或支持 `Alt + 双击`），确保在主画布也能随时编辑文字。
2. **节点卡片支线/事件角标（`EditorNode.tsx`）**：
   - 绑定了 `open-canvas` 的节点，在卡片右上角显示精致的支线画布徽标（提示该节点可双击下钻展开支线）。
3. **画布左上角面包屑导航栈（`src/features/editor/components/CanvasBreadcrumbs.tsx`）**：
   - 维护画布导航栈 `canvasStack: readonly CanvasId[]`（空数组代表主画布，支持多层支线嵌套）。
   - 处于子画布时，画布左上角显示悬浮面包屑：`主画布 / 支线：<宿主节点标题>` 及 `返回上一级 (Esc)` 按钮。

---

## 三、 代码质量与架构红线检查清单

- **TypeScript 最严格模式**：`tsc -b` 零报错。
- **Oxlint 零警告零错误**：`npm run lint`（禁止 `as` 类型断言、禁止 `any`、禁止 `!` 非空断言，单文件 `<= 300` 行，单函数 `<= 50` 行）。
- **模块依赖方向检查**：`npm run lint:deps`（`shared` 不依赖 `features`，`features` 之间不互相耦合，所有跨端结构定义在 `src/shared/types/paper.ts`）。
- **单元测试覆盖**：在 `src/features/editor/data/document.test.ts` 中覆盖默认事件生成、事件增删改、支线子画布创建与宿主节点跨画布内容同步。
