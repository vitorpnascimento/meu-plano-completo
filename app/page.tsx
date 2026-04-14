'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

// ─── Constantes ────────────────────────────────────────────────────────────────

const MACROS_PER_ITEM = [
  // Café
  { kcal: 146, p: 13.3,  c: 0.6,  f: 9.5  },  // 2 ovos cozidos
  { kcal: 135, p: 4.2,   c: 24.4, f: 0.75 },  // 2 fatias pão francês
  { kcal: 108, p: 8.5,   c: 0.6,  f: 5.4  },  // 60g requeijão light
  // Almoço
  { kcal: 330, p: 62.0,  c: 0.0,  f: 7.2  },  // 200g frango cozido
  { kcal: 195, p: 4.05,  c: 42.3, f: 0.45 },  // 150g arroz cozido
  { kcal: 30,  p: 1.0,   c: 6.0,  f: 0.2  },  // 100g vegetais
  // Lanche
  { kcal: 135, p: 4.2,   c: 24.4, f: 0.75 },  // 2 fatias pão francês
  { kcal: 165, p: 31.0,  c: 0.0,  f: 3.6  },  // 100g frango cozido
  { kcal: 54,  p: 4.5,   c: 0.3,  f: 3.25 },  // 30g requeijão light
  // Jantar
  { kcal: 330, p: 62.0,  c: 0.0,  f: 7.2  },  // 200g frango cozido
  { kcal: 195, p: 4.05,  c: 42.3, f: 0.45 },  // 150g arroz cozido
  { kcal: 30,  p: 1.0,   c: 6.0,  f: 0.2  },  // 100g vegetais
  // Ceia
  { kcal: 120, p: 25.0,  c: 2.0,  f: 1.0  },  // 30g whey
  { kcal: 78,  p: 3.46,  c: 13.3, f: 1.38 },  // 20g aveia
]

const MEALS: [string, string[][]][] = [
  ["Refeição 1 — Café da Manhã (~389 kcal)", [
    ["2 Ovos Inteiros Cozidos",  "146 kcal | P: 13,3g C: 0,6g G: 9,5g"],
    ["2 Fatias Pão Francês",     "135 kcal | P: 4,2g C: 24,4g G: 0,75g"],
    ["60g Requeijão Light",      "108 kcal | P: 8,5g C: 0,6g G: 5,4g"],
  ]],
  ["Refeição 2 — Almoço (~555 kcal)", [
    ["200g Peito Frango Cozido", "330 kcal | P: 62g C: 0g G: 7,2g"],
    ["150g Arroz Cozido",        "195 kcal | P: 4,05g C: 42,3g G: 0,45g"],
    ["100g Vegetais Genéricos",  "30 kcal | P: 1g C: 6g G: 0,2g"],
  ]],
  ["Refeição 3 — Lanche (~354 kcal)", [
    ["2 Fatias Pão Francês",     "135 kcal | P: 4,2g C: 24,4g G: 0,75g"],
    ["100g Frango Cozido",       "165 kcal | P: 31g C: 0g G: 3,6g"],
    ["30g Requeijão Light",      "54 kcal | P: 4,5g C: 0,3g G: 3,25g"],
  ]],
  ["Refeição 4 — Jantar (~555 kcal)", [
    ["200g Peito Frango Cozido", "330 kcal | P: 62g C: 0g G: 7,2g"],
    ["150g Arroz Cozido",        "195 kcal | P: 4,05g C: 42,3g G: 0,45g"],
    ["100g Vegetais Genéricos",  "30 kcal | P: 1g C: 6g G: 0,2g"],
  ]],
  ["Refeição 5 — Ceia (~198 kcal)", [
    ["30g Whey Protein",         "120 kcal | P: 25g C: 2g G: 1g"],
    ["20g Aveia",                "78 kcal | P: 3,46g C: 13,3g G: 1,38g"],
  ]],
]

const MEAL_GROUPS = [3, 3, 3, 3, 2]
const MACRO_GOALS = { p: 228, c: 162, f: 41 }
const CAL_META = 2050
const CAL_MAX  = 2250

// ─── Helpers (fora do componente, sem estado) ──────────────────────────────────

