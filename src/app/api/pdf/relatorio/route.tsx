import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#333' },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#009ada', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#666', marginBottom: 2 },
  table: { marginTop: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 8, paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 6, paddingHorizontal: 6 },
  tableFooter: { flexDirection: 'row', backgroundColor: '#e0f3fb', paddingVertical: 8, paddingHorizontal: 6 },
  colData: { width: '14%' },
  colHora: { width: '10%' },
  colProduto: { width: '32%' },
  colQtd: { width: '8%', textAlign: 'center' },
  colPreco: { width: '18%', textAlign: 'right' },
  colSubtotal: { width: '18%', textAlign: 'right' },
  headerText: { fontWeight: 'bold', color: '#555', fontSize: 9 },
  footerLabel: { fontWeight: 'bold', color: '#333', width: '82%' },
  footerTotal: { fontWeight: 'bold', color: '#009ada', width: '18%', textAlign: 'right', fontSize: 11 },
})

function formatCurrencyPDF(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDatePDF(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR')
}

function formatTimePDF(date: string): string {
  const d = new Date(date)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

interface CompraItem {
  id: string
  comprado_em: string
  produto: { nome: string }
  quantidade: number
  preco_unit: number
}

export async function POST(req: NextRequest) {
  const { usuario_id, inicio, fim, periodo_label } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: usuario }, { data: compras }] = await Promise.all([
    supabase.from('usuarios').select('nome').eq('id', usuario_id).single(),
    supabase
      .from('compras')
      .select('*, produto:produtos(nome)')
      .eq('usuario_id', usuario_id)
      .gte('comprado_em', inicio)
      .lte('comprado_em', fim)
      .order('comprado_em'),
  ])

  const listaCompras: CompraItem[] = (compras ?? []) as CompraItem[]
  const total = listaCompras.reduce((acc: number, c: CompraItem) => acc + c.preco_unit * c.quantidade, 0)
  const periodoLabel = periodo_label ?? `${formatDatePDF(inicio)} a ${formatDatePDF(fim)}`

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>SquadHub — Relatorio de Compras Lojinha</Text>
          <Text style={styles.subtitle}>Colaborador: {usuario?.nome ?? 'N/A'}</Text>
          <Text style={styles.subtitle}>Periodo: {periodoLabel}</Text>
          <Text style={styles.subtitle}>Gerado em: {formatDatePDF(new Date().toISOString())}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colData, styles.headerText]}>Data</Text>
            <Text style={[styles.colHora, styles.headerText]}>Horario</Text>
            <Text style={[styles.colProduto, styles.headerText]}>Produto</Text>
            <Text style={[styles.colQtd, styles.headerText]}>Qtd</Text>
            <Text style={[styles.colPreco, styles.headerText]}>Preco unit.</Text>
            <Text style={[styles.colSubtotal, styles.headerText]}>Subtotal</Text>
          </View>

          {listaCompras.map((c: CompraItem) => (
            <View key={c.id} style={styles.tableRow}>
              <Text style={styles.colData}>{formatDatePDF(c.comprado_em)}</Text>
              <Text style={styles.colHora}>{formatTimePDF(c.comprado_em)}</Text>
              <Text style={styles.colProduto}>{c.produto?.nome ?? '-'}</Text>
              <Text style={styles.colQtd}>{String(c.quantidade)}</Text>
              <Text style={styles.colPreco}>{formatCurrencyPDF(c.preco_unit)}</Text>
              <Text style={styles.colSubtotal}>{formatCurrencyPDF(c.preco_unit * c.quantidade)}</Text>
            </View>
          ))}

          <View style={styles.tableFooter}>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerTotal}>{formatCurrencyPDF(total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  const uint8Array = new Uint8Array(buffer)

  return new NextResponse(uint8Array, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="relatorio.pdf"',
    },
  })
}