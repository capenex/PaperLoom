/** 导出包内演示器的查看交互：平移、缩放、只读选中与图片放大（不含任何编辑能力） */
export const PRESENTER_INTERACTION_SCRIPT = `  var MIN_ZOOM = 0.3
  var MAX_ZOOM = 3
  var WHEEL_ZOOM_SPEED = 0.001
  var DRAG_THRESHOLD = 4
  var GRID_SIZE = 24

  var view = { zoom: 1, x: 0, y: 0 }
  var drag = null
  var dragged = false
  var selectedId = null
  var expandedId = null

  function applyView() {
    world.style.transform = 'translate(' + view.x + 'px, ' + view.y + 'px) scale(' + view.zoom + ')'
    canvas.style.backgroundSize = (GRID_SIZE * view.zoom) + 'px ' + (GRID_SIZE * view.zoom) + 'px'
    canvas.style.backgroundPosition = 'calc(50% + ' + view.x + 'px) calc(50% + ' + view.y + 'px)'
  }
  applyView()

  function isInteractiveTarget(target) {
    if (!target || !target.closest) return false
    return target.closest('[data-node-id], button, a') !== null
  }

  canvas.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return
    dragged = false
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: view.x, panY: view.y }
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch (error) {
      // 无法捕获指针时仍可用画布内移动继续拖动
    }
    canvas.classList.add('is-panning')
  })

  canvas.addEventListener('pointermove', function (event) {
    if (!drag || drag.pointerId !== event.pointerId) return
    var dx = event.clientX - drag.startX
    var dy = event.clientY - drag.startY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragged = true
    view.x = drag.panX + dx
    view.y = drag.panY + dy
    applyView()
  })

  function endPan(event) {
    if (!drag || drag.pointerId !== event.pointerId) return
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    drag = null
    canvas.classList.remove('is-panning')
  }
  canvas.addEventListener('pointerup', endPan)
  canvas.addEventListener('pointercancel', endPan)

  canvas.addEventListener('wheel', function (event) {
    event.preventDefault()
    var rect = canvas.getBoundingClientRect()
    var factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED)
    var zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor))
    var ratio = zoom / view.zoom
    view.x = (event.clientX - rect.left - rect.width / 2) * (1 - ratio) + view.x * ratio
    view.y = (event.clientY - rect.top - rect.height / 2) * (1 - ratio) + view.y * ratio
    view.zoom = zoom
    applyView()
  }, { passive: false })

  function renderState() {
    var activePositions = computeActivePositions(expandedId)
    Object.keys(cardsById).forEach(function (id) {
      var card = cardsById[id]
      var pos = activePositions[id]
      if (pos) {
        card.style.left = pos.x + 'px'
        card.style.top = pos.y + 'px'
      }
      var selected = id === selectedId
      card.classList.toggle('node-selected', selected)
      card.classList.toggle('node-expanded', id === expandedId)
      card.setAttribute('aria-pressed', selected ? 'true' : 'false')
    })
    Object.keys(pathsById).forEach(function (key) {
      var entry = pathsById[key]
      var node = nodeById[entry.nodeId]
      var parentNode = nodeById[entry.parentId]
      var source = activePositions[entry.parentId]
      var target = activePositions[entry.nodeId]
      if (!node || !parentNode || !source || !target) return
      entry.path.setAttribute(
        'd',
        connectionPathD(
          source,
          target,
          edgeWidthOf(parentNode, expandedId),
          edgeWidthOf(node, expandedId),
        ),
      )
    })
  }

  function closeDetail() {
    detail.classList.remove('is-open')
  }

  function collapseMedia() {
    expandedId = null
    closeDetail()
    renderState()
  }

  function openDetail(node) {
    if (!node || !node.content) return
    var c = node.content
    if (c.kind === 'image' && typeof c.src === 'string') {
      detailImage.src = c.src
      detailImage.alt = typeof c.alt === 'string' ? c.alt : ''
      detailFrame.src = 'about:blank'
      detail.setAttribute('data-mode', 'image')
      detail.classList.add('is-open')
      return
    }
    if (c.kind === 'file') {
      detailFrame.src = 'about:blank'
      detailFileName.textContent = c.fileName || '未命名文件'
      detailFileBadge.textContent = c.format === 'markdown' ? 'MD' : 'CODE'
      detailFilePre.textContent = typeof c.text === 'string' ? c.text : ''
      detail.setAttribute('data-mode', 'file')
      detail.classList.add('is-open')
    }
  }

  // 分界线拖动：横向范围 30%-70%
  var resizing = false

  function setDetailWidthPercent(percent) {
    detail.style.width = Math.min(70, Math.max(30, percent)) + '%'
  }

  detailResize.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    resizing = true
    try {
      detailResize.setPointerCapture(event.pointerId)
    } catch (error) {
      // 无法捕获指针时仍可用按下后的移动继续拖动
    }
  })
  detailResize.addEventListener('pointermove', function (event) {
    if (!resizing) return
    setDetailWidthPercent(((window.innerWidth - event.clientX) / window.innerWidth) * 100)
  })
  function stopResize() {
    resizing = false
  }
  detailResize.addEventListener('pointerup', stopResize)
  detailResize.addEventListener('pointercancel', stopResize)
  detailResize.addEventListener('keydown', function (event) {
    var delta = event.key === 'ArrowLeft' ? 2 : (event.key === 'ArrowRight' ? -2 : 0)
    if (delta === 0) return
    event.preventDefault()
    event.stopPropagation()
    setDetailWidthPercent((detail.offsetWidth / window.innerWidth) * 100 + delta)
  })

  // 原生 Web Animations API 辅助器：供支线画布过渡与后续动画事件统一调用，遵循系统减弱动态效果设置
  var prefersReducedMotion =
    Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  function animateElement(el, keyframes, options) {
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion) return null
    return el.animate(keyframes, options)
  }

  function switchCanvasSlice(targetCanvasId) {
    var slice = targetCanvasId === null ? data.document : subCanvases[targetCanvasId]
    if (!slice) return
    activeCanvasId = targetCanvasId
    selectedId = null
    expandedId = null
    closeDetail()
    closeRefPop()
    view = { zoom: 1, x: 0, y: 0 }
    applyView()
    computeSliceLayout(slice.nodes, slice.rootIds)
    renderStage()
    renderBreadcrumbs(navigateToCanvas, popSubCanvas)
    animateElement(
      stage,
      [
        { opacity: 0, transform: 'scale(0.97)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }

  function enterSubCanvas(canvasId) {
    if (!canvasId || canvasId === activeCanvasId || !subCanvases[canvasId]) return
    canvasStack = canvasStack.filter(function (id) { return id !== canvasId }).concat([canvasId])
    switchCanvasSlice(canvasId)
  }

  function navigateToCanvas(targetCanvasId) {
    if (targetCanvasId === activeCanvasId) return
    if (targetCanvasId === null) {
      canvasStack = []
      switchCanvasSlice(null)
      return
    }
    var idx = canvasStack.indexOf(targetCanvasId)
    if (idx === -1) return
    canvasStack = canvasStack.slice(0, idx + 1)
    switchCanvasSlice(targetCanvasId)
  }

  function popSubCanvas() {
    if (canvasStack.length === 0) return
    canvasStack = canvasStack.slice(0, -1)
    var nextId = canvasStack.length > 0 ? canvasStack[canvasStack.length - 1] : null
    switchCanvasSlice(nextId)
  }

  // 可扩展事件与动画派发表：后续新增事件或动画只需在此表注册对应 type 的处理函数
  var ACTION_HANDLERS = {
    'open-detail': function (ctx) {
      if (ctx.reference) openRefDetail(ctx.reference)
      else if (ctx.node) openDetail(ctx.node)
    },
    'open-reference-preview': function (ctx) {
      if (ctx.anchor) openRefPop(ctx.anchor, ctx.node)
    },
    'open-canvas': function (ctx, action) {
      if (action && action.canvasId) enterSubCanvas(action.canvasId)
    },
    'return-parent-canvas': function () {
      popSubCanvas()
    },
  }
  window.PAPERLOOM_ACTION_HANDLERS = ACTION_HANDLERS
  window.PAPERLOOM_ANIMATE = animateElement

  function dispatchEventAction(ctx, action) {
    if (!action || !action.type || action.type === 'edit-node') return
    var handler = ACTION_HANDLERS[action.type]
    if (typeof handler === 'function') handler(ctx, action)
  }

  function selectNode(nodeId) {
    var prevSelectedId = selectedId
    selectedId = nodeId
    expandedId = null
    if (nodeId === null || nodeId !== prevSelectedId) {
      closeDetail()
    }
    renderState()
  }

  function activateNode(node) {
    if (!node) return
    var card = cardsById[node.id] || null
    var alreadyActive = selectedId === node.id || (isImageNode(node) && expandedId === node.id)
    if (alreadyActive) {
      var secondBinding = findTriggeredEvent(node, 'second-click', activeCanvasId, 'node')
      if (secondBinding) {
        dispatchEventAction({ node: node, card: card }, secondBinding.action)
        return
      }
    }
    selectNode(node.id)
    var clickBinding = findTriggeredEvent(node, 'click', activeCanvasId, 'node')
    if (clickBinding) {
      dispatchEventAction({ node: node, card: card }, clickBinding.action)
    }
  }

  function fireReferenceTrigger(node, anchor, trigger) {
    var ref = refOf(anchor)
    if (!ref) return
    var binding = findTriggeredEvent(node, trigger, activeCanvasId, 'reference')
    if (!binding) return
    dispatchEventAction(
      { node: node, card: cardsById[node.id] || null, anchor: anchor, reference: ref },
      binding.action,
    )
  }

  function firePopupTrigger(trigger) {
    if (!popRef) return
    if (!popSourceNode) {
      if (trigger === 'click') openRefDetail(popRef)
      return
    }
    var binding = findTriggeredEvent(popSourceNode, trigger, activeCanvasId, 'reference-popup')
    if (!binding) return
    if (binding.action.type !== 'open-reference-preview' && binding.action.type !== 'open-detail') {
      closeRefPop()
    }
    dispatchEventAction(
      { node: popSourceNode, card: cardsById[popSourceNode.id] || null, reference: popRef },
      binding.action,
    )
  }

  popBody.addEventListener('click', function (event) {
    event.stopPropagation()
    firePopupTrigger('click')
  })
  popBody.addEventListener('dblclick', function (event) {
    event.stopPropagation()
    firePopupTrigger('double-click')
  })

  bindCardInteractions = function () {
    Object.keys(cardsById).forEach(function (id) {
      var card = cardsById[id]
      var node = nodeById[id]
      card.addEventListener('click', function (event) {
        event.stopPropagation()
        var anchor = refAnchorOf(event.target)
        if (anchor) {
          event.preventDefault()
          fireReferenceTrigger(node, anchor, 'click')
          return
        }
        closeRefPop()
        activateNode(node)
      })
      card.addEventListener('dblclick', function (event) {
        event.stopPropagation()
        var anchor = refAnchorOf(event.target)
        if (anchor) {
          event.preventDefault()
          fireReferenceTrigger(node, anchor, 'double-click')
          return
        }
        closeRefPop()
        var dblBinding = findTriggeredEvent(node, 'double-click', activeCanvasId, 'node')
        if (dblBinding) {
          dispatchEventAction({ node: node, card: card }, dblBinding.action)
        }
      })
      card.addEventListener('contextmenu', function (event) {
        event.preventDefault()
        event.stopPropagation()
      })
      card.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        activateNode(node)
      })
    })
  }
  bindCardInteractions()

  detailCollapse.addEventListener('click', function (event) {
    event.stopPropagation()
    closeDetail()
  })

  canvas.addEventListener('click', function () {
    if (dragged) return
    closeRefPop()
    selectNode(null)
  })
  canvas.addEventListener('contextmenu', function (event) {
    event.preventDefault()
    closeRefPop()
    collapseMedia()
  })
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return
    if (popRef) {
      closeRefPop()
      return
    }
    if (detail.classList.contains('is-open')) {
      closeDetail()
      return
    }
    if (selectedId !== null || expandedId !== null) {
      selectNode(null)
      return
    }
    if (canvasStack.length > 0) {
      popSubCanvas()
    }
  })
`
