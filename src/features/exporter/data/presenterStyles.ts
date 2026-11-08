/** 导出包内演示器样式 */
import { PRESENTER_REFERENCE_STYLES } from './presenterReferenceStyles'

const PRESENTER_BASE_STYLES = `:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #0f172a;
  background: #fbfcfe;
}

.presenter {
  display: flex;
  width: 100vw;
  height: 100vh;
}

.canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background-color: #fbfcfe;
  background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
  background-size: 24px 24px;
  cursor: grab;
  touch-action: none;
}

.canvas.is-panning {
  cursor: grabbing;
}

.canvas-center {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.world {
  transform-origin: center center;
}

.stage {
  position: relative;
  flex-shrink: 0;
}

.connections {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  user-select: none;
  transition: transform 0.25s ease, left 0.25s ease, top 0.25s ease, box-shadow 0.25s ease;
}

.node-selected {
  outline: 2px solid oklch(0.48 0.16 285);
  outline-offset: 2px;
}

.node:focus-visible {
  outline: 2px solid oklch(0.48 0.16 285);
  outline-offset: 2px;
}

.node-expanded {
  z-index: 30;
  transform: translate(-50%, -50%) scale(1.5);
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28);
}

.node-media-card {
  padding: 0;
  background: #f1f5f9;
}

.node-media {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.node-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.node-empty {
  margin: auto;
  font-size: 12px;
  color: #94a3b8;
}
.node-title-box { margin: auto 0; text-align: center; overflow: hidden; }
.node-title-main { font-weight: 600; color: #0f172a; line-height: 1.35; }
.node-title-sub { margin-top: 4px; color: #64748b; line-height: 1.4; }
.node-file-card { padding: 0; background: #f8fafc; }
.node-file-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 10px; border-bottom: 1px solid #e2e8f0; background: #f1f5f9;
  font-family: monospace; font-size: 11px;
}
.node-file-pre {
  margin: 0; padding: 6px 10px; overflow: hidden; white-space: pre-wrap;
  word-break: break-all; font-family: monospace; color: #334155;
}

.node-rich-text {
  min-height: 0;
  overflow: hidden;
  line-height: 1.6;
  color: #475569;
  overflow-wrap: anywhere;
}

.node-rich-text p { margin: 0; }
.node-rich-text p + p { margin-top: 4px; }
.node-rich-text a { color: #7c3aed; text-decoration: underline; }
.node-rich-text ul, .node-rich-text ol { margin: 0; padding-left: 1.25em; }
.node-rich-text ul { list-style: disc; }
.node-rich-text ol { list-style: decimal; }
.node-rich-text h1 { margin: 0 0 0.25em; font-size: 1.4em; font-weight: 700; line-height: 1.3; color: #0f172a; }
.node-rich-text h2 { margin: 0 0 0.2em; font-size: 1.2em; font-weight: 700; line-height: 1.35; color: #0f172a; }
.node-rich-text h3 { margin: 0 0 0.15em; font-size: 1.08em; font-weight: 600; line-height: 1.4; color: #1e293b; }
.node-rich-text blockquote {
  margin: 0.2em 0; padding-left: 0.65em; border-left: 3px solid #cbd5e1;
  color: #64748b; font-style: italic;
}
.node-rich-text code {
  padding: 0.1em 0.35em; border-radius: 4px; background: #f1f5f9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em; color: #be185d;
}
.node-rich-text .pl-math {
  display: inline-flex; align-items: baseline; margin: 0 0.12em; padding: 0.05em 0.3em;
  border-radius: 4px; background: #f8fafc; border: 1px solid #e2e8f0;
  font-family: "Cambria Math", "Latin Modern Math", "STIX Two Math", "Times New Roman", serif;
  font-style: italic; color: #0f172a; line-height: 1.2;
}
.node-rich-text .pl-frac {
  display: inline-flex; flex-direction: column; align-items: center;
  vertical-align: middle; margin: 0 0.15em; font-size: 0.85em; line-height: 1.05;
}
.node-rich-text .pl-frac-num { padding: 0 0.2em 0.08em; border-bottom: 1px solid currentColor; }
.node-rich-text .pl-frac-den { padding: 0.08em 0.2em 0; }
.node-rich-text .pl-sqrt { display: inline-flex; align-items: baseline; }
.node-rich-text .pl-sqrt-body { border-top: 1px solid currentColor; padding: 0 0.15em; }

.detail {
  position: relative;
  display: none;
  width: 40%;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 12px 12px 12px 8px;
  border-left: 0;
  background: rgba(251, 252, 254, 0.88);
  backdrop-filter: blur(4px);
}

.detail.is-open {
  display: flex;
}

.detail[data-mode="image"] {
  position: fixed;
  inset: 0;
  z-index: 60;
  width: 100vw !important;
  padding: 0;
  border-left: 0;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(2px);
}

.detail img {
  display: none;
  width: auto;
  height: auto;
  max-width: 84vw;
  max-height: 82vh;
  padding: 10px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.28);
  object-fit: contain;
  user-select: none;
}

.detail[data-mode="image"] img {
  display: block;
}

.detail-collapse {
  position: absolute;
  left: 8px;
  top: 50%;
  /* 必须盖在分界线热区之上，否则按钮中心会被拖动条吃掉点击 */
  z-index: 12;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  background: #ffffff;
  color: #475569;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.10);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.detail-collapse:hover {
  background: #f8fafc;
  color: #0f172a;
}

.detail-collapse:focus-visible {
  outline: 2px solid oklch(0.48 0.16 285);
  outline-offset: 2px;
}

.node-badge {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 5;
  padding: 1px 7px;
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 9999px;
  background: rgba(245, 243, 255, 0.94);
  color: #6d28d9;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  pointer-events: none;
}

.node-badge.is-host {
  border-color: rgba(14, 165, 233, 0.3);
  background: rgba(240, 249, 255, 0.95);
  color: #0369a1;
}

.breadcrumbs {
  position: absolute;
  top: 12px;
  left: 16px;
  z-index: 40;
  display: none;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px -6px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(8px);
  font-size: 12px;
}

.breadcrumbs.is-visible {
  display: flex;
}

.breadcrumb-back {
  padding: 3px 8px;
  border: 0;
  border-radius: 7px;
  background: rgba(124, 58, 237, 0.1);
  color: #6d28d9;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.breadcrumb-back:hover {
  background: rgba(124, 58, 237, 0.16);
}

.breadcrumb-divider {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
}

.breadcrumb-sep {
  color: #94a3b8;
  font-size: 12px;
}

.breadcrumb-item {
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.breadcrumb-item:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.breadcrumb-item.is-current {
  color: #0f172a;
  font-weight: 600;
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .node {
    transition: none;
  }
}
`

export const PRESENTER_STYLES = PRESENTER_BASE_STYLES + PRESENTER_REFERENCE_STYLES
