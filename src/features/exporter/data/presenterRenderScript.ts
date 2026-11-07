/** 导出包内演示器的只读节点渲染（由 presenterScript 组装进同一个 IIFE） */
export const PRESENTER_RENDER_SCRIPT = `  app.className = 'presenter'
  var canvas = document.createElement('div')
  canvas.className = 'canvas'
  canvas.setAttribute('role', 'application')
  canvas.setAttribute('aria-label', '演示画布')
  var center = document.createElement('div')
  center.className = 'canvas-center'
  var world = document.createElement('div')
  world.className = 'world'

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

  var cardsById = {}
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

    var content = node.content || {}

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
      card.setAttribute('aria-label', '图片节点：' + imageLabel + '，点击放大，再次点击查看大图，右键空白处还原')
      card.title = '点击放大，再次点击查看大图，右键空白处还原'
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
      card.setAttribute('aria-label', '节点：' + labelText)
    }
    stage.appendChild(card)
  })

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
