'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from 'firebase/auth'
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import {
  isFirebaseConfigured,
  subscribeToAuthState,
  logoutUser,
  saveUserData,
  loadUserData,
} from '../lib/firebase'
import LoginScreen from './components/LoginScreen'
import {
  searchTACO, fuzzyMatchTACO, generateDiet, getSubstitutes,
  getTodaySubstitutes, formatTacoItemName, naturalGrams, searchWithAI,
  BUDGET_IDS, FOOD_UNITS,
  type TacoFood, type GeneratedItem, type GeneratedMeal,
} from '../lib/taco-data'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface MealItem {
  id:      string
  name:    string
  kcal:    number
  p:       number
  c:       number
  f:       number
  unitQty?: number   // present only for unit-based foods (Ovo, Pão, Fruta…)
}

interface Meal {
  id:    string
  title: string
  items: MealItem[]
}

interface SubOption {
  id:   string
  name: string
  kcal: number
  p:    number
  c:    number
  f:    number
}

interface WeightEntry {
  peso:      number
  foto?:     string
  calorias?: number
}

type SyncStatus  = 'unconfigured' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
type ReportPeriod = 'daily' | 'weekly' | 'monthly' | '3m' | '6m'

interface ReportData {
  periodLabel:  string
  dateRange:    string
  dates:        string[]
  finalizados:  number
  daysWithCals: number
  totalCals:    number
  avgCals:      number
  avgP:         number
  avgC:         number
  avgF:         number
  firstW:       number | null
  lastW:        number | null
  weightDiff:   number | null
  weeklyTrend:  number | null
  calChart:     { label: string; cals: number }[]
  pesoChart:    { label: string; peso: number }[]
  macroChart:   { name: string; consumido: number; meta: number }[]
  insights:     string[]
  generatedAt:  string
}

interface CalcResult {
  imc:      number
  imcClass: string
  imcColor: string
  tmb:      number
  tdee:     number
  manter:   number
  emagrecer: number
  ganhar:   number
}


interface SubSearchResult {
  food:   TacoFood
  grams:  number
  kcal:   number
  p:      number
  c:      number
  f:      number
  isAI?:  boolean
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

/** Cardápio padrão para o Vitor (migração de dados existentes) */
const DEFAULT_MEALS: Meal[] = [
  { id: 'cafe',   title: 'Café da Manhã', items: [
    { id: 'cafe_ovo',   name: 'Ovo (2 un)',            kcal: 146, p: 13,  c: 1,  f: 9.5 },
    { id: 'cafe_pao',   name: 'Pão francês (1 un)',    kcal: 150, p: 4,   c: 29, f: 1.5 },
    { id: 'cafe_req',   name: 'Requeijão Light (60g)', kcal: 108, p: 8.5, c: 1,  f: 5.4 },
  ]},
  { id: 'almoco', title: 'Almoço', items: [
    { id: 'almoco_frango', name: 'Frango (180g)',   kcal: 297, p: 56,  c: 0,  f: 7.2 },
    { id: 'almoco_arroz',  name: 'Arroz (130g)',    kcal: 169, p: 3.5, c: 37, f: 0.4 },
    { id: 'almoco_veg',    name: 'Vegetais (100g)', kcal: 30,  p: 1,   c: 6,  f: 0.2 },
  ]},
  { id: 'lanche', title: 'Lanche', items: [
    { id: 'lanche_pao',    name: 'Pão francês (1 un)',    kcal: 150, p: 4,   c: 29, f: 1.5 },
    { id: 'lanche_frango', name: 'Frango (100g)',          kcal: 165, p: 31,  c: 0,  f: 3.6 },
    { id: 'lanche_req',    name: 'Requeijão Light (30g)', kcal: 54,  p: 4.5, c: 0,  f: 3.3 },
  ]},
  { id: 'jantar', title: 'Jantar', items: [
    { id: 'jantar_frango', name: 'Frango (180g)',   kcal: 297, p: 56,  c: 0,  f: 7.2 },
    { id: 'jantar_arroz',  name: 'Arroz (130g)',    kcal: 169, p: 3.5, c: 37, f: 0.4 },
    { id: 'jantar_veg',    name: 'Vegetais (100g)', kcal: 30,  p: 1,   c: 6,  f: 0.2 },
  ]},
  { id: 'ceia',   title: 'Ceia', items: [
    { id: 'ceia_whey',  name: 'Whey (30g)',  kcal: 120, p: 25,  c: 2,  f: 1.0 },
    { id: 'ceia_aveia', name: 'Aveia (20g)', kcal: 78,  p: 3.5, c: 13, f: 1.4 },
  ]},
]

/** Categorias vazias para novo usuário — ele adiciona seus alimentos via Config */
const NEW_USER_MEALS: Meal[] = [
  { id: 'cafe',   title: 'Café da Manhã', items: [] },
  { id: 'almoco', title: 'Almoço',        items: [] },
  { id: 'lanche', title: 'Lanche',        items: [] },
  { id: 'jantar', title: 'Jantar',        items: [] },
  { id: 'ceia',   title: 'Ceia',          items: [] },
]

const DEFAULT_ALTERNATIVES: Record<string, SubOption[]> = {
  cafe_ovo:       [{ id:'ca1', name:'Iogurte grego (165g)',    kcal:167, p:20,  c:6,  f:4  }, { id:'ca2', name:'Leite + Aveia',          kcal:200, p:9,   c:32, f:4  }],
  cafe_pao:       [{ id:'cp1', name:'Biscoito integral (50g)', kcal:190, p:4,   c:36, f:3  }, { id:'cp2', name:'Bolo integral (50g)',     kcal:155, p:3,   c:30, f:2  }],
  cafe_req:       [{ id:'cr1', name:'Queijo meia cura (60g)',  kcal:178, p:12,  c:0,  f:15 }, { id:'cr2', name:'Manteiga amendoim (30g)',kcal:185, p:7,   c:6,  f:16 }],
  almoco_frango:  [{ id:'af1', name:'Peixe (180g)',            kcal:234, p:48,  c:0,  f:4  }, { id:'af2', name:'Ovos cozidos (4 un)',    kcal:292, p:26,  c:0,  f:20 }, { id:'af3', name:'Feijão (180g)',        kcal:205, p:14, c:36, f:1 }],
  almoco_arroz:   [{ id:'aa1', name:'Batata doce (130g)',      kcal:117, p:2,   c:27, f:0  }, { id:'aa2', name:'Batata comum (130g)',    kcal:100, p:2,   c:23, f:0  }, { id:'aa3', name:'Macarrão (130g)',      kcal:184, p:6,  c:36, f:1 }],
  almoco_veg:     [{ id:'av1', name:'Cenoura',                 kcal:34,  p:1,   c:8,  f:0  }, { id:'av2', name:'Brócolis',               kcal:22,  p:3,   c:4,  f:0  }, { id:'av3', name:'Abobrinha',           kcal:17,  p:1,  c:3,  f:0 }, { id:'av4', name:'Qualquer verdura', kcal:30, p:1, c:6, f:0 }],
  lanche_pao:     [{ id:'lp1', name:'Biscoito integral (50g)', kcal:190, p:4,   c:36, f:3  }, { id:'lp2', name:'Bolo integral (50g)',    kcal:155, p:3,   c:30, f:2  }],
  lanche_frango:  [{ id:'lf1', name:'Atum (100g)',             kcal:128, p:28,  c:0,  f:2  }, { id:'lf2', name:'Queijo branco (100g)',   kcal:329, p:18,  c:0,  f:28 }, { id:'lf3', name:'Ovos cozidos (2 un)', kcal:146, p:13, c:1,  f:10 }],
  lanche_req:     [{ id:'lr1', name:'Queijo meia cura (30g)',  kcal:90,  p:6,   c:0,  f:7  }, { id:'lr2', name:'Manteiga amendoim (15g)',kcal:93,  p:3.5, c:3,  f:8  }],
  jantar_frango:  [{ id:'jf1', name:'Peixe (180g)',            kcal:234, p:48,  c:0,  f:4  }, { id:'jf2', name:'Ovos cozidos (4 un)',    kcal:292, p:26,  c:0,  f:20 }, { id:'jf3', name:'Feijão (180g)',        kcal:205, p:14, c:36, f:1 }],
  jantar_arroz:   [{ id:'ja1', name:'Batata doce (130g)',      kcal:117, p:2,   c:27, f:0  }, { id:'ja2', name:'Batata comum (130g)',    kcal:100, p:2,   c:23, f:0  }, { id:'ja3', name:'Macarrão (130g)',      kcal:184, p:6,  c:36, f:1 }],
  jantar_veg:     [{ id:'jv1', name:'Cenoura',                 kcal:34,  p:1,   c:8,  f:0  }, { id:'jv2', name:'Brócolis',               kcal:22,  p:3,   c:4,  f:0  }, { id:'jv3', name:'Abobrinha',           kcal:17,  p:1,  c:3,  f:0 }, { id:'jv4', name:'Qualquer verdura', kcal:30, p:1, c:6, f:0 }],
  ceia_whey:      [{ id:'cw1', name:'Iogurte grego (165g)',    kcal:167, p:20,  c:6,  f:4  }, { id:'cw2', name:'Leite desnatado (250ml)',kcal:90,  p:9,   c:13, f:0  }],
  ceia_aveia:     [{ id:'cv1', name:'Granola (20g)',           kcal:80,  p:2,   c:14, f:2  }, { id:'cv2', name:'Cereal integral (20g)', kcal:72,  p:2,   c:15, f:1  }],
}

const DEFAULT_GOALS     = { cals: 1963, p: 214, c: 161, f: 43 }
const NEW_USER_GOALS    = { cals: 2000, p: 150, c: 200, f: 65 }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcDayMacros(
  meals:      Meal[],
  dayChecked: Record<string, boolean>,
  activeSubs: Record<string, SubOption>,
) {
  let cals = 0, p = 0, c = 0, f = 0
  for (const meal of meals) {
    for (const item of (meal.items ?? [])) {
      if (!dayChecked?.[item.id]) continue
      const src = activeSubs[item.id] ?? item
      cals += src.kcal; p += src.p; c += src.c; f += src.f
    }
  }
  return { cals: Math.round(cals), p: Math.round(p), c: Math.round(c), f: Math.round(f) }
}

function getFeedback(cals: number, calMeta: number, _calMax: number) {
  const diff = cals - calMeta
  if (Math.abs(diff) <= 50) return { msg: 'No alvo! 🎯 Você atingiu sua meta!',                                       color: 'var(--success)', badge: '🟢' }
  if (diff < 0)             return { msg: `Você comeu pouco! Margem: +${Math.abs(diff)} kcal pra próximos dias ✅`,   color: 'var(--warning)', badge: '🟡' }
  return                           { msg: `Passou da meta em ${diff} kcal. Pode compensar amanhã 💪`,                 color: 'var(--warning)', badge: '🔴' }
}

function macroDesc(item: { kcal: number; p: number; c: number; f: number }) {
  return `${item.kcal} kcal · P ${item.p}g · C ${item.c}g · G ${item.f}g`
}

function dateLabel(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getLastNDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

function newId() { return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }

function rawPeso(entry: any): number | null {
  if (entry == null) return null
  const v = typeof entry === 'object' ? entry.peso : entry
  return typeof v === 'number' && !isNaN(v) ? v : null
}

function rawFoto(entry: any): string | null {
  return entry && typeof entry === 'object' ? (entry.foto || null) : null
}

function rawCalorias(entry: any): number | null {
  return entry && typeof entry === 'object' ? (entry.calorias || null) : null
}

// ─── Relatório: helpers ────────────────────────────────────────────────────────

function getReportDates(period: ReportPeriod, anchor: string): string[] {
  const d = new Date(anchor + 'T12:00:00')
  if (period === 'daily') return [anchor]
  if (period === 'weekly') {
    const dow = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(mon); x.setDate(mon.getDate() + i); return x.toISOString().split('T')[0]
    })
  }
  if (period === 'monthly') {
    const y = d.getFullYear(), m = d.getMonth()
    return Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) =>
      new Date(y, m, i + 1).toISOString().split('T')[0]
    )
  }
  const n = period === '3m' ? 90 : 180
  const end = new Date(anchor + 'T12:00:00')
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(end); x.setDate(end.getDate() - (n - 1 - i)); return x.toISOString().split('T')[0]
  })
}

function buildReport(
  period:     ReportPeriod,
  anchor:     string,
  meals:      Meal[],
  checked:    Record<string, Record<string, boolean>>,
  activeSubs: Record<string, SubOption>,
  dayStats:   Record<string, any>,
  weights:    Record<string, any>,
  goals:      { cals: number; p: number; c: number; f: number },
): ReportData {
  const dates     = getReportDates(period, anchor)
  const fmt       = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })
  const dateRange = period === 'daily' ? fmt(dates[0]) : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`

  const daily = dates.map(d => {
    const m = calcDayMacros(meals, checked[d] || {}, activeSubs)
    return {
      date: d, ...m,
      calsTotal: m.cals + (dayStats[d]?.caloriasExtras || 0),
      finalized: !!(dayStats[d]?.finalizado),
      peso:      rawPeso(weights[d]),
    }
  })

  const finalizados  = daily.filter(r => r.finalized).length
  const daysWithCals = daily.filter(r => r.calsTotal > 0).length
  const totalCals    = daily.reduce((s, r) => s + r.calsTotal, 0)
  const n            = dates.length || 1
  const avgCals      = Math.round(totalCals / n)
  const avgP         = Math.round(daily.reduce((s, r) => s + r.p, 0) / n)
  const avgC         = Math.round(daily.reduce((s, r) => s + r.c, 0) / n)
  const avgF         = Math.round(daily.reduce((s, r) => s + r.f, 0) / n)

  const wEntries   = daily.filter(r => r.peso !== null) as (typeof daily[0] & { peso: number })[]
  const firstW     = wEntries[0]?.peso ?? null
  const lastW      = wEntries[wEntries.length - 1]?.peso ?? null
  const weightDiff = firstW !== null && lastW !== null ? +((lastW - firstW).toFixed(1)) : null
  const daySpan    = wEntries.length > 1
    ? (new Date(wEntries[wEntries.length-1].date).getTime() - new Date(wEntries[0].date).getTime()) / 86400000 : 0
  const weeklyTrend = daySpan > 0 && weightDiff !== null ? +((weightDiff / daySpan) * 7).toFixed(2) : null

  const step      = n > 60 ? Math.ceil(n / 60) : 1
  const calChart  = daily.filter((_, i) => i % step === 0).map(r => ({ label: dateLabel(r.date), cals: r.calsTotal }))
  const pesoChart = wEntries.map(r => ({ label: dateLabel(r.date), peso: r.peso }))
  const macroChart = [
    { name: 'P (Prot)', consumido: avgP, meta: goals.p },
    { name: 'C (Carb)', consumido: avgC, meta: goals.c },
    { name: 'G (Gord)', consumido: avgF, meta: goals.f },
  ]

  const insights: string[] = []
  const pct = Math.round((finalizados / n) * 100)
  if      (pct >= 80) insights.push(`${pct}% de adesão — excelente! 🎯`)
  else if (pct >= 50) insights.push(`${pct}% de adesão — bom progresso, pode melhorar 👍`)
  else if (n   >   1) insights.push(`${pct}% de adesão — foco nos próximos dias 💪`)

  const margin = avgCals - goals.cals
  if (Math.abs(margin) <= 150)  insights.push(`Média calórica: ${avgCals} kcal/dia (${margin >= 0 ? '+' : ''}${margin} da meta) ✅`)
  else if (margin < 0)          insights.push(`Média calórica baixa: ${avgCals} kcal/dia — tente consumir mais ⚠️`)
  else                          insights.push(`Média calórica alta: ${avgCals} kcal/dia (+${margin} kcal acima da meta)`)

  if (weightDiff !== null) {
    if      (weightDiff < 0) insights.push(`Perdeu ${Math.abs(weightDiff)}kg no período 🏆`)
    else if (weightDiff > 0) insights.push(`Ganhou ${weightDiff}kg no período 📈`)
    else                     insights.push(`Peso estável no período ➡️`)
    if (weeklyTrend !== null && dates.length >= 7)
      insights.push(`Tendência: ${weeklyTrend > 0 ? '+' : ''}${weeklyTrend}kg/semana`)
  }
  if (avgP >= goals.p) insights.push(`Proteína em dia: ${avgP}g/dia (meta ${goals.p}g) 💪`)
  else                 insights.push(`Proteína abaixo: ${avgP}g/dia — faltou ${goals.p - avgP}g/dia`)

  const LABELS: Record<ReportPeriod, string> = { daily:'Diário', weekly:'Semanal', monthly:'Mensal', '3m':'3 Meses', '6m':'6 Meses' }
  return {
    periodLabel: LABELS[period], dateRange, dates,
    finalizados, daysWithCals, totalCals, avgCals, avgP, avgC, avgF,
    firstW, lastW, weightDiff, weeklyTrend,
    calChart, pesoChart, macroChart, insights,
    generatedAt: new Date().toLocaleString('pt-BR'),
  }
}

// ─── Importação de dieta: helpers ─────────────────────────────────────────────

interface ParsedFood {
  name:      string
  grams:     number
  kcal:      number
  p:         number
  c:         number
  f:         number
  tacoMatch: boolean
}

function estimateUnitGrams(foodName: string): number {
  const n = foodName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/ovo/.test(n))                        return 50
  if (/p[aã]o/.test(n))                    return 50
  if (/banana/.test(n))                    return 100
  if (/ma[cç][aã]/.test(n))               return 130
  if (/laranja/.test(n))                   return 180
  if (/biscoito|bolacha/.test(n))          return 10
  if (/fatia|slice/.test(n))               return 30
  if (/colher|col\.?\s*sopa/.test(n))      return 15
  return 50
}

function parseDietText(text: string): Record<string, ParsedFood[]> {
  const result: Record<string, ParsedFood[]> = {
    cafe: [], almoco: [], lanche: [], jantar: [], ceia: [],
  }
  const MEAL_MAP: { pat: RegExp; id: string }[] = [
    { pat: /caf[eé]|manh[aã]|pequeno.?almo[cç]o|desjejum/i, id: 'cafe'   },
    { pat: /almo[cç]o/i,                                      id: 'almoco' },
    { pat: /lanche/i,                                          id: 'lanche' },
    { pat: /jantar|janta/i,                                    id: 'jantar' },
    { pat: /ceia|notur/i,                                      id: 'ceia'   },
  ]
  let cur = 'cafe'
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 1)

  for (const line of lines) {
    // Meal header check (short lines only)
    if (line.length < 60) {
      let isMH = false
      for (const mp of MEAL_MAP) {
        if (mp.pat.test(line)) { cur = mp.id; isMH = true; break }
      }
      if (isMH) continue
    }
    // Skip obvious non-food lines
    if (/^(total|macro|caloria|proteina|carboidrato|gordura|kcal|refeic)/i.test(line)) continue
    if (/^\d+\s*(kcal|cal)/i.test(line)) continue

    // Clean: remove bullets / list prefixes
    const clean = line.replace(/^[\s\-\*•–—\d.)\]]+/, '').trim()
    if (clean.length < 2) continue

    // Try to parse: "Food name AMOUNT UNIT"
    const m = clean.match(
      /^(.+?)[\s\-:]+[\(\[]?\s*(\d+(?:[,.]\d+)?)\s*(g|gr(?:amas?)?|ml|mL|un(?:idades?)?|colheres?(?:\s+(?:de\s+)?sopa)?|x[íi]caras?|fatias?|porções?)\s*[\)\]]?\.?$/i,
    )

    if (m) {
      const foodRaw = m[1].replace(/[:\(\[\]\)]+$/, '').trim()
      const amount  = parseFloat(m[2].replace(',', '.'))
      const unit    = m[3].toLowerCase()
      let grams     = amount
      if (/^un|fatia/i.test(unit))  grams = amount * estimateUnitGrams(foodRaw)
      else if (/^col/i.test(unit))  grams = amount * 15
      else if (/^x[íi]/i.test(unit)) grams = amount * 200
      else if (/^por/i.test(unit))  grams = amount * 100

      const taco = fuzzyMatchTACO(foodRaw)
      const mult = grams / 100
      result[cur].push({
        name:      taco ? `${taco.nome} (${Math.round(grams)}g)` : `${foodRaw} (${Math.round(grams)}g)`,
        grams:     Math.round(grams),
        kcal:      taco ? Math.round(taco.kcal * mult) : 0,
        p:         taco ? +(taco.p * mult).toFixed(1)  : 0,
        c:         taco ? +(taco.c * mult).toFixed(1)  : 0,
        f:         taco ? +(taco.f * mult).toFixed(1)  : 0,
        tacoMatch: !!taco,
      })
    } else {
      // No portion found: try TACO match with default 100g
      const taco = fuzzyMatchTACO(clean)
      if (taco) {
        result[cur].push({
          name: `${taco.nome} (100g)`, grams: 100,
          kcal: taco.kcal, p: taco.p, c: taco.c, f: taco.f, tacoMatch: true,
        })
      }
    }
  }
  return result
}

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // CDN worker — compatible with Next.js without webpack config changes
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version}/pdf.worker.min.js`
  }
  const ab  = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise
  const parts: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()
    parts.push(content.items.map((i: any) => ('str' in i ? i.str : '')).join(' '))
  }
  return parts.join('\n')
}

