/* eslint-disable react/iframe-missing-sandbox -- 引用的本地页面来自用户自己的文件，沙箱会让其中脚本失效 */
import type { DetailContent } from '../lib/detailContent'
import { PdfDetailView } from './PdfDetailView'

interface DetailBodyProps {
  readonly detail: DetailContent
}

/** 详情正文：图片直接展示，本地页面内嵌展示，PDF 用 pdf.js 定位到引用页 */
export function DetailBody({ detail }: Readonly<DetailBodyProps>) {
  if (detail.type === 'image') {
    return (
      <img
        src={detail.src}
        alt={detail.alt}
        draggable={false}
        className="h-full w-full select-none object-contain p-6"
      />
    )
  }
  if (detail.type === 'page') {
    return <iframe src={detail.src} title={detail.label} className="h-full w-full border-0 bg-white" />
  }
  return <PdfDetailView key={`${detail.src}#${detail.page}`} src={detail.src} page={detail.page} />
}
