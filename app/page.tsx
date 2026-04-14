'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

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

// ─── Defaults ──────────────────────────────────────────────────────────────────

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

const DEFAULT_GOALS = { cals: 1963, p: 214, c: 161, f: 43 }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcDayMacros(
  meals:      Meal[],
  dayChecked: Record<string, boolean>,
  activeSubs: Record<string, SubOption>,
) {
  let cals = 0, p = 0, c = 0, f = 0
  for (const meal of meals) {
    for (const item of meal.items) {
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

// ─── Componente ────────────────────────────────────────────────────────────────

const BLANK_ITEM_FORM = { name: '', kcal: '', p: '', c: '', f: '' }
const BLANK_SUB_FORM  = { name: '', kcal: '', p: '', c: '', f: '', targetId: '' }

export default function Home() {
  // Cardápio dinâmico
  const [meals,          setMeals]          = useState<Meal[]>(DEFAULT_MEALS)
  const [alternatives,   setAlternatives]   = useState<Record<string, SubOption[]>>(DEFAULT_ALTERNATIVES)
  const [activeSubs,     setActiveSubs]     = useState<Record<string, SubOption>>({})

  // Checkboxes (id-based, por data)
  const [checked,        setChecked]        = useState<Record<string, Record<string, boolean>>>({})

  // Stats e peso
  const [dayStats,       setDayStats]       = useState<Record<string, any>>({})
  const [weightsData,    setWeightsData]    = useState<Record<string, any>>({})
  const [weightPhoto,    setWeightPhoto]    = useState('')
  const [userGoals,      setUserGoals]      = useState(DEFAULT_GOALS)

  // UI
  const [activeTab,      setActiveTab]      = useState('hoje')
  const [statsSubTab,    setStatsSubTab]    = useState<'diario'|'semanal'|'mensal'>('diario')
  const [openAlt,        setOpenAlt]        = useState<string|null>(null)

  // Modal: Dia Finalizado
  const [showFinalize,   setShowFinalize]   = useState(false)
  const [finObs,         setFinObs]         = useState('')
  const [finExtras,      setFinExtras]      = useState('')

  // Modal: Histórico de Peso
  const [showWeightHistory, setShowWeightHistory] = useState(false)

  // Modal: Editar / Adicionar Item do Cardápio
  const [itemModal, setItemModal] = useState<null|{ mode:'edit'|'add'; mealIdx:number; item?:MealItem }>(null)
  const [itemForm,  setItemForm]  = useState(BLANK_ITEM_FORM)

  // Modal: Adicionar Substituidor
  const [subModal,  setSubModal]  = useState(false)
  const [subForm,   setSubForm]   = useState(BLANK_SUB_FORM)

  const getToday = () => new Date().toISOString().split('T')[0]
  const CAL_META = userGoals.cals
  const CAL_MAX  = userGoals.cals + 200

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem('dietAppData')
    if (!raw) return
    const d = JSON.parse(raw)
    if (d.meals?.[0]?.items?.[0]?.id) setMeals(d.meals)
    if (d.alternatives)  setAlternatives({ ...DEFAULT_ALTERNATIVES, ...d.alternatives })
    if (d.activeSubs)    setActiveSubs(d.activeSubs)
    if (d.checked)       setChecked(d.checked)
    if (d.dayStats)      setDayStats(d.dayStats)
    // suporta chave nova (weightHistory) e antiga (weights)
    if (d.weightHistory) setWeightsData(d.weightHistory)
    else if (d.weights)  setWeightsData(d.weights)
    if (d.userGoals)     setUserGoals(d.userGoals)
  }, [])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!openAlt) return
    const fn = () => setOpenAlt(null)
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [openAlt])

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = (overrides: Record<string,any> = {}) => {
    localStorage.setItem('dietAppData', JSON.stringify({
      meals, alternatives, activeSubs, checked, dayStats,
      weightHistory: weightsData, userGoals, ...overrides,
    }))
  }

  // ── Ações: Hoje ────────────────────────────────────────────────────────────

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

  // ── Ações: Peso ────────────────────────────────────────────────────────────

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

  // ── Ações: Metas ───────────────────────────────────────────────────────────

  const updateGoal = (key: keyof typeof DEFAULT_GOALS, val: string) => {
    const num = parseInt(val); if (isNaN(num) || num <= 0) return
    const ng = { ...userGoals, [key]: num }
    setUserGoals(ng); save({ userGoals: ng })
  }

  const resetGoals = () => { setUserGoals(DEFAULT_GOALS); save({ userGoals: DEFAULT_GOALS }) }

  // ── Ações: Cardápio ────────────────────────────────────────────────────────

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
    const nm = meals.map((m, mi) => mi !== mealIdx ? m : { ...m, items: m.items.filter(it => it.id !== itemId) })
    const na = { ...alternatives }; delete na[itemId]
    const nas = { ...activeSubs };  delete nas[itemId]
    setMeals(nm); setAlternatives(na); setActiveSubs(nas)
    save({ meals: nm, alternatives: na, activeSubs: nas })
  }

  // ── Ações: Substituidores ──────────────────────────────────────────────────

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
    const na = { ...alternatives, [itemId]: (alternatives[itemId] || []).filter(a => a.id !== altId) }
    setAlternatives(na)
    const nas = { ...activeSubs }
    if (nas[itemId]?.id === altId) delete nas[itemId]
    setActiveSubs(nas); save({ alternatives: na, activeSubs: nas })
  }

  // ── Cálculos hoje ──────────────────────────────────────────────────────────

  const today       = getToday()
  const todayChecked = checked[today] || {}
  const { cals: totalCals, p: totalP, c: totalC, f: totalF } = calcDayMacros(meals, todayChecked, activeSubs)
  const mealsCompleted = meals.filter(m => m.items.length > 0 && m.items.every(it => todayChecked[it.id])).length
  const todayStat      = dayStats[today]
  const todayFinished  = todayStat?.finalizado || false
  const todayCalTotal  = todayStat?.caloriasTotal ?? totalCals
  const todayFeedback  = getFeedback(todayCalTotal, CAL_META, CAL_MAX)

  // ── Histórico de peso ──────────────────────────────────────────────────────

  const weightHistoryAsc = Object.entries(weightsData as Record<string, any>)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, entry]) => ({
      date,
      label:    dateLabel(date),
      peso:     rawPeso(entry),
      foto:     rawFoto(entry),
      calorias: rawCalorias(entry),
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
    ? +((totalLoss / daysBetween) * 7).toFixed(2)
    : null

  // ── Estatísticas ───────────────────────────────────────────────────────────

  const weekDates  = getLastNDates(7)
  const monthDates = getLastNDates(30)

  const weeklyChartData = weekDates.map(d => ({
    label: dateLabel(d),
    cals:  calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0),
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

  const weekFin       = weekDates.filter(d => dayStats[d]?.finalizado).length
  const weekTotal     = weeklyChartData.reduce((s, d) => s + d.cals, 0)
  const weekMeta      = CAL_META * 7
  const weekDiff      = weekTotal - weekMeta

  const weekWeightData = weekDates
    .map(d => ({ label: dateLabel(d), peso: rawPeso(weightsData[d]) }))
    .filter(d => d.peso !== null) as { label:string; peso:number }[]

  const weightTrend = monthDates
    .map(d => ({ label: dateLabel(d), peso: rawPeso(weightsData[d]) }))
    .filter(d => d.peso !== null) as { label:string; peso:number }[]

  // Gráfico duplo (peso + calorias) para Estatísticas
  const dualChartData = monthDates
    .map(d => {
      const peso = rawPeso(weightsData[d])
      const cals = calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0)
      return {
        label: dateLabel(d),
        peso:  peso ?? undefined,
        cals:  cals > 0 ? cals : undefined,
      }
    })
    .filter(d => d.peso !== undefined || d.cals !== undefined)

  // Peso semana: primeiro e último com registro
  const weekFirstW     = weekWeightData[0]?.peso ?? null
  const weekLastW      = weekWeightData[weekWeightData.length - 1]?.peso ?? null
  const weekWeightDiff = weekFirstW !== null && weekLastW !== null ? +((weekLastW - weekFirstW).toFixed(1)) : null

  const weekBadgeColor = weekDiff < -200 ? 'var(--warning)' : weekDiff > 200 ? '#e53935' : 'var(--success)'
  const weekBadgeText  = weekDiff < 0 ? `${Math.abs(weekDiff)} kcal abaixo` : weekDiff > 0 ? `${weekDiff} kcal acima` : 'Semana no alvo'

  const allItemOptions = meals.flatMap(m => m.items.map(it => ({ id: it.id, label: `${m.title} → ${it.name}` })))

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ══ Modal: Histórico de Peso ══ */}
      {showWeightHistory && (
        <div className="modal-overlay" onClick={() => setShowWeightHistory(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📊 Histórico de Peso</div>

            {/* Stats rápidas */}
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

            {/* Gráfico evolução */}
            {weightHistoryAsc.length >= 2 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Evolução do Peso</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={weightHistoryAsc} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }}
                      formatter={(v: any) => [`${v}kg`, 'Peso']}
                    />
                    <Line type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela */}
            {weightHistoryAsc.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table className="wh-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Peso</th>
                      <th>Foto</th>
                      <th>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weightHistoryDesc.map((e, i) => {
                      const prev = weightHistoryDesc[i + 1]
                      const diff = prev ? +((e.peso - prev.peso).toFixed(1)) : null
                      return (
                        <tr key={e.date}>
                          <td>{new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{e.peso}kg</td>
                          <td>
                            {e.foto
                              ? <img src={e.foto} alt="" className="wh-thumb" />
                              : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                            }
                          </td>
                          <td style={{
                            fontWeight: 500, fontSize: 13,
                            color: diff === null ? 'var(--text-secondary)'
                              : diff < 0 ? 'var(--success)'
                              : diff > 0 ? 'var(--warning)'
                              : 'var(--text-secondary)',
                          }}>
                            {diff === null ? '—'
                              : `${diff > 0 ? '+' : ''}${diff}kg ${diff < 0 ? '✅' : diff > 0 ? '📈' : ''}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                Nenhum registro ainda. Registre seu peso na aba Peso!
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

      {/* ── Header ── */}
      <header>
        <div className="header-content">
          <h1>💪 Meu Plano</h1>
          <div className="subtitle">Acompanhamento de Dieta & Treino</div>
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

          {/* Refeições */}
          {meals.map(meal => (
            <div key={meal.id} className="card">
              <div className="card-title">
                {meal.title} · ~{meal.items.reduce((s, it) => s + it.kcal, 0)} kcal
              </div>
              {meal.items.map(item => {
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

          {/* Peso de hoje em destaque */}
          {todayWeight !== null ? (
            <div className="card today-weight-card">
              <div className="today-weight-date">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </div>
              <div className="today-weight-value">{todayWeight}</div>
              <div className="today-weight-unit">kg</div>
              {todayWeightFoto && (
                <img src={todayWeightFoto} alt="Foto de hoje" className="today-weight-photo" />
              )}
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

          {/* Formulário de registro */}
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

          {/* ── Seu Progresso (sempre visível, acima das sub-tabs) ── */}
          {(weightHistoryAsc.length >= 1 || dualChartData.some(d => d.cals !== undefined)) && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>📈 Seu Progresso</div>
                {weightHistoryAsc.length > 0 && (
                  <button className="btn btn-small" style={{ width: 'auto' }}
                    onClick={() => setShowWeightHistory(true)}>
                    Ver Histórico
                  </button>
                )}
              </div>

              {/* Gráfico duplo peso + calorias */}
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
                      <YAxis yAxisId="peso" orientation="left"  domain={['auto', 'auto']} tick={{ fill: 'var(--primary)', fontSize: 10 }} />
                      <YAxis yAxisId="cals" orientation="right" domain={[0, 'auto']}      tick={{ fill: 'var(--success)', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }}
                        formatter={(v: any, name: string) => name === 'peso' ? [`${v}kg`, 'Peso'] : [`${v}kcal`, 'Calorias']}
                      />
                      <Line yAxisId="peso" type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2}
                        dot={{ fill: 'var(--primary)', r: 3 }} name="peso" connectNulls />
                      <Line yAxisId="cals" type="monotone" dataKey="cals" stroke="var(--success)" strokeWidth={2}
                        dot={{ fill: 'var(--success)', r: 3 }} name="cals" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center', padding: '16px 0' }}>
                  Registre peso em pelo menos 2 dias para ver o gráfico de progresso.
                </div>
              )}

              {/* Insights automáticos */}
              <div>
                {totalLoss !== null && totalLoss > 0 && (
                  <div className="insight-item">
                    🏆 Você perdeu <strong>{totalLoss}kg</strong> desde o início ({weightHistoryAsc.length} registros)
                  </div>
                )}
                {totalLoss !== null && totalLoss < 0 && (
                  <div className="insight-item">
                    📈 Ganhou <strong>{Math.abs(totalLoss)}kg</strong> desde o início — ajuste a dieta se necessário
                  </div>
                )}
                {weeklyAvg !== null && weeklyAvg > 0 && (
                  <div className="insight-item">
                    📊 Tendência: perdendo <strong>{weeklyAvg}kg/semana</strong> {weeklyAvg >= 0.3 && weeklyAvg <= 1 ? '✅ bom ritmo!' : weeklyAvg > 1 ? '⚠️ ritmo muito alto' : ''}
                  </div>
                )}
                {weeklyAvg !== null && weeklyAvg <= 0 && (
                  <div className="insight-item">
                    📊 Tendência: <strong>estável</strong> — continue consistente
                  </div>
                )}
                {(() => {
                  const lastEntry = weightHistoryAsc[weightHistoryAsc.length - 1]
                  if (!lastEntry?.calorias) return null
                  const diff = CAL_META - lastEntry.calorias
                  return (
                    <div className="insight-item">
                      {diff > 100
                        ? `🟡 Calorias: margem de -${diff} kcal/dia — pode comer um pouco mais`
                        : diff < -100
                        ? `🔴 Calorias: ${Math.abs(diff)} kcal acima da meta no último registro`
                        : `🟢 Calorias dentro da meta no último registro`}
                    </div>
                  )
                })()}
                {weightHistoryAsc.length === 0 && (
                  <div className="insight-item" style={{ color: 'var(--text-secondary)' }}>
                    Registre seu peso na aba Peso para ver insights de progresso aqui.
                  </div>
                )}
              </div>
            </div>
          )}

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
              {/* Badge de peso semanal */}
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

          {/* Minhas Metas */}
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

          {/* Gerenciar Substituidores */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="card-title" style={{ marginBottom:0 }}>Gerenciar Substituidores</div>
              <button className="btn btn-small" style={{ width:'auto' }} onClick={() => openSubModal()}>+ Adicionar</button>
            </div>
            {meals.map(meal => meal.items.map(item => {
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

          {/* Meu Cardápio */}
          <div className="card">
            <div className="card-title">Meu Cardápio</div>
            {meals.map((meal, mealIdx) => (
              <div key={meal.id} style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--primary)', marginBottom:8 }}>
                  {meal.title} · ~{meal.items.reduce((s,it)=>s+it.kcal,0)} kcal
                </div>
                {meal.items.map(item => (
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
