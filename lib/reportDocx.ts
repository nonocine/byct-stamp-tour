'use client'
// 단순 마크다운 → docx 변환기. heading, table, bullet, blockquote, **bold**, `code` 지원.
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'

const FONT = '맑은 고딕'

interface InlineRun {
  text: string
  bold?: boolean
  code?: boolean
}

function parseInline(s: string): InlineRun[] {
  const runs: InlineRun[] = []
  let i = 0
  let buf = ''
  const flush = (opts?: Omit<InlineRun, 'text'>) => {
    if (buf) {
      runs.push({ text: buf, ...(opts ?? {}) })
      buf = ''
    }
  }
  while (i < s.length) {
    if (s[i] === '*' && s[i + 1] === '*') {
      flush()
      const end = s.indexOf('**', i + 2)
      if (end < 0) { buf = s.slice(i); break }
      runs.push({ text: s.slice(i + 2, end), bold: true })
      i = end + 2
      continue
    }
    if (s[i] === '`') {
      flush()
      const end = s.indexOf('`', i + 1)
      if (end < 0) { buf = s.slice(i); break }
      runs.push({ text: s.slice(i + 1, end), code: true })
      i = end + 1
      continue
    }
    buf += s[i]
    i++
  }
  flush()
  return runs
}

function toTextRuns(runs: InlineRun[]): TextRun[] {
  return runs.map(r => new TextRun({
    text: r.text,
    bold: r.bold,
    font: FONT,
    size: r.code ? 18 : 20,
  }))
}

function paragraphLine(line: string): Paragraph {
  return new Paragraph({
    children: toTextRuns(parseInline(line)),
    spacing: { after: 120 },
  })
}

function headingPara(text: string, level: number): Paragraph {
  const lvls = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ]
  const sizes = [32, 28, 24, 22, 20, 20]
  const idx = Math.min(Math.max(level, 1), 6) - 1
  return new Paragraph({
    heading: lvls[idx],
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: FONT, size: sizes[idx] })],
  })
}

function bulletPara(line: string): Paragraph {
  return new Paragraph({
    children: toTextRuns(parseInline(line)),
    bullet: { level: 0 },
    spacing: { after: 80 },
  })
}

function quotePara(line: string): Paragraph {
  return new Paragraph({
    children: toTextRuns(parseInline(line)),
    spacing: { after: 120 },
    indent: { left: 360 },
  })
}

function tableFromMd(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, font: FONT, size: 20 })],
        alignment: AlignmentType.CENTER,
      })],
      width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
    })),
  })
  const dataRows = rows.map(cells => new TableRow({
    children: cells.map(c => new TableCell({
      // 셀 안의 <br> 은 줄바꿈(문단 분리)으로 처리
      children: c.split(/<br\s*\/?>/i).map(part => new Paragraph({ children: toTextRuns(parseInline(part.trim())) })),
    })),
  }))
  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  })
}

function isTableSep(line: string): boolean {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
}
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map(c => c.trim())
}

function buildBlocks(md: string): (Paragraph | Table)[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: (Paragraph | Table)[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      out.push(headingPara(h[2].trim(), h[1].length))
      i++
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push(tableFromMd(headers, rows))
      out.push(new Paragraph({ children: [new TextRun('')] }))
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        out.push(bulletPara(lines[i].replace(/^\s*[-*]\s+/, '')))
        i++
      }
      continue
    }

    if (/^>\s?/.test(line)) {
      out.push(quotePara(line.replace(/^>\s?/, '')))
      i++
      continue
    }

    out.push(paragraphLine(line))
    i++
  }
  return out
}

export const PHOTO_SECTION_TITLE = '8. 현장 사진'

// 사진 격자 — 한 줄 2장, 모두 같은 4:3 크기 (A4 본문폭 170mm 기준)
const PHOTO_W = 300 // px
const PHOTO_H = 225 // px

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

// 브라우저 canvas 로 가운데 기준 4:3 크롭 → JPEG. 사진마다 비율이 달라도 격자 칸 크기가 같아진다.
function cropToFrame(buf: ArrayBuffer, mime: string): Promise<ArrayBuffer | null> {
  return new Promise(resolve => {
    try {
      const url = URL.createObjectURL(new Blob([buf], { type: mime }))
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const outW = PHOTO_W * 3
        const outH = PHOTO_H * 3
        const srcRatio = img.naturalWidth / img.naturalHeight
        const dstRatio = outW / outH
        let sw = img.naturalWidth
        let sh = img.naturalHeight
        if (srcRatio > dstRatio) sw = sh * dstRatio
        else sh = sw / dstRatio
        const canvas = document.createElement('canvas')
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, outW, outH)
        canvas.toBlob(
          blob => { blob ? blob.arrayBuffer().then(resolve, () => resolve(null)) : resolve(null) },
          'image/jpeg',
          0.85,
        )
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    } catch {
      resolve(null)
    }
  })
}

function photoCell(data: ArrayBuffer | null): TableCell {
  return new TableCell({
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: data
          ? [new ImageRun({ data, type: 'jpg', transformation: { width: PHOTO_W, height: PHOTO_H } })]
          : [],
      }),
    ],
  })
}

