import { PRESENTER_THEME_TOKENS } from '@/shared/lib/presenterTheme'

/** 导出包内演示器的本地引用样式：预览弹窗、详情面板内页（iframe/PDF/文件）与分界线 */
export const PRESENTER_REFERENCE_STYLES = `
.detail-frame {
  display: none;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
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
  overflow: hidden;
  background: rgba(241, 245, 249, 0.65);
}

.detail[data-mode="pdf"] .detail-pdf {
  display: flex;
}

.detail-pdf-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(248, 250, 252, 0.9);
  font-size: 12px;
  color: #475569;
}

.detail-pdf-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.detail-pdf-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f5f3ff;
  color: #6d28d9;
  box-shadow: inset 0 0 0 1px rgba(221, 214, 254, 0.6);
  font-size: 11px;
  font-weight: 600;
}

.detail-pdf-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: #334155;
}

.detail-pdf-controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}

.detail-pdf-zoom {
  padding: 2px 8px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 6px;
  background: #ffffff;
  color: #475569;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.detail-pdf-zoom:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.detail-pdf-prev,
.detail-pdf-next {
  display: inline-flex;
  width: 24px;
  height: 24px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.detail-pdf-prev:hover:not(:disabled),
.detail-pdf-next:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.detail-pdf-prev:disabled,
.detail-pdf-next:disabled {
  opacity: 0.4;
  cursor: default;
}

.detail-pdf-label {
  min-width: 64px;
  text-align: center;
  font-weight: 500;
  color: #334155;
  font-variant-numeric: tabular-nums;
}

.detail-pdf-scroll {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.detail-pdf-scroll.is-panning {
  cursor: grabbing;
}

.detail-pdf-canvas {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 6.5rem);
  width: auto;
  height: auto;
  margin: 0 auto;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: ${PRESENTER_THEME_TOKENS.pdfPageShadow};
  transform-origin: center center;
}

.detail-resize {
  position: absolute;
  right: 0;
  top: 0;
  z-index: 10;
  width: 12px;
  height: 100%;
  transform: translateX(50%);
  cursor: col-resize;
  touch-action: none;
}

.detail-resize:hover {
  background: ${PRESENTER_THEME_TOKENS.primaryMuted40};
}

.detail-resize:focus-visible {
  background: ${PRESENTER_THEME_TOKENS.primaryMuted60};
  outline: none;
}

.ref-pop {
  position: fixed;
  z-index: 40;
  display: none;
  width: 360px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
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
  font-size: 14px;
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
  height: 208px;
  overflow: hidden;
  background: #ffffff;
}

.ref-pop-frame {
  width: 1000px;
  height: 700px;
  border: 0;
  background: #ffffff;
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

.detail-file {
  display: none;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  color: #1e293b;
}

.detail[data-mode="file"] .detail-file {
  display: flex;
}

.detail-file-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(248, 250, 252, 0.9);
}

.detail-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.detail-file-badge {
  flex-shrink: 0;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 12px;
  color: #94a3b8;
}

.detail-file-md {
  display: none;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  font-size: 16px;
  line-height: 1.625;
  color: #334155;
}

.detail-file[data-file-format="markdown"] .detail-file-md {
  display: block;
}

.detail-file-pre {
  display: none;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 24px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: #020617;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 12px;
  line-height: 1.625;
  color: #f1f5f9;
}

.detail-file[data-file-format="code"] .detail-file-pre {
  display: block;
}
`
