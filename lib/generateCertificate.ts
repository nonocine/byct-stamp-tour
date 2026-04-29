'use client'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function downloadCertificatePdf(
  node: HTMLElement,
  participantName: string,
) {
  // mixBlendMode 등 일부 CSS는 html2canvas 기본 옵션으로 잘 합성되지 않으므로
  // foreignObjectRendering 비활성 + scale 2배로 해상도 보강.
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // 캔버스 비율로 PDF에 맞춰 채우기 (가로 폭 기준)
  const ratio = canvas.width / canvas.height
  let renderW = pageWidth
  let renderH = renderW / ratio
  if (renderH > pageHeight) {
    renderH = pageHeight
    renderW = renderH * ratio
  }
  const offsetX = (pageWidth - renderW) / 2
  const offsetY = (pageHeight - renderH) / 2

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST')

  const today = new Date()
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const safeName = participantName.replace(/[\\/:*?"<>|]/g, '').trim() || 'participant'
  pdf.save(`BYCT_인증서_${safeName}_${ymd}.pdf`)
}
