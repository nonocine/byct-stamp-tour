/**
 * 업로드 전 브라우저 이미지 압축 — dream-road(독립탐험대) src/lib/image.ts 에서 가져옴.
 *
 * 긴 변 1600px 이하로 줄이고, 목표 용량(약 500KB)에 맞을 때까지 JPEG 품질을 낮춘다.
 * 고정 품질 하나로는 사진 내용에 따라 결과가 3배씩 차이 나서 목표를 못 지킨다.
 * `imageOrientation: "from-image"` 로 EXIF 회전을 적용한다 — 없으면 세로 사진이 눕는다.
 */

const MAX_DIMENSION = 1600
const TARGET_BYTES = 500 * 1024
const MIN_QUALITY = 0.5

function fitWithin(width: number, height: number, max: number) {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality })
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/jpeg', quality)
  })
}

export async function resizeImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('이 사진 형식은 읽을 수 없어요. 다른 사진을 고르거나 JPG·PNG 사진으로 올려 주세요.')
  }

  try {
    let { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION)
    // 해상도를 줄여 가며 최대 4번. 각 시도에서 품질을 차례로 낮춘다.
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = makeCanvas(width, height)
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
      if (!ctx) throw new Error('이 브라우저에서는 사진을 줄일 수 없어요.')
      ctx.drawImage(bitmap, 0, 0, width, height)

      let best: Blob | null = null
      for (const q of [0.85, 0.75, 0.65, 0.55, MIN_QUALITY]) {
        best = await canvasToBlob(canvas, q)
        if (best.size <= TARGET_BYTES) break
      }
      if (best && (best.size <= TARGET_BYTES || attempt === 3)) return best

      width = Math.max(1, Math.round(width * 0.8))
      height = Math.max(1, Math.round(height * 0.8))
    }
    throw new Error('사진 용량을 줄이지 못했어요. 다른 사진으로 해 볼까요?')
  } finally {
    bitmap.close?.()
  }
}