// ─── Bioimpedância: parser de texto ────────────────────────────────────────────

interface BioData {
  peso?:    string
  gordura?: string  // % gordura corporal
  altura?:  string
  idade?:   string
}

function parseBioText(text: string): BioData {
  const r: BioData = {}
  const tryNum = (m: RegExpMatchArray | null) => m?.[1]?.replace(',', '.') ?? undefined
  r.peso    = tryNum(text.match(/(?:peso|weight)[:\s]+([0-9]+[.,][0-9]+|[0-9]+)\s*(?:kg)?/i))
  r.gordura = tryNum(text.match(/(?:gordura|fat|body\s*fat)[:\s%]+([0-9]+[.,][0-9]+|[0-9]+)\s*%?/i))
  r.altura  = tryNum(text.match(/(?:altura|height)[:\s]+([0-9]+(?:[.,][0-9]+)?)\s*(?:cm)?/i))
  r.idade   = tryNum(text.match(/(?:idade|age)[:\s]+([0-9]+)/i))
  return r
}

// ─── Componente ────────────────────────────────────────────────────────────────

const BLANK_ITEM_FORM = { name: '', kcal: '', p: '', c: '', f: '' }
const BLANK_SUB_FORM  = { name: '', kcal: '', p: '', c: '', f: '', targetId: '' }

const SYNC_ICON: Record<SyncStatus, string> = {
  unconfigured: '',
  idle:    '☁️',
  syncing: '⟳',
  synced:  '☁️ ✅',
  offline: '📵',
  error:   '⚠️',
}

