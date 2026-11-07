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
  transform: translate(-50%, -50%) scale(3);
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
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
  border-left: 1px solid #1e293b;
  background: #020617;
}

.detail.is-open {
  display: flex;
}

.detail img {
  display: none;
  width: 100%;
  height: 100%;
  padding: 24px;
  object-fit: contain;
  user-select: none;
}

.detail[data-mode="image"] img {
  display: block;
}

.detail-collapse {
  position: absolute;
  left: 0;
  top: 50%;
  /* 必须盖在分界线热区之上，否则按钮中心会被拖动条吃掉点击 */
  z-index: 12;
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  border: 1px solid #334155;
  border-radius: 9999px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.detail-collapse:hover {
  background: #1e293b;
}

.detail-collapse:focus-visible {
  outline: 2px solid oklch(0.48 0.16 285);
  outline-offset: 2px;
}
`

export const PRESENTER_STYLES = PRESENTER_BASE_STYLES + PRESENTER_REFERENCE_STYLES