// photo_urls → "현장 사진" 섹션 블록 생성 (보고서 맨 마지막에 붙는다)
async function buildPhotoBlocks(photoUrls: string[]): Promise<(Paragraph | Table)[]> {
  const images: ArrayBuffer[] = []
  for (const url of photoUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      const cropped = await cropToFrame(buf, res.headers.get('content-type') || 'image/jpeg')
      if (cropped) images.push(cropped)
    } catch {
      // 개별 이미지 실패는 건너뜀
    }
  }
  if (images.length === 0) return []

  const rows: TableRow[] = []
  for (let i = 0; i < images.length; i += 2) {
    rows.push(new TableRow({ children: [photoCell(images[i]), photoCell(images[i + 1] ?? null)] }))
  }
  return [
    headingPara(PHOTO_SECTION_TITLE, 2),
    new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
        insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
      },
    }),
  ]
}

export async function downloadReportAsDocx(
  markdown: string,
  filename: string,
  photoUrls: string[] = [],
): Promise<void> {
  const blocks = buildBlocks(markdown)
  if (photoUrls.length > 0) {
    const photoBlocks = await buildPhotoBlocks(photoUrls)
    blocks.push(...photoBlocks)
  }
  const doc = new Document({
    creator: 'B.Y.C.T 스탬프투어',
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children: blocks,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── 소감문 자료집 ────────────────────────────────────────────────────────────
// 보고서와 같은 글꼴·제목 스타일·여백(downloadReportAsDocx)을 쓴다. 기관별로 묶고,
// 소감문 1편 = 1쪽(이름·사진·본문). 사진은 자르지 않고 비율을 지켜 줄인다.

export interface EssayDocItem {
  participant_name: string
  center_id: number
  center_name: string
  is_excellent: boolean
  photo_url: string | null
  sections: { title: string; body: string }[]
}

const ESSAY_PHOTO_MAX_W = 420 // px
const ESSAY_PHOTO_MAX_H = 300 // px

// 사진 → 비율 유지 JPEG + 표시 크기. 실패하면 null(사진 없이 계속).
async function fitPhoto(url: string): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('image'))
        i.src = objUrl
      })
      const scale = Math.min(ESSAY_PHOTO_MAX_W / img.naturalWidth, ESSAY_PHOTO_MAX_H / img.naturalHeight, 1)
      const width = Math.max(1, Math.round(img.naturalWidth * scale))
      const height = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85))
      if (!out) return null
      return { data: await out.arrayBuffer(), width, height }
    } finally {
      URL.revokeObjectURL(objUrl)
    }
  } catch {
    return null
  }
}

// 사용자가 쓴 글은 마크다운으로 해석하지 않는다(** 같은 문자가 그대로 보이게).
function plainParas(text: string): Paragraph[] {
  return text
    .split(/\r?\n/)
    .map(line => new Paragraph({
      children: [new TextRun({ text: line, font: FONT, size: 21 })],
      spacing: { after: 80, line: 340 },
    }))
}

export async function downloadEssayBookDocx(
  items: EssayDocItem[],
  filename: string,
  opts: { title: string; centerOrder: number[]; onProgress?: (done: number, total: number) => void },
): Promise<void> {
  const groups = new Map<number, EssayDocItem[]>()
  for (const it of items) {
    const g = groups.get(it.center_id) ?? []
    g.push(it)
    groups.set(it.center_id, g)
  }
  const order = [
    ...opts.centerOrder.filter(id => groups.has(id)),
    ...[...groups.keys()].filter(id => !opts.centerOrder.includes(id)),
  ]

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [new TextRun({ text: opts.title, bold: true, font: FONT, size: 44 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `소감문 ${items.length}편 · ${order.length}개 기관`, font: FONT, size: 24 })],
    }),
  ]
  // 목차
  blocks.push(headingPara('차례', 2))
  for (const id of order) {
    const g = groups.get(id)!
    blocks.push(bulletPara(`${g[0].center_name} — ${g.length}편`))
  }

  let done = 0
  for (const id of order) {
    const g = groups.get(id)!
    // 기관 표지
    blocks.push(new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 1600, after: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: g[0].center_name, bold: true, font: FONT, size: 36 })],
    }))
    blocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `소감문 ${g.length}편`, font: FONT, size: 22 })],
    }))

    for (const it of g) {
      blocks.push(new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 160 },
        children: [
          new TextRun({ text: it.participant_name, bold: true, font: FONT, size: 30 }),
          ...(it.is_excellent ? [new TextRun({ text: '  ★ 우수작', bold: true, font: FONT, size: 22, color: 'C47F00' })] : []),
        ],
      }))
      blocks.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: it.center_name, font: FONT, size: 18, color: '888888' })],
      }))
      if (it.photo_url) {
        const photo = await fitPhoto(it.photo_url)
        if (photo) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new ImageRun({ data: photo.data, type: 'jpg', transformation: { width: photo.width, height: photo.height } })],
          }))
        }
      }
      for (const s of it.sections) {
        if (!s.body.trim()) continue
        blocks.push(new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [new TextRun({ text: s.title, bold: true, font: FONT, size: 20, color: '1A3A8C' })],
        }))
        blocks.push(...plainParas(s.body.trim()))
      }
      done += 1
      opts.onProgress?.(done, items.length)
    }
  }

  const doc = new Document({
    creator: 'B.Y.C.T 스탬프투어',
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(20),
            bottom: convertMillimetersToTwip(20),
            left: convertMillimetersToTwip(20),
            right: convertMillimetersToTwip(20),
          },
        },
      },
      children: blocks,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