export default function Home() {

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [authUser,    setAuthUser]    = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── App State ───────────────────────────────────────────────────────────────
  const [meals,        setMeals]        = useState<Meal[]>(DEFAULT_MEALS)
  const [alternatives, setAlternatives] = useState<Record<string, SubOption[]>>(DEFAULT_ALTERNATIVES)
  const [activeSubs,   setActiveSubs]   = useState<Record<string, SubOption>>({})
  const [checked,      setChecked]      = useState<Record<string, Record<string, boolean>>>({})
  const [dayStats,     setDayStats]     = useState<Record<string, any>>({})
  const [weightsData,  setWeightsData]  = useState<Record<string, any>>({})
  const [weightPhoto,  setWeightPhoto]  = useState('')
  const [userGoals,    setUserGoals]    = useState(DEFAULT_GOALS)
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>('unconfigured')

  // ── UI State ────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('hoje')
  const [statsSubTab,    setStatsSubTab]    = useState<'diario'|'semanal'|'mensal'>('diario')
  const [openAlt,        setOpenAlt]        = useState<string|null>(null)
  const [expandedMeals,  setExpandedMeals]  = useState<Record<string, boolean>>({})

  // ── Theme ────────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true) // dark por padrão

  // ── Onboarding ───────────────────────────────────────────────────────────────
  // 0=off  1=modal boas-vindas  2=hint calc  3=hint dieta  4=done toast
  const [onboardingStep, setOnboardingStep] = useState<0|1|2|3|4>(0)
  // Tela dedicada de onboarding (fluxo guiado: passo 1=calc, passo 2=gerar dieta)
  const [onboardingScreen,     setOnboardingScreen]     = useState(false)
  const [onboardingScreenStep, setOnboardingScreenStep] = useState<1|2>(1)

  // ── Setup gate ───────────────────────────────────────────────────────────────
  // Sugestão de regerar dieta quando meta calórica muda
  const [suggestRegen, setSuggestRegen] = useState(false)
  // Seções expansíveis do Config — todas fechadas por padrão
  const [configSections, setConfigSections] = useState<Record<string, boolean>>({})

  const [showFinalize,      setShowFinalize]      = useState(false)
  const [finObs,            setFinObs]            = useState('')
  const [finExtras,         setFinExtras]         = useState('')
  const [showWeightHistory, setShowWeightHistory] = useState(false)

  const [itemModal, setItemModal] = useState<null|{ mode:'edit'|'add'; mealIdx:number; item?:MealItem }>(null)
  const [itemForm,  setItemForm]  = useState(BLANK_ITEM_FORM)
  const [subModal,  setSubModal]  = useState(false)
  const [subForm,   setSubForm]   = useState(BLANK_SUB_FORM)

  // ── Relatório ────────────────────────────────────────────────────────────────
  const [showReport,    setShowReport]    = useState(false)
  const [reportPeriod,  setReportPeriod]  = useState<ReportPeriod>('weekly')
  const [reportAnchor,  setReportAnchor]  = useState(new Date().toISOString().split('T')[0])
  const [reportResult,  setReportResult]  = useState<ReportData | null>(null)
  const [reportStep,    setReportStep]    = useState<'select'|'view'>('select')

  // ── TACO Modal ───────────────────────────────────────────────────────────────
  const [showTACO,      setShowTACO]      = useState(false)
  const [tacoQuery,     setTacoQuery]     = useState('')
  const [tacoResults,   setTacoResults]   = useState<TacoFood[]>([])
  const [tacoSelected,  setTacoSelected]  = useState<TacoFood | null>(null)
  const [tacoPorcao,    setTacoPorcao]    = useState('100')
  const [tacoMealIdx,   setTacoMealIdx]   = useState(0)

  // ── Import Modal ─────────────────────────────────────────────────────────────
  const [showImport,    setShowImport]    = useState(false)
  const [importStep,    setImportStep]    = useState<'upload'|'processing'|'preview'|'done'>('upload')
  const [importFile,    setImportFile]    = useState('')
  const [importPreview, setImportPreview] = useState<Record<string, ParsedFood[]> | null>(null)
  const [importMode,    setImportMode]    = useState<'replace'|'merge'>('replace')
  const [importStats,   setImportStats]   = useState<Record<string, number>>({})
  const [isDragging,    setIsDragging]    = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  // ── Adicionar alimento rápido (Meu Cardápio) ─────────────────────────────────
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddMeal, setQuickAddMeal] = useState(0)
  const [quickAddKcal, setQuickAddKcal] = useState('')
  const [quickAddP,    setQuickAddP]    = useState('')
  const [quickAddC,    setQuickAddC]    = useState('')
  const [quickAddF,    setQuickAddF]    = useState('')

  // ── Calculadora ──────────────────────────────────────────────────────────────
  const [calcPeso,      setCalcPeso]      = useState('')
  const [calcAltura,    setCalcAltura]    = useState('')
  const [calcIdade,     setCalcIdade]     = useState('')
  const [calcSexo,      setCalcSexo]      = useState<'M'|'F'>('M')
  const [calcAtividade, setCalcAtividade] = useState<'sed'|'leve'|'mod'|'int'|'muito'>('mod')
  const [calcObjetivo,  setCalcObjetivo]  = useState<'emagrecer'|'manter'|'ganhar'>('emagrecer')
  const [calcResult,    setCalcResult]    = useState<CalcResult | null>(null)
  const [calcGordura,   setCalcGordura]   = useState('')   // % gordura para Katch-McArdle
  const [calcDeficit,   setCalcDeficit]   = useState<'leve'|'mod'|'agr'|null>(null)
  const [showBio,       setShowBio]       = useState(false)
  const bioFileRef = useRef<HTMLInputElement>(null)

  // ── Gerar Dieta ───────────────────────────────────────────────────────────────
  const [dietTarget,    setDietTarget]    = useState('')
  const [dietBudget,    setDietBudget]    = useState(false)
  const [generatedDiet, setGeneratedDiet] = useState<GeneratedMeal[] | null>(null)
  const [dietSubModal,  setDietSubModal]  = useState<{mealIdx:number; itemIdx:number} | null>(null)
  const [dietSubs,      setDietSubs]      = useState<TacoFood[]>([])

  // ── Substituidores Hoje ───────────────────────────────────────────────────────
  const [todaySubItem,        setTodaySubItem]        = useState<MealItem | null>(null)
  const [todaySubQuery,       setTodaySubQuery]       = useState('')
  const [todaySubSearchRes,   setTodaySubSearchRes]   = useState<SubSearchResult[]>([])
  const [todaySubSearching,   setTodaySubSearching]   = useState(false)
  const subSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Busca no modal de substituição de dieta gerada ────────────────────────────
  const [dietSubSearchQuery, setDietSubSearchQuery] = useState('')
  const [dietSubSearchRes,   setDietSubSearchRes]   = useState<SubSearchResult[]>([])
  const [dietSubSearching,   setDietSubSearching]   = useState(false)
  const dietSubSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getToday = () => new Date().toISOString().split('T')[0]
  const CAL_META = userGoals.cals
  const CAL_MAX  = userGoals.cals + 200

  // ── applyData ───────────────────────────────────────────────────────────────

  const applyData = useCallback((d: any, localPhotos?: Record<string, any>) => {
    // ── normalização defensiva ───────────────────────────────────────────────
    // Firebase omite arrays vazios e pode retornar objetos {0:…,1:…} no lugar
    // de arrays. Normalizamos tudo antes de setar o estado.

    // meals: garante array e garante que cada meal.items é array
    const mealsRaw: any[] = Array.isArray(d.meals)
      ? d.meals
      : d.meals && typeof d.meals === 'object'
        ? Object.values(d.meals)
        : null
    if (mealsRaw) {
      const normalizedMeals: Meal[] = mealsRaw.map((m: any) => ({
        id:    m?.id    || newId(),
        title: m?.title || '',
        items: (Array.isArray(m?.items)
          ? m.items
          : m?.items && typeof m.items === 'object'
            ? Object.values(m.items)
            : []
        ).map((it: any) => {
          // Auto-init unitQty from name "(X un)" for items saved before this field existed
          if (it != null && it.unitQty === undefined) {
            const m2 = /\((\d+)\s*un\)/i.exec(it.name || '')
            if (m2) return { ...it, unitQty: parseInt(m2[1], 10) }
          }
          return it
        }),
      }))
      setMeals(normalizedMeals)
    }

    // alternatives: cada valor deve ser array
    if (d.alternatives && typeof d.alternatives === 'object') {
      const normAlts: Record<string, SubOption[]> = {}
      for (const [key, val] of Object.entries(d.alternatives)) {
        normAlts[key] = Array.isArray(val)
          ? val as SubOption[]
          : val && typeof val === 'object'
            ? Object.values(val as any)
            : []
      }
      setAlternatives({ ...DEFAULT_ALTERNATIVES, ...normAlts })
    }

    if (d.activeSubs && typeof d.activeSubs === 'object') setActiveSubs(d.activeSubs)
    if (d.checked    && typeof d.checked    === 'object') setChecked(d.checked)
    if (d.dayStats   && typeof d.dayStats   === 'object') setDayStats(d.dayStats)
    if (d.userGoals  && typeof d.userGoals  === 'object') setUserGoals(d.userGoals)

    // weightHistory: sempre objeto {date: entry}
    const wh: Record<string, any> =
      d.weightHistory && typeof d.weightHistory === 'object' ? d.weightHistory
      : d.weights     && typeof d.weights       === 'object' ? d.weights
      : {}

    if (localPhotos) {
      const merged: Record<string, any> = {}
      for (const [date, entry] of Object.entries(wh)) {
        merged[date] = localPhotos[date]?.foto
          ? { ...(entry as any), foto: localPhotos[date].foto }
          : entry
      }
      for (const [date, entry] of Object.entries(localPhotos)) {
        if (!merged[date]) merged[date] = entry
      }
      setWeightsData(merged)
    } else {
      setWeightsData(wh)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resetState = useCallback(() => {
    setMeals(DEFAULT_MEALS)
    setAlternatives(DEFAULT_ALTERNATIVES)
    setActiveSubs({})
    setChecked({})
    setDayStats({})
    setWeightsData({})
    setUserGoals(DEFAULT_GOALS)
    setSyncStatus('unconfigured')
  }, [])

  // ── Auth Effect ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Sem Firebase: usa localStorage direto, sem auth
      setAuthLoading(false)
      const raw = localStorage.getItem('dietAppData')
      if (raw) {
        try { applyData(JSON.parse(raw)) } catch {}
      } else if (!localStorage.getItem('onboarding_done')) {
        // Novo usuário sem Firebase → mostra onboarding
        applyData({ meals: NEW_USER_MEALS, userGoals: NEW_USER_GOALS })
        setOnboardingStep(1)
      }
      return
    }

    const unsub = subscribeToAuthState((user) => {
      if (!user) resetState()
      setAuthUser(user)
      setAuthLoading(false)
    })
    return unsub
  }, [applyData, resetState])

  // ── Data Load Effect (dispara quando authUser muda) ─────────────────────────

  useEffect(() => {
    if (!isFirebaseConfigured() || !authUser) return

    setSyncStatus('syncing')

    // Cache do localStorage (só usa se pertence a este usuário)
    const savedUserId = localStorage.getItem('dietUserId')
    const localRaw    = savedUserId === authUser.uid ? localStorage.getItem('dietAppData') : null
    const localData   = localRaw ? (() => { try { return JSON.parse(localRaw) } catch { return null } })() : null
    const localWH     = localData?.weightHistory || localData?.weights || {}

    loadUserData(authUser.uid)
      .then(fbData => {
        if (fbData) {
          // Usuário existente: Firebase é autoritativo, restaura fotos locais
          applyData(fbData, localWH)
          setSyncStatus('synced')
        } else if (localData && Object.keys(localData).length > 0) {
          // Primeiro login neste device: migra localStorage pro Firebase
          applyData(localData)
          setSyncStatus('syncing')
          saveUserData(authUser.uid, localData).then(ok =>
            setSyncStatus(ok ? 'synced' : 'offline')
          )
        } else {
          // Novo usuário: dados zerados → mostra onboarding
          applyData({ meals: NEW_USER_MEALS, userGoals: NEW_USER_GOALS })
          setSyncStatus('idle')
          const done = authUser && localStorage.getItem(`onboarding_done_${authUser.uid}`)
          if (!done) setOnboardingStep(1)
        }
        localStorage.setItem('dietUserId', authUser.uid)
      })
      .catch(() => {
        if (localData) applyData(localData)
        setSyncStatus('offline')
      })
  }, [authUser, applyData])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!openAlt) return
    const fn = () => setOpenAlt(null)
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [openAlt])

  // ── Tema: inicializa do localStorage (dark por padrão) ──────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    setIsDark(saved !== 'light')
  }, [])

  // ── Tema: aplica classe 'dark' no <html> ────────────────────────────────────
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // ── Onboarding: auto-dismiss do toast de conclusão ──────────────────────────
  useEffect(() => {
    if (onboardingStep !== 4) return
    const t = setTimeout(() => setOnboardingStep(0), 4000)
    return () => clearTimeout(t)
  }, [onboardingStep])

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = (overrides: Record<string, any> = {}) => {
    const data = {
      meals, alternatives, activeSubs, checked, dayStats,
      weightHistory: weightsData, userGoals,
      ...overrides,
    }
    localStorage.setItem('dietAppData', JSON.stringify(data))

    if (isFirebaseConfigured() && authUser) {
      setSyncStatus('syncing')
      saveUserData(authUser.uid, data).then(ok =>
        setSyncStatus(ok ? 'synced' : 'offline')
      )
    }
  }

  // ── Ações: Auth ─────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logoutUser()
    localStorage.removeItem('dietUserId')
    // resetState() é chamado pelo onAuthStateChanged automaticamente
  }

  // ── Ações: Relatório ─────────────────────────────────────────────────────────

  const generateReport = () => {
    const r = buildReport(reportPeriod, reportAnchor, meals, checked, activeSubs, dayStats, weightsData, userGoals)
    setReportResult(r)
    setReportStep('view')
  }

  const copyReportToClipboard = () => {
    if (!reportResult) return
    const r   = reportResult
    const pct = Math.round((r.finalizados / r.dates.length) * 100)
    const lines = [
      `MEU PLANO — RELATÓRIO ${r.periodLabel.toUpperCase()}`,
      `Período: ${r.dateRange}`,
      ``,
      `RESUMO GERAL`,
      `Dias cumpridos: ${r.finalizados}/${r.dates.length} (${pct}%)`,
      `Calorias totais: ${r.totalCals.toLocaleString('pt-BR')} kcal`,
      `Média diária: ${r.avgCals} kcal (meta: ${userGoals.cals})`,
      ``,
      `MACROS (média/dia)`,
      `Proteína: ${r.avgP}g | Carboidrato: ${r.avgC}g | Gordura: ${r.avgF}g`,
      ...(r.firstW !== null ? [
        ``,
        `PESO`,
        `${r.firstW}kg → ${r.lastW}kg (${r.weightDiff! >= 0 ? '+' : ''}${r.weightDiff}kg)`,
        ...(r.weeklyTrend !== null ? [`Tendência: ${r.weeklyTrend > 0 ? '+' : ''}${r.weeklyTrend}kg/semana`] : []),
      ] : []),
      ``,
      `INSIGHTS`,
      ...r.insights.map(i => `• ${i}`),
      ``,
      `Gerado em ${r.generatedAt} · Meu Plano`,
    ]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  // ── Ações: Hoje ─────────────────────────────────────────────────────────────

  const toggleItem = (itemId: string) => {
    const today = getToday()
    const newChecked = { ...checked, [today]: { ...(checked[today] || {}) } }
    if (newChecked[today][itemId]) delete newChecked[today][itemId]
    else newChecked[today][itemId] = true
    setChecked(newChecked)
    save({ checked: newChecked })
  }

  const chooseSub = (itemId: string, sub: SubOption | null) => {
    const newAS = { ...activeSubs }
    if (sub === null) delete newAS[itemId]
    else newAS[itemId] = sub
    setActiveSubs(newAS)
    setOpenAlt(null)
    save({ activeSubs: newAS })
  }

  const finalizarDia = () => {
    const today = getToday()
    const { cals } = calcDayMacros(meals, checked[today] || {}, activeSubs)
    const extras = parseFloat(finExtras) || 0
    const newDS = { ...dayStats, [today]: {
      finalizado: true, observacoes: finObs,
      caloriasExtras: extras, caloriasTotal: cals + extras,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
    }}
    setDayStats(newDS)
    save({ dayStats: newDS })
    setShowFinalize(false); setFinObs(''); setFinExtras('')
  }

  // ── Ações: Peso ─────────────────────────────────────────────────────────────

  const addWeight = (weight: string, photo = '') => {
    const today = getToday()
    const cals = calcDayMacros(meals, checked[today] || {}, activeSubs).cals
    const entry: WeightEntry = {
      peso: parseFloat(weight),
      ...(photo ? { foto: photo } : {}),
      ...(cals > 0 ? { calorias: cals } : {}),
    }
    const newW = { ...weightsData, [today]: entry }
    setWeightsData(newW)
    save({ weightHistory: newW })
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setWeightPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── Ações: Metas ────────────────────────────────────────────────────────────

  const updateGoal = (key: keyof typeof DEFAULT_GOALS, val: string) => {
    const num = parseInt(val); if (isNaN(num) || num <= 0) return
    const ng = { ...userGoals, [key]: num }
    setUserGoals(ng); save({ userGoals: ng })
    // Se a meta calórica mudou e já existe um cardápio, sugere regenerar
    if (key === 'cals' && num !== userGoals.cals && meals.some(m => (m.items ?? []).length > 0)) {
      setSuggestRegen(true)
    }
  }

  const resetGoals = () => { setUserGoals(DEFAULT_GOALS); save({ userGoals: DEFAULT_GOALS }) }

  // ── Ações: Cardápio ─────────────────────────────────────────────────────────

  const openItemModal = (mode: 'edit'|'add', mealIdx: number, item?: MealItem) => {
    setItemModal({ mode, mealIdx, item })
    setItemForm(item ? { name: item.name, kcal: String(item.kcal), p: String(item.p), c: String(item.c), f: String(item.f) } : BLANK_ITEM_FORM)
  }

  const saveItemModal = () => {
    if (!itemModal) return
    const saved: MealItem = {
      id:   itemModal.item?.id || newId(),
      name: itemForm.name || 'Sem nome',
      kcal: parseFloat(itemForm.kcal) || 0,
      p:    parseFloat(itemForm.p)    || 0,
      c:    parseFloat(itemForm.c)    || 0,
      f:    parseFloat(itemForm.f)    || 0,
    }
    const nm = meals.map((m, mi) => mi !== itemModal.mealIdx ? m : {
      ...m,
      items: itemModal.mode === 'edit'
        ? m.items.map(it => it.id === saved.id ? saved : it)
        : [...m.items, saved],
    })
    setMeals(nm); save({ meals: nm }); setItemModal(null)
  }

  const deleteMealItem = (mealIdx: number, itemId: string) => {
    const nm  = meals.map((m, mi) => mi !== mealIdx ? m : { ...m, items: m.items.filter(it => it.id !== itemId) })
    const na  = { ...alternatives }; delete na[itemId]
    const nas = { ...activeSubs };   delete nas[itemId]
    setMeals(nm); setAlternatives(na); setActiveSubs(nas)
    save({ meals: nm, alternatives: na, activeSubs: nas })
  }

  // ── Ações: Ajuste de Quantidade (Unidades) ──────────────────────────────────

  // Scales a unit-based item (or its active substitution) by one step.
  // currentQty is read from display.name at render time so it works for subs too.
  const adjustQuantity = (mealId: string, itemId: string, dir: 'increase' | 'decrease', currentQty: number) => {
    const newQty = dir === 'increase' ? Math.min(99, currentQty + 1) : Math.max(1, currentQty - 1)
    if (newQty === currentQty) return
    const scale = newQty / currentQty

    // Helper: rescale a name that may contain "(N unit)" and/or "Ng"
    const scaleName = (name: string) =>
      name
        .replace(/\((\d{1,2})(\s+[^\d)]+)\)/i, `(${newQty}$2)`)
        .replace(/\b(\d+)g\b/, g2 => `${Math.round(parseInt(g2) * scale)}g`)

    const subActive = activeSubs[itemId]
    if (subActive) {
      // Scale the active substitution
      const newSub: SubOption = {
        ...subActive,
        kcal: Math.round(subActive.kcal * scale),
        p:    +((subActive.p * scale).toFixed(1)),
        c:    +((subActive.c * scale).toFixed(1)),
        f:    +((subActive.f * scale).toFixed(1)),
        name: scaleName(subActive.name),
      }
      const nas = { ...activeSubs, [itemId]: newSub }
      // Also sync unitQty on the base item if it has one
      const nm = meals.map(m => m.id !== mealId ? m : {
        ...m,
        items: m.items.map(it =>
          it.id !== itemId || it.unitQty === undefined ? it : { ...it, unitQty: newQty }
        ),
      })
      setActiveSubs(nas)
      setMeals(nm)
      save({ activeSubs: nas, meals: nm })
      return
    }

    // No active sub — scale the base item directly
    const nm = meals.map(m => {
      if (m.id !== mealId) return m
      return {
        ...m,
        items: m.items.map(item => {
          if (item.id !== itemId) return item
          return {
            ...item,
            unitQty: newQty,
            kcal: Math.round(item.kcal * scale),
            p:    +((item.p * scale).toFixed(1)),
            c:    +((item.c * scale).toFixed(1)),
            f:    +((item.f * scale).toFixed(1)),
            name: scaleName(item.name),
          }
        }),
      }
    })
    setMeals(nm)
    save({ meals: nm })
  }

  // ── Ações: Substituidores ───────────────────────────────────────────────────

  const openSubModal = (itemId = '') => {
    setSubForm({ ...BLANK_SUB_FORM, targetId: itemId }); setSubModal(true)
  }

  const saveSubModal = () => {
    const tid = subForm.targetId; if (!tid) return
    const newSub: SubOption = {
      id: newId(), name: subForm.name || 'Sem nome',
      kcal: parseFloat(subForm.kcal) || 0,
      p:    parseFloat(subForm.p)    || 0,
      c:    parseFloat(subForm.c)    || 0,
      f:    parseFloat(subForm.f)    || 0,
    }
    const na = { ...alternatives, [tid]: [...(alternatives[tid] || []), newSub] }
    setAlternatives(na); save({ alternatives: na })
    setSubModal(false); setSubForm(BLANK_SUB_FORM)
  }

  const deleteAlt = (itemId: string, altId: string) => {
    const na  = { ...alternatives, [itemId]: (alternatives[itemId] || []).filter(a => a.id !== altId) }
    const nas = { ...activeSubs }
    if (nas[itemId]?.id === altId) delete nas[itemId]
    setAlternatives(na); setActiveSubs(nas)
    save({ alternatives: na, activeSubs: nas })
  }

  // ── Ações: TACO ─────────────────────────────────────────────────────────────

  const openTACO = (mealIdx = 0) => {
    setTacoMealIdx(mealIdx); setTacoQuery(''); setTacoResults([]); setTacoSelected(null); setTacoPorcao('100'); setShowTACO(true)
  }

  const addTACOItem = () => {
    if (!tacoSelected) return
    const g        = parseFloat(tacoPorcao) || 100
    const mult     = g / 100
    const unitInfo = FOOD_UNITS[tacoSelected.id]
    const unitQty  = unitInfo ? Math.max(1, Math.round(g / unitInfo.unitWeight)) : undefined
    const item: MealItem = {
      id:   newId(),
      name: formatTacoItemName(tacoSelected, Math.round(g)),
      kcal: Math.round(tacoSelected.kcal * mult),
      p:    +(tacoSelected.p * mult).toFixed(1),
      c:    +(tacoSelected.c * mult).toFixed(1),
      f:    +(tacoSelected.f * mult).toFixed(1),
      ...(unitQty !== undefined ? { unitQty } : {}),
    }
    const nm = meals.map((m, mi) => mi !== tacoMealIdx ? m : { ...m, items: [...m.items, item] })
    setMeals(nm); save({ meals: nm }); setShowTACO(false)
  }

  // ── Ações: Import ────────────────────────────────────────────────────────────

  const processImportFile = async (file: File) => {
    setImportFile(file.name)
    setImportStep('processing')
    try {
      let text = ''
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        text = await extractTextFromPDF(file)
      } else {
        text = await file.text()
      }
      const parsed = parseDietText(text)
      const stats: Record<string, number> = {}
      let total = 0, matched = 0
      for (const [key, foods] of Object.entries(parsed)) {
        stats[key] = foods.length
        total  += foods.length
        matched += foods.filter(f => f.tacoMatch).length
      }
      stats._total   = total
      stats._matched = matched
      setImportPreview(parsed)
      setImportStats(stats)
      setImportStep('preview')
    } catch (e) {
      console.error('[Import]', e)
      setImportStep('upload')
      setImportFile('')
    }
  }

  const applyImport = () => {
    if (!importPreview) return
    const mealIdMap: Record<string, string[]> = {
      cafe:   ['cafe'],
      almoco: ['almoco'],
      lanche: ['lanche'],
      jantar: ['jantar'],
      ceia:   ['ceia'],
    }
    const nm = meals.map(m => {
      const key = Object.keys(mealIdMap).find(k => mealIdMap[k].includes(m.id)) || m.id
      const foods = importPreview[key]
      if (!foods || foods.length === 0) return m
      const newItems: MealItem[] = foods.map(f => ({
        id:   newId(),
        name: f.name,
        kcal: f.kcal,
        p:    f.p,
        c:    f.c,
        f:    f.f,
      }))
      return {
        ...m,
        items: importMode === 'replace' ? newItems : [...m.items, ...newItems],
      }
    })
    setMeals(nm); save({ meals: nm }); setImportStep('done')
  }

  // ── Ações: Adicionar alimento rápido ────────────────────────────────────────

  const handleQuickAdd = () => {
    const kcal = parseInt(quickAddKcal)
    if (!quickAddName.trim() || !kcal || kcal <= 0) return
    const newItem: MealItem = {
      id:   newId(),
      name: quickAddName.trim(),
      kcal,
      p:    parseFloat(quickAddP)  || 0,
      c:    parseFloat(quickAddC)  || 0,
      f:    parseFloat(quickAddF)  || 0,
    }
    const nm = meals.map((m, idx) =>
      idx === quickAddMeal ? { ...m, items: [...(m.items ?? []), newItem] } : m
    )
    setMeals(nm)
    save({ meals: nm })
    setQuickAddName('')
    setQuickAddKcal('')
    setQuickAddP('')
    setQuickAddC('')
    setQuickAddF('')
  }

  // ── Ações: Calculadora ───────────────────────────────────────────────────────

  const handleCalc = () => {
    const peso   = parseFloat(calcPeso)
    const altura = parseFloat(calcAltura)
    const idade  = parseFloat(calcIdade)
    if (!peso || !altura || !idade) return

    let tmb: number
    const gordPct = parseFloat(calcGordura)
    if (gordPct > 0 && gordPct < 100) {
      // Katch-McArdle: mais preciso quando % gordura é conhecida
      const lbm = peso * (1 - gordPct / 100)
      tmb = 370 + (21.6 * lbm)
    } else {
      // Harris-Benedict revisada
      tmb = calcSexo === 'M'
        ? 88.362 + (13.397 * peso) + (4.799 * altura) - (5.677 * idade)
        : 447.593 + (9.247 * peso) + (3.098 * altura) - (4.330 * idade)
    }

    const FACTORS: Record<string, number> = { sed:1.2, leve:1.375, mod:1.55, int:1.725, muito:1.9 }
    const tdee = tmb * FACTORS[calcAtividade]

    const imc      = peso / Math.pow(altura / 100, 2)
    const imcClass = imc < 18.5 ? 'Abaixo do peso' : imc < 25 ? 'Peso normal' : imc < 30 ? 'Sobrepeso' : 'Obeso'
    const imcColor = imc < 18.5 ? 'var(--warning)' : imc < 25 ? 'var(--success)' : imc < 30 ? 'var(--warning)' : '#e53935'

    setCalcDeficit(null)
    setCalcResult({
      imc: +imc.toFixed(1), imcClass, imcColor,
      tmb:       Math.round(tmb),
      tdee:      Math.round(tdee),
      manter:    Math.round(tdee),
      emagrecer: Math.round(tdee - 500),
      ganhar:    Math.round(tdee + 500),
    })
  }

  const applyBioFile = (text: string) => {
    const bio = parseBioText(text)
    if (bio.peso)    setCalcPeso(bio.peso)
    if (bio.gordura) setCalcGordura(bio.gordura)
    if (bio.altura)  setCalcAltura(bio.altura)
    if (bio.idade)   setCalcIdade(bio.idade)
  }

  // ── Ações: Busca no modal de substituição ─────────────────────────────────

  const closeTodaySubModal = () => {
    setTodaySubItem(null)
    setTodaySubQuery('')
    setTodaySubSearchRes([])
    setTodaySubSearching(false)
    if (subSearchTimeoutRef.current) clearTimeout(subSearchTimeoutRef.current)
  }

  const handleTodaySubSearch = (query: string) => {
    setTodaySubQuery(query)
    if (subSearchTimeoutRef.current) clearTimeout(subSearchTimeoutRef.current)

    if (query.trim().length < 2) {
      setTodaySubSearchRes([])
      setTodaySubSearching(false)
      return
    }

    // Busca imediata no TACO
    const tacoHits = searchTACO(query)
    if (tacoHits.length > 0) {
      setTodaySubSearchRes(tacoHits.slice(0, 6).map(food => {
        const g    = naturalGrams(food)
        const mult = g / 100
        return { food, grams: g, kcal: Math.round(food.kcal * mult), p: +(food.p * mult).toFixed(1), c: +(food.c * mult).toFixed(1), f: +(food.f * mult).toFixed(1), isAI: false }
      }))
      setTodaySubSearching(false)
      return
    }

    // TACO vazio → IA fallback após debounce
    setTodaySubSearchRes([])
    setTodaySubSearching(true)
    subSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const aiFood = await searchWithAI(query)
        if (aiFood) {
          setTodaySubSearchRes([{ food: aiFood, grams: 100, kcal: aiFood.kcal, p: aiFood.p, c: aiFood.c, f: aiFood.f, isAI: true }])
        } else {
          setTodaySubSearchRes([])
        }
      } catch { /* ignore */ } finally {
        setTodaySubSearching(false)
      }
    }, 600)
  }

  const applyTodaySubFromSearch = (result: SubSearchResult) => {
    if (!todaySubItem) return
    const sub: SubOption = {
      id:   newId(),
      name: formatTacoItemName(result.food, result.grams),
      kcal: result.kcal,
      p:    result.p,
      c:    result.c,
      f:    result.f,
    }
    chooseSub(todaySubItem.id, sub)
    closeTodaySubModal()
  }

  const useDietCals = (cals: number, _obj: 'emagrecer'|'manter'|'ganhar') => {
    setDietTarget(String(cals))
    setDietBudget(false)
    setGeneratedDiet(null)
    // Salva a meta calórica escolhida para que CAL_META e o Status do Dia reflitam o déficit/superávit correto
    const ng = { ...userGoals, cals }
    setUserGoals(ng)
    save({ userGoals: ng })
    // Tela dedicada de onboarding: avança para passo 2 sem sair da tela
    if (onboardingScreen) {
      setOnboardingScreenStep(2)
      return
    }
    // Navega para Config > Gerar Dieta
    setActiveTab('config')
    setConfigSections(s => ({ ...s, dieta: true, calc: false }))
    // Avança onboarding: calc → dieta
    if (onboardingStep === 2) setOnboardingStep(3)
  }

  // ── Ações: Gerar Dieta ────────────────────────────────────────────────────────

  const handleGenerateDiet = () => {
    const target = parseInt(dietTarget)
    if (!target || target < 500) return
    setGeneratedDiet(generateDiet(target, dietBudget))
  }

  const openDietSubModal = (mealIdx: number, itemIdx: number) => {
    const item = generatedDiet?.[mealIdx]?.items[itemIdx]
    if (!item) return
    const subs = getSubstitutes(item.food, item.grams, dietBudget)
    setDietSubs(subs)
    setDietSubModal({ mealIdx, itemIdx })
    setDietSubSearchQuery('')
    setDietSubSearchRes([])
    setDietSubSearching(false)
    if (dietSubSearchTimeoutRef.current) clearTimeout(dietSubSearchTimeoutRef.current)
  }

  const applyDietSub = (food: TacoFood) => {
    if (!dietSubModal || !generatedDiet) return
    const { mealIdx, itemIdx } = dietSubModal
    const original = generatedDiet[mealIdx].items[itemIdx]
    const rawGrams = food.kcal > 0 ? (original.kcal / food.kcal) * 100 : 50
    const grams    = Math.max(10, Math.min(600, Math.round(rawGrams / 5) * 5))
    const mult     = grams / 100
    const newItem: GeneratedItem = {
      food, grams,
      kcal: Math.round(food.kcal * mult),
      p:    +(food.p * mult).toFixed(1),
      c:    +(food.c * mult).toFixed(1),
      f:    +(food.f * mult).toFixed(1),
    }
    const newDiet = generatedDiet.map((m, mi) => {
      if (mi !== mealIdx) return m
      const items = m.items.map((it, ii) => ii === itemIdx ? newItem : it)
      return { ...m, items, actualKcal: items.reduce((s, it) => s + it.kcal, 0) }
    })
    setGeneratedDiet(newDiet)
    setDietSubModal(null)
  }

  const handleDietSubSearch = (query: string) => {
    setDietSubSearchQuery(query)
    if (dietSubSearchTimeoutRef.current) clearTimeout(dietSubSearchTimeoutRef.current)
    if (query.trim().length < 2) {
      setDietSubSearchRes([]); setDietSubSearching(false); return
    }
    const tacoHits = searchTACO(query)
    if (tacoHits.length > 0) {
      setDietSubSearchRes(tacoHits.slice(0, 6).map(food => {
        const g = naturalGrams(food); const mult = g / 100
        return { food, grams: g, kcal: Math.round(food.kcal * mult), p: +(food.p * mult).toFixed(1), c: +(food.c * mult).toFixed(1), f: +(food.f * mult).toFixed(1), isAI: false }
      }))
      setDietSubSearching(false); return
    }
    setDietSubSearchRes([]); setDietSubSearching(true)
    dietSubSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const aiFood = await searchWithAI(query)
        setDietSubSearchRes(aiFood ? [{ food: aiFood, grams: 100, kcal: aiFood.kcal, p: aiFood.p, c: aiFood.c, f: aiFood.f, isAI: true }] : [])
      } catch { /* ignore */ } finally { setDietSubSearching(false) }
    }, 600)
  }

  const applyDietSubFromSearch = (result: SubSearchResult) => {
    if (!dietSubModal || !generatedDiet) return
    const { mealIdx, itemIdx } = dietSubModal
    const original = generatedDiet[mealIdx].items[itemIdx]
    // Escala a porção para manter as mesmas calorias do item original
    const rawGrams = result.food.kcal > 0 ? (original.kcal / result.food.kcal) * 100 : result.grams
    const grams    = Math.max(10, Math.min(600, Math.round(rawGrams / 5) * 5))
    const mult     = grams / 100
    const newItem: GeneratedItem = {
      food: result.food, grams,
      kcal: Math.round(result.food.kcal * mult),
      p:    +(result.food.p * mult).toFixed(1),
      c:    +(result.food.c * mult).toFixed(1),
      f:    +(result.food.f * mult).toFixed(1),
    }
    const newDiet = generatedDiet.map((m, mi) => {
      if (mi !== mealIdx) return m
      const items = m.items.map((it, ii) => ii === itemIdx ? newItem : it)
      return { ...m, items, actualKcal: items.reduce((s, it) => s + it.kcal, 0) }
    })
    setGeneratedDiet(newDiet)
    setDietSubModal(null)
  }

  const saveDiet = () => {
    if (!generatedDiet) return
    const nm: Meal[] = generatedDiet.map(gm => ({
      id:    gm.mealId,
      title: gm.title,
      items: gm.items.map(gi => {
        const unitInfo = FOOD_UNITS[gi.food.id]
        const unitQty  = unitInfo ? Math.max(1, Math.round(gi.grams / unitInfo.unitWeight)) : undefined
        return {
          id:   newId(),
          name: formatTacoItemName(gi.food, gi.grams),
          kcal: gi.kcal,
          p:    gi.p,
          c:    gi.c,
          f:    gi.f,
          ...(unitQty !== undefined ? { unitQty } : {}),
        }
      }),
    }))
    // Sync userGoals.cals with the diet target so CAL_META always matches.
    // This covers the case where the user typed the target directly (bypassing
    // the calculator "Usar →" button that also saves the goal).
    const target = parseInt(dietTarget)
    const ng = target > 0 && target !== userGoals.cals
      ? { ...userGoals, cals: target }
      : userGoals
    if (ng !== userGoals) setUserGoals(ng)
    setMeals(nm)
    save({ meals: nm, userGoals: ng })
    setGeneratedDiet(null)
    setActiveTab('hoje')
    // Tela dedicada de onboarding: fecha a tela e marca como concluído
    if (onboardingScreen) {
      setOnboardingScreen(false)
      setOnboardingStep(4)
      if (authUser) localStorage.setItem(`onboarding_done_${authUser.uid}`, '1')
      else          localStorage.setItem('onboarding_done', '1')
      return
    }
    // Conclui onboarding clássico
    if (onboardingStep === 3) {
      setOnboardingStep(4)
      // Marca como concluído
      if (authUser) localStorage.setItem(`onboarding_done_${authUser.uid}`, '1')
      else          localStorage.setItem('onboarding_done', '1')
    }
  }

  // ── Cálculos hoje ───────────────────────────────────────────────────────────

  const today        = getToday()
  const todayChecked = checked[today] || {}
  const { cals: totalCals, p: totalP, c: totalC, f: totalF } = calcDayMacros(meals, todayChecked, activeSubs)
  const mealsCompleted  = meals.filter(m => (m.items ?? []).length > 0 && (m.items ?? []).every(it => todayChecked[it.id])).length
  const todayStat       = dayStats[today]
  const todayFinished   = todayStat?.finalizado || false
  const todayCalTotal   = todayStat?.caloriasTotal ?? totalCals   // snapshot histórico (usado em stats)
  // Feedback usa sempre dados ao vivo: itens marcados + extras, com a meta atual
  const liveDayTotal    = totalCals + (todayStat?.caloriasExtras || 0)
  const todayFeedback   = getFeedback(liveDayTotal, CAL_META, CAL_MAX)

  // ── Histórico de peso ───────────────────────────────────────────────────────

  const weightHistoryAsc = Object.entries(weightsData as Record<string, any>)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, entry]) => ({
      date, label: dateLabel(date),
      peso: rawPeso(entry), foto: rawFoto(entry), calorias: rawCalorias(entry),
    }))
    .filter(e => e.peso !== null) as { date:string; label:string; peso:number; foto:string|null; calorias:number|null }[]

  const weightHistoryDesc = [...weightHistoryAsc].reverse()

  const todayWeightEntry = weightsData[today]
  const todayWeight      = rawPeso(todayWeightEntry)
  const todayWeightFoto  = rawFoto(todayWeightEntry)

  const firstW    = weightHistoryAsc[0]?.peso ?? null
  const lastW     = weightHistoryAsc[weightHistoryAsc.length - 1]?.peso ?? null
  const totalLoss = firstW !== null && lastW !== null ? +((firstW - lastW).toFixed(1)) : null
  const daysBetween = weightHistoryAsc.length > 1
    ? (new Date(weightHistoryAsc[weightHistoryAsc.length-1].date).getTime() - new Date(weightHistoryAsc[0].date).getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const weeklyAvg = daysBetween > 0 && totalLoss !== null
    ? +((totalLoss / daysBetween) * 7).toFixed(2) : null

  // ── Estatísticas ────────────────────────────────────────────────────────────

  const weekDates  = getLastNDates(7)
  const monthDates = getLastNDates(30)

  const weeklyChartData = weekDates.map(d => ({
    label: dateLabel(d),
    cals: calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0),
  }))

  const monthlyChartData = (() => {
    const out: { label:string; total:number; dias:number; finalizados:number }[] = []
    for (let w = 0; w < 4; w++) {
      const slice = monthDates.slice(w * 7, w * 7 + 7)
      let total = 0, fin = 0
      slice.forEach(d => {
        total += calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0)
        if (dayStats[d]?.finalizado) fin++
      })
      out.push({ label: `Sem ${w + 1}`, total, dias: slice.length, finalizados: fin })
    }
    return out
  })()

  const weekFin   = weekDates.filter(d => dayStats[d]?.finalizado).length
  const weekTotal = weeklyChartData.reduce((s, d) => s + d.cals, 0)
  const weekMeta  = CAL_META * 7
  const weekDiff  = weekTotal - weekMeta

  const weekWeightData = weekDates
    .map(d => ({ label: dateLabel(d), peso: rawPeso(weightsData[d]) }))
    .filter(d => d.peso !== null) as { label:string; peso:number }[]

  const weightTrend = monthDates
    .map(d => ({ label: dateLabel(d), peso: rawPeso(weightsData[d]) }))
    .filter(d => d.peso !== null) as { label:string; peso:number }[]

  const dualChartData = monthDates
    .map(d => {
      const peso = rawPeso(weightsData[d])
      const cals = calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0)
      return { label: dateLabel(d), peso: peso ?? undefined, cals: cals > 0 ? cals : undefined }
    })
    .filter(d => d.peso !== undefined || d.cals !== undefined)

  const weekFirstW     = weekWeightData[0]?.peso ?? null
  const weekLastW      = weekWeightData[weekWeightData.length - 1]?.peso ?? null
  const weekWeightDiff = weekFirstW !== null && weekLastW !== null ? +((weekLastW - weekFirstW).toFixed(1)) : null

  const weekBadgeColor = weekDiff < -200 ? 'var(--warning)' : weekDiff > 200 ? '#e53935' : 'var(--success)'
  const weekBadgeText  = weekDiff < 0 ? `${Math.abs(weekDiff)} kcal abaixo` : weekDiff > 0 ? `${weekDiff} kcal acima` : 'Semana no alvo'

  const allItemOptions = meals.flatMap(m => (m.items ?? []).map(it => ({ id: it.id, label: `${m.title} → ${it.name}` })))

  const firebaseConfigured = isFirebaseConfigured()

  // ── Setup gate ───────────────────────────────────────────────────────────────
  // Verdadeiro quando o usuário tem pelo menos um item em alguma refeição
  const setupComplete = meals.some(m => (m.items ?? []).length > 0)
  // Verdadeiro quando o usuário está no caminho automático de setup (calc → dieta)
  const inAutoSetup   = (onboardingStep === 2 || onboardingStep === 3) && !setupComplete

  const toggleConfigSection = (key: string) =>
    setConfigSections(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Telas de loading / login ─────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-logo">💪</div>
        <div className="auth-loading-text">Carregando...</div>
      </div>
    )
  }

  if (firebaseConfigured && !authUser) {
    return <LoginScreen />
  }

  // ── Tela dedicada de onboarding ──────────────────────────────────────────────

  if (onboardingScreen) {
    const totalKcalOnb = generatedDiet ? generatedDiet.reduce((s, m) => s + m.actualKcal, 0) : 0
    const targetOnb    = parseInt(dietTarget) || 1
    const diffOnb      = totalKcalOnb - targetOnb
    const diffColorOnb = Math.abs(diffOnb) <= 100 ? 'var(--success)' : diffOnb > 0 ? 'var(--error)' : 'var(--warning)'
    const diffTextOnb  = Math.abs(diffOnb) <= 100 ? '✅ No alvo' : diffOnb > 0 ? `+${diffOnb} kcal acima` : `${Math.abs(diffOnb)} kcal abaixo`

    return (
      <div className="onb-screen">
        {/* Header */}
        <div className="onb-header">
          <div className="onb-logo">💪 Meu Plano</div>
          <div className="onb-progress-row">
            <div className={`onb-step-dot ${onboardingScreenStep >= 1 ? 'active' : ''} ${onboardingScreenStep > 1 ? 'done' : ''}`}>
              {onboardingScreenStep > 1 ? '✓' : '1'}
            </div>
            <div className={`onb-step-connector ${onboardingScreenStep > 1 ? 'done' : ''}`} />
            <div className={`onb-step-dot ${onboardingScreenStep >= 2 ? 'active' : ''}`}>2</div>
          </div>
          <div className="onb-step-subtitle">
            {onboardingScreenStep === 1
              ? '🧮 Passo 1 — Calcule sua meta calórica'
              : '🍽️ Passo 2 — Gere sua dieta personalizada'}
          </div>
        </div>

        {/* Body */}
        <div className="onb-body">

          {/* ── Passo 1: Calculadora ── */}
          {onboardingScreenStep === 1 && (
            <div className="onb-step-content">
              {/* Bioimpedância */}
              <div className="bio-section">
                <button className="bio-toggle" onClick={() => setShowBio(!showBio)}>
                  📡 {showBio ? '▾' : '▸'} Importar Bioimpedância <span className="bio-optional">(opcional)</span>
                </button>
                {showBio && (
                  <div className="bio-content">
                    <div className="bio-upload-zone" onClick={() => bioFileRef.current?.click()}>
                      <div className="bio-upload-icon">📊</div>
                      <div className="bio-upload-text">Clique para selecionar arquivo da balança</div>
                      <div className="bio-upload-sub">TXT, CSV — exportado da balança ou app de bioimpedância</div>
                    </div>
                    <input ref={bioFileRef} type="file" accept=".txt,.csv,.text" style={{ display:'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(applyBioFile) }} />
                    <div className="calc-field" style={{ marginTop:10 }}>
                      <label className="calc-label">% Gordura Corporal <span className="calc-unit">(se conhecido)</span></label>
                      <input type="number" className="login-input" value={calcGordura} placeholder="Ex: 22.5"
                        onChange={e => setCalcGordura(e.target.value)} />
                    </div>
                    {calcGordura && <div className="bio-formula-note">✅ Usando Katch-McArdle (mais preciso com % gordura)</div>}
                  </div>
                )}
              </div>
              {/* Dados principais */}
              <div className="calc-grid" style={{ marginTop:12 }}>
                {([
                  { label:'Peso', unit:'kg',    val:calcPeso,   set:setCalcPeso   },
                  { label:'Altura', unit:'cm',  val:calcAltura, set:setCalcAltura },
                  { label:'Idade', unit:'anos', val:calcIdade,  set:setCalcIdade  },
                ] as { label:string; unit:string; val:string; set:(v:string)=>void }[]).map(({ label, unit, val, set }) => (
                  <div key={label} className="calc-field">
                    <label className="calc-label">{label} <span className="calc-unit">({unit})</span></label>
                    <input type="number" className="login-input" value={val} onChange={e => set(e.target.value)} placeholder="0" />
                  </div>
                ))}
                <div className="calc-field">
                  <label className="calc-label">Sexo</label>
                  <select className="login-input" value={calcSexo} onChange={e => setCalcSexo(e.target.value as 'M'|'F')}>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>
              <div className="calc-field" style={{ marginTop:10 }}>
                <label className="calc-label">Nível de Atividade</label>
                <select className="login-input" value={calcAtividade} onChange={e => setCalcAtividade(e.target.value as typeof calcAtividade)}>
                  <option value="sed">Sedentário — pouco ou nenhum exercício</option>
                  <option value="leve">Leve — exercício 1–3×/semana</option>
                  <option value="mod">Moderado — exercício 3–5×/semana</option>
                  <option value="int">Intenso — exercício 5–7×/semana</option>
                  <option value="muito">Muito Intenso — atleta / treino 2× ao dia</option>
                </select>
              </div>
              <div className="calc-field" style={{ marginTop:10 }}>
                <label className="calc-label">Objetivo Principal</label>
                <div className="calc-obj-row">
                  {([
                    { v:'emagrecer', label:'📉 Emagrecer' },
                    { v:'manter',    label:'➡️ Manter'    },
                    { v:'ganhar',    label:'📈 Ganhar'     },
                  ] as const).map(({ v, label }) => (
                    <button key={v} className={`calc-obj-btn ${calcObjetivo === v ? 'active' : ''}`}
                      onClick={() => setCalcObjetivo(v)}>{label}</button>
                  ))}
                </div>
              </div>
              <button className="btn" style={{ marginTop:14 }} onClick={handleCalc}
                disabled={!calcPeso || !calcAltura || !calcIdade}>
                🧮 Calcular
              </button>
              {calcResult && (
                <div className="calc-result-box">
                  <div className="calc-result-imc" style={{ color: calcResult.imcColor }}>
                    IMC: <strong>{calcResult.imc}</strong> — {calcResult.imcClass}
                  </div>
                  <div className="calc-result-row">
                    <span>Taxa Metabólica Basal (TMB){calcGordura ? ' · Katch-McArdle' : ''}</span>
                    <span><strong>{calcResult.tmb.toLocaleString('pt-BR')}</strong> kcal/dia</span>
                  </div>
                  <div className="calc-result-row">
                    <span>Gasto Total Diário (TDEE)</span>
                    <span><strong>{calcResult.tdee.toLocaleString('pt-BR')}</strong> kcal/dia</span>
                  </div>
                  {/* Cards de objetivo — selecionáveis */}
                  <div className="calc-options-grid">
                    {([
                      { obj:'emagrecer', label:'📉 EMAGRECER', val:calcResult.emagrecer, desc:'déficit · perda de peso' },
                      { obj:'manter',    label:'➡️ MANTER',    val:calcResult.manter,    desc:'igual ao TDEE · manutenção' },
                      { obj:'ganhar',    label:'📈 GANHAR',     val:calcResult.ganhar,    desc:'superávit · ganho de massa' },
                    ] as const).map(({ obj, label, val, desc }) => (
                      <div key={obj}
                        className={`calc-option-card ${calcObjetivo === obj ? 'active' : ''}`}
                        onClick={() => { setCalcObjetivo(obj); setCalcDeficit(null) }}>
                        <div className="calc-option-label">{label}</div>
                        <div className="calc-option-val">{val.toLocaleString('pt-BR')} kcal/dia</div>
                        <div className="calc-option-desc">{desc}</div>
                      </div>
                    ))}
                  </div>
                  {/* Seleção de intensidade (emagrecer ou ganhar) */}
                  {(calcObjetivo === 'emagrecer' || calcObjetivo === 'ganhar') && (
                    <div className="deficit-section">
                      <div className="deficit-title">
                        {calcObjetivo === 'emagrecer' ? '📌 Escolha o déficit:' : '📌 Escolha o superávit:'}
                      </div>
                      <div className="deficit-row">
                        {([
                          { id:'leve', label:'Leve',      pct:10, desc:'Confortável' },
                          { id:'mod',  label:'Moderado',  pct:15, desc:'Recomendado ✅' },
                          { id:'agr',  label:'Agressivo', pct:20, desc:'Rápido' },
                        ] as const).map(({ id, label, pct, desc }) => {
                          const cals = calcObjetivo === 'emagrecer'
                            ? Math.round(calcResult.tdee * (1 - pct / 100))
                            : Math.round(calcResult.tdee * (1 + pct / 100))
                          return (
                            <button key={id}
                              className={`deficit-btn ${calcDeficit === id ? 'active' : ''}`}
                              onClick={() => setCalcDeficit(id)}>
                              <div className="deficit-btn-label">
                                {label} {calcObjetivo === 'emagrecer' ? `−${pct}%` : `+${pct}%`}
                              </div>
                              <div className="deficit-btn-cals">{cals.toLocaleString('pt-BR')}</div>
                              <div className="deficit-btn-desc">{desc}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* Botão único Usar → */}
                  <button
                    className="btn"
                    style={{ marginTop:14, width:'100%' }}
                    disabled={calcObjetivo !== 'manter' && calcDeficit === null}
                    onClick={() => {
                      if (calcObjetivo === 'manter') {
                        useDietCals(calcResult.manter, 'manter')
                      } else {
                        const pcts = { leve:10, mod:15, agr:20 }
                        const pct  = pcts[calcDeficit!]
                        const cals = calcObjetivo === 'emagrecer'
                          ? Math.round(calcResult.tdee * (1 - pct / 100))
                          : Math.round(calcResult.tdee * (1 + pct / 100))
                        useDietCals(cals, calcObjetivo)
                      }
                    }}>
                    🧮 Usar →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Passo 2: Gerar Dieta ── */}
          {onboardingScreenStep === 2 && (
            <div className="onb-step-content">
              <div className="calc-field" style={{ marginTop:8 }}>
                <label className="calc-label">Meta calórica diária</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="number" className="login-input" style={{ flex:1 }}
                    value={dietTarget} onChange={e => setDietTarget(e.target.value)} placeholder="Ex: 1600" />
                  <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>kcal/dia</span>
                </div>
              </div>
              <div className="calc-field" style={{ marginTop:12 }}>
                <label className="calc-label">Preferência de alimentos</label>
                <div className="calc-obj-row">
                  <button className={`calc-obj-btn ${!dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(false)}>✨ Melhor qualidade</button>
                  <button className={`calc-obj-btn ${dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(true)}>💰 Simples / Barato</button>
                </div>
              </div>
              <button className="btn" style={{ marginTop:14 }} onClick={handleGenerateDiet}
                disabled={!dietTarget || parseInt(dietTarget) < 500}>
                🚀 Gerar Dieta Automaticamente
              </button>

              {generatedDiet && (
                <>
                  <div className="diet-gen-summary">
                    <div className="diet-gen-total">
                      {totalKcalOnb.toLocaleString('pt-BR')} kcal
                      <span className="diet-gen-pct" style={{ color: diffColorOnb }}> · {diffTextOnb}</span>
                    </div>
                    <div className="diet-gen-macros-row">
                      <span>P {generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.p, 0).toFixed(0)}g</span>
                      <span>C {generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.c, 0).toFixed(0)}g</span>
                      <span>G {generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.f, 0).toFixed(0)}g</span>
                    </div>
                    {Math.abs(diffOnb) > 150 && (
                      <button className="btn btn-small btn-cancel" style={{ width:'auto', marginTop:6 }} onClick={handleGenerateDiet}>
                        🔄 Reajustar para meta
                      </button>
                    )}
                    <button className="btn" style={{ marginTop:8, width:'100%' }} onClick={saveDiet}>
                      💾 Salvar e começar!
                    </button>
                  </div>

                  {generatedDiet.map((meal, mi) => (
                    <div key={meal.mealId} className="diet-gen-meal">
                      <div className="diet-gen-meal-header">
                        <span className="diet-gen-meal-title">{meal.title}</span>
                        <span className="diet-gen-meal-kcal">
                          {meal.actualKcal} kcal
                          <span className="diet-gen-pct"> ({Math.round(meal.actualKcal / targetOnb * 100)}%)</span>
                        </span>
                      </div>
                      {meal.items.map((item, ii) => (
                        <div key={ii} className="diet-gen-item">
                          <div className="diet-gen-item-body">
                            <div className="diet-gen-item-name">
                              {item.food.nome}
                              {item.food.id === -1 && <span className="diet-ia-badge"> IA</span>}
                            </div>
                            <div className="diet-gen-item-detail">
                              {item.grams}g · {item.kcal} kcal · P{item.p}g · C{item.c}g · G{item.f}g
                              {BUDGET_IDS.has(item.food.id) && <span className="diet-budget-badge"> 💰</span>}
                            </div>
                          </div>
                          <button className="diet-sub-btn" title="Substituir" onClick={() => openDietSubModal(mi, ii)}>🔄</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="onb-footer">
          <button className="onb-skip-btn"
            onClick={() => {
              setOnboardingScreen(false)
              setOnboardingStep(0)
              if (authUser) localStorage.setItem(`onboarding_done_${authUser.uid}`, '1')
              else          localStorage.setItem('onboarding_done', '1')
              setActiveTab('config')
              setConfigSections(prev => ({ ...prev, cardapio: true }))
            }}>
            Pular e montar manualmente →
          </button>
        </div>

        {/* Modal de substituição de item (dentro da tela de onboarding) */}
        {dietSubModal !== null && generatedDiet && (() => {
          const item = generatedDiet[dietSubModal.mealIdx]?.items[dietSubModal.itemIdx]
          if (!item) return null
          return (
            <div className="modal-overlay" onClick={() => setDietSubModal(null)}>
              <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
                <div className="modal-title">🔄 Substituir Alimento na Dieta</div>
                <div className="diet-sub-original">
                  <strong>{item.food.nome}</strong> · {item.grams}g · {item.kcal} kcal
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>
                    A porção será ajustada para manter ~{item.kcal} kcal
                  </div>
                </div>
                {dietSubs.length > 0 && (
                  <>
                    <div className="sub-section-label">Sugestões similares</div>
                    <div className="taco-results">
                      {dietSubs.map(sub => {
                        const rawG = sub.kcal > 0 ? (item.kcal / sub.kcal) * 100 : 50
                        const g    = Math.max(10, Math.min(600, Math.round(rawG / 5) * 5))
                        const mult = g / 100
                        return (
                          <button key={sub.id} className="taco-result-item" onClick={() => applyDietSub(sub)}>
                            <div className="taco-result-name">
                              {sub.nome} · {g}g
                              {BUDGET_IDS.has(sub.id) && <span className="diet-budget-badge"> 💰</span>}
                            </div>
                            <div className="taco-result-cat">
                              {Math.round(sub.kcal * mult)} kcal · P{+(sub.p * mult).toFixed(1)}g · C{+(sub.c * mult).toFixed(1)}g · G{+(sub.f * mult).toFixed(1)}g
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
                <div className="sub-search-section">
                  <div className="sub-section-label">🔍 Buscar qualquer alimento</div>
                  <input type="text" className="login-input"
                    placeholder="Ex: batata doce, atum, tofu, peixe..."
                    value={dietSubSearchQuery} autoComplete="off"
                    onChange={e => handleDietSubSearch(e.target.value)} />
                  {dietSubSearching && (
                    <div className="sub-search-loading"><span>🤖 Consultando IA...</span></div>
                  )}
                  {dietSubSearchRes.length > 0 && (
                    <div className="taco-results" style={{ marginTop:6 }}>
                      {dietSubSearchRes.map((res, i) => {
                        const rawG = res.food.kcal > 0 ? (item.kcal / res.food.kcal) * 100 : res.grams
                        const g    = Math.max(10, Math.min(600, Math.round(rawG / 5) * 5))
                        const mult = g / 100
                        return (
                          <button key={i} className="taco-result-item" onClick={() => applyDietSubFromSearch(res)}>
                            <div className="taco-result-name">
                              {res.food.nome} · {g}g
                              {res.isAI && <span className="diet-ia-badge"> IA</span>}
                            </div>
                            <div className="taco-result-cat">
                              {Math.round(res.food.kcal * mult)} kcal · P{+(res.food.p * mult).toFixed(1)}g · C{+(res.food.c * mult).toFixed(1)}g · G{+(res.food.f * mult).toFixed(1)}g
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {dietSubSearchQuery.length >= 2 && !dietSubSearching && dietSubSearchRes.length === 0 && (
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>
                      Nenhum resultado para "{dietSubSearchQuery}". Tente outra palavra.
                    </div>
                  )}
                </div>
                <button className="btn btn-cancel" style={{ marginTop:12 }} onClick={() => setDietSubModal(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ── JSX principal ────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ══ Modal: Substituir Alimento Hoje ══ */}
      {todaySubItem && (() => {
        const display      = activeSubs[todaySubItem.id] ?? todaySubItem
        const originalKcal = display.kcal
        const userAlts     = alternatives[todaySubItem.id] || []
        const tacoAlts     = getTodaySubstitutes(originalKcal, todaySubItem.name)

        const renderKcalDiff = (kcal: number) => {
          const diff = kcal - originalKcal
          if (Math.abs(diff) < 5) return null
          const color = diff > 0 ? '#e53935' : 'var(--success)'
          return <span className="sub-kcal-diff" style={{ color }}>{diff > 0 ? '+' : ''}{diff} kcal</span>
        }

        return (
          <div className="modal-overlay" onClick={closeTodaySubModal}>
            <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
              <div className="modal-title">🔄 Substituir Alimento</div>
              <div className="diet-sub-original">
                <strong>{display.name}</strong>
                {activeSubs[todaySubItem.id] && <span style={{ color:'var(--text-secondary)', fontSize:12 }}> (sub ativa)</span>}
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>
                  {originalKcal} kcal · P{display.p}g · C{display.c}g · G{display.f}g
                </div>
              </div>

              {/* Restaurar original */}
              {activeSubs[todaySubItem.id] && (
                <button className="taco-result-item" style={{ width:'100%' }}
                  onClick={() => { chooseSub(todaySubItem.id, null); closeTodaySubModal() }}>
                  <div className="taco-result-name">↩ {todaySubItem.name} <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>(original)</span></div>
                  <div className="taco-result-cat">{macroDesc(todaySubItem)}</div>
                </button>
              )}

              {/* Configurados pelo usuário */}
              {userAlts.filter(a => a.id !== activeSubs[todaySubItem.id]?.id).length > 0 && (
                <>
                  <div className="sub-section-label">Configurados por você</div>
                  {userAlts.filter(a => a.id !== activeSubs[todaySubItem.id]?.id).map(alt => (
                    <button key={alt.id} className="taco-result-item" style={{ width:'100%' }}
                      onClick={() => { chooseSub(todaySubItem.id, alt); closeTodaySubModal() }}>
                      <div className="taco-result-name">{alt.name} {renderKcalDiff(alt.kcal)}</div>
                      <div className="taco-result-cat">{macroDesc(alt)}</div>
                    </button>
                  ))}
                </>
              )}

              {/* TACO — alternativas automáticas */}
              {tacoAlts.length > 0 && (
                <>
                  <div className="sub-section-label">Sugestões do TACO</div>
                  <div className="taco-results">
                    {tacoAlts.map(alt => (
                      <button key={alt.food.id} className="taco-result-item"
                        onClick={() => {
                          const sub: SubOption = { id:newId(), name:formatTacoItemName(alt.food, alt.grams), kcal:alt.kcal, p:alt.p, c:alt.c, f:alt.f }
                          chooseSub(todaySubItem.id, sub)
                          closeTodaySubModal()
                        }}>
                        <div className="taco-result-name">
                          {formatTacoItemName(alt.food, alt.grams)}
                          {renderKcalDiff(alt.kcal)}
                          {BUDGET_IDS.has(alt.food.id) && <span className="diet-budget-badge"> 💰</span>}
                        </div>
                        <div className="taco-result-cat">{alt.kcal} kcal · P{alt.p}g · C{alt.c}g · G{alt.f}g</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Campo de Busca ── */}
              <div className="sub-search-section">
                <div className="sub-section-label">🔍 Buscar outro alimento</div>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Ex: iogurte, atum, tofu, peixe..."
                  value={todaySubQuery}
                  autoComplete="off"
                  onChange={e => handleTodaySubSearch(e.target.value)}
                />

                {todaySubSearching && (
                  <div className="sub-search-loading">
                    <span>🤖 Consultando IA...</span>
                  </div>
                )}

                {todaySubSearchRes.length > 0 && (
                  <div className="taco-results" style={{ marginTop:6 }}>
                    {todaySubSearchRes.map((res, i) => (
                      <button key={i} className="taco-result-item"
                        onClick={() => applyTodaySubFromSearch(res)}>
                        <div className="taco-result-name">
                          {formatTacoItemName(res.food, res.grams)}
                          {renderKcalDiff(res.kcal)}
                          {res.isAI && <span className="diet-ia-badge"> IA</span>}
                          {BUDGET_IDS.has(res.food.id) && <span className="diet-budget-badge"> 💰</span>}
                        </div>
                        <div className="taco-result-cat">
                          {res.kcal} kcal · P{res.p}g · C{res.c}g · G{res.f}g
                          {!res.isAI && ` · ${res.food.cat}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {todaySubQuery.length >= 2 && !todaySubSearching && todaySubSearchRes.length === 0 && (
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>
                    Nenhum resultado para "{todaySubQuery}". Tente outra palavra.
                  </div>
                )}
              </div>

              <button className="btn btn-cancel" style={{ marginTop:12 }} onClick={closeTodaySubModal}>
                Fechar
              </button>
            </div>
          </div>
        )
      })()}

      {/* ══ Modal: Substituto de Dieta Gerada ══ */}
      {dietSubModal !== null && generatedDiet && (() => {
        const item = generatedDiet[dietSubModal.mealIdx]?.items[dietSubModal.itemIdx]
        if (!item) return null
        return (
          <div className="modal-overlay" onClick={() => setDietSubModal(null)}>
            <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
              <div className="modal-title">🔄 Substituir Alimento na Dieta</div>
              <div className="diet-sub-original">
                <strong>{item.food.nome}</strong> · {item.grams}g · {item.kcal} kcal
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>
                  A porção será ajustada para manter ~{item.kcal} kcal
                </div>
              </div>

              {/* Sugestões automáticas da mesma categoria */}
              {dietSubs.length > 0 && (
                <>
                  <div className="sub-section-label">Sugestões similares</div>
                  <div className="taco-results">
                    {dietSubs.map(sub => {
                      const rawG = sub.kcal > 0 ? (item.kcal / sub.kcal) * 100 : 50
                      const g    = Math.max(10, Math.min(600, Math.round(rawG / 5) * 5))
                      const mult = g / 100
                      return (
                        <button key={sub.id} className="taco-result-item" onClick={() => applyDietSub(sub)}>
                          <div className="taco-result-name">
                            {sub.nome} · {g}g
                            {BUDGET_IDS.has(sub.id) && <span className="diet-budget-badge"> 💰</span>}
                          </div>
                          <div className="taco-result-cat">
                            {Math.round(sub.kcal * mult)} kcal · P{+(sub.p * mult).toFixed(1)}g · C{+(sub.c * mult).toFixed(1)}g · G{+(sub.f * mult).toFixed(1)}g
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Campo de busca livre no TACO */}
              <div className="sub-search-section">
                <div className="sub-section-label">🔍 Buscar qualquer alimento</div>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Ex: batata doce, atum, tofu, peixe..."
                  value={dietSubSearchQuery}
                  autoComplete="off"
                  onChange={e => handleDietSubSearch(e.target.value)}
                />
                {dietSubSearching && (
                  <div className="sub-search-loading"><span>🤖 Consultando IA...</span></div>
                )}
                {dietSubSearchRes.length > 0 && (
                  <div className="taco-results" style={{ marginTop:6 }}>
                    {dietSubSearchRes.map((res, i) => {
                      // Calcular porção equivalente ao item original
                      const rawG = res.food.kcal > 0 ? (item.kcal / res.food.kcal) * 100 : res.grams
                      const g    = Math.max(10, Math.min(600, Math.round(rawG / 5) * 5))
                      const mult = g / 100
                      return (
                        <button key={i} className="taco-result-item" onClick={() => applyDietSubFromSearch(res)}>
                          <div className="taco-result-name">
                            {res.food.nome} · {g}g
                            {res.isAI && <span className="diet-ia-badge"> IA</span>}
                            {BUDGET_IDS.has(res.food.id) && <span className="diet-budget-badge"> 💰</span>}
                          </div>
                          <div className="taco-result-cat">
                            {Math.round(res.food.kcal * mult)} kcal · P{+(res.food.p * mult).toFixed(1)}g · C{+(res.food.c * mult).toFixed(1)}g · G{+(res.food.f * mult).toFixed(1)}g
                            {!res.isAI && ` · ${res.food.cat}`}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {dietSubSearchQuery.length >= 2 && !dietSubSearching && dietSubSearchRes.length === 0 && (
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>
                    Nenhum resultado para "{dietSubSearchQuery}". Tente outra palavra.
                  </div>
                )}
              </div>

              <button className="btn btn-cancel" style={{ marginTop:12 }} onClick={() => setDietSubModal(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* ══ Modal: TACO ══ */}
      {showTACO && (
        <div className="modal-overlay" onClick={() => setShowTACO(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🥗 Banco TACO — Buscar Alimento</div>

            <div style={{ marginBottom: 12 }}>
              <label className="config-goal-label" style={{ marginBottom: 6 }}>Adicionar em:</label>
              <select
                className="login-input"
                value={tacoMealIdx}
                onChange={e => setTacoMealIdx(Number(e.target.value))}
              >
                {meals.map((m, i) => <option key={m.id} value={i}>{m.title}</option>)}
              </select>
            </div>

            <input
              type="text"
              className="login-input"
              placeholder="Buscar alimento (ex: frango, arroz, ovo...)"
              value={tacoQuery}
              autoFocus
              onChange={e => {
                const q = e.target.value
                setTacoQuery(q)
                setTacoResults(q.trim().length >= 2 ? searchTACO(q) : [])
                if (tacoSelected && !q.toLowerCase().includes(tacoSelected.nome.split(' ')[0].toLowerCase())) {
                  setTacoSelected(null)
                }
              }}
            />

            {tacoResults.length > 0 && !tacoSelected && (
              <div className="taco-results">
                {tacoResults.map(food => (
                  <button
                    key={food.id}
                    className="taco-result-item"
                    onClick={() => { setTacoSelected(food); setTacoResults([]) }}
                  >
                    <div className="taco-result-name">{food.nome}</div>
                    <div className="taco-result-cat">{food.cat} · {food.kcal} kcal/100g · P{food.p}g · C{food.c}g · G{food.f}g</div>
                  </button>
                ))}
              </div>
            )}

            {tacoSelected && (
              <div className="taco-calc-preview">
                <div className="taco-calc-name">{tacoSelected.nome}</div>
                <div className="taco-calc-cat">{tacoSelected.cat}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
                  <input
                    type="number"
                    className="login-input"
                    style={{ width: 100, textAlign: 'center' }}
                    value={tacoPorcao}
                    min={1}
                    onChange={e => setTacoPorcao(e.target.value)}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>gramas</span>
                </div>
                {(() => {
                  const g = parseFloat(tacoPorcao) || 100
                  const m = g / 100
                  return (
                    <div className="taco-calc-macros">
                      <span>🔥 {Math.round(tacoSelected.kcal * m)} kcal</span>
                      <span>P {+(tacoSelected.p * m).toFixed(1)}g</span>
                      <span>C {+(tacoSelected.c * m).toFixed(1)}g</span>
                      <span>G {+(tacoSelected.f * m).toFixed(1)}g</span>
                    </div>
                  )
                })()}
                <button
                  className="btn"
                  style={{ marginTop: 8 }}
                  disabled={!tacoPorcao || parseFloat(tacoPorcao) <= 0}
                  onClick={addTACOItem}
                >
                  ✅ Adicionar a {meals[tacoMealIdx]?.title}
                </button>
                <button
                  className="btn btn-cancel"
                  style={{ marginTop: 6 }}
                  onClick={() => { setTacoSelected(null); setTacoQuery(''); setTacoResults([]) }}
                >
                  ← Buscar outro
                </button>
              </div>
            )}

            <button className="btn btn-cancel" style={{ marginTop: 12 }} onClick={() => setShowTACO(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal: Histórico de Peso ══ */}
      {showWeightHistory && (
        <div className="modal-overlay" onClick={() => setShowWeightHistory(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📊 Histórico de Peso</div>

            <div className="wh-stats-grid">
              {[
                { label: 'Peso inicial', val: firstW !== null ? `${firstW}kg` : '—' },
                { label: 'Peso atual',   val: lastW  !== null ? `${lastW}kg`  : '—' },
                { label: 'Perda total',  val: totalLoss !== null
                    ? `${totalLoss > 0 ? '-' : totalLoss < 0 ? '+' : ''}${Math.abs(totalLoss)}kg ${totalLoss > 0 ? '✅' : totalLoss < 0 ? '⚠️' : '='}`
                    : '—' },
                { label: 'Dias reg.',    val: String(weightHistoryAsc.length) },
                { label: 'Média/semana', val: weeklyAvg !== null
                    ? `${weeklyAvg > 0 ? '-' : weeklyAvg < 0 ? '+' : ''}${Math.abs(weeklyAvg)}kg`
                    : '—' },
              ].map(({ label, val }) => (
                <div key={label} className="wh-stat-box">
                  <div className="wh-stat-label">{label}</div>
                  <div className="wh-stat-val">{val}</div>
                </div>
              ))}
            </div>

            {weightHistoryAsc.length >= 2 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Evolução do Peso</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={weightHistoryAsc} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }}
                      formatter={(v: any) => [`${v}kg`, 'Peso']} />
                    <Line type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {weightHistoryAsc.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table className="wh-table">
                  <thead><tr><th>Data</th><th>Peso</th><th>Foto</th><th>Diferença</th></tr></thead>
                  <tbody>
                    {weightHistoryDesc.map((e, i) => {
                      const prev = weightHistoryDesc[i + 1]
                      const diff = prev ? +((e.peso - prev.peso).toFixed(1)) : null
                      return (
                        <tr key={e.date}>
                          <td>{new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{e.peso}kg</td>
                          <td>{e.foto ? <img src={e.foto} alt="" className="wh-thumb" /> : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}</td>
                          <td style={{ fontWeight: 500, fontSize: 13,
                            color: diff === null ? 'var(--text-secondary)' : diff < 0 ? 'var(--success)' : diff > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                            {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}kg ${diff < 0 ? '✅' : diff > 0 ? '📈' : ''}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                Nenhum registro ainda.
              </div>
            )}
            <button className="btn" onClick={() => setShowWeightHistory(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Dia Finalizado ══ */}
      {showFinalize && (
        <div className="modal-overlay" onClick={() => setShowFinalize(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Finalizar Dia 🏁</div>
            <label className="modal-label">O que comeu fora da dieta?</label>
            <textarea className="modal-textarea" rows={3} placeholder="Ex: brigadeiro, pizza..."
              value={finObs} onChange={e => setFinObs(e.target.value)} />
            <label className="modal-label">Calorias extras (opcional)</label>
            <input type="number" className="modal-input" placeholder="Ex: 250"
              value={finExtras} onChange={e => setFinExtras(e.target.value)} />
            {(() => {
              const extras = parseFloat(finExtras) || 0
              const fb = getFeedback(totalCals + extras, CAL_META, CAL_MAX)
              return (
                <div className="modal-feedback" style={{ borderColor: fb.color, color: fb.color }}>
                  {fb.badge} {fb.msg}
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Refeições: {totalCals} + Extras: {extras} = <strong>{totalCals + extras} kcal</strong>
                  </div>
                </div>
              )
            })()}
            <div className="modal-actions">
              <button className="btn" onClick={finalizarDia}>Finalizar Dia</button>
              <button className="btn btn-cancel" onClick={() => setShowFinalize(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Editar / Adicionar Item ══ */}
      {itemModal && (
        <div className="modal-overlay" onClick={() => setItemModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{itemModal.mode === 'edit' ? 'Editar Alimento' : 'Novo Alimento'}</div>
            {[
              { key:'name', label:'Nome', type:'text',   placeholder:'Ex: Frango (200g)' },
              { key:'kcal', label:'Calorias (kcal)', type:'number', placeholder:'Ex: 297' },
              { key:'p',    label:'Proteína (g)',    type:'number', placeholder:'Ex: 56'  },
              { key:'c',    label:'Carboidrato (g)', type:'number', placeholder:'Ex: 0'   },
              { key:'f',    label:'Gordura (g)',     type:'number', placeholder:'Ex: 7'   },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="modal-label">{label}</label>
                <input type={type} className="modal-input" placeholder={placeholder}
                  value={(itemForm as any)[key]}
                  onChange={e => setItemForm(prev => ({ ...prev, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn" onClick={saveItemModal}>Salvar</button>
              <button className="btn btn-cancel" onClick={() => setItemModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Adicionar Substituidor ══ */}
      {subModal && (
        <div className="modal-overlay" onClick={() => setSubModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Novo Substituidor</div>
            <label className="modal-label">Substitui qual alimento?</label>
            <select className="modal-input" value={subForm.targetId}
              onChange={e => setSubForm(p => ({ ...p, targetId: e.target.value }))}>
              <option value="">— Selecione —</option>
              {allItemOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {[
              { key:'name', label:'Nome do Alimento', type:'text',   placeholder:'Ex: Filé de Peixe (150g)' },
              { key:'kcal', label:'Calorias (kcal)',   type:'number', placeholder:'Ex: 225' },
              { key:'p',    label:'Proteína (g)',       type:'number', placeholder:'Ex: 45'  },
              { key:'c',    label:'Carboidrato (g)',    type:'number', placeholder:'Ex: 0'   },
              { key:'f',    label:'Gordura (g)',        type:'number', placeholder:'Ex: 3'   },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="modal-label">{label}</label>
                <input type={type} className="modal-input" placeholder={placeholder}
                  value={(subForm as any)[key]}
                  onChange={e => setSubForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn" onClick={saveSubModal} disabled={!subForm.targetId}>Salvar Substituidor</button>
              <button className="btn btn-cancel" onClick={() => setSubModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal / View: Relatório ══ */}
      {showReport && (
        <div
          className="modal-overlay report-overlay"
          onClick={reportStep === 'select' ? () => setShowReport(false) : undefined}
        >
          {reportStep === 'select' ? (
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-title">📄 Gerar Relatório</div>

              <label className="modal-label">Período</label>
              <select className="modal-input" value={reportPeriod}
                onChange={e => setReportPeriod(e.target.value as ReportPeriod)}>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="3m">3 Meses</option>
                <option value="6m">6 Meses</option>
              </select>

              <label className="modal-label">
                {reportPeriod === 'daily'   ? 'Data específica' :
                 reportPeriod === 'weekly'  ? 'Qualquer dia da semana' :
                 reportPeriod === 'monthly' ? 'Qualquer dia do mês' :
                 'Data final do período'}
              </label>
              <input type="date" className="modal-input" value={reportAnchor}
                max={getToday()} onChange={e => setReportAnchor(e.target.value)} />

              {reportPeriod !== 'daily' && (() => {
                const ds  = getReportDates(reportPeriod, reportAnchor)
                const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })
                return (
                  <div className="report-range-preview">
                    📅 {fmt(ds[0])} → {fmt(ds[ds.length - 1])} ({ds.length} dias)
                  </div>
                )
              })()}

              <div className="modal-actions">
                <button className="btn" onClick={generateReport}>Gerar Relatório</button>
                <button className="btn btn-cancel" onClick={() => setShowReport(false)}>Cancelar</button>
              </div>
            </div>

          ) : reportResult && (
            <div className="report-view" onClick={e => e.stopPropagation()}>

              {/* Header do relatório */}
              <div className="report-header">
                <div>
                  <div className="report-title">💪 Meu Plano — Relatório {reportResult.periodLabel}</div>
                  <div className="report-subtitle">Período: {reportResult.dateRange}</div>
                </div>
                <button className="report-close-btn" onClick={() => setShowReport(false)}>✕</button>
              </div>

              <div className="report-body">

                {/* Seção 1: Resumo */}
                <div className="report-section">
                  <div className="report-section-title">📊 Resumo Geral</div>
                  <div className="report-grid">
                    <div className="report-stat">
                      <div className="report-stat-val">{reportResult.finalizados}/{reportResult.dates.length}</div>
                      <div className="report-stat-label">Dias cumpridos</div>
                      <div className="report-stat-sub">{Math.round(reportResult.finalizados / reportResult.dates.length * 100)}%</div>
                    </div>
                    <div className="report-stat">
                      <div className="report-stat-val">{reportResult.avgCals}</div>
                      <div className="report-stat-label">Média kcal/dia</div>
                      <div className="report-stat-sub">Meta: {userGoals.cals}</div>
                    </div>
                    <div className="report-stat">
                      <div className="report-stat-val">{reportResult.totalCals.toLocaleString('pt-BR')}</div>
                      <div className="report-stat-label">Total kcal</div>
                      <div className="report-stat-sub">{reportResult.daysWithCals}d c/ dados</div>
                    </div>
                    {reportResult.weightDiff !== null && (
                      <div className="report-stat">
                        <div className="report-stat-val" style={{ color: reportResult.weightDiff <= 0 ? 'var(--success)' : 'var(--warning)' }}>
                          {reportResult.weightDiff > 0 ? '+' : ''}{reportResult.weightDiff}kg
                        </div>
                        <div className="report-stat-label">Variação peso</div>
                        <div className="report-stat-sub">{reportResult.firstW} → {reportResult.lastW}kg</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Seção 2: Macros */}
                <div className="report-section">
                  <div className="report-section-title">🥗 Macros (média/dia)</div>
                  <div className="report-grid">
                    {([
                      { label:'Proteína',    val: reportResult.avgP, meta: userGoals.p },
                      { label:'Carboidrato', val: reportResult.avgC, meta: userGoals.c },
                      { label:'Gordura',     val: reportResult.avgF, meta: userGoals.f },
                    ] as const).map(({ label, val, meta }) => (
                      <div key={label} className="report-stat">
                        <div className="report-stat-val">{val}g</div>
                        <div className="report-stat-label">{label}</div>
                        <div className="report-stat-sub" style={{ color: val >= meta ? 'var(--success)' : 'var(--warning)' }}>
                          {val >= meta ? '✓ ok' : `falta ${meta - val}g`} / {meta}g
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seção 3: Gráfico calorias */}
                <div className="report-section">
                  <div className="report-section-title">📈 Calorias no Período</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={reportResult.calChart} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill:'var(--text-secondary)', fontSize:10 }} />
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                      <ReferenceLine y={userGoals.cals} stroke="var(--success)" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="cals" stroke="var(--primary)" strokeWidth={2} dot={false} name="kcal" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Seção 3b: Gráfico peso */}
                {reportResult.pesoChart.length >= 2 && (
                  <div className="report-section">
                    <div className="report-section-title">⚖️ Peso no Período</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={reportResult.pesoChart} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:10 }} interval="preserveStartEnd" />
                        <YAxis domain={['auto','auto']} tick={{ fill:'var(--text-secondary)', fontSize:10 }} />
                        <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                        <Line type="monotone" dataKey="peso" stroke="var(--success)" strokeWidth={2} dot={false} name="kg" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Seção 4: Gráfico macros */}
                <div className="report-section">
                  <div className="report-section-title">🏋️ Macros Médios vs Meta</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={reportResult.macroChart} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                      <YAxis tick={{ fill:'var(--text-secondary)', fontSize:10 }} />
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Bar dataKey="consumido" fill="var(--primary)" name="Consumido (g)" radius={[3,3,0,0]} />
                      <Bar dataKey="meta"      fill="var(--border)"  name="Meta (g)"      radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Seção 5: Insights */}
                <div className="report-section">
                  <div className="report-section-title">💡 Insights Automáticos</div>
                  {reportResult.insights.map((ins, i) => (
                    <div key={i} className="report-insight">• {ins}</div>
                  ))}
                </div>

                <div className="report-footer">
                  Gerado em {reportResult.generatedAt} · Meu Plano
                </div>
              </div>

              {/* Barra de ações */}
              <div className="report-action-bar">
                <button className="btn btn-cancel btn-small" style={{ width:'auto' }}
                  onClick={() => { setReportStep('select'); setReportResult(null) }}>
                  ← Novo
                </button>
                <button className="btn btn-small" style={{ width:'auto' }} onClick={copyReportToClipboard}>
                  📋 Copiar
                </button>
                <button className="btn btn-small" style={{ width:'auto' }} onClick={() => window.print()}>
                  📥 PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ONBOARDING: Modal de boas-vindas (step 1) ══ */}
      {onboardingStep === 1 && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <div className="modal-card" style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Bem-vindo ao Meu Plano!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
              Vamos configurar sua dieta em <strong style={{ color: 'var(--primary)' }}>3 passos</strong>:<br />
              <span style={{ display: 'inline-block', marginTop: 8 }}>
                🧮 Calcule sua meta calórica<br />
                🍽️ Gere sua dieta personalizada<br />
                📋 Comece a acompanhar!
              </span>
            </div>
            <button className="btn" style={{ width: '100%' }}
              onClick={() => {
                setOnboardingStep(2)
                setOnboardingScreen(true)
                setOnboardingScreenStep(1)
              }}>
              🧮 Calcular meta e gerar dieta
            </button>
            <button className="btn btn-cancel" style={{ marginTop: 10, width: '100%' }}
              onClick={() => {
                setOnboardingStep(0)
                if (authUser) localStorage.setItem(`onboarding_done_${authUser.uid}`, '1')
                else          localStorage.setItem('onboarding_done', '1')
                setActiveTab('config')
                setConfigSections(prev => ({ ...prev, cardapio: true }))
              }}>
              ✍️ Montar minha própria dieta
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header>
        <div className="header-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <h1>💪 Meu Plano</h1>
              <div className="subtitle">Dieta & Treino</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {firebaseConfigured && syncStatus !== 'unconfigured' && (
                <div className={`sync-badge sync-badge--${syncStatus}`}>
                  {SYNC_ICON[syncStatus]}
                </div>
              )}
              <button
                className="theme-toggle"
                title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                onClick={() => setIsDark(d => !d)}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banner de progresso de setup (caminho automático, steps 2-3) */}
      {inAutoSetup && (
        <div className="setup-progress-banner">
          <span>🔧 Configure seu plano primeiro —</span>
          <span className="setup-progress-steps">
            Passo {onboardingStep === 2 ? '1' : '2'}/2: {onboardingStep === 2 ? 'Calculadora' : 'Gerar Dieta'}
          </span>
        </div>
      )}

      <div className="container">
        {/* Tab bar — oculto no mobile (substituído pela bottom nav) */}
        <div className="tabs">
          {[
            { id:'hoje',         label:'📋 Hoje'   },
            { id:'peso',         label:'⚖️ Peso'  },
            { id:'estatísticas', label:'📊 Stats'  },
            { id:'config',       label:'⚙️ Config' },
          ].map(t => (
            <button key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              disabled={inAutoSetup && t.id !== 'config'}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ HOJE */}
        <div className={`tab-content ${activeTab === 'hoje' ? 'active' : ''}`}>

          {/* Onboarding: toast de conclusão */}
          {onboardingStep === 4 && (
            <div className="onboarding-done-banner">
              🎉 Tudo pronto! Seu cardápio está configurado. Comece a marcar as refeições!
            </div>
          )}

          {/* Status do Dia — compacto, clicável */}
          {(() => {
            const diff     = liveDayTotal - CAL_META
            const onTarget = Math.abs(diff) <= 50
            const color    = onTarget ? 'var(--success)' : diff < 0 ? 'var(--warning)' : 'var(--error)'
            const emoji    = onTarget ? '🟢' : diff < 0 ? '🟡' : '🔴'
            const text     = onTarget
              ? 'No alvo! Você atingiu sua meta!'
              : diff < 0
                ? `Pouco! Margem: +${Math.abs(diff)} kcal`
                : `Passou em +${diff} kcal`
            const dateStr = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' })
            return (
              <div className="week-status-card" style={{ borderColor: color }}
                onClick={() => { setActiveTab('estatísticas'); setStatsSubTab('diario') }}>
                <div className="week-status-left">
                  <div className="week-status-title">Status do Dia</div>
                  <div className="week-status-text" style={{ color }}>
                    {emoji} {text}
                  </div>
                  <div className="week-status-sub">
                    {mealsCompleted}/{meals.length} refeições · {dateStr}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>→</div>
              </div>
            )
          })()}

          {/* Refeições colapsáveis */}
          {meals.length === 0 || meals.every(m => (m.items ?? []).length === 0) ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🍽️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Cardápio vazio</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Adicione seus alimentos na aba Config → Meu Cardápio
              </div>
              <button className="btn btn-small" style={{ width: 'auto', margin: '0 auto', display: 'block' }}
                onClick={() => setActiveTab('config')}>
                Ir para Configurações
              </button>
            </div>
          ) : meals.map(meal => {
            const items       = meal.items ?? []
            const isExpanded  = !!expandedMeals[meal.id]
            const checkedCount = items.filter(it => todayChecked[it.id]).length
            const mealStatus  = items.length === 0 ? 'empty' : checkedCount === 0 ? 'empty' : checkedCount < items.length ? 'partial' : 'complete'
            const mealKcal    = items.reduce((s, it) => s + (activeSubs[it.id]?.kcal ?? it.kcal) * (todayChecked[it.id] ? 1 : 0), 0)
            const mealKcalTotal = items.reduce((s, it) => s + (activeSubs[it.id]?.kcal ?? it.kcal), 0)
            return (
              <div key={meal.id} className="meal-collapse-card">
                <div className="meal-collapse-header"
                  onClick={() => setExpandedMeals(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}>
                  {/* Status dots — one per item: green=checked, gray=unchecked */}
                  <div className="meal-status-dots">
                    {items.length === 0
                      ? <div className="meal-dot meal-dot--empty" />
                      : items.slice(0, 5).map(it => (
                          <div key={it.id} className={`meal-dot meal-dot--${todayChecked[it.id] ? 'complete' : 'empty'}`} />
                        ))
                    }
                  </div>
                  <div className="meal-collapse-title">{meal.title}</div>
                  <div className="meal-collapse-kcal">
                    {mealKcal > 0 ? `${Math.round(mealKcal)}` : `~${Math.round(mealKcalTotal)}`} kcal
                  </div>
                  <div className={`meal-collapse-arrow ${isExpanded ? 'meal-collapse-arrow--open' : ''}`}>▼</div>
                </div>
                {isExpanded && (
                  <div className="meal-collapse-body">
                    {items.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>
                        Nenhum alimento — adicione em Config
                      </div>
                    ) : items.map(item => {
                      const subActive  = activeSubs[item.id]
                      const display    = subActive || item
                      const qtyMatch   = /\((\d{1,2})\s+[^\d)]+\)/i.exec(display.name)
                      const displayQty = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined
                      return (
                        <div key={item.id} className="meal-item-wrap">
                          <div className="meal-item" onClick={() => toggleItem(item.id)}>
                            <div className={`checkbox ${todayChecked[item.id] ? 'checked' : ''}`}>
                              {todayChecked[item.id] ? '✓' : ''}
                            </div>
                            <div className="meal-content">
                              <div className="meal-name">
                                {display.name}
                                {subActive && <span className="sub-badge">sub</span>}
                              </div>
                              <div className="meal-desc">{macroDesc(display)}</div>
                            </div>
                          </div>
                          <div className="alt-wrap" onClick={e => e.stopPropagation()}>
                            <button className="alt-btn" title="Substituir alimento"
                              onClick={() => setTodaySubItem(item)}>🔄</button>
                            {displayQty !== undefined && (
                              <>
                                <button className="qty-btn" title="Diminuir quantidade"
                                  disabled={displayQty <= 1}
                                  onClick={() => adjustQuantity(meal.id, item.id, 'decrease', displayQty)}>➖</button>
                                <button className="qty-btn" title="Aumentar quantidade"
                                  disabled={displayQty >= 99}
                                  onClick={() => adjustQuantity(meal.id, item.id, 'increase', displayQty)}>➕</button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Macros */}
          <div className="cardapio-macros">
            <div className="cardapio-macros-title">Macros do Dia</div>
            <div className="macros-grid">
              {[
                { label:'Proteína',    val: totalP, meta: userGoals.p, cls: 'macro-box--protein' },
                { label:'Carboidrato', val: totalC, meta: userGoals.c, cls: 'macro-box--carb'    },
                { label:'Gordura',     val: totalF, meta: userGoals.f, cls: 'macro-box--fat'     },
              ].map(({ label, val, meta, cls }) => (
                <div key={label} className={`macro-box ${cls}`}>
                  <div className="macro-label">{label}</div>
                  <div className="macro-value">{val}g</div>
                  <div className="macro-goal">/{meta}g</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (val/meta)*100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Finalizar Dia */}
          {todayFinished ? (
            <div className="day-finalized-card">
              <div style={{ fontSize: 26 }}>✅</div>
              <div>
                <div className="day-finalized-title">Dia Finalizado às {todayStat.timestamp}</div>
                <div className="day-finalized-feedback" style={{ color: todayFeedback.color }}>{todayFeedback.msg}</div>
                {todayStat.observacoes && <div className="day-finalized-obs">"{todayStat.observacoes}"</div>}
              </div>
            </div>
          ) : (
            <button className="btn btn-finalizar" onClick={() => setShowFinalize(true)}>🏁 Finalizar Dia</button>
          )}

        </div>

        {/* ══════════════════════════════════════════════════════ PESO */}
        <div className={`tab-content ${activeTab === 'peso' ? 'active' : ''}`}>

          {todayWeight !== null ? (
            <div className="card today-weight-card">
              <div className="today-weight-date">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </div>
              <div className="today-weight-value">{todayWeight}</div>
              <div className="today-weight-unit">kg</div>
              {todayWeightFoto && <img src={todayWeightFoto} alt="Foto de hoje" className="today-weight-photo" />}
              <button className="btn btn-small" style={{ width: 'auto', margin: '0 auto', display: 'block' }}
                onClick={() => setShowWeightHistory(true)}>
                📊 Ver Histórico Completo
              </button>
            </div>
          ) : weightHistoryAsc.length > 0 ? (
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Último registro: {weightHistoryDesc[0]?.peso}kg em {new Date(weightHistoryDesc[0]?.date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
              <button className="btn btn-small" style={{ width: 'auto', margin: '0 auto', display: 'block' }}
                onClick={() => setShowWeightHistory(true)}>
                📊 Ver Histórico ({weightHistoryAsc.length} registros)
              </button>
            </div>
          ) : null}

          <div className="card">
            <div className="card-title">{todayWeight !== null ? 'Atualizar Peso de Hoje' : 'Registrar Peso'}</div>
            <input type="number" placeholder="Seu peso em kg" step="0.1" id="weight-input" />
            <label className="photo-upload-label">
              {weightPhoto ? '✓ Foto selecionada' : '📷 Adicionar foto (opcional)'}
              <input type="file" accept="image/*" onChange={handlePhotoSelect} />
            </label>
            {weightPhoto && (
              <div className="photo-preview-container">
                <img src={weightPhoto} alt="Preview" className="photo-preview" />
                <button className="photo-remove" onClick={() => setWeightPhoto('')}>✕</button>
              </div>
            )}
            <button className="btn" onClick={() => {
              const inp = document.getElementById('weight-input') as HTMLInputElement
              if (inp.value) { addWeight(inp.value, weightPhoto); inp.value = ''; setWeightPhoto('') }
            }}>Registrar</button>
          </div>
        </div>

        {/* Calculadora e Gerar Dieta foram movidos para dentro de Config (accordion) */}

        {/* ══════════════════════════════════════════════════════ ESTATÍSTICAS */}
        <div className={`tab-content ${activeTab === 'estatísticas' ? 'active' : ''}`}>

          {(weightHistoryAsc.length >= 1 || dualChartData.some(d => d.cals !== undefined)) && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>📈 Seu Progresso</div>
                {weightHistoryAsc.length > 0 && (
                  <button className="btn btn-small" style={{ width: 'auto' }} onClick={() => setShowWeightHistory(true)}>
                    Ver Histórico
                  </button>
                )}
              </div>
              {dualChartData.length >= 2 ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span style={{ color: 'var(--primary)' }}>●</span> Peso (kg) &nbsp;
                    <span style={{ color: 'var(--success)' }}>●</span> Calorias
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={dualChartData} margin={{ top: 8, right: 50, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                      <YAxis yAxisId="peso" orientation="left"  domain={['auto','auto']} tick={{ fill: 'var(--primary)', fontSize: 10 }} />
                      <YAxis yAxisId="cals" orientation="right" domain={[0,'auto']}      tick={{ fill: 'var(--success)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }}
                        formatter={(v: any, name: string) => name === 'peso' ? [`${v}kg`, 'Peso'] : [`${v}kcal`, 'Calorias']} />
                      <Line yAxisId="peso" type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} name="peso" connectNulls />
                      <Line yAxisId="cals" type="monotone" dataKey="cals" stroke="var(--success)" strokeWidth={2} dot={{ fill: 'var(--success)', r: 3 }} name="cals" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center', padding: '16px 0' }}>
                  Registre peso em pelo menos 2 dias para ver o gráfico.
                </div>
              )}
              <div>
                {totalLoss !== null && totalLoss > 0 && (
                  <div className="insight-item">🏆 Você perdeu <strong>{totalLoss}kg</strong> desde o início ({weightHistoryAsc.length} registros)</div>
                )}
                {totalLoss !== null && totalLoss < 0 && (
                  <div className="insight-item">📈 Ganhou <strong>{Math.abs(totalLoss)}kg</strong> desde o início — ajuste a dieta se necessário</div>
                )}
                {weeklyAvg !== null && weeklyAvg > 0 && (
                  <div className="insight-item">📊 Tendência: perdendo <strong>{weeklyAvg}kg/semana</strong>{weeklyAvg >= 0.3 && weeklyAvg <= 1 ? ' ✅ bom ritmo!' : weeklyAvg > 1 ? ' ⚠️ ritmo muito alto' : ''}</div>
                )}
                {(() => {
                  const lastEntry = weightHistoryAsc[weightHistoryAsc.length - 1]
                  if (!lastEntry?.calorias) return null
                  const diff = CAL_META - lastEntry.calorias
                  return (
                    <div className="insight-item">
                      {diff > 100 ? `🟡 Calorias: margem de -${diff} kcal/dia — pode comer mais`
                        : diff < -100 ? `🔴 Calorias: ${Math.abs(diff)} kcal acima da meta no último registro`
                        : `🟢 Calorias dentro da meta no último registro`}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <div className="report-btn-row">
            <button className="btn btn-small btn-pdf" style={{ width:'auto' }}
              onClick={() => window.print()}>
              📥 PDF
            </button>
            <button className="btn btn-small btn-report" style={{ width:'auto' }}
              onClick={() => { setShowReport(true); setReportStep('select'); setReportResult(null) }}>
              📄 Gerar Relatório
            </button>
          </div>

          <div className="sub-tabs">
            {(['diario','semanal','mensal'] as const).map(st => (
              <button key={st} className={`sub-tab-btn ${statsSubTab === st ? 'active' : ''}`}
                onClick={() => setStatsSubTab(st)}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {statsSubTab === 'diario' && (
            <div>
              <div className="card">
                <div className="card-title">Hoje — Calorias vs Meta</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[{ label:'Consumido', val:totalCals },{ label:'Meta', val:CAL_META }]} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:12 }} />
                    <YAxis tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                    <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                    <Bar dataKey="val" fill="var(--primary)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-title">Hoje — Macros vs Meta</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { macro:'Proteína',    consumido:totalP, meta:userGoals.p },
                    { macro:'Carboidrato', consumido:totalC, meta:userGoals.c },
                    { macro:'Gordura',     consumido:totalF, meta:userGoals.f },
                  ]} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="macro" tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                    <YAxis tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                    <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    <Bar dataKey="consumido" fill="var(--primary)" radius={[4,4,0,0]} name="Consumido (g)" />
                    <Bar dataKey="meta"      fill="var(--border)"  radius={[4,4,0,0]} name="Meta (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-title">Insights de Hoje</div>
                {[{ label:'Proteína', val:totalP, meta:userGoals.p },{ label:'Carboidrato', val:totalC, meta:userGoals.c },{ label:'Gordura', val:totalF, meta:userGoals.f }].map(({ label, val, meta }) => (
                  <div key={label} className="insight-row">
                    <span className="insight-label">{label}</span>
                    <span className="insight-val">{val}g / {meta}g</span>
                    <span className="insight-diff" style={{ color: val < meta ? 'var(--warning)' : 'var(--success)' }}>
                      {val < meta ? `faltou ${meta-val}g` : 'ok ✓'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statsSubTab === 'semanal' && (
            <div>
              {weekWeightDiff !== null && weekFirstW !== null && weekLastW !== null && (
                <div className="weight-badge-card">
                  <span style={{ fontSize: 18 }}>{weekWeightDiff < 0 ? '📉' : weekWeightDiff > 0 ? '📈' : '➡️'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      Peso: {weekFirstW}kg → {weekLastW}kg
                      <span style={{ color: weekWeightDiff < 0 ? 'var(--success)' : weekWeightDiff > 0 ? 'var(--warning)' : 'var(--text-secondary)', marginLeft: 6 }}>
                        ({weekWeightDiff > 0 ? '+' : ''}{weekWeightDiff}kg)
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>evolução na semana</div>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-title">Calorias — 7 Dias</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyChartData} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                    <YAxis domain={[0,2500]} tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                    <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                    <ReferenceLine y={CAL_META} stroke="var(--success)" strokeDasharray="4 4" label={{ value:'Meta', fill:'var(--success)', fontSize:11 }} />
                    <Line type="monotone" dataKey="cals" stroke="var(--primary)" strokeWidth={2} dot={{ fill:'var(--primary)', r:4 }} name="kcal" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {weekWeightData.length >= 2 && (
                <div className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div className="card-title" style={{ marginBottom:0 }}>Peso — 7 Dias</div>
                    <button className="config-reset-btn" onClick={() => setShowWeightHistory(true)}>Ver completo</button>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={weekWeightData} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                      <YAxis domain={['auto','auto']} tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                      <Line type="monotone" dataKey="peso" stroke="var(--success)" strokeWidth={2} dot={{ fill:'var(--success)', r:4 }} name="kg" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card">
                <div className="card-title">Tabela Semanal</div>
                <table className="stats-table">
                  <thead><tr><th>Data</th><th>kcal</th><th>Status</th></tr></thead>
                  <tbody>
                    {weekDates.map((d, i) => {
                      const cals = calcDayMacros(meals, checked[d]||{}, activeSubs).cals + (dayStats[d]?.caloriasExtras||0)
                      const fin  = dayStats[d]?.finalizado
                      const diff = CAL_META - cals
                      const status = fin ? `✅ ${Math.abs(diff)} ${diff>=0?'abaixo':'acima'}` : cals > CAL_MAX ? '⚠️ Acima' : cals > 0 ? '⏳ Parcial' : '—'
                      return (
                        <tr key={d} style={{ background: i%2===0 ? 'var(--dark)' : 'transparent' }}>
                          <td>{dateLabel(d)}</td>
                          <td style={{ color:'var(--primary)' }}>{cals > 0 ? cals : '—'}</td>
                          <td style={{ fontSize:12 }}>{status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div className="card-title">Resumo Semanal</div>
                {[['Total',`${weekTotal} kcal`],['Meta',`${weekMeta} kcal`],['Resultado',`${weekDiff>=0?'+':''}${weekDiff} kcal`],['Finalizados',`${weekFin}/7`],['Média',`${Math.round(weekTotal/7)} kcal/dia`]].map(([k,v])=>(
                  <div key={k} className="summary-row"><span className="summary-key">{k}</span><span className="summary-val">{v}</span></div>
                ))}
              </div>
            </div>
          )}

          {statsSubTab === 'mensal' && (
            <div>
              <div className="card">
                <div className="card-title">Calorias por Semana — 30 Dias</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyChartData} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:12 }} />
                    <YAxis tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                    <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                    <ReferenceLine y={CAL_META*7} stroke="var(--success)" strokeDasharray="4 4" label={{ value:'Meta', fill:'var(--success)', fontSize:11 }} />
                    <Bar dataKey="total" fill="var(--primary)" radius={[4,4,0,0]} name="kcal" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {weightTrend.length >= 2 && (
                <div className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div className="card-title" style={{ marginBottom:0 }}>Tendência de Peso — 30 Dias</div>
                    <button className="config-reset-btn" onClick={() => setShowWeightHistory(true)}>Ver completo</button>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weightTrend} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                      <YAxis domain={['auto','auto']} tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:6 }} />
                      <Line type="monotone" dataKey="peso" stroke="var(--success)" strokeWidth={2} dot={{ fill:'var(--success)', r:4 }} name="kg" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card">
                <div className="card-title">Resumo Mensal</div>
                {(() => {
                  const tot = monthlyChartData.reduce((s,w) => s+w.total, 0)
                  const met = CAL_META * 30
                  const fin = monthDates.filter(d => dayStats[d]?.finalizado).length
                  return [['Total',`${tot.toLocaleString()} kcal`],['Meta',`${met.toLocaleString()} kcal`],['Status',tot<=met?'No alvo ✅':`${(tot-met).toLocaleString()} kcal acima`],['Finalizados',`${fin}/30`]].map(([k,v])=>(
                    <div key={k} className="summary-row"><span className="summary-key">{k}</span><span className="summary-val">{v}</span></div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════ CONFIG */}
        <div className={`tab-content ${activeTab === 'config' ? 'active' : ''}`}>

          {/* ── Seção: Conta ── */}
          {firebaseConfigured && authUser && (
            <div className="config-section">
              <div className="config-section-header" onClick={() => toggleConfigSection('conta')}>
                <div className="config-section-title-group">
                  <span>👤 Minha Conta</span>
                  <span className="config-section-desc">Gerencie login e sincronização</span>
                </div>
                <span className={`config-section-arrow ${configSections.conta ? 'open' : ''}`}>▼</span>
              </div>
              {configSections.conta && (
                <div className="config-section-body">
                  <div className="account-row" style={{ marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{authUser.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {syncStatus === 'synced'  && '☁️ Sincronizado'}
                        {syncStatus === 'syncing' && '⟳ Sincronizando...'}
                        {syncStatus === 'offline' && '📵 Offline — dados salvos localmente'}
                        {syncStatus === 'idle'    && '☁️ Conectado'}
                      </div>
                    </div>
                    <button className="btn btn-small warning" style={{ width: 'auto' }} onClick={handleLogout}>
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Seção: Minha Meta ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('metas')}>
              <div className="config-section-title-group">
                <span>🎯 Minha Meta</span>
                <span className="config-section-desc">Defina seu objetivo calórico</span>
              </div>
              <span className={`config-section-arrow ${configSections.metas ? 'open' : ''}`}>▼</span>
            </div>
            {configSections.metas && (
              <div className="config-section-body">
                {suggestRegen && (
                  <div className="regen-suggestion">
                    <div>🍽️ Sua meta calórica mudou para <strong>{userGoals.cals} kcal/dia</strong>. Deseja gerar um novo cardápio automaticamente?</div>
                    <div className="regen-actions">
                      <button className="btn btn-small" style={{ width: 'auto' }} onClick={() => {
                        setDietTarget(String(userGoals.cals))
                        setGeneratedDiet(generateDiet(userGoals.cals, dietBudget))
                        setConfigSections(s => ({ ...s, dieta: true }))
                        setSuggestRegen(false)
                      }}>✓ Gerar novo cardápio</button>
                      <button className="btn btn-small btn-cancel" style={{ width: 'auto' }} onClick={() => setSuggestRegen(false)}>
                        ✗ Manter atual
                      </button>
                    </div>
                  </div>
                )}
                <div className="config-goals" style={{ marginTop: 8 }}>
                  {([{ key:'cals', label:'Calorias', unit:'kcal' },{ key:'p', label:'Proteína', unit:'g' },{ key:'c', label:'Carboidrato', unit:'g' },{ key:'f', label:'Gordura', unit:'g' }] as { key: keyof typeof DEFAULT_GOALS; label:string; unit:string }[]).map(({ key, label, unit }) => (
                    <div key={key} className="config-goal-row">
                      <label className="config-goal-label">{label}</label>
                      <div className="config-goal-input-wrap">
                        <input type="number" className="config-goal-input" value={userGoals[key]} onChange={e => updateGoal(key, e.target.value)} />
                        <span className="config-goal-unit">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-cancel" style={{ marginTop:12 }} onClick={resetGoals}>
                  ↩ Reset Padrão ({DEFAULT_GOALS.cals} kcal · P{DEFAULT_GOALS.p}g · C{DEFAULT_GOALS.c}g · G{DEFAULT_GOALS.f}g)
                </button>
              </div>
            )}
          </div>

          {/* ── Seção: Calcular ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('calc')}>
              <div className="config-section-title-group">
                <span>🧮 Calcular</span>
                <span className="config-section-desc">Recalcule seus dados nutricionais</span>
              </div>
              <span className={`config-section-arrow ${configSections.calc ? 'open' : ''}`}>▼</span>
            </div>
            {configSections.calc && (
              <div className="config-section-body">
                {onboardingStep === 2 && (
                  <div className="onboarding-banner" style={{ marginBottom:12, marginTop:8 }}>
                    <span className="onboarding-step-badge">Passo 1 / 2</span>
                    <div className="onboarding-banner-text">
                      <strong>Calcule sua meta calórica.</strong> Preencha seus dados e clique em <strong>"Calcular"</strong>.
                      Depois use o botão <strong>"Usar →"</strong> para continuar.
                    </div>
                  </div>
                )}
                {/* Bioimpedância */}
                <div className="bio-section" style={{ marginTop:8 }}>
                  <button className="bio-toggle" onClick={() => setShowBio(!showBio)}>
                    📡 {showBio ? '▾' : '▸'} Importar Bioimpedância <span className="bio-optional">(opcional)</span>
                  </button>
                  {showBio && (
                    <div className="bio-content">
                      <div className="bio-upload-zone" onClick={() => bioFileRef.current?.click()}>
                        <div className="bio-upload-icon">📊</div>
                        <div className="bio-upload-text">Clique para selecionar arquivo da balança</div>
                        <div className="bio-upload-sub">TXT, CSV — exportado da balança ou app de bioimpedância</div>
                      </div>
                      <input ref={bioFileRef} type="file" accept=".txt,.csv,.text" style={{ display:'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(applyBioFile) }} />
                      <div className="calc-field" style={{ marginTop:10 }}>
                        <label className="calc-label">% Gordura Corporal <span className="calc-unit">(se conhecido)</span></label>
                        <input type="number" className="login-input" value={calcGordura} placeholder="Ex: 22.5"
                          onChange={e => setCalcGordura(e.target.value)} />
                      </div>
                      {calcGordura && <div className="bio-formula-note">✅ Usando Katch-McArdle (mais preciso com % gordura)</div>}
                    </div>
                  )}
                </div>
                {/* Dados principais */}
                <div className="calc-grid" style={{ marginTop:12 }}>
                  {([
                    { label:'Peso', unit:'kg',    val:calcPeso,   set:setCalcPeso   },
                    { label:'Altura', unit:'cm',  val:calcAltura, set:setCalcAltura },
                    { label:'Idade', unit:'anos', val:calcIdade,  set:setCalcIdade  },
                  ] as { label:string; unit:string; val:string; set:(v:string)=>void }[]).map(({ label, unit, val, set }) => (
                    <div key={label} className="calc-field">
                      <label className="calc-label">{label} <span className="calc-unit">({unit})</span></label>
                      <input type="number" className="login-input" value={val} onChange={e => set(e.target.value)} placeholder="0" />
                    </div>
                  ))}
                  <div className="calc-field">
                    <label className="calc-label">Sexo</label>
                    <select className="login-input" value={calcSexo} onChange={e => setCalcSexo(e.target.value as 'M'|'F')}>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                </div>
                <div className="calc-field" style={{ marginTop:10 }}>
                  <label className="calc-label">Nível de Atividade</label>
                  <select className="login-input" value={calcAtividade} onChange={e => setCalcAtividade(e.target.value as typeof calcAtividade)}>
                    <option value="sed">Sedentário — pouco ou nenhum exercício</option>
                    <option value="leve">Leve — exercício 1–3×/semana</option>
                    <option value="mod">Moderado — exercício 3–5×/semana</option>
                    <option value="int">Intenso — exercício 5–7×/semana</option>
                    <option value="muito">Muito Intenso — atleta / treino 2× ao dia</option>
                  </select>
                </div>
                <div className="calc-field" style={{ marginTop:10 }}>
                  <label className="calc-label">Objetivo Principal</label>
                  <div className="calc-obj-row">
                    {([
                      { v:'emagrecer', label:'📉 Emagrecer' },
                      { v:'manter',    label:'➡️ Manter'    },
                      { v:'ganhar',    label:'📈 Ganhar'     },
                    ] as const).map(({ v, label }) => (
                      <button key={v} className={`calc-obj-btn ${calcObjetivo === v ? 'active' : ''}`}
                        onClick={() => setCalcObjetivo(v)}>{label}</button>
                    ))}
                  </div>
                </div>
                <button className="btn" style={{ marginTop:14 }} onClick={handleCalc}
                  disabled={!calcPeso || !calcAltura || !calcIdade}>
                  🧮 Calcular
                </button>
                {calcResult && (
                  <div className="calc-result-box">
                    <div className="calc-result-imc" style={{ color: calcResult.imcColor }}>
                      IMC: <strong>{calcResult.imc}</strong> — {calcResult.imcClass}
                    </div>
                    <div className="calc-result-row">
                      <span>Taxa Metabólica Basal (TMB){calcGordura ? ' · Katch-McArdle' : ''}</span>
                      <span><strong>{calcResult.tmb.toLocaleString('pt-BR')}</strong> kcal/dia</span>
                    </div>
                    <div className="calc-result-row">
                      <span>Gasto Total Diário (TDEE)</span>
                      <span><strong>{calcResult.tdee.toLocaleString('pt-BR')}</strong> kcal/dia</span>
                    </div>
                    {/* Cards de objetivo — selecionáveis */}
                    <div className="calc-options-grid">
                      {([
                        { obj:'emagrecer', label:'📉 EMAGRECER', val:calcResult.emagrecer, desc:'déficit · perda de peso' },
                        { obj:'manter',    label:'➡️ MANTER',    val:calcResult.manter,    desc:'igual ao TDEE · manutenção' },
                        { obj:'ganhar',    label:'📈 GANHAR',     val:calcResult.ganhar,    desc:'superávit · ganho de massa' },
                      ] as const).map(({ obj, label, val, desc }) => (
                        <div key={obj}
                          className={`calc-option-card ${calcObjetivo === obj ? 'active' : ''}`}
                          onClick={() => { setCalcObjetivo(obj); setCalcDeficit(null) }}>
                          <div className="calc-option-label">{label}</div>
                          <div className="calc-option-val">{val.toLocaleString('pt-BR')} kcal/dia</div>
                          <div className="calc-option-desc">{desc}</div>
                        </div>
                      ))}
                    </div>
                    {/* Seleção de intensidade (emagrecer ou ganhar) */}
                    {(calcObjetivo === 'emagrecer' || calcObjetivo === 'ganhar') && (
                      <div className="deficit-section">
                        <div className="deficit-title">
                          {calcObjetivo === 'emagrecer' ? '📌 Escolha o déficit:' : '📌 Escolha o superávit:'}
                        </div>
                        <div className="deficit-row">
                          {([
                            { id:'leve', label:'Leve',      pct:10, desc:'Confortável' },
                            { id:'mod',  label:'Moderado',  pct:15, desc:'Recomendado ✅' },
                            { id:'agr',  label:'Agressivo', pct:20, desc:'Rápido' },
                          ] as const).map(({ id, label, pct, desc }) => {
                            const cals = calcObjetivo === 'emagrecer'
                              ? Math.round(calcResult.tdee * (1 - pct / 100))
                              : Math.round(calcResult.tdee * (1 + pct / 100))
                            return (
                              <button key={id}
                                className={`deficit-btn ${calcDeficit === id ? 'active' : ''}`}
                                onClick={() => setCalcDeficit(id)}>
                                <div className="deficit-btn-label">
                                  {label} {calcObjetivo === 'emagrecer' ? `−${pct}%` : `+${pct}%`}
                                </div>
                                <div className="deficit-btn-cals">{cals.toLocaleString('pt-BR')}</div>
                                <div className="deficit-btn-desc">{desc}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* Botão único Usar → */}
                    <button
                      className="btn"
                      style={{ marginTop:14, width:'100%' }}
                      disabled={calcObjetivo !== 'manter' && calcDeficit === null}
                      onClick={() => {
                        if (calcObjetivo === 'manter') {
                          useDietCals(calcResult.manter, 'manter')
                        } else {
                          const pcts = { leve:10, mod:15, agr:20 }
                          const pct  = pcts[calcDeficit!]
                          const cals = calcObjetivo === 'emagrecer'
                            ? Math.round(calcResult.tdee * (1 - pct / 100))
                            : Math.round(calcResult.tdee * (1 + pct / 100))
                          useDietCals(cals, calcObjetivo)
                        }
                      }}>
                      🧮 Usar →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Seção: Gerar Dieta ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('dieta')}>
              <div className="config-section-title-group">
                <span>🍽️ Gerar Dieta</span>
                <span className="config-section-desc">Monte seu cardápio automático</span>
              </div>
              <span className={`config-section-arrow ${configSections.dieta ? 'open' : ''}`}>▼</span>
            </div>
            {configSections.dieta && (
              <div className="config-section-body">
                {onboardingStep === 3 && (
                  <div className="onboarding-banner" style={{ marginBottom:12, marginTop:8 }}>
                    <span className="onboarding-step-badge">Passo 2 / 2</span>
                    <div className="onboarding-banner-text">
                      <strong>Quase lá!</strong> Clique em <strong>"Gerar Dieta"</strong>,
                      revise os alimentos e clique <strong>"Salvar como Meu Cardápio"</strong>.
                    </div>
                  </div>
                )}
                <div className="calc-field" style={{ marginTop:8 }}>
                  <label className="calc-label">Meta calórica diária</label>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input type="number" className="login-input" style={{ flex:1 }}
                      value={dietTarget} onChange={e => setDietTarget(e.target.value)} placeholder="Ex: 1600" />
                    <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>kcal/dia</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>
                    Use <strong>Calcular</strong> acima para obter o valor ideal para você.
                  </div>
                </div>
                <div className="calc-field" style={{ marginTop:12 }}>
                  <label className="calc-label">Preferência de alimentos</label>
                  <div className="calc-obj-row">
                    <button className={`calc-obj-btn ${!dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(false)}>✨ Melhor qualidade</button>
                    <button className={`calc-obj-btn ${dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(true)}>💰 Simples / Barato</button>
                  </div>
                </div>
                <button className="btn" style={{ marginTop:14 }} onClick={handleGenerateDiet}
                  disabled={!dietTarget || parseInt(dietTarget) < 500}>
                  🚀 Gerar Dieta Automaticamente
                </button>

                {generatedDiet && (() => {
                  const totalKcal = generatedDiet.reduce((s, m) => s + m.actualKcal, 0)
                  const target    = parseInt(dietTarget) || 1
                  const totalP    = generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.p, 0)
                  const totalC    = generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.c, 0)
                  const totalF    = generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.f, 0)
                  const diff      = totalKcal - target
                  const diffColor = Math.abs(diff) <= 100 ? 'var(--success)' : diff > 0 ? 'var(--error)' : 'var(--warning)'
                  const diffText  = Math.abs(diff) <= 100 ? '✅ No alvo' : diff > 0 ? `+${diff} kcal acima` : `${Math.abs(diff)} kcal abaixo`
                  return (
                    <>
                      <div className="diet-gen-summary">
                        <div className="diet-gen-total">
                          {totalKcal.toLocaleString('pt-BR')} kcal
                          <span className="diet-gen-pct" style={{ color: diffColor }}> · {diffText}</span>
                        </div>
                        <div className="diet-gen-macros-row">
                          <span>P {totalP.toFixed(0)}g</span>
                          <span>C {totalC.toFixed(0)}g</span>
                          <span>G {totalF.toFixed(0)}g</span>
                        </div>
                        {Math.abs(diff) > 150 && (
                          <button className="btn btn-small btn-cancel" style={{ width:'auto', marginTop:6 }} onClick={handleGenerateDiet}>
                            🔄 Reajustar para meta
                          </button>
                        )}
                        <button className="btn" style={{ marginTop:8, width:'100%' }} onClick={saveDiet}>
                          💾 Salvar como Meu Cardápio
                        </button>
                      </div>

                      {generatedDiet.map((meal, mi) => (
                        <div key={meal.mealId} className="diet-gen-meal">
                          <div className="diet-gen-meal-header">
                            <span className="diet-gen-meal-title">{meal.title}</span>
                            <span className="diet-gen-meal-kcal">
                              {meal.actualKcal} kcal
                              <span className="diet-gen-pct"> ({Math.round(meal.actualKcal / target * 100)}%)</span>
                            </span>
                          </div>
                          {meal.items.map((item, ii) => (
                            <div key={ii} className="diet-gen-item">
                              <div className="diet-gen-item-body">
                                <div className="diet-gen-item-name">
                                  {item.food.nome}
                                  {item.food.id === -1 && <span className="diet-ia-badge"> IA</span>}
                                </div>
                                <div className="diet-gen-item-detail">
                                  {item.grams}g · {item.kcal} kcal · P{item.p}g · C{item.c}g · G{item.f}g
                                  {BUDGET_IDS.has(item.food.id) && <span className="diet-budget-badge"> 💰</span>}
                                </div>
                              </div>
                              <button className="diet-sub-btn" title="Substituir" onClick={() => openDietSubModal(mi, ii)}>🔄</button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ── Seção: Meu Cardápio ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('cardapio')}>
              <div className="config-section-title-group">
                <span>📋 Meu Cardápio</span>
                <span className="config-section-desc">Edite e organize seus alimentos</span>
              </div>
              <span className={`config-section-arrow ${configSections.cardapio ? 'open' : ''}`}>▼</span>
            </div>
            {configSections.cardapio && (
              <div className="config-section-body">
                {/* ── Buscar TACO ── */}
                <div style={{ display:'flex', gap:6, marginBottom:16, marginTop:8 }}>
                  <button className="btn btn-small" style={{ width:'auto' }} onClick={() => openTACO(0)}>🥗 Buscar TACO</button>
                </div>

                {/* ── Adicionar alimento manual ── */}
                <div className="quick-add-form">
                  <div className="quick-add-title">+ Adicionar alimento</div>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="Nome do alimento (ex: Frango grelhado 150g)"
                    value={quickAddName}
                    onChange={e => setQuickAddName(e.target.value)}
                  />
                  <div className="quick-add-row">
                    <select className="login-input" value={quickAddMeal} onChange={e => setQuickAddMeal(Number(e.target.value))}>
                      {meals.map((m, i) => <option key={m.id} value={i}>{m.title}</option>)}
                    </select>
                    <input type="number" className="login-input" placeholder="kcal" min="0"
                      value={quickAddKcal} onChange={e => setQuickAddKcal(e.target.value)} />
                  </div>
                  <div className="quick-add-macros">
                    <div className="quick-add-macro-field">
                      <label>Proteína (g)</label>
                      <input type="number" className="login-input" placeholder="0" min="0" step="0.1"
                        value={quickAddP} onChange={e => setQuickAddP(e.target.value)} />
                    </div>
                    <div className="quick-add-macro-field">
                      <label>Carbo (g)</label>
                      <input type="number" className="login-input" placeholder="0" min="0" step="0.1"
                        value={quickAddC} onChange={e => setQuickAddC(e.target.value)} />
                    </div>
                    <div className="quick-add-macro-field">
                      <label>Gordura (g)</label>
                      <input type="number" className="login-input" placeholder="0" min="0" step="0.1"
                        value={quickAddF} onChange={e => setQuickAddF(e.target.value)} />
                    </div>
                  </div>
                  <button
                    className="btn btn-small"
                    style={{ marginTop:4, width:'auto' }}
                    disabled={!quickAddName.trim() || !quickAddKcal || parseInt(quickAddKcal) <= 0}
                    onClick={handleQuickAdd}>
                    Adicionar
                  </button>
                </div>

                {meals.map((meal, mealIdx) => (
                  <div key={meal.id} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--primary)', marginBottom:8 }}>
                      {meal.title} · ~{(meal.items ?? []).reduce((s,it)=>s+it.kcal,0)} kcal
                    </div>
                    {(meal.items ?? []).map(item => (
                      <div key={item.id} className="config-item-row">
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{macroDesc(item)}</div>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="config-reset-btn" onClick={() => openItemModal('edit', mealIdx, item)}>Editar</button>
                          <button className="config-reset-btn" style={{ color:'var(--warning)' }} onClick={() => deleteMealItem(mealIdx, item.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      <button className="config-reset-btn" style={{ flex:1, textAlign:'center' }}
                        onClick={() => openItemModal('add', mealIdx)}>+ Adicionar manual</button>
                      <button className="config-reset-btn" style={{ flex:1, textAlign:'center' }}
                        onClick={() => openTACO(mealIdx)}>🥗 Buscar TACO</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Seção: Substituidores ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('subs')}>
              <div className="config-section-title-group">
                <span>🔄 Substituidores</span>
                <span className="config-section-desc">Gerencie alternativas por alimento</span>
              </div>
              <span className={`config-section-arrow ${configSections.subs ? 'open' : ''}`}>▼</span>
            </div>
            {configSections.subs && (
              <div className="config-section-body">
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12, marginTop:8 }}>
                  <button className="btn btn-small" style={{ width:'auto' }} onClick={() => openSubModal()}>+ Adicionar</button>
                </div>
                {meals.map(meal => (meal.items ?? []).map(item => {
                  const alts = alternatives[item.id] || []
                  return (
                    <div key={item.id} style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{meal.title} → {item.name}</div>
                        <button className="config-reset-btn" onClick={() => openSubModal(item.id)}>+ sub</button>
                      </div>
                      {alts.length === 0
                        ? <div style={{ fontSize:12, color:'var(--text-secondary)', paddingLeft:8 }}>Nenhum substituidor</div>
                        : alts.map(alt => (
                            <div key={alt.id} className="config-item-row">
                              <div>
                                <div style={{ fontSize:13 }}>{alt.name}</div>
                                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{macroDesc(alt)}</div>
                              </div>
                              <button className="config-reset-btn" onClick={() => deleteAlt(item.id, alt.id)}>✕</button>
                            </div>
                          ))
                      }
                    </div>
                  )
                }))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ══ Bottom Navigation (mobile only) ══ */}
      <nav className="bottom-nav">
        {[
          { id:'hoje',         icon:'📋', label:'Hoje'   },
          { id:'peso',         icon:'⚖️', label:'Peso'   },
          { id:'estatísticas', icon:'📊', label:'Stats'  },
          { id:'config',       icon:'⚙️', label:'Config' },
        ].map(t => (
          <button key={t.id}
            className={`bottom-nav-btn ${activeTab === t.id ? 'active' : ''}`}
            disabled={inAutoSetup && t.id !== 'config'}
            onClick={() => setActiveTab(t.id)}>
            <span className="bottom-nav-icon">{t.icon}</span>
            <span className="bottom-nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <footer>💪 Consistência vence tudo. Você consegue!</footer>
    </div>
  )
}
