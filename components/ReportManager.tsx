'use client'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Download, FileText, Save, Eye, Edit2 } from 'lucide-react'
import { collectCenterReportData, collectGlobalReportData } from '@/lib/reportData'
import { generateCenterReport, generateGlobalReport } from '@/lib/reportGenerator'
import { downloadReportAsDocx } from '@/lib/reportDocx'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'

type Scope = 'center' | 'global'
type Status = 'idle' | 'collecting' | 'ready' | 'error'
type View = 'preview' | 'edit'

interface Props {
  scope: Scope
  centerId?: number
  createdBy: string
  /** 외부에서 주입할 마크다운(저장된 보고서 불러오기 등). 비어있으면 무시. */
  externalMarkdown?: string | null
  /** externalMarkdown 변경 감지용 키. 이 값이 바뀌면 외부 마크다운으로 상태가 교체됨. */
  externalMarkdownKey?: string | number | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  const isSep = (l: string) => /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(l)
  const splitRow = (l: string) => {
    let s = l.trim()
    if (s.startsWith('|')) s = s.slice(1)
    if (s.endsWith('|')) s = s.slice(0, -1)
    return s.split('|').map(c => c.trim())
  }
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      out.push(`<h${h[1].length}>${renderInline(h[2].trim())}</h${h[1].length}>`)
      i++; continue
    }
    if (line.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const headers = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push(
        `<table><thead><tr>${headers.map(h => `<th>${renderInline(h)}</th>`).join('')}</tr></thead><tbody>` +
          rows.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('') +
          `</tbody></table>`,
      )
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^>\s?/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^>\s?/, '')))
        i++
      }
      out.push(`<blockquote>${items.join('<br>')}</blockquote>`)
      continue
    }
    out.push(`<p>${renderInline(line)}</p>`)
    i++
  }
  return out.join('\n')
}

export default function ReportManager({
  scope,
  centerId,
  createdBy,
  externalMarkdown,
  externalMarkdownKey,
}: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [view, setView] = useState<View>('preview')
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // 외부 주입 마크다운 — key 변경 시 내부 상태 교체
  useEffect(() => {
    if (typeof externalMarkdown === 'string' && externalMarkdown.length > 0) {
      setMarkdown(externalMarkdown)
      setView('preview')
      setStatus('ready')
      setError('')
      setSavedAt(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalMarkdownKey])

  async function handleGenerate() {
    setStatus('collecting')
    setError('')
    setSavedAt(null)
    try {
      let md: string
      if (scope === 'global') {
        const data = await collectGlobalReportData()
        md = generateGlobalReport(data)
      } else {
        if (!centerId) throw new Error('기관이 선택되지 않았습니다.')
        const data = await collectCenterReportData(centerId)
        md = generateCenterReport(data)
      }
      setMarkdown(md)
      setView('preview')
      setStatus('ready')
    } catch (e: any) {
      console.error('[ReportManager] 생성 실패:', e)
      setError(`보고서 생성 실패: ${e?.message ?? e}`)
      setStatus('error')
    }
  }

  async function handleDownloadDocx() {
    if (!markdown) return
    setDownloading(true)
    try {
      const tag = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const shortName = ORGANIZATIONS.find(o => o.id === centerId)?.shortName ?? 'center'
      const base = scope === 'global' ? `byct_통합보고서_${tag}` : `byct_${shortName}_${tag}`
      await downloadReportAsDocx(markdown, `${base}.docx`)
    } catch (e: any) {
      alert(`Word 파일 생성 실패: ${e?.message ?? e}`)
    } finally {
      setDownloading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  async function handleSaveToDb() {
    if (!markdown) return
    setSaving(true)
    try {
      const titleLine = markdown.split('\n').find(l => l.startsWith('# '))
      const title = titleLine
        ? titleLine.replace(/^#\s+/, '').trim()
        : `보고서 ${new Date().toLocaleDateString('ko-KR')}`
      const { error } = await supabase.from('reports').insert({
        scope,
        center_id: scope === 'center' ? (centerId ?? null) : null,
        title,
        content_md: markdown,
        created_by: createdBy,
      })
      if (error) throw error
      setSavedAt(new Date().toLocaleTimeString('ko-KR'))
    } catch (e: any) {
      alert(`DB 저장 실패: ${e?.message ?? e}`)
    } finally {
      setSaving(false)
    }
  }

  const previewHtml = useMemo(() => renderMarkdown(markdown), [markdown])
  const isBusy = status === 'collecting'
  const canGenerate = scope === 'global' || !!centerId

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 no-print">
        <button
          onClick={handleGenerate}
          disabled={isBusy || !canGenerate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBusy ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> 데이터 수집 중...
            </>
          ) : status === 'ready' ? (
            <>
              <RefreshCw size={14} /> 다시 생성
            </>
          ) : (
            <>✨ 보고서 생성</>
          )}
        </button>

        {status === 'ready' && (
          <>
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setView('preview')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Eye size={12} /> 미리보기
              </button>
              <button
                onClick={() => setView('edit')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Edit2 size={12} /> 편집
              </button>
            </div>
            <button
              onClick={handleDownloadDocx}
              disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Word(.docx)
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 text-white text-sm font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
            >
              <FileText size={14} /> PDF / 인쇄
            </button>
            <button
              onClick={handleSaveToDb}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              DB 저장
            </button>
          </>
        )}
      </div>

      {savedAt && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700 no-print">
          ✓ DB에 저장되었습니다 ({savedAt})
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 no-print">
          {error}
        </div>
      )}

      {status === 'ready' && view === 'preview' && (
        <div
          className="report-preview bg-white rounded-2xl border border-gray-200 px-6 py-6 max-w-none print:border-0 print:p-0"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}

      {status === 'ready' && view === 'edit' && (
        <textarea
          value={markdown}
          onChange={e => setMarkdown(e.target.value)}
          className="w-full min-h-[600px] p-4 font-mono text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 no-print"
          spellCheck={false}
        />
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-preview { border: none !important; padding: 0 !important; }
        }
        .report-preview h1 { font-size: 24px; font-weight: 800; margin: 16px 0 12px; color: #111827; }
        .report-preview h2 {
          font-size: 19px; font-weight: 700; margin: 20px 0 10px;
          color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;
        }
        .report-preview h3 { font-size: 16px; font-weight: 700; margin: 14px 0 8px; }
        .report-preview p { margin: 8px 0; line-height: 1.65; font-size: 13px; }
        .report-preview ul { margin: 8px 0 8px 20px; font-size: 13px; }
        .report-preview li { margin: 3px 0; line-height: 1.55; }
        .report-preview blockquote {
          margin: 10px 0; padding: 8px 12px; background: #f9fafb;
          border-left: 3px solid #d1d5db; color: #4b5563; font-size: 13px;
        }
        .report-preview table {
          border-collapse: collapse; margin: 12px 0; width: 100%; font-size: 12px;
        }
        .report-preview th, .report-preview td {
          border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;
        }
        .report-preview th { background: #f3f4f6; font-weight: 700; }
        .report-preview a { color: #2563eb; text-decoration: underline; }
        .report-preview code {
          background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 11px;
        }
        .report-preview em { color: #6b7280; }
      `}</style>
    </div>
  )
}
