'use client'
// 단순 마크다운 → docx 변환기. heading, table, bullet, blockquote, **bold**, `code` 지원.
import {
  AlignmentType,
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
      children: [new Paragraph({ children: toTextRuns(parseInline(c)) })],
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

type DocxImageType = 'jpg' | 'png' | 'gif' | 'bmp'

function imageTypeFromMime(mime: string): DocxImageType {
  if (mime.includes('png')) return 'png'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('bmp')) return 'bmp'
  return 'jpg'
}

// 브라우저에서 이미지 실제 크기 측정 (비율 유지용)
function getImageDimensions(buf: ArrayBuffer, mime: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    try {
      const blob = new Blob([buf], { type: mime })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth || 450, height: img.naturalHeight || 300 })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        resolve({ width: 450, height: 300 })
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch {
      resolve({ width: 450, height: 300 })
    }
  })
}

// photo_urls → "현장 사진" 섹션 블록 생성
async function buildPhotoBlocks(photoUrls: string[]): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = []
  const MAX_W = 450 // px

  const images: Paragraph[] = []
  for (const url of photoUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      const mime = res.headers.get('content-type') || 'image/jpeg'
      const type = imageTypeFromMime(mime)
      const { width, height } = await getImageDimensions(buf, mime)
      const scale = width > MAX_W ? MAX_W / width : 1
      images.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: buf,
              type,
              transformation: {
                width: Math.round(width * scale),
                height: Math.round(height * scale),
              },
            }),
          ],
          spacing: { after: 160 },
        }),
      )
    } catch {
      // 개별 이미지 실패는 건너뜀
    }
  }

  if (images.length === 0) return out
  out.push(headingPara('현장 사진', 2))
  out.push(...images)
  return out
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
