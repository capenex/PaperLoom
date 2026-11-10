/** 导出包内演示器的本地引用交互：单击弹预览、点击弹窗进右侧详情、PDF 双击直达引用页 */
export const PRESENTER_REFERENCE_SCRIPT = `  // --------------------------------------------------------------------------
  // 本地引用：单击弹预览，点击弹窗进右侧详情，PDF 双击直达全文引用页
  // --------------------------------------------------------------------------
  var REF_KIND_ATTR = 'data-pl-ref'
  var REF_PAGE_ATTR = 'data-pl-page'
  var REF_PREVIEW_ATTR = 'data-pl-preview'
  var popRef = null
  var popSourceNode = null

  function refOf(anchor) {
    var kind = anchor.getAttribute(REF_KIND_ATTR)
    var src = anchor.getAttribute('href')
    if (!kind || !src) return null
    var page = Number(anchor.getAttribute(REF_PAGE_ATTR))
    return {
      kind: kind,
      src: src,
      label: (anchor.textContent || '').trim(),
      page: Number.isInteger(page) && page > 0 ? page : 1,
      previewSrc: anchor.getAttribute(REF_PREVIEW_ATTR),
    }
  }

  function refAnchorOf(target) {
    if (!target || !target.closest) return null
    return target.closest('a[' + REF_KIND_ATTR + ']')
  }

  function closeRefPop() {
    popRef = null
    popSourceNode = null
    pop.classList.remove('is-open')
    popBody.textContent = ''
  }

  function openRefPop(anchor, sourceNode) {
    var ref = refOf(anchor)
    if (!ref) return
    popRef = ref
    popSourceNode = sourceNode || null
    popTitle.textContent = ref.label
    popTag.textContent = ref.kind === 'pdf' ? 'PDF · 第 ' + ref.page + ' 页' : (ref.kind === 'page' ? '页面' : '图片')
    popBody.textContent = ''
    if (ref.kind === 'page') {
      var box = document.createElement('div')
      box.className = 'ref-pop-framebox'
      var frame = document.createElement('iframe')
      frame.className = 'ref-pop-frame'
      frame.src = ref.src
      frame.title = ref.label
      frame.tabIndex = -1
      box.appendChild(frame)
      popBody.appendChild(box)
    } else {
      var img = document.createElement('img')
      img.className = 'ref-pop-img'
      img.alt = ref.label
      img.draggable = false
      img.src = ref.kind === 'pdf' ? (ref.previewSrc || '') : ref.src
      popBody.appendChild(img)
      if (ref.kind === 'pdf' && !ref.previewSrc) {
        var missing = document.createElement('div')
        missing.className = 'ref-pop-missing'
        missing.textContent = '无预览图'
        popBody.appendChild(missing)
      }
    }
    popHint.textContent = ref.kind === 'pdf'
      ? '点击在右侧展开 · 双击链接跳转全文引用页'
      : '点击在右侧展开'
    pop.classList.add('is-open')
    var rect = anchor.getBoundingClientRect()
    var x = Math.min(Math.max(8, rect.left), window.innerWidth - pop.offsetWidth - 8)
    var y = rect.bottom + 8
    if (y + pop.offsetHeight > window.innerHeight - 8) {
      y = Math.max(8, rect.top - pop.offsetHeight - 8)
    }
    pop.style.left = x + 'px'
    pop.style.top = y + 'px'
  }

  // PDF 用 pdf.js 逐页渲染：file:// 下既不能 fetch 本地 PDF，也不依赖浏览器内置阅读器
  var PDF_VIEW_WIDTH = 1600
  var pdfDocs = {}
  var pdfView = { src: null, page: 1, count: 0 }
  var pdfStage = { zoom: 1, x: 0, y: 0, drag: null }

  function applyPdfTransform() {
    detailPdfCanvas.style.transform =
      'translate(' + pdfStage.x + 'px, ' + pdfStage.y + 'px) scale(' + pdfStage.zoom + ')'
  }

  function resetPdfTransform() {
    pdfStage.zoom = 1
    pdfStage.x = 0
    pdfStage.y = 0
    applyPdfTransform()
  }

  detailPdfScroll.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return
    pdfStage.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pdfStage.x,
      panY: pdfStage.y,
    }
    try {
      detailPdfScroll.setPointerCapture(event.pointerId)
    } catch (error) {
      // 忽略指针捕获异常
    }
    detailPdfScroll.classList.add('is-panning')
  })

  detailPdfScroll.addEventListener('pointermove', function (event) {
    if (!pdfStage.drag || pdfStage.drag.pointerId !== event.pointerId) return
    pdfStage.x = pdfStage.drag.panX + (event.clientX - pdfStage.drag.startX)
    pdfStage.y = pdfStage.drag.panY + (event.clientY - pdfStage.drag.startY)
    applyPdfTransform()
  })

  function endPdfPan(event) {
    if (!pdfStage.drag || pdfStage.drag.pointerId !== event.pointerId) return
    if (detailPdfScroll.hasPointerCapture(event.pointerId)) {
      detailPdfScroll.releasePointerCapture(event.pointerId)
    }
    pdfStage.drag = null
    detailPdfScroll.classList.remove('is-panning')
  }
  detailPdfScroll.addEventListener('pointerup', endPdfPan)
  detailPdfScroll.addEventListener('pointercancel', endPdfPan)

  detailPdfScroll.addEventListener('wheel', function (event) {
    event.preventDefault()
    event.stopPropagation()
    var rect = detailPdfScroll.getBoundingClientRect()
    var factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED)
    var zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pdfStage.zoom * factor))
    var ratio = zoom / pdfStage.zoom
    pdfStage.x = (event.clientX - rect.left - rect.width / 2) * (1 - ratio) + pdfStage.x * ratio
    pdfStage.y = (event.clientY - rect.top - rect.height / 2) * (1 - ratio) + pdfStage.y * ratio
    pdfStage.zoom = zoom
    applyPdfTransform()
  }, { passive: false })

  function base64ToBytes(encoded) {
    var binary = atob(encoded)
    var bytes = new Uint8Array(binary.length)
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  function takePdfBytes(src) {
    var registry = window.__PL_PDF_BYTES__
    if (!registry || typeof registry[src] !== 'string') return null
    return base64ToBytes(registry[src])
  }

  function renderPdfViewPage() {
    var doc = pdfDocs[pdfView.src]
    if (!doc) return
    detailPdfLabel.textContent = '第 ' + pdfView.page + ' / ' + pdfView.count + ' 页'
    detailPdfPrev.disabled = pdfView.page <= 1
    detailPdfNext.disabled = pdfView.page >= pdfView.count
    doc.getPage(pdfView.page).then(function (page) {
      if (pdfDocs[pdfView.src] !== doc) return null
      var natural = page.getViewport({ scale: 1 })
      var viewport = page.getViewport({ scale: PDF_VIEW_WIDTH / natural.width })
      detailPdfCanvas.width = Math.floor(viewport.width)
      detailPdfCanvas.height = Math.floor(viewport.height)
      return page.render({ canvas: detailPdfCanvas, viewport: viewport }).promise
    }).catch(function () {
      detailPdfLabel.textContent = 'PDF 渲染失败'
    })
  }

  function openPdfView(src, page) {
    detail.setAttribute('data-mode', 'pdf')
    detail.classList.add('is-open')
    resetPdfTransform()
    pdfView.src = src
    if (pdfDocs[src]) {
      pdfView.count = pdfDocs[src].numPages
      pdfView.page = Math.min(Math.max(1, page), pdfView.count)
      renderPdfViewPage()
      return
    }
    pdfView.count = 0
    detailPdfLabel.textContent = '正在解析 PDF…'
    var bytes = takePdfBytes(src)
    if (!bytes) {
      detailPdfLabel.textContent = '缺少 PDF 数据'
      return
    }
    window.pdfjsLib.getDocument({ data: bytes }).promise.then(function (doc) {
      pdfDocs[src] = doc
      var registry = window.__PL_PDF_BYTES__
      if (registry) delete registry[src]
      if (pdfView.src !== src) return
      pdfView.count = doc.numPages
      pdfView.page = Math.min(Math.max(1, page), doc.numPages)
      renderPdfViewPage()
    }).catch(function () {
      if (pdfView.src === src) detailPdfLabel.textContent = 'PDF 解析失败'
    })
  }

  detailPdfPrev.addEventListener('click', function (event) {
    event.stopPropagation()
    if (pdfView.page <= 1) return
    pdfView.page -= 1
    renderPdfViewPage()
  })
  detailPdfNext.addEventListener('click', function (event) {
    event.stopPropagation()
    if (pdfView.page >= pdfView.count) return
    pdfView.page += 1
    renderPdfViewPage()
  })

  function openRefDetail(ref) {
    closeRefPop()
    detailImageNodeId = null
    if (ref.kind === 'image') {
      detailImage.src = ref.src
      detailImage.alt = ref.label
      detailFrame.src = 'about:blank'
      detail.setAttribute('data-mode', 'image')
      detail.classList.add('is-open')
    } else if (ref.kind === 'page') {
      detailFrame.src = ref.src
      detail.setAttribute('data-mode', 'page')
      detail.classList.add('is-open')
    } else {
      openPdfView(ref.src, ref.page)
    }
  }
`
