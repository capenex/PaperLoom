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
    Object.keys(cardsById).forEach(function (id) {
      var card = cardsById[id]
      var selected = id === selectedId
      card.classList.toggle('node-selected', selected)
      card.classList.toggle('node-expanded', id === expandedId)
      card.setAttribute('aria-pressed', selected ? 'true' : 'false')
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
    if (!node.content || node.content.kind !== 'image' || typeof node.content.src !== 'string') return
    detailImage.src = node.content.src
    detailImage.alt = typeof node.content.alt === 'string' ? node.content.alt : ''
    detailFrame.src = 'about:blank'
    detail.setAttribute('data-mode', 'image')
    detail.classList.add('is-open')
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

  function selectNode(nodeId) {
    var node = nodeId === null ? null : nodeById[nodeId]
    var isImage = node && node.content && node.content.kind === 'image'
    selectedId = nodeId
    if (!isImage) {
      expandedId = null
      closeDetail()
    } else if (expandedId !== nodeId) {
      expandedId = nodeId
      closeDetail()
    }
    renderState()
  }

  function activateNode(node) {
    if (expandedId === node.id) {
      openDetail(node)
      return
    }
    selectNode(node.id)
  }

  Object.keys(cardsById).forEach(function (id) {
    var card = cardsById[id]
    card.addEventListener('click', function (event) {
      event.stopPropagation()
      var anchor = refAnchorOf(event.target)
      if (anchor) {
        // 本地引用不跳转：单击只弹预览
        event.preventDefault()
        openRefPop(anchor)
        return
      }
      closeRefPop()
      activateNode(nodeById[id])
    })
    card.addEventListener('dblclick', function (event) {
      var anchor = refAnchorOf(event.target)
      if (!anchor) return
      event.stopPropagation()
      event.preventDefault()
      var ref = refOf(anchor)
      if (ref) openRefDetail(ref)
    })
    card.addEventListener('contextmenu', function (event) {
      event.stopPropagation()
    })
    card.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      activateNode(nodeById[id])
    })
  })

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
    selectNode(null)
  })
`
