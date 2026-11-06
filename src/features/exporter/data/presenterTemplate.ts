/** 导出包内演示器的自包含脚本（纯浏览器 JS，不依赖 React 或构建产物） */
export const PRESENTER_SCRIPT = `(function () {
  var DEFAULT_WIDTH = 208
  var DEFAULT_HEIGHT = 112
  var COLUMN_GAP = 96
  var ROW_GAP = 48
  var MIN_ROW_HEIGHT = 140
  var MIN_PADDING_X = 180
  var MIN_PADDING_Y = 100

  var data = window.PAPERLOOM_DATA
  var app = document.getElementById('app')
  if (!app) return
  if (!data || !data.document || !Array.isArray(data.document.nodes)) {
    app.textContent = '无法加载演示数据'
    return
  }

  var nodes = data.document.nodes
  var rootId = data.document.rootId
  var nodeById = {}
  var childrenOf = {}
  nodes.forEach(function (node) {
    nodeById[node.id] = node
    if (node.parentId === null) return
    if (!childrenOf[node.parentId]) childrenOf[node.parentId] = []
    childrenOf[node.parentId].push(node)
  })

  var rootNode = nodeById[rootId]
  if (!rootNode) {
    app.textContent = '未找到根节点'
    return
  }

  function sizeOf(node) {
    var width = node.layout && typeof node.layout.width === 'number' ? node.layout.width : DEFAULT_WIDTH
    var height = node.layout && typeof node.layout.height === 'number' ? node.layout.height : DEFAULT_HEIGHT
    return { width: width, height: height }
  }

  var columnWidths = []
  var maxDepth = 0
  var maxNodeHeight = 0
  function measure(node, depth) {
    var size = sizeOf(node)
    var currentWidth = columnWidths[depth] || 0
    if (size.width > currentWidth) columnWidths[depth] = size.width
    if (size.height > maxNodeHeight) maxNodeHeight = size.height
    if (depth > maxDepth) maxDepth = depth
    var children = childrenOf[node.id] || []
    children.forEach(function (child) {
      measure(child, depth + 1)
    })
  }
  measure(rootNode, 0)

  var widestColumn = 0
  columnWidths.forEach(function (width) {
    if (width > widestColumn) widestColumn = width
  })
  var paddingX = Math.max(MIN_PADDING_X, widestColumn / 2 + 48)
  var paddingY = Math.max(MIN_PADDING_Y, maxNodeHeight / 2 + 40)

  var columnOffsets = [paddingX]
  for (var depthIndex = 1; depthIndex <= maxDepth; depthIndex += 1) {
    columnOffsets[depthIndex] = columnOffsets[depthIndex - 1] + columnWidths[depthIndex - 1] + COLUMN_GAP
  }
  var rowHeight = Math.max(MIN_ROW_HEIGHT, maxNodeHeight + ROW_GAP)

  var positions = {}
  var leafIndex = 0
  function place(id, depth) {
    var children = childrenOf[id] || []
    var y
    if (children.length === 0) {
      y = paddingY + leafIndex * rowHeight
      leafIndex += 1
    } else {
      var ys = children.map(function (child) {
        return place(child.id, depth + 1)
      })
      y = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2
    }
    positions[id] = { x: columnOffsets[depth], y: y }
    return y
  }
  place(rootId, 0)

  var width = columnOffsets[maxDepth] + columnWidths[maxDepth] / 2 + paddingX
  var height = Math.max(paddingY * 2 + (leafIndex - 1) * rowHeight, 400)

  var stage = document.createElement('div')
  stage.className = 'stage'
  stage.style.width = width + 'px'
  stage.style.height = height + 'px'

  var svgNS = 'http://www.w3.org/2000/svg'
  var svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'connections')
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  svg.setAttribute('aria-hidden', 'true')

  nodes.forEach(function (node) {
    if (node.parentId === null) return
    var parentNode = nodeById[node.parentId]
    var source = positions[node.parentId]
    var target = positions[node.id]
    if (!parentNode || !source || !target) return
    var startX = source.x + sizeOf(parentNode).width / 2
    var endX = target.x - sizeOf(node).width / 2
    var controlX = (startX + endX) / 2
    var path = document.createElementNS(svgNS, 'path')
    path.setAttribute(
      'd',
      'M ' + startX + ' ' + source.y + ' C ' + controlX + ' ' + source.y +
        ', ' + controlX + ' ' + target.y + ', ' + endX + ' ' + target.y,
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#7c5cbf')
    path.setAttribute('stroke-width', '2')
    path.setAttribute('opacity', '0.45')
    svg.appendChild(path)
  })
  stage.appendChild(svg)

  nodes.forEach(function (node) {
    var position = positions[node.id]
    if (!position) return
    var size = sizeOf(node)
    var card = document.createElement('article')
    card.className = 'node' + (node.id === rootId ? ' node-root' : '')
    card.style.left = position.x + 'px'
    card.style.top = position.y + 'px'
    card.style.width = size.width + 'px'
    card.style.height = size.height + 'px'
    card.setAttribute('data-node-id', node.id)

    var richText = node.content.richText
    if (typeof richText === 'string' && richText.trim() !== '') {
      var rich = document.createElement('div')
      rich.className = 'node-rich-text'
      rich.innerHTML = richText
      rich.querySelectorAll('a').forEach(function (anchor) {
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
      })
      card.appendChild(rich)
    } else {
      var empty = document.createElement('span')
      empty.className = 'node-empty'
      empty.textContent = '空白节点'
      card.appendChild(empty)
    }
    stage.appendChild(card)
  })

  app.appendChild(stage)
  document.title = data.document.meta.title || 'PaperLoom'
})()
`

/** 导出包内演示器样式 */
export const PRESENTER_STYLES = `:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #0f172a;
  background-color: #fbfcfe;
  background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
  background-size: 24px 24px;
}

#app {
  display: flex;
  min-height: 100vh;
  padding: 40px;
  overflow: auto;
}

.stage {
  position: relative;
  flex-shrink: 0;
  margin: auto;
}

.connections {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.node-root {
  border-color: #1e293b;
  background: #0f172a;
  color: #fff;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.15);
}

.node-empty {
  margin: auto;
  font-size: 12px;
  color: #94a3b8;
}

.node-root .node-empty {
  color: #64748b;
}

.node-rich-text {
  min-height: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.6;
  color: #475569;
  overflow-wrap: anywhere;
}

.node-root .node-rich-text {
  color: #cbd5e1;
}

.node-rich-text p {
  margin: 0;
}

.node-rich-text p + p {
  margin-top: 4px;
}

.node-rich-text a {
  color: #7c3aed;
  text-decoration: underline;
}

.node-root .node-rich-text a {
  color: #c4b5fd;
}

.node-rich-text ul,
.node-rich-text ol {
  margin: 0;
  padding-left: 1.25em;
}

.node-rich-text ul {
  list-style: disc;
}

.node-rich-text ol {
  list-style: decimal;
}

@media (max-width: 640px) {
  #app {
    padding: 24px;
  }
}
`
