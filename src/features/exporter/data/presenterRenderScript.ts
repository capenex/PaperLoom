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
  var PRIMARY_COLOR = 'oklch(0.48 0.16 285)'
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

  function appendNodePager(card, onStep) {
    var pager = document.createElement('div')
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

  function placeBridge(line, node, centerPoint) {
    if (!centerPoint) return
    var halfWidth = sizeOf(node).width / 2
    line.setAttribute('x1', String(centerPoint.x - halfWidth))
    line.setAttribute('x2', String(centerPoint.x + halfWidth))
    line.setAttribute('y1', String(centerPoint.y))
    line.setAttribute('y2', String(centerPoint.y))
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
        var sourceWidth = sizeOf(parentNode).width
        var targetWidth = sizeOf(node).width
        var group = document.createElementNS(svgNS, 'g')
        var path = document.createElementNS(svgNS, 'path')
        path.setAttribute('d', connectionPathD(source, target, sourceWidth, targetWidth))
        path.setAttribute('fill', 'none')
        path.setAttribute('stroke', PRIMARY_COLOR)
        path.setAttribute('stroke-width', '2')
        path.setAttribute('stroke-linecap', 'round')
        path.setAttribute('opacity', '0.42')
        group.appendChild(path)

        var startDot = null
        if (!isHiddenNode(parentNode)) {
          startDot = document.createElementNS(svgNS, 'circle')
          startDot.setAttribute('cx', String(source.x + sourceWidth / 2))
          startDot.setAttribute('cy', String(source.y))
          startDot.setAttribute('r', '3')
          startDot.setAttribute('fill', PRIMARY_COLOR)
          startDot.setAttribute('opacity', '0.55')
          group.appendChild(startDot)
        }

        var endDot = null
        if (!isHiddenNode(node)) {
          endDot = document.createElementNS(svgNS, 'circle')
          endDot.setAttribute('cx', String(target.x - targetWidth / 2))
          endDot.setAttribute('cy', String(target.y))
          endDot.setAttribute('r', '3')
          endDot.setAttribute('fill', PRIMARY_COLOR)
          endDot.setAttribute('opacity', '0.75')
          group.appendChild(endDot)
        }

        pathsById[node.id + ':' + parentId] = {
          path: path,
          startDot: startDot,
          endDot: endDot,
          nodeId: node.id,
          parentId: parentId,
        }
        svg.appendChild(group)
      })
    })
    nodes.forEach(function (node) {
      if (!isHiddenNode(node) || !hasVisibleParent[node.id] || !hasVisibleChild[node.id]) return
      var line = document.createElementNS(svgNS, 'line')
      line.setAttribute('stroke', PRIMARY_COLOR)
      line.setAttribute('stroke-width', '2')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('opacity', '0.42')
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
      var card = document.createElement('div')
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
      var branchHint = hasSubCanvas ? '，双击展开支线画布' : (isHostRoot ? '，双击返回上级画布' : '')

      if (content.kind === 'image' && typeof content.src === 'string') {
        card.classList.add('node-media-card')
        var imgItems = imageItemsOf(content)
        var imgCount = imgItems.length
        var imgIndex = typeof nodePageById[node.id] === 'number'
          ? nodePageById[node.id]
          : imageActiveIndexOf(content, imgItems)
        var media = document.createElement('div')
        media.className = imgCount > 1 ? 'node-media is-multi' : 'node-media'
        var image = document.createElement('img')
        image.alt = typeof content.alt === 'string' ? content.alt : ''
        image.draggable = false
        var mediaEmpty = document.createElement('div')
        mediaEmpty.className = 'node-media-empty'
        mediaEmpty.style.display = 'none'
        media.appendChild(image)
        media.appendChild(mediaEmpty)
        card.appendChild(media)

        image.addEventListener('error', function () {
          image.style.display = 'none'
          mediaEmpty.textContent = '图片不可用'
          mediaEmpty.style.display = 'flex'
        })

        var imgLabel = null
        var imgPrev = null
        var imgNext = null
        function applyImagePage(nextIdx) {
          var clamped = Math.max(0, Math.min(imgCount - 1, nextIdx))
          imgIndex = clamped
          nodePageById[node.id] = clamped
          var currentSrc = (imgItems[clamped] && imgItems[clamped].src) || ''
          if (currentSrc.trim() === '') {
            image.style.display = 'none'
            mediaEmpty.textContent = '未选择图片'
            mediaEmpty.style.display = 'flex'
          } else {
            image.style.display = 'block'
            mediaEmpty.style.display = 'none'
            image.src = currentSrc
          }
          if (imgLabel) imgLabel.textContent = (clamped + 1) + '/' + imgCount
          if (imgPrev) imgPrev.disabled = clamped <= 0
          if (imgNext) imgNext.disabled = clamped >= imgCount - 1
          if (detailImageNodeId === node.id) {
            if (currentSrc.trim() === '') {
              detail.setAttribute('data-image-empty', 'true')
            } else {
              detail.removeAttribute('data-image-empty')
              detailImage.src = currentSrc
            }
          }
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
        var imageLabel = image.alt.trim() === '' ? '未命名图片' : image.alt
        card.setAttribute('aria-label', '图片节点：' + imageLabel + branchHint)
        card.title = hasSubCanvas ? '双击展开支线画布' : '双击在左侧展开大图'
      } else if (content.kind === 'title') {
        var titleBox = document.createElement('div')
        titleBox.className = 'node-title-box'
        var mainTitle = typeof content.title === 'string' ? content.title.trim() : ''
        var subTitle = typeof content.subtitle === 'string' ? content.subtitle.trim() : ''
        if (mainTitle === '' && subTitle === '') {
          var emptyTitleWrap = document.createElement('div')
          emptyTitleWrap.className = 'node-empty-wrap'
          var emptyTitle = document.createElement('span')
          emptyTitle.className = 'node-empty'
          emptyTitle.style.color = '#94a3b8'
          emptyTitle.textContent = '空白标题'
          emptyTitleWrap.appendChild(emptyTitle)
          card.appendChild(emptyTitleWrap)
        } else {
          var accent = document.createElement('span')
          accent.className = 'node-title-accent'
          accent.setAttribute('aria-hidden', 'true')
          titleBox.appendChild(accent)
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
        var fWrap = document.createElement('div')
        fWrap.className = 'node-file-wrap'
        var fHead = document.createElement('div')
        fHead.className = 'node-file-head'
        var fName = document.createElement('span')
        fName.className = 'node-file-name'
        fName.textContent = content.fileName || '未命名文件'
        var fBadge = document.createElement('span')
        fBadge.className = 'node-file-badge'
        fBadge.textContent = content.format === 'markdown' ? '· MD' : '· CODE'
        fHead.appendChild(fName)
        fHead.appendChild(fBadge)
        fWrap.appendChild(fHead)
        var rawFileText = typeof content.text === 'string' ? content.text : ''
        if (content.format === 'markdown') {
          var fMd = document.createElement('div')
          fMd.className = 'node-file-md node-rich-text'
          fMd.style.fontSize = Math.max(12, Math.round(defaultFontSize * 0.85)) + 'px'
          fMd.innerHTML = renderStaticMarkdownHtml(rawFileText)
          fWrap.appendChild(fMd)
        } else {
          var fPre = document.createElement('pre')
          fPre.className = 'node-file-pre'
          fPre.style.fontSize = Math.max(11, Math.round(defaultFontSize * 0.78)) + 'px'
          fPre.textContent = rawFileText
          fWrap.appendChild(fPre)
        }
        card.appendChild(fWrap)
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
          var emptyPage = document.createElement('div')
          emptyPage.className = pages.length > 1 ? 'node-empty-page has-pager' : 'node-empty-page'
          emptyPage.textContent = '当前页空白'
          emptyPage.style.display = 'none'
          card.appendChild(rich)
          card.appendChild(emptyPage)

          var richPager = null

          function renderNodePage(nextIdx) {
            var clamped = Math.max(0, Math.min(pages.length - 1, nextIdx))
            nodePageById[node.id] = clamped
            var pageHtml = pages[clamped] || ''
            if (pageHtml.trim() === '') {
              rich.style.display = 'none'
              rich.innerHTML = ''
              emptyPage.style.display = 'flex'
            } else {
              emptyPage.style.display = 'none'
              rich.style.display = 'block'
              rich.innerHTML = pageHtml
              rich.querySelectorAll('a').forEach(function (anchor) {
                if (anchor.hasAttribute('data-pl-ref')) return
                anchor.setAttribute('target', '_blank')
                anchor.setAttribute('rel', 'noopener noreferrer')
              })
            }
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
          var emptyWrap = document.createElement('div')
          emptyWrap.className = 'node-empty-wrap'
          var empty = document.createElement('span')
          empty.className = 'node-empty'
          empty.textContent = '空白节点'
          emptyWrap.appendChild(empty)
          card.appendChild(emptyWrap)
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

`
