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
  var cardsById = {}
  var bindCardInteractions = null

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
    cardsById = {}

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
      var path = document.createElementNS(svgNS, 'path')
      path.setAttribute(
        'd',
        connectionPathD(source, target, sizeOf(parentNode).width, sizeOf(node).width),
      )
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', '#7c5cbf')
      path.setAttribute('stroke-width', '2')
      path.setAttribute('opacity', '0.45')
      pathsById[node.id] = path
      svg.appendChild(path)
    })
    stage.appendChild(svg)

    var activeHostNodeId =
      activeCanvasId && subCanvases[activeCanvasId] ? subCanvases[activeCanvasId].hostNodeId : null

    nodes.forEach(function (node) {
      var position = positions[node.id]
      if (!position) return
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
        image.src = content.src
        image.alt = typeof content.alt === 'string' ? content.alt : ''
        image.draggable = false
        media.appendChild(image)
        card.appendChild(media)
        var imageLabel = image.alt === '' ? '未命名图片' : image.alt
        card.setAttribute('aria-label', '图片节点：' + imageLabel + '，再次点击在右侧展开大图' + branchHint)
        card.title = hasSubCanvas ? '双击展开支线画布；再次点击弹出右栏大图' : '选中后再次点击弹出右栏大图'
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
        card.setAttribute('aria-label', '静态文件节点：' + (content.fileName || '未命名文件') + (branchHint || '，双击在右侧展开查看全文'))
        card.title = hasSubCanvas ? '双击展开支线画布' : '双击在右侧展开查看全文'
      } else {
        var labelText = '空白节点'
        var richText = content.richText
        if (typeof richText === 'string' && richText.trim() !== '') {
          var rich = document.createElement('div')
          rich.className = 'node-rich-text'
          rich.style.fontSize = defaultFontSize + 'px'
          rich.innerHTML = richText
          rich.querySelectorAll('a').forEach(function (anchor) {
            if (anchor.hasAttribute('data-pl-ref')) return
            anchor.setAttribute('target', '_blank')
            anchor.setAttribute('rel', 'noopener noreferrer')
          })
          card.appendChild(rich)
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
  detailCollapse.setAttribute('aria-label', '收起右侧详情')
  detailCollapse.title = '收起右侧详情'
  detailCollapse.textContent = '›'
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
  popBody.setAttribute('aria-label', '在右侧展开')
  var popHint = document.createElement('div')
  popHint.className = 'ref-pop-hint'
  pop.appendChild(popHead)
  pop.appendChild(popBody)
  pop.appendChild(popHint)

  app.appendChild(canvas)
  app.appendChild(detail)
  app.appendChild(pop)
  document.title = data.document.meta.title || 'PaperLoom'
`
