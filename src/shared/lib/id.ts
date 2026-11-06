/** 生成全局唯一 ID（浏览器原生 UUID） */
export function createId(): string {
  return crypto.randomUUID()
}
