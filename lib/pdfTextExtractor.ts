'use client'

// pdfjs-dist 워커 1회 설정 가드
let configured = false

async function getPdfJs() {
  // 클라이언트 전용 — dynamic import 로 SSR 번들 회피
  const pdfjs: any = await import('pdfjs-dist')
  if (!configured) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    configured = true
  }
  return pdfjs
}

/**
 * 공개 PDF URL 에서 텍스트를 추출한다. 워커는 unpkg CDN 사용.
 * @param url 공개 접근 가능한 PDF URL (Supabase Storage public bucket 등)
 * @param maxPages 추출할 최대 페이지 수 (기본 20)
 */
export async function extractTextFromPdfUrl(url: string, maxPages = 20): Promise<string> {
  if (!url) return ''
  const pdfjs: any = await getPdfJs()
  const task = pdfjs.getDocument({ url })
  const pdf = await task.promise
  const limit = Math.min(pdf.numPages ?? 0, maxPages)
  const parts: string[] = []
  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = (content.items as any[])
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
    parts.push(text)
  }
  return parts.join('\n\n').trim()
}
