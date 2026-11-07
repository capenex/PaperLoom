/** 导出包内演示器的数据读取与多根布局（由 presenterScript 组装进同一个 IIFE） */
export const PRESENTER_LAYOUT_SCRIPT = `  var COLUMN_GAP = 96
  var ROW_GAP = 48
  var MIN_ROW_HEIGHT = 140
  var STAGE_PADDING_X = 96
  var STAGE_PADDING_Y = 80
  var MIN_STAGE_SIZE = 400
  var FALLBACK_WIDTH = 208
  var FALLBACK_HEIGHT = 112
  var FALLBACK_FONT_SIZE = 16

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

  var EXPANDED_MEDIA_SCALE = 3
  var COLLISION_GAP = 24

  function isImageNode(node) {
    var content = node.content || {}
    return content.kind === 'image' && typeof content.src === 'string'
  }

  // 推开之后仍与放大框相交的节点，沿重叠更小的那根轴再挪开一次
  function resolveResidualOverlap(point, size, center, expandedWidth, expandedHeight) {
    var overlapX = expandedWidth / 2 + size.width / 2 + COLLISION_GAP - Math.abs(point.x - center.x)
    var overlapY = expandedHeight / 2 + size.height / 2 + COLLISION_GAP - Math.abs(point.y - center.y)
    if (overlapX <= 0 || overlapY <= 0) return point
    if (overlapX < overlapY) {
      return { x: point.x + (point.x < center.x ? -overlapX : overlapX), y: point.y }
    }
    return { x: point.x, y: point.y + (point.y < center.y ? -overlapY : overlapY) }
  }

  // 放大的图片自己不参与位移，但要继续往下遍历，否则它的子树会漏标
  function markSubtreeShift(shifts, id, shiftY, expandedId) {
    if (id !== expandedId) {
      if (shifts[id] !== undefined) return
      shifts[id] = shiftY
    }
    var children = childrenOf[id] || []
    children.forEach(function (child) {
      markSubtreeShift(shifts, child.id, shiftY, expandedId)
    })
  }

  // 与编辑器 mediaExpansionLayout 同一套公式：放大图片中心不动，左右整列推开、上下整棵子树推开
  function computeActivePositions(expandedId) {
    var expandedNode = expandedId === null ? null : nodeById[expandedId]
    if (!expandedNode || !isImageNode(expandedNode) || !positions[expandedId]) return positions

    var center = positions[expandedId]
    var baseSize = sizeOf(expandedNode)
    var expandedWidth = baseSize.width * EXPANDED_MEDIA_SCALE
    var expandedHeight = baseSize.height * EXPANDED_MEDIA_SCALE
    var halfWidth = baseSize.width / 2
    var pushX = (expandedWidth - baseSize.width) / 2
    var pushY = (expandedHeight - baseSize.height) / 2

    var verticalShifts = {}
    nodes.forEach(function (node) {
      if (node.id === expandedId) return
      var pos = positions[node.id]
      if (!pos || Math.abs(pos.x - center.x) >= halfWidth) return
      markSubtreeShift(verticalShifts, node.id, pos.y < center.y ? -pushY : pushY, expandedId)
    })

    var next = {}
    nodes.forEach(function (node) {
      var pos = positions[node.id]
      if (!pos) return
      if (node.id === expandedId) {
        next[node.id] = pos
        return
      }
      var dx = pos.x - center.x
      var offsetX = dx <= -halfWidth ? -pushX : (dx >= halfWidth ? pushX : 0)
      var shifted = { x: pos.x + offsetX, y: pos.y + (verticalShifts[node.id] || 0) }
      next[node.id] = resolveResidualOverlap(shifted, sizeOf(node), center, expandedWidth, expandedHeight)
    })
    return next
  }

  function edgeWidthOf(node, expandedId) {
    var baseWidth = sizeOf(node).width
    return node.id === expandedId && isImageNode(node) ? baseWidth * EXPANDED_MEDIA_SCALE : baseWidth
  }

  // 连线从父卡片右边缘连到子卡片左边缘；初次渲染与放大位移后共用同一条公式
  function connectionPathD(source, target, sourceWidth, targetWidth) {
    var startX = source.x + sourceWidth / 2
    var endX = target.x - targetWidth / 2
    var controlX = (startX + endX) / 2
    return 'M ' + startX + ' ' + source.y + ' C ' + controlX + ' ' + source.y +
      ', ' + controlX + ' ' + target.y + ', ' + endX + ' ' + target.y
  }
`