function calcDayMacros(mealsData: Record<string, any>, date: string) {
  const dayMeals = mealsData[date] || {}
  let cals = 0, p = 0, c = 0, f = 0
  for (let i = 0; i < MACROS_PER_ITEM.length; i++) {
    if (dayMeals[i]) {
      cals += MACROS_PER_ITEM[i].kcal
      p    += MACROS_PER_ITEM[i].p
      c    += MACROS_PER_ITEM[i].c
      f    += MACROS_PER_ITEM[i].f
    }
  }
  return { cals, p, c, f }
}

function getFeedback(cals: number) {
  if (cals < CAL_META) {
    const diff = CAL_META - cals
    return { msg: `Você comeu pouco! Margem: +${diff} kcal pra próximos dias ✅`, color: 'var(--warning)', badge: '🟡' }
  }
  if (cals <= CAL_MAX) {
    return { msg: 'Perfeito! Dia dentro da meta 🎯', color: 'var(--success)', badge: '🟢' }
  }
  const diff = cals - CAL_MAX
  return { msg: `Passou da meta em ${diff} kcal. Sem problema! Pode compensar amanhã 💪`, color: 'var(--warning)', badge: '🔴' }
}

function dateLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getLastNDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function Home() {
  const [activeTab,      setActiveTab]      = useState('hoje')
  const [mealsData,      setMealsData]      = useState<Record<string, any>>({})
  const [dayStats,       setDayStats]       = useState<Record<string, any>>({})
  const [weightsData,    setWeightsData]    = useState<Record<string, any>>({})
  const [notesData,      setNotesData]      = useState<Record<string, any>>({})
  const [trainingData,   setTrainingData]   = useState<Record<string, any>>({})
  const [mealCheckboxes, setMealCheckboxes] = useState<boolean[]>([])
  const [weightPhoto,    setWeightPhoto]    = useState('')
  const [cardioMinutes,  setCardioMinutes]  = useState('30')
  const [cardioTime,     setCardioTime]     = useState(0)
  const [isCardioRunning,setIsCardioRunning]= useState(false)

  // Modal "Dia Finalizado"
  const [showModal,    setShowModal]    = useState(false)
  const [modalObs,     setModalObs]     = useState('')
  const [modalExtras,  setModalExtras]  = useState('')

  // Aba estatísticas
  const [statsSubTab,  setStatsSubTab]  = useState<'diario'|'semanal'|'mensal'>('diario')

  const getToday = () => new Date().toISOString().split('T')[0]

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('dietAppData')
    if (saved) {
      const data = JSON.parse(saved)
      const meals = data.meals || {}
      setMealsData(meals)
      setDayStats(data.dayStats || {})
      setWeightsData(data.weights || {})
      setNotesData(data.notes || {})
      setTrainingData(data.training || {})
      const today = new Date().toISOString().split('T')[0]
      const todayMeals = meals[today] || {}
      setMealCheckboxes(MACROS_PER_ITEM.map((_, i) => todayMeals[i] === true))
    }
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveData = (overrides: Record<string, any> = {}) => {
    localStorage.setItem('dietAppData', JSON.stringify({
      meals:    mealsData,
      dayStats,
      weights:  weightsData,
      notes:    notesData,
      training: trainingData,
      ...overrides,
    }))
  }

  // ── Ações ───────────────────────────────────────────────────────────────────

  const toggleMeal = (idx: number) => {
    const today = getToday()
    const newMeals = { ...mealsData, [today]: { ...(mealsData[today] || {}) } }
    if (newMeals[today][idx]) delete newMeals[today][idx]
    else newMeals[today][idx] = true
    const newCb = [...mealCheckboxes]
    newCb[idx] = !newCb[idx]
    setMealsData(newMeals)
    setMealCheckboxes(newCb)
    saveData({ meals: newMeals })
  }

  const finalizarDia = () => {
    const today = getToday()
    const { cals } = calcDayMacros(mealsData, today)
    const extras = parseFloat(modalExtras) || 0
    const caloriasTotal = cals + extras
    const newDayStats = {
      ...dayStats,
      [today]: {
        finalizado:     true,
        observacoes:    modalObs,
        caloriasExtras: extras,
        caloriasTotal,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    }
    setDayStats(newDayStats)
    saveData({ dayStats: newDayStats })
    setShowModal(false)
    setModalObs('')
    setModalExtras('')
  }

  const addWeight = (weight: string, photo: string = '', date: string | null = null) => {
    const finalDate = date || getToday()
    const entry = photo ? { peso: parseFloat(weight), foto: photo } : parseFloat(weight)
    const newWeights = { ...weightsData, [finalDate]: entry }
    setWeightsData(newWeights)
    saveData({ weights: newWeights })
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setWeightPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  const addNote = (text: string) => {
    const today = getToday()
    const newNotes = { ...notesData, [today]: [...(notesData[today] || [])] }
    newNotes[today].push({
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    })
    setNotesData(newNotes)
    saveData({ notes: newNotes })
  }

  // ── Cálculos de hoje ────────────────────────────────────────────────────────

  const today = getToday()
  const { cals: totalCals, p: totalP, c: totalC, f: totalF } = calcDayMacros(mealsData, today)

  const mealsCompleted = (() => {
    const todayMeals = mealsData[today] || {}
    let count = 0, itemIdx = 0
    for (let m = 0; m < MEAL_GROUPS.length; m++) {
      let checked = 0
      for (let i = 0; i < MEAL_GROUPS[m]; i++) { if (todayMeals[itemIdx++]) checked++ }
      if (checked === MEAL_GROUPS[m]) count++
    }
    return count
  })()

  const todayStats    = dayStats[today]
  const todayFinished = todayStats?.finalizado || false
  const todayCalTotal = todayStats?.caloriasTotal ?? totalCals
  const todayFeedback = getFeedback(todayCalTotal)

  // ── Cardio timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isCardioRunning || cardioTime <= 0) {
      if (cardioTime === 0) setIsCardioRunning(false)
      return
    }
    const t = setInterval(() => setCardioTime(p => p - 1), 1000)
    return () => clearInterval(t)
  }, [isCardioRunning, cardioTime])

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Dados estatísticas ──────────────────────────────────────────────────────

  const weekDates   = getLastNDates(7)
  const monthDates  = getLastNDates(30)

  const weeklyChartData = weekDates.map(d => {
    const { cals } = calcDayMacros(mealsData, d)
    const extras   = dayStats[d]?.caloriasExtras || 0
    return { label: dateLabel(d), cals: cals + extras, meta: CAL_META }
  })

  const monthlyChartData = (() => {
    const weeks: { label: string; total: number; dias: number; finalizados: number }[] = []
    for (let w = 0; w < 4; w++) {
      const slice = monthDates.slice(w * 7, w * 7 + 7)
      let total = 0, finalizados = 0
      slice.forEach(d => {
        const { cals } = calcDayMacros(mealsData, d)
        total += cals + (dayStats[d]?.caloriasExtras || 0)
        if (dayStats[d]?.finalizado) finalizados++
      })
      weeks.push({ label: `Sem ${w + 1}`, total, dias: slice.length, finalizados })
    }
    return weeks
  })()

  const weekFinalizados = weekDates.filter(d => dayStats[d]?.finalizado).length
  const weekTotalCals   = weeklyChartData.reduce((s, d) => s + d.cals, 0)
  const weekMeta        = CAL_META * 7
  const weekDiff        = weekTotalCals - weekMeta

  const weightTrendData = monthDates
    .map(d => {
      const entry = weightsData[d]
      const peso  = entry ? (typeof entry === 'object' ? entry.peso : entry) : null
      return { label: dateLabel(d), peso }
    })
    .filter(d => d.peso !== null)

  // ── Insights automáticos ────────────────────────────────────────────────────

  const weekInsights: string[] = []
  const lowProteinDays = weekDates.filter(d => calcDayMacros(mealsData, d).p < MACRO_GOALS.p).length
  if (lowProteinDays > 0)
    weekInsights.push(`Proteína abaixo da meta em ${lowProteinDays}/7 dias esta semana`)
  weekInsights.push(`Dias finalizados: ${weekFinalizados}/7 ${weekFinalizados >= 5 ? '— bom progresso! 💪' : '— tente finalizar mais dias'}`)
  if (weekDiff < 0)
    weekInsights.push(`Margem semanal: ${Math.abs(weekDiff)} kcal abaixo — pode comer mais nos próximos dias`)
  else if (weekDiff > 0)
    weekInsights.push(`Semana ${weekDiff} kcal acima da meta — compense nos próximos dias`)

  const weekPct = weekMeta > 0 ? Math.round((weekFinalizados / 7) * 100) : 0
  weekInsights.push(`Você está cumprindo ${weekPct}% dos dias dessa semana`)

  // ── Badge semanal para aba Hoje ─────────────────────────────────────────────

  const weekBadgeColor = weekDiff < -200 ? 'var(--warning)' : weekDiff > 200 ? '#e53935' : 'var(--success)'
  const weekBadgeEmoji = weekDiff < -200 ? '🟡' : weekDiff > 200 ? '🔴' : '🟢'
  const weekBadgeText  = weekDiff < 0
    ? `${Math.abs(weekDiff)} kcal abaixo (pode comer mais)`
    : weekDiff > 0
    ? `${weekDiff} kcal acima (tá passando)`
    : 'Semana no alvo'

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Modal "Dia Finalizado" ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Finalizar Dia 🏁</div>

            <label className="modal-label">O que comeu fora da dieta?</label>
            <textarea
              className="modal-textarea"
              placeholder="Ex: comi um brigadeiro, pizza no jantar..."
              rows={3}
              value={modalObs}
              onChange={e => setModalObs(e.target.value)}
            />

            <label className="modal-label">Calorias extras (opcional)</label>
            <input
              type="number"
              className="modal-input"
              placeholder="Ex: 250"
              value={modalExtras}
              onChange={e => setModalExtras(e.target.value)}
            />

            {/* Preview do feedback */}
            {(() => {
              const extras = parseFloat(modalExtras) || 0
              const fb = getFeedback(totalCals + extras)
              return (
                <div className="modal-feedback" style={{ borderColor: fb.color, color: fb.color }}>
                  {fb.badge} {fb.msg}
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Refeições: {totalCals} kcal + Extras: {extras} kcal = <strong>{totalCals + extras} kcal</strong>
                  </div>
                </div>
              )
            })()}

            <div className="modal-actions">
              <button className="btn" onClick={finalizarDia}>Finalizar Dia</button>
              <button className="btn btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
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
        {/* ── Tabs ── */}
        <div className="tabs">
          {['hoje', 'peso', 'cardio', 'notas', 'estatísticas'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'estatísticas' ? '📊 Stats' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ TAB: HOJE */}
        <div className={`tab-content ${activeTab === 'hoje' ? 'active' : ''}`}>

          {/* Card semanal */}
          <div
            className="week-status-card"
            style={{ borderColor: weekBadgeColor }}
            onClick={() => { setActiveTab('estatísticas'); setStatsSubTab('semanal') }}
          >
            <div className="week-status-left">
              <div className="week-status-title">📊 Status da semana</div>
              <div className="week-status-text" style={{ color: weekBadgeColor }}>
                {weekBadgeEmoji} {weekBadgeText}
              </div>
              <div className="week-status-sub">{weekFinalizados}/7 dias finalizados · clique pra ver detalhes</div>
            </div>
          </div>

          {/* Dia Finalizado */}
          {todayFinished ? (
            <div className="day-finalized-card">
              <div style={{ fontSize: 28 }}>✅</div>
              <div>
                <div className="day-finalized-title">Dia Finalizado às {todayStats.timestamp}</div>
                <div className="day-finalized-feedback" style={{ color: todayFeedback.color }}>
                  {todayFeedback.msg}
                </div>
                {todayStats.observacoes && (
                  <div className="day-finalized-obs">"{todayStats.observacoes}"</div>
                )}
              </div>
            </div>
          ) : (
            <button className="btn btn-finalizar" onClick={() => setShowModal(true)}>
              🏁 Finalizar Dia
            </button>
          )}

          {/* Stats */}
          <div className="stats">
            <div className="stat-box">
              <div className="stat-value">{mealsCompleted}/{MEALS.length}</div>
              <div className="stat-label">Refeições</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{totalCals}</div>
              <div className="stat-label">kcal</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{Math.min(100, Math.round((totalCals / CAL_META) * 100))}%</div>
              <div className="stat-label">Meta</div>
            </div>
          </div>

          {/* Macros */}
          <div className="card">
            <div className="card-title">Macronutrientes (Tempo Real)</div>
            <div className="macros-grid">
              {[
                { label: 'Proteína',    val: totalP, meta: MACRO_GOALS.p },
                { label: 'Carboidrato', val: totalC, meta: MACRO_GOALS.c },
                { label: 'Gordura',     val: totalF, meta: MACRO_GOALS.f },
              ].map(({ label, val, meta }) => (
                <div key={label} className="macro-box">
                  <div className="macro-label">{label}</div>
                  <div className="macro-value">{val}g</div>
                  <div className="macro-goal">Meta: {meta}g</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (val / meta) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refeições */}
          {MEALS.map((meal, mealIdx) => (
            <div key={mealIdx} className="card">
              <div className="card-title">{meal[0]}</div>
              {meal[1].map((item, itemIdx) => {
                const globalIdx = MEAL_GROUPS.slice(0, mealIdx).reduce((a, b) => a + b, 0) + itemIdx
                return (
                  <div key={globalIdx} className="meal-item" onClick={() => toggleMeal(globalIdx)}>
                    <div className={`checkbox ${mealCheckboxes[globalIdx] ? 'checked' : ''}`}>
                      {mealCheckboxes[globalIdx] ? '✓' : ''}
                    </div>
                    <div className="meal-content">
                      <div className="meal-name">{item[0]}</div>
                      <div className="meal-desc">{item[1]}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ TAB: PESO */}
        <div className={`tab-content ${activeTab === 'peso' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-title">Registrar Peso</div>
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
              const weight = (document.getElementById('weight-input') as HTMLInputElement).value
              if (weight) {
                addWeight(weight, weightPhoto)
                ;(document.getElementById('weight-input') as HTMLInputElement).value = ''
                setWeightPhoto('')
              }
            }}>
              Registrar
            </button>
          </div>

          <div className="card">
            <div className="card-title">Histórico</div>
            {Object.entries(weightsData).sort((a, b) => b[0].localeCompare(a[0])).map(([date, entry]: any) => {
              const peso = typeof entry === 'object' ? entry.peso : entry
              const foto = typeof entry === 'object' ? entry.foto : null
              return (
                <div key={date} className="weight-history-item">
                  <div className="weight-history-info">
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--primary)' }}>{peso}kg</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  </div>
                  {foto && <img src={foto} alt={`Foto ${date}`} className="weight-history-photo" />}
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-title">Meta Inicial</div>
            <div className="stats">
              <div className="stat-box"><div className="stat-value">100kg</div><div className="stat-label">Peso Atual</div></div>
              <div className="stat-box"><div className="stat-value">-0.5kg</div><div className="stat-label">Meta em 4 Semanas</div></div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ TAB: CARDIO */}
        <div className={`tab-content ${activeTab === 'cardio' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-title">Timer de Cardio</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Minutos</label>
              <input type="number" value={cardioMinutes} onChange={e => setCardioMinutes(e.target.value)} min="1" />
            </div>
            <div style={{ fontSize: 48, fontWeight: 'bold', textAlign: 'center', color: 'var(--primary)', margin: '30px 0' }}>
              {formatTime(cardioTime || parseInt(cardioMinutes) * 60)}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-small" onClick={() => { setCardioTime(parseInt(cardioMinutes) * 60); setIsCardioRunning(!isCardioRunning) }} style={{ background: isCardioRunning ? 'var(--warning)' : 'var(--primary)' }}>
                {isCardioRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <button className="btn btn-small" onClick={() => { setCardioTime(0); setIsCardioRunning(false) }} style={{ background: 'var(--warning)' }}>
                Resetar
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Plano Recomendado</div>
            {[['Semanas 1-2','20-30 min cardio, 4-5x por semana'],['Semana 3','Avaliação: continue ou ajuste intensidade'],['Semana 4','Aumento progressivo ou manutenção']].map(([t,d])=>(
              <div key={t} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ TAB: NOTAS */}
        <div className={`tab-content ${activeTab === 'notas' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-title">Adicionar Nota</div>
            <textarea placeholder="Como você se sentiu? Comeu fora? Dicas?" rows={3} id="note-input" style={{ marginBottom: 12 }} />
            <button className="btn" onClick={() => {
              const text = (document.getElementById('note-input') as HTMLTextAreaElement).value
              if (text.trim()) { addNote(text); (document.getElementById('note-input') as HTMLTextAreaElement).value = '' }
            }}>
              Salvar Nota
            </button>
          </div>
          <div className="card">
            <div className="card-title">Minhas Notas</div>
            {notesData[today]?.length > 0
              ? notesData[today].map((note: any, idx: number) => (
                  <div key={idx} style={{ padding: 8, background: 'var(--dark)', borderRadius: 4, borderLeft: '2px solid var(--primary)', marginBottom: 8 }}>
                    <strong style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note.timestamp}</strong><br />{note.text}
                  </div>
                ))
              : <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma nota ainda</div>}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ TAB: ESTATÍSTICAS */}
        <div className={`tab-content ${activeTab === 'estatísticas' ? 'active' : ''}`}>

          {/* Sub-tabs */}
          <div className="sub-tabs">
            {(['diario','semanal','mensal'] as const).map(st => (
              <button key={st} className={`sub-tab-btn ${statsSubTab === st ? 'active' : ''}`} onClick={() => setStatsSubTab(st)}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* ── DIÁRIO ── */}
          {statsSubTab === 'diario' && (
            <div>
              <div className="card">
                <div className="card-title">Hoje — Calorias vs Meta</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[{ label: 'Consumido', val: totalCals }, { label: 'Meta', val: CAL_META }]} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <Bar dataKey="val" fill="var(--primary)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-title">Hoje — Macros vs Meta</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={[
                      { macro: 'Proteína',    consumido: totalP, meta: MACRO_GOALS.p },
                      { macro: 'Carboidrato', consumido: totalC, meta: MACRO_GOALS.c },
                      { macro: 'Gordura',     consumido: totalF, meta: MACRO_GOALS.f },
                    ]}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="macro" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                    <Bar dataKey="consumido" fill="var(--primary)" radius={[4,4,0,0]} name="Consumido (g)" />
                    <Bar dataKey="meta"      fill="var(--border)"  radius={[4,4,0,0]} name="Meta (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-title">Insights de Hoje</div>
                {[
                  { label: 'Proteína',    val: totalP, meta: MACRO_GOALS.p, unit: 'g' },
                  { label: 'Carboidrato', val: totalC, meta: MACRO_GOALS.c, unit: 'g' },
                  { label: 'Gordura',     val: totalF, meta: MACRO_GOALS.f, unit: 'g' },
                ].map(({ label, val, meta, unit }) => {
                  const diff = meta - val
                  return (
                    <div key={label} className="insight-row">
                      <span className="insight-label">{label}</span>
                      <span className="insight-val">{val}{unit} / {meta}{unit}</span>
                      <span className="insight-diff" style={{ color: diff > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        {diff > 0 ? `faltou ${diff}${unit}` : `ok ✓`}
                      </span>
                    </div>
                  )
                })}
                <div className="insight-row" style={{ marginTop: 8 }}>
                  <span className="insight-label">Status do dia</span>
                  <span style={{ color: todayFinished ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {todayFinished ? `✅ Finalizado (${todayCalTotal} kcal)` : '⏳ Não finalizado ainda'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── SEMANAL ── */}
          {statsSubTab === 'semanal' && (
            <div>
              <div className="card">
                <div className="card-title">Calorias — Últimos 7 Dias</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis domain={[0, 2500]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <ReferenceLine y={CAL_META} stroke="var(--success)" strokeDasharray="4 4" label={{ value: 'Meta', fill: 'var(--success)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="cals" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 4 }} name="kcal" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-title">Tabela Semanal</div>
                <table className="stats-table">
                  <thead>
                    <tr><th>Data</th><th>kcal</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {weekDates.map((d, i) => {
                      const { cals } = calcDayMacros(mealsData, d)
                      const extras   = dayStats[d]?.caloriasExtras || 0
                      const total    = cals + extras
                      const fin      = dayStats[d]?.finalizado
                      const diff     = CAL_META - total
                      let status = '—'
                      if (fin)       status = `✅ ${Math.abs(diff)} ${diff >= 0 ? 'abaixo' : 'acima'}`
                      else if (total > CAL_MAX) status = '⚠️ Acima'
                      else if (total > 0)       status = '⏳ Parcial'
                      return (
                        <tr key={d} style={{ background: i % 2 === 0 ? 'var(--dark)' : 'transparent' }}>
                          <td>{dateLabel(d)}</td>
                          <td style={{ color: 'var(--primary)' }}>{total > 0 ? total : '—'}</td>
                          <td style={{ fontSize: 12 }}>{status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-title">Resumo Semanal</div>
                {[
                  ['Total da semana', `${weekTotalCals} kcal`],
                  ['Meta da semana',  `${weekMeta} kcal`],
                  ['Resultado',       `${weekDiff >= 0 ? '+' : ''}${weekDiff} kcal ${weekDiff <= 0 ? '(margem disponível)' : '(compensar)'}`],
                  ['Dias finalizados',`${weekFinalizados}/7`],
                  ['Média diária',    `${Math.round(weekTotalCals / 7)} kcal`],
                ].map(([k, v]) => (
                  <div key={k} className="summary-row">
                    <span className="summary-key">{k}</span>
                    <span className="summary-val">{v}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title">Insights da Semana</div>
                {weekInsights.map((ins, i) => (
                  <div key={i} className="insight-item">💡 {ins}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── MENSAL ── */}
          {statsSubTab === 'mensal' && (
            <div>
              <div className="card">
                <div className="card-title">Calorias por Semana — Últimos 30 Dias</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <ReferenceLine y={CAL_META * 7} stroke="var(--success)" strokeDasharray="4 4" label={{ value: 'Meta', fill: 'var(--success)', fontSize: 11 }} />
                    <Bar dataKey="total" fill="var(--primary)" radius={[4,4,0,0]} name="kcal total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {weightTrendData.length >= 2 && (
                <div className="card">
                  <div className="card-title">Tendência de Peso — Últimos 30 Dias</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weightTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <YAxis domain={['auto','auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                      <Line type="monotone" dataKey="peso" stroke="var(--success)" strokeWidth={2} dot={{ fill: 'var(--success)', r: 4 }} name="kg" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="card">
                <div className="card-title">Tabela por Semana</div>
                <table className="stats-table">
                  <thead>
                    <tr><th>Semana</th><th>kcal total</th><th>Dias fin.</th></tr>
                  </thead>
                  <tbody>
                    {monthlyChartData.map((w, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'var(--dark)' : 'transparent' }}>
                        <td>{w.label}</td>
                        <td style={{ color: 'var(--primary)' }}>{w.total}</td>
                        <td>{w.finalizados}/{w.dias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-title">Resumo Mensal</div>
                {(() => {
                  const totalMes  = monthlyChartData.reduce((s, w) => s + w.total, 0)
                  const metaMes   = CAL_META * 30
                  const finMes    = monthDates.filter(d => dayStats[d]?.finalizado).length
                  const bestWeek  = [...monthlyChartData].sort((a, b) => (CAL_META*7 - a.total) - (CAL_META*7 - b.total))[0]
                  return [
                    ['Total do mês',      `${totalMes.toLocaleString()} kcal`],
                    ['Meta do mês',       `${metaMes.toLocaleString()} kcal`],
                    ['Status',            totalMes <= metaMes ? 'No alvo ✅' : `${(totalMes-metaMes).toLocaleString()} kcal acima`],
                    ['Dias finalizados',  `${finMes}/30`],
                    ['Melhor semana',     bestWeek ? `${bestWeek.label} (${bestWeek.total} kcal)` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="summary-row">
                      <span className="summary-key">{k}</span>
                      <span className="summary-val">{v}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer>
        💪 Consistência vence tudo. Você consegue!
      </footer>
    </div>
  )
}
