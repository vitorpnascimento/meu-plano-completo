'use client'

import { useState, useEffect, useCallback } from 'react'
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

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface MealItem {
  id:   string
  name: string
  kcal: number
  p:    number
  c:    number
  f:    number
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

function getFeedback(cals: number, calMeta: number, calMax: number) {
  if (cals < calMeta) return { msg: `Você comeu pouco! Margem: +${calMeta - cals} kcal pra próximos dias ✅`, color: 'var(--warning)', badge: '🟡' }
  if (cals <= calMax)  return { msg: 'Perfeito! Dia dentro da meta 🎯',                                           color: 'var(--success)', badge: '🟢' }
  return                       { msg: `Passou da meta em ${cals - calMax} kcal. Pode compensar amanhã 💪`,        color: 'var(--warning)', badge: '🔴' }
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
  const [activeTab,    setActiveTab]    = useState('hoje')
  const [statsSubTab,  setStatsSubTab]  = useState<'diario'|'semanal'|'mensal'>('diario')
  const [openAlt,      setOpenAlt]      = useState<string|null>(null)

  const [showFinalize,      setShowFinalize]      = useState(false)
  const [finObs,            setFinObs]            = useState('')
  const [finExtras,         setFinExtras]         = useState('')
  const [showWeightHistory, setShowWeightHistory] = useState(false)

  const [itemModal, setItemModal] = useState<null|{ mode:'edit'|'add'; mealIdx:number; item?:MealItem }>(null)
  const [itemForm,  setItemForm]  = useState(BLANK_ITEM_FORM)
  const [subModal,  setSubModal]  = useState(false)
  const [subForm,   setSubForm]   = useState(BLANK_SUB_FORM)

  // ── Lembretes ───────────────────────────────────────────────────────────────
  const DEFAULT_REMINDER_TIMES = { cafe:'07:00', almoco:'12:00', lanche:'15:00', jantar:'19:00', ceia:'21:00' }
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderTimes,    setReminderTimes]    = useState(DEFAULT_REMINDER_TIMES)
  const [reminderDraft,    setReminderDraft]    = useState(DEFAULT_REMINDER_TIMES)
  const [notifPermission,  setNotifPermission]  = useState<NotificationPermission>('default')

  // ── Relatório ────────────────────────────────────────────────────────────────
  const [showReport,    setShowReport]    = useState(false)
  const [reportPeriod,  setReportPeriod]  = useState<ReportPeriod>('weekly')
  const [reportAnchor,  setReportAnchor]  = useState(new Date().toISOString().split('T')[0])
  const [reportResult,  setReportResult]  = useState<ReportData | null>(null)
  const [reportStep,    setReportStep]    = useState<'select'|'view'>('select')

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
        items: Array.isArray(m?.items)
          ? m.items
          : m?.items && typeof m.items === 'object'
            ? Object.values(m.items)
            : [],
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
          // Novo usuário: dados zerados
          applyData({ meals: NEW_USER_MEALS, userGoals: NEW_USER_GOALS })
          setSyncStatus('idle')
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

  // ── Carrega configurações de lembrete do localStorage ──────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('reminderSettings')
    if (raw) {
      try {
        const s = JSON.parse(raw)
        if (typeof s.enabled === 'boolean') setRemindersEnabled(s.enabled)
        if (s.times && typeof s.times === 'object') {
          setReminderTimes(t => ({ ...t, ...s.times }))
          setReminderDraft(t => ({ ...t, ...s.times }))
        }
      } catch {}
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }
  }, [])

  // ── Intervalo de verificação de lembretes ──────────────────────────────────
  useEffect(() => {
    if (!remindersEnabled) return
    const firedKeys = new Set<string>()
    const MEAL_LABELS: Record<string, string> = {
      cafe:'Café da Manhã', almoco:'Almoço', lanche:'Lanche', jantar:'Jantar', ceia:'Ceia',
    }
    const check = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const now = new Date()
      const hm  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const day = now.toISOString().split('T')[0]
      for (const [meal, time] of Object.entries(reminderTimes)) {
        const key = `${day}_${meal}_${time}`
        if (time === hm && !firedKeys.has(key)) {
          firedKeys.add(key)
          const n = new Notification(`🔔 Hora do ${MEAL_LABELS[meal]}!`, {
            body: 'Toque para registrar sua refeição',
            tag:  `mealreminder_${meal}`,
          })
          n.onclick = () => { window.focus(); setActiveTab('hoje'); n.close() }
        }
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [remindersEnabled, reminderTimes])

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

  // ── Ações: Lembretes ────────────────────────────────────────────────────────

  const requestNotifPermission = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (typeof Notification === 'undefined') {
      alert('Notificações não são suportadas neste navegador. No iPhone, tente adicionar o app à Tela de Início e abrir de lá.')
      return
    }
    try {
      const p = await Notification.requestPermission()
      setNotifPermission(p)
      if (p === 'granted') {
        new Notification('🎉 Lembretes ativados!', { body: 'Você receberá notificações nos horários configurados.' })
      }
    } catch {
      alert('Não foi possível solicitar permissão de notificação neste navegador.')
    }
  }

  const toggleReminders = (enabled: boolean) => {
    setRemindersEnabled(enabled)
    const stored = localStorage.getItem('reminderSettings')
    const curr   = stored ? (() => { try { return JSON.parse(stored) } catch { return {} } })() : {}
    localStorage.setItem('reminderSettings', JSON.stringify({ ...curr, enabled }))
  }

  const saveReminderSettings = () => {
    setReminderTimes(reminderDraft)
    localStorage.setItem('reminderSettings', JSON.stringify({ enabled: remindersEnabled, times: reminderDraft }))
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

  // ── Cálculos hoje ───────────────────────────────────────────────────────────

  const today        = getToday()
  const todayChecked = checked[today] || {}
  const { cals: totalCals, p: totalP, c: totalC, f: totalF } = calcDayMacros(meals, todayChecked, activeSubs)
  const mealsCompleted  = meals.filter(m => (m.items ?? []).length > 0 && (m.items ?? []).every(it => todayChecked[it.id])).length
  const todayStat       = dayStats[today]
  const todayFinished   = todayStat?.finalizado || false
  const todayCalTotal   = todayStat?.caloriasTotal ?? totalCals
  const todayFeedback   = getFeedback(todayCalTotal, CAL_META, CAL_MAX)

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

  // ── JSX principal ────────────────────────────────────────────────────────────

  return (
    <div>

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

      {/* ── Header ── */}
      <header>
        <div className="header-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>💪 Meu Plano</h1>
              <div className="subtitle">Acompanhamento de Dieta & Treino</div>
            </div>
            {firebaseConfigured && syncStatus !== 'unconfigured' && (
              <div className={`sync-badge sync-badge--${syncStatus}`}>
                {SYNC_ICON[syncStatus]}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        <div className="tabs">
          {[
            { id:'hoje',         label:'Hoje'      },
            { id:'peso',         label:'Peso'      },
            { id:'estatísticas', label:'📊 Stats'  },
            { id:'config',       label:'⚙️ Config' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ HOJE */}
        <div className={`tab-content ${activeTab === 'hoje' ? 'active' : ''}`}>

          <div className="week-status-card" style={{ borderColor: weekBadgeColor }}
            onClick={() => { setActiveTab('estatísticas'); setStatsSubTab('semanal') }}>
            <div className="week-status-left">
              <div className="week-status-title">📊 Status da semana</div>
              <div className="week-status-text" style={{ color: weekBadgeColor }}>
                {weekDiff < -200 ? '🟡' : weekDiff > 200 ? '🔴' : '🟢'} {weekBadgeText}
              </div>
              <div className="week-status-sub">{weekFin}/7 dias finalizados · clique pra ver detalhes</div>
            </div>
          </div>

          {todayFinished ? (
            <div className="day-finalized-card">
              <div style={{ fontSize: 28 }}>✅</div>
              <div>
                <div className="day-finalized-title">Dia Finalizado às {todayStat.timestamp}</div>
                <div className="day-finalized-feedback" style={{ color: todayFeedback.color }}>{todayFeedback.msg}</div>
                {todayStat.observacoes && <div className="day-finalized-obs">"{todayStat.observacoes}"</div>}
              </div>
            </div>
          ) : (
            <button className="btn btn-finalizar" onClick={() => setShowFinalize(true)}>🏁 Finalizar Dia</button>
          )}

          <div className="stats">
            <div className="stat-box"><div className="stat-value">{mealsCompleted}/{meals.length}</div><div className="stat-label">Refeições</div></div>
            <div className="stat-box"><div className="stat-value">{totalCals}</div><div className="stat-label">kcal</div></div>
            <div className="stat-box"><div className="stat-value">{Math.min(100, Math.round((totalCals / CAL_META) * 100))}%</div><div className="stat-label">Meta</div></div>
          </div>

          <div className="card">
            <div className="card-title">Macronutrientes (Tempo Real)</div>
            <div className="macros-grid">
              {[
                { label:'Proteína',    val: totalP, meta: userGoals.p },
                { label:'Carboidrato', val: totalC, meta: userGoals.c },
                { label:'Gordura',     val: totalF, meta: userGoals.f },
              ].map(({ label, val, meta }) => (
                <div key={label} className="macro-box">
                  <div className="macro-label">{label}</div>
                  <div className="macro-value">{val}g</div>
                  <div className="macro-goal">Meta: {meta}g</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (val/meta)*100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

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
          ) : meals.map(meal => (
            <div key={meal.id} className="card">
              <div className="card-title">
                {meal.title} · ~{(meal.items ?? []).reduce((s, it) => s + it.kcal, 0)} kcal
              </div>
              {(meal.items ?? []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Nenhum alimento — adicione em Config
                </div>
              ) : (meal.items ?? []).map(item => {
                const subActive = activeSubs[item.id]
                const display   = subActive || item
                const alts      = alternatives[item.id] || []
                const isOpen    = openAlt === item.id
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
                    {(alts.length > 0 || subActive) && (
                      <div className="alt-wrap" onClick={e => e.stopPropagation()}>
                        <button className="alt-btn" onClick={() => setOpenAlt(isOpen ? null : item.id)}>🔄</button>
                        {isOpen && (
                          <div className="alt-dropdown">
                            {subActive && (
                              <div className="alt-option alt-original" onClick={() => chooseSub(item.id, null)}>
                                ↩ {item.name} (original)
                              </div>
                            )}
                            {alts.filter(a => a.id !== subActive?.id).map(alt => (
                              <div key={alt.id} className="alt-option" onClick={() => chooseSub(item.id, alt)}>
                                <div>{alt.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{macroDesc(alt)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
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

          {/* ── Conta ── */}
          {firebaseConfigured && authUser && (
            <div className="card">
              <div className="card-title">👤 Minha Conta</div>
              <div className="account-row">
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

          {/* ── Firebase Rules (info) ── */}
          {firebaseConfigured && authUser && (
            <div className="card">
              <div className="card-title">🔒 Segurança Firebase</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                Configure as regras abaixo no Firebase Console → Realtime Database → Rules para garantir que cada usuário só acesse seus próprios dados:
              </div>
              <div className="sync-code-block">
                {`{\n  "rules": {\n    "users": {\n      "$uid": {\n        ".read":  "auth != null && auth.uid == $uid",\n        ".write": "auth != null && auth.uid == $uid"\n      }\n    }\n  }\n}`}
              </div>
            </div>
          )}

          {/* ── Lembretes de Refeição ── */}
          <div className="card">
            <div className="card-title">🔔 Lembretes de Refeição</div>

            {(() => {
              const notifSupported = typeof window !== 'undefined' && 'Notification' in window
              const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
              const isStandalone = typeof window !== 'undefined' && (window.navigator as any).standalone === true

              if (!notifSupported) {
                if (isIOS && !isStandalone) {
                  // iOS Safari: Web Notifications não suportadas fora de PWA
                  return (
                    <div className="reminder-banner reminder-banner--info">
                      <span style={{ lineHeight: 1.4 }}>
                        No iPhone, notificações funcionam apenas como app instalado.{' '}
                        <strong>Adicione à Tela de Início</strong> (Safari → Compartilhar → Adicionar à Tela de Início) e abra de lá.
                      </span>
                    </div>
                  )
                }
                return (
                  <div className="reminder-banner reminder-banner--denied">
                    Notificações não suportadas neste navegador.
                  </div>
                )
              }

              if (notifPermission === 'default') {
                return (
                  <div className="reminder-banner">
                    <span>Permita notificações para receber lembretes</span>
                    <button
                      className="btn btn-small"
                      style={{ width:'auto', flexShrink:0 }}
                      onClick={requestNotifPermission}
                      onTouchEnd={requestNotifPermission}
                    >
                      Permitir
                    </button>
                  </div>
                )
              }

              if (notifPermission === 'denied') {
                return (
                  <div className="reminder-banner reminder-banner--denied">
                    Notificações bloqueadas. Vá em Configurações do navegador e permita notificações para este site.
                  </div>
                )
              }

              // granted — mostra status positivo
              return (
                <div className="reminder-banner reminder-banner--granted">
                  ✅ Notificações permitidas
                </div>
              )
            })()}

            <div className="reminder-toggle-row">
              <span style={{ fontSize:14, fontWeight:500 }}>Ativar Lembretes</span>
              <button
                className={`toggle-btn ${remindersEnabled ? 'toggle-on' : 'toggle-off'}`}
                onClick={() => toggleReminders(!remindersEnabled)}
                disabled={notifPermission === 'denied' || (typeof window !== 'undefined' && !('Notification' in window))}
              >
                {remindersEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div style={{ marginTop:12 }}>
              {([
                { key:'cafe',   label:'Café da Manhã' },
                { key:'almoco', label:'Almoço'        },
                { key:'lanche', label:'Lanche'        },
                { key:'jantar', label:'Jantar'        },
                { key:'ceia',   label:'Ceia'          },
              ] as const).map(({ key, label }) => (
                <div key={key} className="reminder-time-row">
                  <span className="reminder-time-label">⏰ {label}</span>
                  <input
                    type="time"
                    className="reminder-time-input"
                    value={reminderDraft[key]}
                    onChange={e => setReminderDraft(d => ({ ...d, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <button className="btn" style={{ marginTop:12 }} onClick={saveReminderSettings}>
              💾 Salvar Horários
            </button>
          </div>

          {/* ── Minhas Metas ── */}
          <div className="card">
            <div className="card-title">Minhas Metas</div>
            <div className="config-goals">
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

          {/* ── Gerenciar Substituidores ── */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="card-title" style={{ marginBottom:0 }}>Gerenciar Substituidores</div>
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

          {/* ── Meu Cardápio ── */}
          <div className="card">
            <div className="card-title">Meu Cardápio</div>
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
                <button className="config-reset-btn" style={{ marginTop:8, width:'100%', textAlign:'center' }}
                  onClick={() => openItemModal('add', mealIdx)}>
                  + Adicionar item
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>

      <footer>💪 Consistência vence tudo. Você consegue!</footer>
    </div>
  )
}
