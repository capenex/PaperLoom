/** 导出包内演示器的左侧详情面板与引用预览弹窗 DOM 装配 */
export const PRESENTER_CHROME_DOM_SCRIPT = `
  function createIconSvg(size, innerMarkup) {
    var box = document.createElement('span')
    box.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + size +
      '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      innerMarkup + '</svg>'
    return box.firstChild
  }

  function createGitBranchIcon(size) {
    return createIconSvg(
      size,
      '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    )
  }

  function createLinkIcon(size) {
    return createIconSvg(
      size,
      '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
    )
  }

  function createArrowLeftIcon(size) {
    return createIconSvg(size, '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>')
  }

  function createChevronLeftIcon(size) {
    return createIconSvg(size, '<path d="m15 18-6-6 6-6"/>')
  }

  function createChevronRightIcon(size) {
    return createIconSvg(size, '<path d="m9 18 6-6-6-6"/>')
  }

  function appendNodeBadge(card, hasSubCanvas, isHostRoot) {
    if (!hasSubCanvas && !isHostRoot) return
    var badge = document.createElement('span')
    badge.className = hasSubCanvas ? 'node-badge' : 'node-badge is-host'
    badge.setAttribute(
      'aria-label',
      hasSubCanvas ? '已绑定支线画布，双击展开' : '与上级画布实时同步的同源起点节点，双击返回上级画布',
    )
    badge.appendChild(hasSubCanvas ? createGitBranchIcon(10) : createLinkIcon(10))
    var text = document.createElement('span')
    text.textContent = hasSubCanvas ? '支线' : '同源起点'
    badge.appendChild(text)
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
    backBtn.appendChild(createArrowLeftIcon(14))
    var backLabel = document.createElement('span')
    backLabel.textContent = '返回上级'
    backBtn.appendChild(backLabel)
    backBtn.title = '返回上一级画布（快捷键 Esc）'
    backBtn.addEventListener('click', function (event) {
      event.stopPropagation()
      onPop()
    })
    breadcrumbsBar.appendChild(backBtn)

    var sep = document.createElement('span')
    sep.className = 'breadcrumb-divider'
    sep.setAttribute('aria-hidden', 'true')
    breadcrumbsBar.appendChild(sep)

    var list = document.createElement('div')
    list.className = 'breadcrumb-list'
    breadcrumbsBar.appendChild(list)

    var items = [{ canvasId: null, label: '主画布' }]
    canvasStack.forEach(function (cid) {
      var sub = subCanvases[cid]
      var hostNode = sub ? findNodeAcrossDocument(sub.hostNodeId) : null
      items.push({ canvasId: cid, label: '支线：' + summarizeNodeTitle(hostNode) })
    })

    items.forEach(function (item, idx) {
      var step = document.createElement('div')
      step.className = 'breadcrumb-step'
      if (idx > 0) {
        var slash = document.createElement('span')
        slash.className = 'breadcrumb-sep'
        slash.textContent = '/'
        step.appendChild(slash)
      }
      var isLast = idx === items.length - 1
      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = isLast ? 'breadcrumb-item is-current' : 'breadcrumb-item'
      if (idx > 0) btn.appendChild(createGitBranchIcon(12))
      var itemText = document.createElement('span')
      itemText.textContent = item.label
      btn.appendChild(itemText)
      btn.disabled = isLast
      if (!isLast) {
        btn.addEventListener('click', function (event) {
          event.stopPropagation()
          onNavigate(item.canvasId)
        })
      }
      step.appendChild(btn)
      list.appendChild(step)
    })
  }

  var detail = document.createElement('aside')
  detail.className = 'detail'
  detail.setAttribute('aria-label', '引用详情')
  var detailResize = document.createElement('div')
  detailResize.className = 'detail-resize'
  detailResize.setAttribute('role', 'separator')
  detailResize.setAttribute('aria-orientation', 'vertical')
  detailResize.setAttribute('aria-label', '拖动调整面板宽度')
  detailResize.tabIndex = 0
  var detailCollapse = document.createElement('button')
  detailCollapse.type = 'button'
  detailCollapse.className = 'detail-collapse'
  detailCollapse.setAttribute('aria-label', '收起左侧详情')
  detailCollapse.title = '收起左侧详情'
  detailCollapse.appendChild(createChevronLeftIcon(16))

  var detailCard = document.createElement('div')
  detailCard.className = 'detail-card'

  var detailImage = document.createElement('img')
  detailImage.className = 'detail-image'
  detailImage.alt = ''
  detailImage.draggable = false
  var detailImageEmpty = document.createElement('div')
  detailImageEmpty.className = 'detail-image-empty'
  detailImageEmpty.textContent = '图片不可用'
  detailImage.addEventListener('error', function () {
    if (detail.getAttribute('data-mode') === 'image') {
      detail.setAttribute('data-image-empty', 'true')
    }
  })

  var detailFrame = document.createElement('iframe')
  detailFrame.className = 'detail-frame'
  detailFrame.title = '引用内容'

  var detailPdf = document.createElement('div')
  detailPdf.className = 'detail-pdf'
  var detailPdfBar = document.createElement('header')
  detailPdfBar.className = 'detail-pdf-bar'
  var detailPdfMeta = document.createElement('div')
  detailPdfMeta.className = 'detail-pdf-meta'
  var detailPdfBadge = document.createElement('span')
  detailPdfBadge.className = 'detail-pdf-badge'
  detailPdfBadge.textContent = 'PDF'
  var detailPdfTitle = document.createElement('span')
  detailPdfTitle.className = 'detail-pdf-title'
  detailPdfTitle.textContent = '文献预览'
  detailPdfMeta.appendChild(detailPdfBadge)
  detailPdfMeta.appendChild(detailPdfTitle)

  var detailPdfControls = document.createElement('div')
  detailPdfControls.className = 'detail-pdf-controls'
  var detailPdfZoom = document.createElement('button')
  detailPdfZoom.type = 'button'
  detailPdfZoom.className = 'detail-pdf-zoom'
  detailPdfZoom.title = '滚轮缩放 · 拖拽平移 · 点击重置视图为 100%'
  detailPdfZoom.textContent = '100%'
  var detailPdfPrev = document.createElement('button')
  detailPdfPrev.type = 'button'
  detailPdfPrev.className = 'detail-pdf-prev'
  detailPdfPrev.setAttribute('aria-label', '上一页')
  detailPdfPrev.appendChild(createChevronLeftIcon(14))
  var detailPdfLabel = document.createElement('span')
  detailPdfLabel.className = 'detail-pdf-label'
  detailPdfLabel.setAttribute('aria-live', 'polite')
  var detailPdfNext = document.createElement('button')
  detailPdfNext.type = 'button'
  detailPdfNext.className = 'detail-pdf-next'
  detailPdfNext.setAttribute('aria-label', '下一页')
  detailPdfNext.appendChild(createChevronRightIcon(14))
  detailPdfControls.appendChild(detailPdfZoom)
  detailPdfControls.appendChild(detailPdfPrev)
  detailPdfControls.appendChild(detailPdfLabel)
  detailPdfControls.appendChild(detailPdfNext)
  detailPdfBar.appendChild(detailPdfMeta)
  detailPdfBar.appendChild(detailPdfControls)

  var detailPdfScroll = document.createElement('div')
  detailPdfScroll.className = 'detail-pdf-scroll'
  detailPdfScroll.setAttribute('aria-label', 'PDF 页面画布（滚轮缩放，拖拽平移）')
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
  var detailFileMd = document.createElement('div')
  detailFileMd.className = 'detail-file-md node-rich-text'
  var detailFilePre = document.createElement('pre')
  detailFilePre.className = 'detail-file-pre'
  detailFile.appendChild(detailFileHead)
  detailFile.appendChild(detailFileMd)
  detailFile.appendChild(detailFilePre)

  detailCard.appendChild(detailImage)
  detailCard.appendChild(detailImageEmpty)
  detailCard.appendChild(detailFrame)
  detailCard.appendChild(detailPdf)
  detailCard.appendChild(detailFile)

  detail.appendChild(detailResize)
  detail.appendChild(detailCollapse)
  detail.appendChild(detailCard)

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
