/** 导出包内演示器的只读节点渲染（支持主画布与支线子画布切换、支线徽标、面包屑与文件全文详情） */
export const PRESENTER_RENDER_SCRIPT = `  app.className = 'presenter'
  var canvas = document.createElement('div')
  canvas.className = 'canvas'
  canvas.setAttribute('role', 'application')
  canvas.setAttribute('aria-label', '演示画布')

  var breadcrumbsBar = document.createElement('nav')
  breadcrumbsBar.className = 'breadcrumbs'
  breadcrumbsBar.setAttribute('aria-label', '画布层级导航')
  canvas.appendChild(breadcrumbsBar)

  var center = document.createElement('div')
  center.className = 'canvas-center'
  var world = document.createElement('div')
  world.className = 'world'
  var stage = document.createElement('div')
  stage.className = 'stage'

  var svgNS = 'http://www.w3.org/2000/svg'
  var pathsById = {}
  var bridgesById = {}
  var cardsById = {}
  var nodePageById = {}
  var pageSwitchersById = {}
  var detailImageNodeId = null
  var bindCardInteractions = null

  function splitRichTextPages(richText) {
    if (typeof richText !== 'string' || richText.trim() === '') return ['']
    var parts = richText.split(/<hr\b[^>]*data-pl-page-break[^>]*>/i)
    return parts.length > 0 ? parts : [richText]
  }

  function imageItemsOf(content) {
    if (content.items && content.items.length > 0) return content.items
    return [{ src: content.src, alt: content.alt }]
  }

  function imageActiveIndexOf(content, items) {
    var index = typeof content.activeIndex === 'number' ? content.activeIndex : 0
    return Math.max(0, Math.min(items.length - 1, index))
  }

  function appendNodePager(card, onStep) {    var pager = document.createElement('div')
    pager.className = 'node-pager'
    pager.setAttribute('role', 'group')
    pager.setAttribute('aria-label', '节点翻页')
    ;['pointerdown', 'click', 'dblclick'].forEach(function (evName) {
      pager.addEventListener(evName, function (ev) {
        ev.stopPropagation()
      })
    })
    var prev = document.createElement('button')
    prev.type = 'button'
    prev.className = 'node-pager-btn'
    prev.setAttribute('aria-label', '上一页')
    prev.textContent = '‹'
    prev.addEventListener('click', function () {
      onStep(-1)
    })
    var label = document.createElement('span')
    label.className = 'node-pager-label'
    var next = document.createElement('button')
    next.type = 'button'
    next.className = 'node-pager-btn'
    next.setAttribute('aria-label', '下一页')
    next.textContent = '›'
    next.addEventListener('click', function () {
      onStep(1)
    })
    pager.appendChild(prev)
    pager.appendChild(label)
    pager.appendChild(next)
    card.appendChild(pager)
    return { label: label, prev: prev, next: next }
  }

  // 隐藏节点照常占位但不出卡片；仅当两侧都有可见节点时用一段横线把两端接成一根
  function isHiddenNode(node) {
    return node.isHidden === true
  }

  function placeBridge(line, node, center) {
    if (!center) return
    var halfWidth = sizeOf(node).width / 2
    line.setAttribute('x1', String(center.x - halfWidth))
    line.setAttribute('x2', String(center.x + halfWidth))
    line.setAttribute('y1', String(center.y))
    line.setAttribute('y2', String(center.y))
  }

  function appendNodeBadge(card, hasSubCanvas, isHostRoot) {
    if (!hasSubCanvas && !isHostRoot) return
    var badge = document.createElement('span')
    badge.className = isHostRoot ? 'node-badge is-host' : 'node-badge'
    badge.textContent = isHostRoot ? '支线起点' : '支线'
    card.appendChild(badge)
    if (isHostRoot && !hasSubCanvas) {
      card.title = '双击返回上级画布'
    }
  }

  function renderBreadcrumbs(onNavigate, onPop) {
    breadcrumbsBar.textContent = ''
    if (canvasStack.length === 0) {
      breadcrumbsBar.classList.remove('is-visible')
      return
    }
    breadcrumbsBar.classList.add('is-visible')

    var backBtn = document.createElement('button')
    backBtn.type = 'button'
    backBtn.className = 'breadcrumb-back'
    backBtn.textContent = '← 返回上级'
    backBtn.title = '返回上一级画布（快捷键 Esc）'
    backBtn.addEventListener('click', function (event) {
      event.stopPropagation()
      onPop()
    })
    breadcrumbsBar.appendChild(backBtn)

    var sep = document.createElement('span')
    sep.className = 'breadcrumb-divider'
    breadcrumbsBar.appendChild(sep)

    var items = [{ canvasId: null, label: '主画布' }]
    canvasStack.forEach(function (cid) {
      var sub = subCanvases[cid]
      var hostNode = sub ? findNodeAcrossDocument(sub.hostNodeId) : null
      items.push({ canvasId: cid, label: '支线：' + summarizeNodeTitle(hostNode) })
    })

    items.forEach(function (item, idx) {
      if (idx > 0) {
        var arrow = document.createElement('span')
        arrow.className = 'breadcrumb-sep'
        arrow.textContent = '›'
        breadcrumbsBar.appendChild(arrow)
      }
      var isLast = idx === items.length - 1
      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = isLast ? 'breadcrumb-item is-current' : 'breadcrumb-item'
      btn.textContent = item.label
      btn.disabled = isLast
      if (!isLast) {
        btn.addEventListener('click', function (event) {
          event.stopPropagation()
          onNavigate(item.canvasId)
        })
      }
      breadcrumbsBar.appendChild(btn)
    })
  }

  function renderStage() {
    stage.textContent = ''
    stage.style.width = width + 'px'
    stage.style.height = height + 'px'
    pathsById = {}
    bridgesById = {}
    cardsById = {}
    pageSwitchersById = {}
    var hasVisibleParent = {}
    var hasVisibleChild = {}
    nodes.forEach(function (node) {
      var parentIds = Array.isArray(node.parentIds) ? node.parentIds : []
      parentIds.forEach(function (parentId) {
        var parentNode = nodeById[parentId]
        if (!parentNode) return
        if (!isHiddenNode(parentNode)) hasVisibleParent[node.id] = true
        if (!isHiddenNode(node)) hasVisibleChild[parentId] = true
      })
    })

    var svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('class', 'connections')
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
    svg.setAttribute('aria-hidden', 'true')

    nodes.forEach(function (node) {
      var parentIds = Array.isArray(node.parentIds) ? node.parentIds : []
      parentIds.forEach(function (parentId) {
        var parentNode = nodeById[parentId]
        var source = positions[parentId]
        var target = positions[node.id]
        if (!parentNode || !source || !target) return
        var faded =
          (isHiddenNode(parentNode) && (!hasVisibleParent[parentId] || !hasVisibleChild[parentId])) ||
          (isHiddenNode(node) && (!hasVisibleParent[node.id] || !hasVisibleChild[node.id]))
        if (faded) return
        var path = document.createElementNS(svgNS, 'path')
        path.setAttribute(
          'd',
          connectionPathD(source, target, sizeOf(parentNode).width, sizeOf(node).width),
        )
        path.setAttribute('fill', 'none')
        path.setAttribute('stroke', '#7c5cbf')
        path.setAttribute('stroke-width', '2')
        path.setAttribute('opacity', '0.45')
        pathsById[node.id + ':' + parentId] = { path: path, nodeId: node.id, parentId: parentId }
        svg.appendChild(path)
      })
    })
    nodes.forEach(function (node) {
      if (!isHiddenNode(node) || !hasVisibleParent[node.id] || !hasVisibleChild[node.id]) return
      var line = document.createElementNS(svgNS, 'line')
      line.setAttribute('stroke', '#7c5cbf')
      line.setAttribute('stroke-width', '2')
      line.setAttribute('opacity', '0.45')
      bridgesById[node.id] = line
      placeBridge(line, node, positions[node.id])
      svg.appendChild(line)
    })
    stage.appendChild(svg)

    var activeHostNodeId =
      activeCanvasId && subCanvases[activeCanvasId] ? subCanvases[activeCanvasId].hostNodeId : null

    nodes.forEach(function (node) {
      var position = positions[node.id]
      if (!position || isHiddenNode(node)) return
      var size = sizeOf(node)
      var card = document.createElement('article')
      card.className = 'node'
      card.style.left = position.x + 'px'
      card.style.top = position.y + 'px'
      card.style.width = size.width + 'px'
      card.style.height = size.height + 'px'
      card.setAttribute('data-node-id', node.id)
      card.setAttribute('role', 'button')
      card.setAttribute('aria-pressed', 'false')
      card.tabIndex = 0
      cardsById[node.id] = card

      var hasSubCanvas = findBoundSubCanvasId(node, activeCanvasId) !== null
      var isHostRoot = node.id === activeHostNodeId
      appendNodeBadge(card, hasSubCanvas, isHostRoot)

      var content = node.content || {}
      var branchHint = hasSubCanvas ? '，双击展开支线画布' : ''

      if (content.kind === 'image' && typeof content.src === 'string') {
        card.classList.add('node-media-card')
        var media = document.createElement('div')
        media.className = 'node-media'
        var image = document.createElement('img')
        var imgItems = imageItemsOf(content)
        var imgCount = imgItems.length
        var imgIndex = typeof nodePageById[node.id] === 'number'
          ? nodePageById[node.id]
          : imageActiveIndexOf(content, imgItems)
        image.alt = typeof content.alt === 'string' ? content.alt : ''
        image.draggable = false
        media.appendChild(image)
        card.appendChild(media)
        var imgLabel = null
        var imgPrev = null
        var imgNext = null
        function applyImagePage(nextIdx) {
          var clamped = Math.max(0, Math.min(imgCount - 1, nextIdx))
          imgIndex = clamped
          nodePageById[node.id] = clamped
          image.src = imgItems[clamped].src
          if (imgLabel) imgLabel.textContent = (clamped + 1) + '/' + imgCount
          if (imgPrev) imgPrev.disabled = clamped <= 0
          if (imgNext) imgNext.disabled = clamped >= imgCount - 1
          if (detailImageNodeId === node.id) detailImage.src = imgItems[clamped].src
        }
        if (imgCount > 1) {
          var imgPager = appendNodePager(card, function (delta) {
            applyImagePage(imgIndex + delta)
          })
          imgLabel = imgPager.label
          imgPrev = imgPager.prev
          imgNext = imgPager.next
          pageSwitchersById[node.id] = {
            count: imgCount,
            current: function () { return imgIndex },
            apply: applyImagePage,
          }
        }
        applyImagePage(imgIndex)
        var imageLabel = image.alt === '' ? '未命名图片' : image.alt
        card.setAttribute('aria-label', '图片节点：' + imageLabel + '，双击在左侧展开大图' + branchHint)
        card.title = hasSubCanvas ? '双击展开支线画布；双击弹出左栏大图' : '双击弹出左栏大图'
      } else if (content.kind === 'title') {
        var titleBox = document.createElement('div')
        titleBox.className = 'node-title-box'
        var mainTitle = typeof content.title === 'string' ? content.title.trim() : ''
        var subTitle = typeof content.subtitle === 'string' ? content.subtitle.trim() : ''
        if (mainTitle === '' && subTitle === '') {
          var emptyTitle = document.createElement('span')
          emptyTitle.className = 'node-empty'
          emptyTitle.textContent = '空白标题'
          card.appendChild(emptyTitle)
        } else {
          if (mainTitle !== '') {
            var tEl = document.createElement('div')
            tEl.className = 'node-title-main'
            tEl.style.fontSize = Math.round(defaultFontSize * 1.15) + 'px'
            tEl.textContent = mainTitle
            titleBox.appendChild(tEl)
          }
          if (subTitle !== '') {
            var sEl = document.createElement('div')
            sEl.className = 'node-title-sub'
            sEl.style.fontSize = Math.max(12, Math.round(defaultFontSize * 0.82)) + 'px'
            sEl.textContent = subTitle
            titleBox.appendChild(sEl)
          }
          card.appendChild(titleBox)
        }
        card.setAttribute('aria-label', '标题节点：' + (mainTitle || subTitle || '空白标题') + branchHint)
        if (hasSubCanvas) card.title = '双击展开支线画布'
      } else if (content.kind === 'file') {
        card.classList.add('node-file-card')
        var fHead = document.createElement('div')
        fHead.className = 'node-file-head'
        var fName = document.createElement('span')
        fName.className = 'node-file-name'
        fName.textContent = content.fileName || '未命名文件'
        var fBadge = document.createElement('span')
        fBadge.className = 'node-file-badge'
        fBadge.textContent = content.format === 'markdown' ? 'MD' : 'CODE'
        fHead.appendChild(fName)
        fHead.appendChild(fBadge)
        var fPre = document.createElement('pre')
        fPre.className = 'node-file-pre'
        fPre.style.fontSize = Math.max(11, Math.round(defaultFontSize * 0.78)) + 'px'
        fPre.textContent = typeof content.text === 'string' ? content.text : ''
        card.appendChild(fHead)
        card.appendChild(fPre)
        card.setAttribute('aria-label', '静态文件节点：' + (content.fileName || '未命名文件') + (branchHint || '，双击在左侧展开查看全文'))
        card.title = hasSubCanvas ? '双击展开支线画布' : '双击在左侧展开查看全文'
      } else {
        var labelText = '空白节点'
        var richText = content.richText
        if (typeof richText === 'string' && richText.trim() !== '') {
          var pages = splitRichTextPages(richText)
          var rich = document.createElement('div')
          rich.className = pages.length > 1 ? 'node-rich-text has-pager' : 'node-rich-text'
          rich.style.fontSize = defaultFontSize + 'px'
          card.appendChild(rich)

          var richPager = null

          function renderNodePage(nextIdx) {
            var clamped = Math.max(0, Math.min(pages.length - 1, nextIdx))
            nodePageById[node.id] = clamped
            var pageHtml = pages[clamped] || ''
            rich.innerHTML = pageHtml
            rich.querySelectorAll('a').forEach(function (anchor) {
              if (anchor.hasAttribute('data-pl-ref')) return
              anchor.setAttribute('target', '_blank')
              anchor.setAttribute('rel', 'noopener noreferrer')
            })
            if (richPager) {
              richPager.label.textContent = (clamped + 1) + '/' + pages.length
              richPager.prev.disabled = clamped <= 0
              richPager.next.disabled = clamped >= pages.length - 1
            }
          }

          if (pages.length > 1) {
            richPager = appendNodePager(card, function (delta) {
              renderNodePage((nodePageById[node.id] || 0) + delta)
              if (bindCardInteractions) bindCardInteractions()
            })
            pageSwitchersById[node.id] = {
              count: pages.length,
              current: function () { return nodePageById[node.id] || 0 },
              apply: function (nextIdx) { renderNodePage(nextIdx) },
            }
          }

          renderNodePage(nodePageById[node.id] || 0)
          var text = rich.textContent || ''
          if (text !== '') labelText = text.length > 40 ? text.slice(0, 40) + '…' : text
        } else {
          var empty = document.createElement('span')
          empty.className = 'node-empty'
          empty.textContent = '空白节点'
          card.appendChild(empty)
        }
        card.setAttribute('aria-label', '节点：' + labelText + branchHint)
        if (hasSubCanvas) card.title = '双击展开支线画布'
      }
      stage.appendChild(card)
    })

    if (bindCardInteractions) bindCardInteractions()
  }

  function switchNodePage(nodeId, mode, targetPageIndex) {
    var driver = pageSwitchersById[nodeId]
    if (!driver || driver.count <= 1) return
    var current = driver.current()
    var next = 0
    if (mode === 'first') {
      next = 0
    } else if (mode === 'last') {
      next = driver.count - 1
    } else if (mode === 'next-loop') {
      next = (current + 1) % driver.count
    } else if (mode === 'prev-loop') {
      next = (current - 1 + driver.count) % driver.count
    } else {
      var index = typeof targetPageIndex === 'number' ? targetPageIndex : 0
      next = Math.max(0, Math.min(driver.count - 1, index))
    }
    driver.apply(next)
  }
  window.PAPERLOOM_SWITCH_NODE_PAGE = switchNodePage

  renderStage()
  world.appendChild(stage)
  center.appendChild(world)
  canvas.appendChild(center)

  var detail = document.createElement('aside')
  detail.className = 'detail'
  detail.setAttribute('aria-label', '引用详情')
  var detailCollapse = document.createElement('button')
  detailCollapse.type = 'button'
  detailCollapse.className = 'detail-collapse'
  detailCollapse.setAttribute('aria-label', '收起左侧详情')
  detailCollapse.title = '收起左侧详情'
  detailCollapse.textContent = '‹'
  var detailImage = document.createElement('img')
  detailImage.alt = ''
  detailImage.draggable = false
  var detailFrame = document.createElement('iframe')
  detailFrame.className = 'detail-frame'
  detailFrame.title = '引用内容'
  var detailPdf = document.createElement('div')
  detailPdf.className = 'detail-pdf'
  var detailPdfBar = document.createElement('div')
  detailPdfBar.className = 'detail-pdf-bar'
  var detailPdfPrev = document.createElement('button')
  detailPdfPrev.type = 'button'
  detailPdfPrev.className = 'detail-pdf-prev'
  detailPdfPrev.setAttribute('aria-label', '上一页')
  detailPdfPrev.textContent = '‹'
  var detailPdfLabel = document.createElement('span')
  detailPdfLabel.className = 'detail-pdf-label'
  detailPdfLabel.setAttribute('aria-live', 'polite')
  var detailPdfNext = document.createElement('button')
  detailPdfNext.type = 'button'
  detailPdfNext.className = 'detail-pdf-next'
  detailPdfNext.setAttribute('aria-label', '下一页')
  detailPdfNext.textContent = '›'
  detailPdfBar.appendChild(detailPdfPrev)
  detailPdfBar.appendChild(detailPdfLabel)
  detailPdfBar.appendChild(detailPdfNext)
  var detailPdfScroll = document.createElement('div')
  detailPdfScroll.className = 'detail-pdf-scroll'
  var detailPdfCanvas = document.createElement('canvas')
  detailPdfCanvas.className = 'detail-pdf-canvas'
  detailPdfScroll.appendChild(detailPdfCanvas)
  detailPdf.appendChild(detailPdfBar)
  detailPdf.appendChild(detailPdfScroll)

  var detailFile = document.createElement('div')
  detailFile.className = 'detail-file'
  var detailFileHead = document.createElement('div')
  detailFileHead.className = 'detail-file-head'
  var detailFileName = document.createElement('span')
  detailFileName.className = 'detail-file-name'
  var detailFileBadge = document.createElement('span')
  detailFileBadge.className = 'detail-file-badge'
  detailFileHead.appendChild(detailFileName)
  detailFileHead.appendChild(detailFileBadge)
  var detailFilePre = document.createElement('pre')
  detailFilePre.className = 'detail-file-pre'
  detailFile.appendChild(detailFileHead)
  detailFile.appendChild(detailFilePre)

  var detailResize = document.createElement('div')
  detailResize.className = 'detail-resize'
  detailResize.setAttribute('role', 'separator')
  detailResize.setAttribute('aria-orientation', 'vertical')
  detailResize.setAttribute('aria-label', '拖动调整面板宽度')
  detailResize.tabIndex = 0
  detail.appendChild(detailCollapse)
  detail.appendChild(detailImage)
  detail.appendChild(detailFrame)
  detail.appendChild(detailPdf)
  detail.appendChild(detailFile)
  detail.appendChild(detailResize)

  var pop = document.createElement('div')
  pop.className = 'ref-pop'
  pop.setAttribute('role', 'dialog')
  pop.setAttribute('aria-label', '引用预览')
  var popHead = document.createElement('div')
  popHead.className = 'ref-pop-head'
  var popTitle = document.createElement('span')
  popTitle.className = 'ref-pop-title'
  var popTag = document.createElement('span')
  popTag.className = 'ref-pop-tag'
  popHead.appendChild(popTitle)
  popHead.appendChild(popTag)
  var popBody = document.createElement('button')
  popBody.type = 'button'
  popBody.className = 'ref-pop-body'
  popBody.setAttribute('aria-label', '在左侧展开')
  var popHint = document.createElement('div')
  popHint.className = 'ref-pop-hint'
  pop.appendChild(popHead)
  pop.appendChild(popBody)
  pop.appendChild(popHint)

  app.appendChild(detail)
  app.appendChild(canvas)
  app.appendChild(pop)
  document.title = data.document.meta.title || 'PaperLoom'
`
