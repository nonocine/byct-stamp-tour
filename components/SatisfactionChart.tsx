'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

export interface SatisfactionData {
  programAvg: number | null
  leaderAvg: number | null
  facilityAvg: number | null
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981']

export default function SatisfactionChart({ data }: { data: SatisfactionData }) {
  const rows = [
    { name: '프로그램', score: data.programAvg },
    { name: '지도자', score: data.leaderAvg },
    { name: '시설', score: data.facilityAvg },
  ]
  const hasAny = rows.some(r => r.score !== null)

  if (!hasAny) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center no-print">
        <p className="text-sm text-gray-400">아직 누적된 만족도 평가가 없습니다.</p>
      </div>
    )
  }

  const chartData = rows.map(r => ({ name: r.name, score: r.score ?? 0 }))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-4 py-5 no-print">
      <h3 className="text-sm font-bold text-gray-700 mb-3 px-1">📊 항목별 만족도 (평균 / 5.0)</h3>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 20, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#374151' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: any) => [`${Number(v).toFixed(1)} / 5.0`, '평균']}
              cursor={{ fill: '#f9fafb' }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={56}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList
                dataKey="score"
                position="top"
                formatter={(v: any) => (Number(v) > 0 ? Number(v).toFixed(1) : '-')}
                style={{ fontSize: 13, fontWeight: 700, fill: '#374151' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
