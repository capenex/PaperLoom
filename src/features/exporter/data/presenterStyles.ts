/** 导出包内演示器样式 */
import { PRESENTER_THEME_TOKENS, SHARED_RICH_TEXT_STYLES } from '@/shared/lib/presenterTheme'
import { PRESENTER_CHROME_STYLES } from './presenterChromeStyles'
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
  font-family: ${PRESENTER_THEME_TOKENS.fontSans};
  color: ${PRESENTER_THEME_TOKENS.foreground};
  background: ${PRESENTER_THEME_TOKENS.canvasBg};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection {
  background: ${PRESENTER_THEME_TOKENS.primarySoft15};
  color: ${PRESENTER_THEME_TOKENS.primary};
}

button,
a {
  -webkit-tap-highlight-color: transparent;
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
  background-color: ${PRESENTER_THEME_TOKENS.canvasBg};
  background-image: radial-gradient(circle, ${PRESENTER_THEME_TOKENS.canvasDot} 1px, transparent 1px);
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
  pointer-events: none;
}

.node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: #ffffff;
  color: #0f172a;
  box-shadow: ${PRESENTER_THEME_TOKENS.cardShadow};
  cursor: pointer;
  user-select: none;
  transition: transform 0.25s cubic-bezier(0, 0, 0.2, 1), left 0.25s cubic-bezier(0, 0, 0.2, 1), top 0.25s cubic-bezier(0, 0, 0.2, 1), width 0.25s cubic-bezier(0, 0, 0.2, 1), height 0.25s cubic-bezier(0, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0, 0, 0.2, 1), border-color 0.25s cubic-bezier(0, 0, 0.2, 1), opacity 0.25s cubic-bezier(0, 0, 0.2, 1);
}

.node:hover {
  border-color: rgba(203, 213, 225, 0.9);
  box-shadow: ${PRESENTER_THEME_TOKENS.cardHoverShadow};
}

.node:focus-visible {
  outline: none;
  border-color: ${PRESENTER_THEME_TOKENS.primaryMuted40};
  box-shadow: 0 0 0 2px ${PRESENTER_THEME_TOKENS.canvasBg}, 0 0 0 4px ${PRESENTER_THEME_TOKENS.primary}, ${PRESENTER_THEME_TOKENS.cardShadow};
}

.node-selected,
.node-selected:hover {
  border-color: ${PRESENTER_THEME_TOKENS.primaryMuted40};
  box-shadow: 0 0 0 2px ${PRESENTER_THEME_TOKENS.canvasBg}, 0 0 0 4px ${PRESENTER_THEME_TOKENS.primary}, ${PRESENTER_THEME_TOKENS.cardShadow};
}

.node-expanded,
.node-expanded:hover {
  z-index: 30;
  transform: translate(-50%, -50%) scale(1.5);
  box-shadow: ${PRESENTER_THEME_TOKENS.cardExpandedShadow};
}

.node-expanded.node-selected,
.node-expanded.node-selected:hover {
  box-shadow: 0 0 0 2px ${PRESENTER_THEME_TOKENS.canvasBg}, 0 0 0 4px ${PRESENTER_THEME_TOKENS.primary}, ${PRESENTER_THEME_TOKENS.cardExpandedShadow};
}

.node-media-card {
  padding: 0;
  background: #ffffff;
}

.node-media {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f1f5f9;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.node-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.node-media.is-multi img {
  object-fit: contain;
}

.node-media-empty {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: rgba(241, 245, 249, 0.8);
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
}

.node-empty-wrap {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.node-empty {
  margin: auto;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.node-empty-page {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #94a3b8;
}

.node-empty-page.has-pager {
  padding-bottom: 20px;
}

.node-title-box {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
}

.node-title-accent {
  width: 28px;
  height: 4px;
  margin-bottom: 8px;
  flex-shrink: 0;
  border-radius: 9999px;
  background: ${PRESENTER_THEME_TOKENS.primaryMuted25};
}

.node-title-main {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.25;
  color: #0f172a;
}

.node-title-sub {
  display: -webkit-box;
  width: 100%;
  margin-top: 4px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.375;
  color: #64748b;
}

.node-file-card {
  padding: 0;
  background: rgba(248, 250, 252, 0.6);
}

.node-file-wrap {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.6);
}

.node-file-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(241, 245, 249, 0.9);
}

.node-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 11px;
  font-weight: 600;
  color: #334155;
}

.node-file-badge {
  flex-shrink: 0;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
}

.node-file-md {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px 12px;
  line-height: 1.625;
  color: #475569;
}

.node-file-pre {
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow: hidden;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  line-height: 1.375;
  color: #334155;
}

.node-pager {
  position: absolute;
  right: 10px;
  bottom: 6px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 1px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(4px);
  font-size: 11px;
  font-weight: 500;
  color: #475569;
  user-select: none;
}

.node-pager-btn {
  display: flex;
  width: 16px;
  height: 16px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.node-pager-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.node-pager-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.node-pager-label {
  padding: 0 4px;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: #64748b;
}

${SHARED_RICH_TEXT_STYLES}

`

export const PRESENTER_STYLES = PRESENTER_BASE_STYLES + PRESENTER_CHROME_STYLES + PRESENTER_REFERENCE_STYLES
