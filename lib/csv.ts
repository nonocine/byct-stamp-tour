'use client'
/** CSV 다운로드 — 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙인다. */

function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  // 엑셀 수식 주입 방지: = + - @ 로 시작하면 앞에 ' 를 붙인다
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const text = [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
