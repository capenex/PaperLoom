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
  transition: transform 0.2s ease, box-shadow 0.2s ease;
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
  transform: translate(-50%, -50%) scale(2);
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

.node-rich-text {
  min-height: 0;
  overflow: hidden;
  line-height: 1.6;
  color: #475569;
  overflow-wrap: anywhere;
}

.node-rich-text p {
  margin: 0;
}

.node-rich-text p + p {
  margin-top: 4px;
}

.node-rich-text a {
  color: #7c3aed;
  text-decoration: underline;
}

.node-rich-text ul,
.node-rich-text ol {
  margin: 0;
  padding-left: 1.25em;
}

.node-rich-text ul {
  list-style: disc;
}

.node-rich-text ol {
  list-style: decimal;
}

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
