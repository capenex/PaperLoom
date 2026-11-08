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

  var subCanvases = data.document.subCanvases || {}
  var preset = data.document.defaults || {}
  var defaultWidth = typeof preset.nodeWidth === 'number' ? preset.nodeWidth : FALLBACK_WIDTH
  var defaultHeight = typeof preset.nodeHeight === 'number' ? preset.nodeHeight : FALLBACK_HEIGHT
  var defaultFontSize = typeof preset.fontSize === 'number' ? preset.fontSize : FALLBACK_FONT_SIZE

  var activeCanvasId = null
  var canvasStack = []
  var nodes = []
  var rootIds = []
  var nodeById = {}
  var childrenOf = {}
  var positions = {}
  var width = MIN_STAGE_SIZE
  var height = MIN_STAGE_SIZE

  function sizeOf(node) {
    var layout = (node && node.layout) || {}
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
      if (!node) return
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
      var halfSpan = Math.round(((columnWidths[depth - 1] || 0) + (columnWidths[depth] || 0)) / 2)
      columnOffsets[depth] = columnOffsets[depth - 1] + halfSpan + COLUMN_GAP
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

  function subtreeBoundsOf(items) {
    var sMinX = Infinity
    var sMinY = Infinity
    var sMaxX = -Infinity
    var sMaxY = -Infinity
    items.forEach(function (item) {
      var sz = sizeOf(nodeById[item.id])
      sMinX = Math.min(sMinX, item.x - sz.width / 2)
      sMinY = Math.min(sMinY, item.y - sz.height / 2)
      sMaxX = Math.max(sMaxX, item.x + sz.width / 2)
      sMaxY = Math.max(sMaxY, item.y + sz.height / 2)
    })
    return { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY }
  }

  function computeSliceLayout(sliceNodes, sliceRootIds) {
    nodes = Array.isArray(sliceNodes) ? sliceNodes : []
    rootIds = Array.isArray(sliceRootIds) ? sliceRootIds : []
    nodeById = {}
    childrenOf = {}
    nodes.forEach(function (node) {
      nodeById[node.id] = node
      if (node.parentId === null) return
      if (!childrenOf[node.parentId]) childrenOf[node.parentId] = []
      childrenOf[node.parentId].push(node)
    })

    var subtrees = []
    rootIds.forEach(function (rootId) {
      var root = nodeById[rootId]
      if (!root) return
      var anchor = root.layout || {}
      var local = layoutSubtree(rootId)
      var items = [{ id: rootId, x: anchor.x || 0, y: anchor.y || 0 }]
      Object.keys(local).forEach(function (id) {
        if (id === rootId) return
        items.push({
          id: id,
          x: (anchor.x || 0) + local[id].x,
          y: (anchor.y || 0) + local[id].y,
        })
      })
      subtrees.push(items)
    })

    for (var i = 0; i < subtrees.length; i += 1) {
      var rootA = subtrees[i][0]
      if (!rootA) continue
      var bA = subtreeBoundsOf(subtrees[i])
      for (var j = i + 1; j < subtrees.length; j += 1) {
        var rootB = subtrees[j][0]
        if (!rootB) continue
        var bB = subtreeBoundsOf(subtrees[j])
        var ovRight = bA.maxX + ROW_GAP - bB.minX
        var ovLeft = bB.maxX + ROW_GAP - bA.minX
        var ovDown = bA.maxY + ROW_GAP - bB.minY
        var ovUp = bB.maxY + ROW_GAP - bA.minY
        if (ovRight <= 0 || ovLeft <= 0 || ovDown <= 0 || ovUp <= 0) continue
        var rDx = rootB.x - rootA.x
        var rDy = rootB.y - rootA.y
        var pVert = rDy >= 0 ? ovDown : -ovUp
        var pHoriz = rDx >= 0 ? ovRight : -ovLeft
        var useHoriz = Math.abs(rDx) > Math.abs(rDy) && Math.abs(pHoriz) < Math.abs(pVert)
        var dx = useHoriz ? pHoriz : 0
        var dy = useHoriz ? 0 : pVert
        subtrees[j] = subtrees[j].map(function (it) {
          return { id: it.id, x: it.x + dx, y: it.y + dy }
        })
      }
    }

    var placed = []
    subtrees.forEach(function (items) {
      items.forEach(function (it) {
        placed.push(it)
      })
    })

    if (placed.length === 0) {
      positions = {}
      width = MIN_STAGE_SIZE
      height = MIN_STAGE_SIZE
      return false
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

    var shiftX = Math.max(0, STAGE_PADDING_X - minX)
    var shiftY = Math.max(0, STAGE_PADDING_Y - minY)
    positions = {}
    placed.forEach(function (item) {
      positions[item.id] = { x: item.x + shiftX, y: item.y + shiftY }
    })
    width = Math.max(maxX + shiftX + STAGE_PADDING_X, MIN_STAGE_SIZE)
    height = Math.max(maxY + shiftY + STAGE_PADDING_Y, MIN_STAGE_SIZE)
    return true
  }

  if (!computeSliceLayout(data.document.nodes, data.document.rootIds)) {
    app.textContent = '未找到根节点'
    return
  }

  var DEFAULT_IMAGE_EVENTS = [
    { id: 'default-image-open-detail', target: 'node', trigger: 'second-click', action: { type: 'open-detail' } },
  ]
  var DEFAULT_FILE_EVENTS = [
    { id: 'default-file-open-detail', target: 'node', trigger: 'double-click', action: { type: 'open-detail' } },
  ]
  var DEFAULT_REFERENCE_EVENTS = [
    { id: 'default-reference-open-preview', target: 'reference', trigger: 'click', action: { type: 'open-reference-preview' } },
    { id: 'default-reference-open-detail', target: 'reference', trigger: 'double-click', action: { type: 'open-detail' } },
    { id: 'default-popup-open-detail', target: 'reference-popup', trigger: 'click', action: { type: 'open-detail' } },
  ]

  function defaultEventsForNode(node) {
    var content = (node && node.content) || {}
    if (content.kind === 'image') return DEFAULT_IMAGE_EVENTS
    if (content.kind === 'file') return DEFAULT_FILE_EVENTS
    if (content.kind === 'text' && typeof content.richText === 'string' && content.richText.indexOf('data-pl-ref') !== -1) {
      return DEFAULT_REFERENCE_EVENTS
    }
    return []
  }

  function resolveNodeEvents(node) {
    if (!node) return []
    return Array.isArray(node.events) ? node.events : defaultEventsForNode(node)
  }

  var DEFAULT_HOST_EXIT_EVENT = {
    id: 'default-host-return-parent-canvas',
    target: 'node',
    trigger: 'double-click',
    action: { type: 'return-parent-canvas' },
  }

  function isActionActiveInCanvas(action, canvasId) {
    if (!action || !action.type || action.type === 'edit-node') return false
    if (action.type === 'return-parent-canvas') return Boolean(canvasId)
    if (action.type === 'open-canvas') {
      return Boolean(action.canvasId && action.canvasId !== canvasId && subCanvases[action.canvasId])
    }
    return true
  }

  function findTriggeredEvent(node, trigger, canvasId, target) {
    if (!node) return null
    var expectedTarget = target || 'node'
    var isSubCanvasHost = Boolean(
      canvasId && subCanvases[canvasId] && subCanvases[canvasId].hostNodeId === node.id,
    )
    var list = resolveNodeEvents(node)
    for (var i = 0; i < list.length; i += 1) {
      var binding = list[i]
      var bTarget = (binding && binding.target) || 'node'
      if (
        bTarget === expectedTarget &&
        binding.trigger === trigger &&
        isActionActiveInCanvas(binding.action, canvasId)
      ) {
        if (isSubCanvasHost && expectedTarget === 'node' && trigger === 'double-click') {
          if (binding.action.type === 'open-canvas' || binding.action.type === 'return-parent-canvas') {
            return binding
          }
          continue
        }
        return binding
      }
    }
    if (isSubCanvasHost && expectedTarget === 'node' && trigger === 'double-click') {
      return DEFAULT_HOST_EXIT_EVENT
    }
    return null
  }

  function findBoundSubCanvasId(node, canvasId) {
    var list = resolveNodeEvents(node)
    for (var i = 0; i < list.length; i += 1) {
      var binding = list[i]
      var bTarget = (binding && binding.target) || 'node'
      if (
        bTarget === 'node' &&
        binding.action &&
        binding.action.type === 'open-canvas' &&
        binding.action.canvasId &&
        binding.action.canvasId !== canvasId &&
        subCanvases[binding.action.canvasId]
      ) {
        return binding.action.canvasId
      }
    }
    return null
  }

  function findNodeAcrossDocument(nodeId) {
    var mainList = data.document.nodes || []
    for (var i = 0; i < mainList.length; i += 1) {
      if (mainList[i].id === nodeId) return mainList[i]
    }
    var subIds = Object.keys(subCanvases)
    for (var j = 0; j < subIds.length; j += 1) {
      var sNodes = (subCanvases[subIds[j]] && subCanvases[subIds[j]].nodes) || []
      for (var k = 0; k < sNodes.length; k += 1) {
        if (sNodes[k].id === nodeId) return sNodes[k]
      }
    }
    return null
  }

  function summarizeNodeTitle(node) {
    if (!node || !node.content) return '支线画布'
    var c = node.content
    if (c.kind === 'title') return (c.title || '').trim() || '未命名标题'
    if (c.kind === 'image') return (c.alt || '').trim() || '图片支线'
    if (c.kind === 'file') return (c.fileName || '').trim() || '文件支线'
    var tmp = document.createElement('div')
    tmp.innerHTML = c.richText || ''
    var txt = (tmp.textContent || '').trim()
    if (!txt) return '支线探索'
    return txt.length > 18 ? txt.slice(0, 18) + '…' : txt
  }

  var EXPANDED_MEDIA_SCALE = 1.5
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
