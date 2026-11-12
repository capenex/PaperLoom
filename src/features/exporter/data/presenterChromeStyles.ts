import { PRESENTER_THEME_TOKENS } from '@/shared/lib/presenterTheme'

/** 导出包内演示器的外框与导航样式：左侧详情面板容器、节点角标与面包屑 */
export const PRESENTER_CHROME_STYLES = `.detail {
  position: relative;
  z-index: 20;
  display: none;
  width: 40%;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 12px 8px 12px 12px;
  background: rgba(251, 252, 254, 0.85);
  backdrop-filter: blur(4px);
}

.detail.is-open {
  display: flex;
}

.detail-card {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: ${PRESENTER_THEME_TOKENS.detailCardShadow};
}

.detail-image {
  display: none;
  width: 100%;
  height: 100%;
  padding: 24px;
  object-fit: contain;
  user-select: none;
}

.detail[data-mode="image"] .detail-image {
  display: block;
}

.detail-image-empty {
  display: none;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.7);
  font-size: 14px;
  color: #94a3b8;
}

.detail[data-mode="image"][data-image-empty="true"] .detail-image {
  display: none;
}

.detail[data-mode="image"][data-image-empty="true"] .detail-image-empty {
  display: flex;
}

.detail-collapse {
  position: absolute;
  right: 8px;
  top: 50%;
  z-index: 20;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  transform: translate(50%, -50%);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 9999px;
  background: #ffffff;
  color: #475569;
  box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.detail-collapse:hover {
  transform: translate(50%, -50%) scale(1.05);
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

.detail-collapse:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px ${PRESENTER_THEME_TOKENS.primary};
}

.node-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid ${PRESENTER_THEME_TOKENS.primaryMuted25};
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.95);
  color: ${PRESENTER_THEME_TOKENS.primary};
  box-shadow: 0 1px 1px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(4px);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  pointer-events: none;
}

.node-badge.is-host {
  border-color: #bae6fd;
  background: rgba(240, 249, 255, 0.95);
  color: #0369a1;
}

.breadcrumbs {
  position: absolute;
  top: 14px;
  left: 16px;
  z-index: 30;
  display: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(12px);
  font-size: 12px;
}

.breadcrumbs.is-visible {
  display: flex;
}

.breadcrumb-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.breadcrumb-back:hover {
  background: rgba(226, 232, 240, 0.8);
  color: #0f172a;
}

.breadcrumb-divider {
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: #e2e8f0;
}

.breadcrumb-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.breadcrumb-step {
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-sep {
  color: #cbd5e1;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.breadcrumb-item:hover:not(:disabled) {
  background: #f1f5f9;
  color: #1e293b;
}

.breadcrumb-item.is-current {
  padding: 2px 8px;
  background: ${PRESENTER_THEME_TOKENS.primarySoft10};
  color: ${PRESENTER_THEME_TOKENS.primary};
  font-weight: 600;
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .node {
    transition: none;
  }
}
`
