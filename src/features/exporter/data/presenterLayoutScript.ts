/** 导出包内演示器的数据读取与多根布局（由 presenterScript 组装进同一个 IIFE） */
export const PRESENTER_LAYOUT_SCRIPT = `  var COLUMN_GAP = 96
  var ROW_GAP = 48
  var MIN_ROW_HEIGHT = 140
  var STAGE_PADDING_X = 96
  var STAGE_PADDING_Y = 80
  var MIN_STAGE_SIZE = 400
  var FALLBACK_WIDTH = 208
  var FALLBACK_HEIGHT = 112
  var FALLBACK_FONT_SIZE = 12

  var app = document.getElementById('app')
  if (!app) return

  var data = window.PAPERLOOM_DATA
  if (!data || !data.document || !Array.isArray(data.document.nodes)) {
    app.textContent = '无法加载演示数据'
    return
  }

  var nodes = data.document.nodes
  var rootIds = Array.isArray(data.document.rootIds) ? data.document.rootIds : []
  var preset = data.document.defaults || {}
  var defaultWidth = typeof preset.nodeWidth === 'number' ? preset.nodeWidth : FALLBACK_WIDTH
  var defaultHeight = typeof preset.nodeHeight === 'number' ? preset.nodeHeight : FALLBACK_HEIGHT
  var defaultFontSize = typeof preset.fontSize === 'number' ? preset.fontSize : FALLBACK_FONT_SIZE

  var nodeById = {}
  var childrenOf = {}
  nodes.forEach(function (node) {
    nodeById[node.id] = node
    if (node.parentId === null) return
    if (!childrenOf[node.parentId]) childrenOf[node.parentId] = []
    childrenOf[node.parentId].push(node)
  })

  function sizeOf(node) {
    var layout = node.layout || {}
    return {
      width: typeof layout.width === 'number' ? layout.width : defaultWidth,
      height: typeof layout.height === 'number' ? layout.height : defaultHeight,
    }
  }

  // 单棵子树的本地布局：根节点落在原点，子节点向右展开，父节点取子节点的垂直中点
  function layoutSubtree(rootId) {
    var columnWidths = []
    var maxNodeHeight = 0
    function measure(node, depth) {
      var size = sizeOf(node)
      if (size.width > (columnWidths[depth] || 0)) columnWidths[depth] = size.width
      if (size.height > maxNodeHeight) maxNodeHeight = size.height
      var children = childrenOf[node.id] || []
      children.forEach(function (child) {
        measure(child, depth + 1)
      })
    }
    measure(nodeById[rootId], 0)

    var columnOffsets = [0]
    for (var depth = 1; depth < columnWidths.length; depth += 1) {
      columnOffsets[depth] = columnOffsets[depth - 1] + (columnWidths[depth - 1] || 0) + COLUMN_GAP
    }
    var rowHeight = Math.max(MIN_ROW_HEIGHT, maxNodeHeight + ROW_GAP)

    var raw = {}
    var leafIndex = 0
    function place(id, placeDepth) {
      var children = childrenOf[id] || []
      var y
      if (children.length === 0) {
        y = leafIndex * rowHeight
        leafIndex += 1
      } else {
        var ys = children.map(function (child) {
          return place(child.id, placeDepth + 1)
        })
        y = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2
      }
      raw[id] = { x: columnOffsets[placeDepth] || 0, y: y }
      return y
    }
    place(rootId, 0)

    var rootEntry = raw[rootId]
    var rootY = rootEntry ? rootEntry.y : 0
    var local = {}
    Object.keys(raw).forEach(function (id) {
      local[id] = { x: raw[id].x, y: raw[id].y - rootY }
    })
    return local
  }

  // 每棵子树按自己根节点的锚点定位，再整体平移进舞台坐标
  var placed = []
  rootIds.forEach(function (rootId) {
    var root = nodeById[rootId]
    if (!root) return
    var anchor = root.layout || {}
    var local = layoutSubtree(rootId)
    Object.keys(local).forEach(function (id) {
      placed.push({
        id: id,
        x: (anchor.x || 0) + local[id].x,
        y: (anchor.y || 0) + local[id].y,
      })
    })
  })

  if (placed.length === 0) {
    app.textContent = '未找到根节点'
    return
  }

  var minX = Infinity
  var minY = Infinity
  var maxX = -Infinity
  var maxY = -Infinity
  placed.forEach(function (item) {
    var size = sizeOf(nodeById[item.id])
    minX = Math.min(minX, item.x - size.width / 2)
    minY = Math.min(minY, item.y - size.height / 2)
    maxX = Math.max(maxX, item.x + size.width / 2)
    maxY = Math.max(maxY, item.y + size.height / 2)
  })

  // 只有内容越出舞台左上角时才整体平移，编辑器里拖出来的位置原样保留
  var shiftX = Math.max(0, STAGE_PADDING_X - minX)
  var shiftY = Math.max(0, STAGE_PADDING_Y - minY)

  var positions = {}
  placed.forEach(function (item) {
    positions[item.id] = {
      x: item.x + shiftX,
      y: item.y + shiftY,
    }
  })

  var width = Math.max(maxX + shiftX + STAGE_PADDING_X, MIN_STAGE_SIZE)
  var height = Math.max(maxY + shiftY + STAGE_PADDING_Y, MIN_STAGE_SIZE)
`
