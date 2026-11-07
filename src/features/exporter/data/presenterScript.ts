import { PRESENTER_INTERACTION_SCRIPT } from './presenterInteractionScript'
import { PRESENTER_LAYOUT_SCRIPT } from './presenterLayoutScript'
import { PRESENTER_REFERENCE_SCRIPT } from './presenterReferenceScript'
import { PRESENTER_RENDER_SCRIPT } from './presenterRenderScript'

/** 导出包内演示器的自包含脚本（纯浏览器 JS，不依赖 React 或构建产物） */
export const PRESENTER_SCRIPT = `(function () {
${PRESENTER_LAYOUT_SCRIPT}
${PRESENTER_RENDER_SCRIPT}
${PRESENTER_REFERENCE_SCRIPT}
${PRESENTER_INTERACTION_SCRIPT}
})()
`
