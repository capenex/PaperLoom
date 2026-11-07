/** 导出包内演示器的本地引用样式：引用锚点、预览弹窗、详情面板的 iframe 与分界线 */
export const PRESENTER_REFERENCE_STYLES = `
/* 本地引用锚点：与常规超链接区分，不跳转 */
.node-rich-text a[data-pl-ref] {
  cursor: pointer;
  text-decoration-style: dotted;
}

.detail-frame {
  display: none;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.detail[data-mode="page"] .detail-frame {
  display: block;
}

/* PDF 正文：pdf.js 画布逐页渲染 */
.detail-pdf {
  display: none;
  width: 100%;
  height: 100%;
  flex-direction: column;
}

.detail[data-mode="pdf"] .detail-pdf {
  display: flex;
}

.detail-pdf-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 12px;
  color: #cbd5e1;
}

.detail-pdf-bar button {
  width: 28px;
  height: 28px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.detail-pdf-bar button:hover {
  background: #1e293b;
}

.detail-pdf-bar button:disabled {
  opacity: 0.4;
  cursor: default;
}

.detail-pdf-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.detail-pdf-canvas {
  display: block;
  max-width: 100%;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.detail-resize {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 11;
  width: 12px;
  height: 100%;
  transform: translateX(-50%);
  cursor: col-resize;
  touch-action: none;
}

.detail-resize:hover,
.detail-resize:focus-visible {
  background: rgba(124, 92, 191, 0.45);
  outline: none;
}

.ref-pop {
  position: fixed;
  z-index: 60;
  display: none;
  width: 360px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
}

.ref-pop.is-open {
  display: block;
}

.ref-pop-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.ref-pop-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.ref-pop-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 9999px;
  background: #f5f3ff;
  color: #6d28d9;
  font-size: 11px;
}

.ref-pop-body {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: #f8fafc;
  cursor: pointer;
}

.ref-pop-img {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin: 0 auto;
  object-fit: contain;
}

.ref-pop-framebox {
  height: 200px;
  overflow: hidden;
  background: #fff;
}

.ref-pop-frame {
  width: 1000px;
  height: 700px;
  border: 0;
  background: #fff;
  pointer-events: none;
  transform: scale(0.36);
  transform-origin: top left;
}

.ref-pop-missing {
  display: flex;
  height: 128px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #94a3b8;
}

.ref-pop-hint {
  padding: 6px 12px;
  font-size: 11px;
  color: #94a3b8;
}
`
