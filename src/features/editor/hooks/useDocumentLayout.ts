import { useMemo } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { layoutDocument } from '../data/layout'
import type { DocumentLayout } from '../data/layout'

/** 布局只在文档结构或预设变化时重算：拖动期间画面由预览位置覆盖，重排是白费的 */
export function useDocumentLayout(document: PaperDocument): DocumentLayout {
  const { nodes, rootIds, defaults } = document

  return useMemo(() => layoutDocument(nodes, rootIds, defaults), [nodes, rootIds, defaults])
}
