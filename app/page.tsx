'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

// ─── Constantes ────────────────────────────────────────────────────────────────

const MACROS_PER_ITEM = [
  // Café
  { kcal: 146, p: 13,   c: 1,  f: 9.5 },  // 0  Ovo (2 un)
  { kcal: 150, p: 4,    c: 29, f: 1.5 },  // 1  Pão francês (1 un)
  { kcal: 108, p: 8.5,  c: 1,  f: 5.4 },  // 2  Requeijão Light (60g)
  // Almoço
  { kcal: 297, p: 56,   c: 0,  f: 7.2 },  // 3  Frango (180g)
  { kcal: 169, p: 3.5,  c: 37, f: 0.4 },  // 4  Arroz (130g)
  { kcal: 30,  p: 1,    c: 6,  f: 0.2 },  // 5  Vegetais (100g)
  // Lanche
  { kcal: 150, p: 4,    c: 29, f: 1.5 },  // 6  Pão francês (1 un)
  { kcal: 165, p: 31,   c: 0,  f: 3.6 },  // 7  Frango (100g)
  { kcal: 54,  p: 4.5,  c: 0,  f: 3.3 },  // 8  Requeijão Light (30g)
  // Jantar
  { kcal: 297, p: 56,   c: 0,  f: 7.2 },  // 9  Frango (180g)
  { kcal: 169, p: 3.5,  c: 37, f: 0.4 },  // 10 Arroz (130g)
  { kcal: 30,  p: 1,    c: 6,  f: 0.2 },  // 11 Vegetais (100g)
  // Ceia
  { kcal: 120, p: 25,   c: 2,  f: 1.0 },  // 12 Whey (30g)
  { kcal: 78,  p: 3.5,  c: 13, f: 1.4 },  // 13 Aveia (20g)
]

const MEALS: [string, string[][]][] = [
  ['Café da Manhã · ~404 kcal', [
    ['Ovo (2 un)',            '146 kcal · P 13g · C 1g · G 9,5g'],
    ['Pão francês (1 un)',    '150 kcal · P 4g · C 29g · G 1,5g'],
    ['Requeijão Light (60g)', '108 kcal · P 8,5g · C 1g · G 5,4g'],
  ]],
  ['Almoço · ~496 kcal', [
    ['Frango (180g)',   '297 kcal · P 56g · C 0g · G 7,2g'],
    ['Arroz (130g)',    '169 kcal · P 3,5g · C 37g · G 0,4g'],
    ['Vegetais (100g)', '30 kcal · P 1g · C 6g · G 0,2g'],
  ]],
  ['Lanche · ~369 kcal', [
    ['Pão francês (1 un)',    '150 kcal · P 4g · C 29g · G 1,5g'],
    ['Frango (100g)',          '165 kcal · P 31g · C 0g · G 3,6g'],
    ['Requeijão Light (30g)', '54 kcal · P 4,5g · C 0g · G 3,3g'],
  ]],
  ['Jantar · ~496 kcal', [
    ['Frango (180g)',   '297 kcal · P 56g · C 0g · G 7,2g'],
    ['Arroz (130g)',    '169 kcal · P 3,5g · C 37g · G 0,4g'],
    ['Vegetais (100g)', '30 kcal · P 1g · C 6g · G 0,2g'],
  ]],
  ['Ceia · ~198 kcal', [
    ['Whey (30g)',  '120 kcal · P 25g · C 2g · G 1g'],
    ['Aveia (20g)', '78 kcal · P 3,5g · C 13g · G 1,4g'],
  ]],
]

const MEAL_GROUPS = [3, 3, 3, 3, 2]

// Alternativas para cada item (mesmos macros, nome diferente)
const ALTERNATIVES: string[][] = [
  ['Iogurte grego (165g)', 'Leite + Aveia'],                              // 0  Ovo
  ['Biscoito integral (50g)', 'Bolo integral (50g)'],                      // 1  Pão (café)
  ['Queijo meia cura (60g)', 'Manteiga amendoim (30g)'],                   // 2  Requeijão 60g
  ['Peixe (180g)', 'Ovos cozidos (4 un)', 'Feijão cozido (180g)'],        // 3  Frango 180g
  ['Batata doce (130g)', 'Batata comum (130g)', 'Macarrão (130g)'],       // 4  Arroz
  ['Cenoura', 'Brócolis', 'Abobrinha', 'Qualquer verdura'],                // 5  Vegetais
  ['Biscoito integral (50g)', 'Bolo integral (50g)'],                      // 6  Pão (lanche)
  ['Atum (100g)', 'Queijo branco (100g)', 'Ovos cozidos (2 un)'],         // 7  Frango 100g
  ['Queijo meia cura (30g)', 'Manteiga amendoim (15g)'],                   // 8  Requeijão 30g
  ['Peixe (180g)', 'Ovos cozidos (4 un)', 'Feijão cozido (180g)'],        // 9  Frango 180g
  ['Batata doce (130g)', 'Batata comum (130g)', 'Macarrão (130g)'],       // 10 Arroz
  ['Cenoura', 'Brócolis', 'Abobrinha', 'Qualquer verdura'],                // 11 Vegetais
  ['Iogurte grego (165g)', 'Leite desnatado (250ml)'],                     // 12 Whey
  ['Granola (20g)', 'Cereal integral (20g)'],                              // 13 Aveia
]

const DEFAULT_GOALS = { cals: 1963, p: 214, c: 161, f: 43 }

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
  return { cals: Math.round(cals), p: Math.round(p), c: Math.round(c), f: Math.round(f) }
}

function getFeedback(cals: number, calMeta: number, calMax: number) {
  if (cals < calMeta) {
    return { msg: `Você comeu pouco! Margem: +${calMeta - cals} kcal pra próximos dias ✅`, color: 'var(--warning)', badge: '🟡' }
  }
  if (cals <= calMax) {
    return { msg: 'Perfeito! Dia dentro da meta 🎯', color: 'var(--success)', badge: '🟢' }
  }
  return { msg: `Passou da meta em ${cals - calMax} kcal. Pode compensar amanhã 💪`, color: 'var(--warning)', badge: '🔴' }
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

// ─── Componente ────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab,      setActiveTab]      = useState('hoje')
  const [mealsData,      setMealsData]      = useState<Record<string, any>>({})
  const [dayStats,       setDayStats]       = useState<Record<string, any>>({})
  const [weightsData,    setWeightsData]    = useState<Record<string, any>>({})
  const [mealCheckboxes, setMealCheckboxes] = useState<boolean[]>([])
  const [weightPhoto,    setWeightPhoto]    = useState('')

  // Substituidores
  const [substitutes, setSubstitutes] = useState<Record<number, string>>({})
  const [openAlt,     setOpenAlt]     = useState<number | null>(null)

  // Metas editáveis
  const [userGoals, setUserGoals] = useState(DEFAULT_GOALS)

  // Modal "Dia Finalizado"
  const [showModal,   setShowModal]   = useState(false)
  const [modalObs,    setModalObs]    = useState('')
  const [modalExtras, setModalExtras] = useState('')

  // Sub-tab estatísticas
  const [statsSubTab, setStatsSubTab] = useState<'diario' | 'semanal' | 'mensal'>('diario')

  const getToday = () => new Date().toISOString().split('T')[0]

  // Valores derivados de userGoals
  const CAL_META = userGoals.cals
  const CAL_MAX  = userGoals.cals + 200

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('dietAppData')
    if (saved) {
      const data = JSON.parse(saved)
      const meals = data.meals || {}
      setMealsData(meals)
      setDayStats(data.dayStats || {})
      setWeightsData(data.weights || {})
      setSubstitutes(data.substitutes || {})
      if (data.userGoals) setUserGoals(data.userGoals)
      const today = new Date().toISOString().split('T')[0]
      setMealCheckboxes(MACROS_PER_ITEM.map((_, i) => (meals[today] || {})[i] === true))
    }
  }, [])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (openAlt === null) return
    const close = () => setOpenAlt(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openAlt])

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveData = (overrides: Record<string, any> = {}) => {
    localStorage.setItem('dietAppData', JSON.stringify({
      meals:      mealsData,
      dayStats,
      weights:    weightsData,
      substitutes,
      userGoals,
      ...overrides,
    }))
  }

  // ── Ações ─────────────────────────────────────────────────────────────────────

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

  const chooseSubstitute = (idx: number, name: string | null) => {
    const newSubs = { ...substitutes }
    if (name === null) delete newSubs[idx]
    else newSubs[idx] = name
    setSubstitutes(newSubs)
    setOpenAlt(null)
    saveData({ substitutes: newSubs })
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

  const addWeight = (weight: string, photo: string = '') => {
    const entry = photo ? { peso: parseFloat(weight), foto: photo } : parseFloat(weight)
    const newWeights = { ...weightsData, [getToday()]: entry }
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

  const updateGoal = (key: keyof typeof DEFAULT_GOALS, val: string) => {
    const num = parseInt(val)
    if (isNaN(num) || num <= 0) return
    const newGoals = { ...userGoals, [key]: num }
    setUserGoals(newGoals)
    saveData({ userGoals: newGoals })
  }

  const resetGoals = () => {
    setUserGoals(DEFAULT_GOALS)
    saveData({ userGoals: DEFAULT_GOALS })
  }

  // ── Cálculos de hoje ──────────────────────────────────────────────────────────

  const today = getToday()
  const { cals: totalCals, p: totalP, c: totalC, f: totalF } = calcDayMacros(mealsData, today)

  const mealsCompleted = (() => {
    const todayMeals = mealsData[today] || {}
    let count = 0, idx = 0
    for (let m = 0; m < MEAL_GROUPS.length; m++) {
      let checked = 0
      for (let i = 0; i < MEAL_GROUPS[m]; i++) { if (todayMeals[idx++]) checked++ }
      if (checked === MEAL_GROUPS[m]) count++
    }
    return count
  })()

  const todayStats    = dayStats[today]
  const todayFinished = todayStats?.finalizado || false
  const todayCalTotal = todayStats?.caloriasTotal ?? totalCals
  const todayFeedback = getFeedback(todayCalTotal, CAL_META, CAL_MAX)

  // ── Dados estatísticas ────────────────────────────────────────────────────────

  const weekDates  = getLastNDates(7)
  const monthDates = getLastNDates(30)

  const weeklyChartData = weekDates.map(d => {
    const { cals } = calcDayMacros(mealsData, d)
    return { label: dateLabel(d), cals: cals + (dayStats[d]?.caloriasExtras || 0), meta: CAL_META }
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
      const e = weightsData[d]
      return { label: dateLabel(d), peso: e ? (typeof e === 'object' ? e.peso : e) : null }
    })
    .filter(d => d.peso !== null)

  const weekWeightData = weekDates
    .map(d => {
      const e = weightsData[d]
      return { label: dateLabel(d), peso: e ? (typeof e === 'object' ? e.peso : e) : null }
    })
    .filter(d => d.peso !== null)

  const weekInsights: string[] = []
  const lowProteinDays = weekDates.filter(d => calcDayMacros(mealsData, d).p < userGoals.p).length
  if (lowProteinDays > 0)
    weekInsights.push(`Proteína abaixo da meta em ${lowProteinDays}/7 dias esta semana`)
  weekInsights.push(`Dias finalizados: ${weekFinalizados}/7 ${weekFinalizados >= 5 ? '— bom progresso! 💪' : '— tente finalizar mais dias'}`)
  if (weekDiff < 0)
    weekInsights.push(`Margem semanal: ${Math.abs(weekDiff)} kcal abaixo — pode comer mais`)
  else if (weekDiff > 0)
    weekInsights.push(`Semana ${weekDiff} kcal acima — compense nos próximos dias`)
  weekInsights.push(`Você está cumprindo ${Math.round((weekFinalizados / 7) * 100)}% dos dias dessa semana`)

  const weekBadgeColor = weekDiff < -200 ? 'var(--warning)' : weekDiff > 200 ? '#e53935' : 'var(--success)'
  const weekBadgeEmoji = weekDiff < -200 ? '🟡' : weekDiff > 200 ? '🔴' : '🟢'
  const weekBadgeText  = weekDiff < 0
    ? `${Math.abs(weekDiff)} kcal abaixo (pode comer mais)`
    : weekDiff > 0 ? `${weekDiff} kcal acima` : 'Semana no alvo'

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Modal Dia Finalizado ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Finalizar Dia 🏁</div>
            <label className="modal-label">O que comeu fora da dieta?</label>
            <textarea className="modal-textarea" placeholder="Ex: brigadeiro, pizza..." rows={3}
              value={modalObs} onChange={e => setModalObs(e.target.value)} />
            <label className="modal-label">Calorias extras (opcional)</label>
            <input type="number" className="modal-input" placeholder="Ex: 250"
              value={modalExtras} onChange={e => setModalExtras(e.target.value)} />
            {(() => {
              const extras = parseFloat(modalExtras) || 0
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
          {[
            { id: 'hoje',         label: 'Hoje' },
            { id: 'peso',         label: 'Peso' },
            { id: 'estatísticas', label: '📊 Stats' },
            { id: 'config',       label: '⚙️ Config' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ HOJE */}
        <div className={`tab-content ${activeTab === 'hoje' ? 'active' : ''}`}>

          {/* Card semanal */}
          <div className="week-status-card" style={{ borderColor: weekBadgeColor }}
            onClick={() => { setActiveTab('estatísticas'); setStatsSubTab('semanal') }}>
            <div className="week-status-left">
              <div className="week-status-title">📊 Status da semana</div>
              <div className="week-status-text" style={{ color: weekBadgeColor }}>{weekBadgeEmoji} {weekBadgeText}</div>
              <div className="week-status-sub">{weekFinalizados}/7 dias finalizados · clique pra ver detalhes</div>
            </div>
          </div>

          {/* Dia Finalizado */}
          {todayFinished ? (
            <div className="day-finalized-card">
              <div style={{ fontSize: 28 }}>✅</div>
              <div>
                <div className="day-finalized-title">Dia Finalizado às {todayStats.timestamp}</div>
                <div className="day-finalized-feedback" style={{ color: todayFeedback.color }}>{todayFeedback.msg}</div>
                {todayStats.observacoes && <div className="day-finalized-obs">"{todayStats.observacoes}"</div>}
              </div>
            </div>
          ) : (
            <button className="btn btn-finalizar" onClick={() => setShowModal(true)}>🏁 Finalizar Dia</button>
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
                { label: 'Proteína',    val: totalP, meta: userGoals.p },
                { label: 'Carboidrato', val: totalC, meta: userGoals.c },
                { label: 'Gordura',     val: totalF, meta: userGoals.f },
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

          {/* Refeições com substituidores */}
          {MEALS.map((meal, mealIdx) => (
            <div key={mealIdx} className="card">
              <div className="card-title">{meal[0]}</div>
              {meal[1].map((item, itemIdx) => {
                const globalIdx = MEAL_GROUPS.slice(0, mealIdx).reduce((a, b) => a + b, 0) + itemIdx
                const displayName = substitutes[globalIdx] || item[0]
                const hasAlts = ALTERNATIVES[globalIdx]?.length > 0
                const isOpen = openAlt === globalIdx
                return (
                  <div key={globalIdx} className="meal-item-wrap">
                    <div className="meal-item" onClick={() => toggleMeal(globalIdx)}>
                      <div className={`checkbox ${mealCheckboxes[globalIdx] ? 'checked' : ''}`}>
                        {mealCheckboxes[globalIdx] ? '✓' : ''}
                      </div>
                      <div className="meal-content">
                        <div className="meal-name">
                          {displayName}
                          {substitutes[globalIdx] && (
                            <span className="sub-badge">sub</span>
                          )}
                        </div>
                        <div className="meal-desc">{item[1]}</div>
                      </div>
                    </div>
                    {hasAlts && (
                      <div className="alt-wrap" onClick={e => e.stopPropagation()}>
                        <button
                          className="alt-btn"
                          title="Substituir alimento"
                          onClick={() => setOpenAlt(isOpen ? null : globalIdx)}
                        >🔄</button>
                        {isOpen && (
                          <div className="alt-dropdown">
                            <div className="alt-option alt-original"
                              onClick={() => chooseSubstitute(globalIdx, null)}>
                              ↩ {item[0]} (original)
                            </div>
                            {ALTERNATIVES[globalIdx].map(alt => (
                              <div key={alt} className="alt-option"
                                onClick={() => chooseSubstitute(globalIdx, alt)}>
                                {alt}
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
              const w = (document.getElementById('weight-input') as HTMLInputElement).value
              if (w) {
                addWeight(w, weightPhoto)
                ;(document.getElementById('weight-input') as HTMLInputElement).value = ''
                setWeightPhoto('')
              }
            }}>Registrar</button>
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
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  {foto && <img src={foto} alt="" className="weight-history-photo" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ ESTATÍSTICAS */}
        <div className={`tab-content ${activeTab === 'estatísticas' ? 'active' : ''}`}>
          <div className="sub-tabs">
            {(['diario', 'semanal', 'mensal'] as const).map(st => (
              <button key={st} className={`sub-tab-btn ${statsSubTab === st ? 'active' : ''}`}
                onClick={() => setStatsSubTab(st)}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Diário ── */}
          {statsSubTab === 'diario' && (
            <div>
              <div className="card">
                <div className="card-title">Hoje — Calorias vs Meta</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[{ label: 'Consumido', val: totalCals }, { label: 'Meta', val: CAL_META }]}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <Bar dataKey="val" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-title">Hoje — Macros vs Meta</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={[
                      { macro: 'Proteína',    consumido: totalP, meta: userGoals.p },
                      { macro: 'Carboidrato', consumido: totalC, meta: userGoals.c },
                      { macro: 'Gordura',     consumido: totalF, meta: userGoals.f },
                    ]}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="macro" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                    <Bar dataKey="consumido" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Consumido (g)" />
                    <Bar dataKey="meta"      fill="var(--border)"  radius={[4, 4, 0, 0]} name="Meta (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-title">Insights de Hoje</div>
                {[
                  { label: 'Proteína',    val: totalP, meta: userGoals.p },
                  { label: 'Carboidrato', val: totalC, meta: userGoals.c },
                  { label: 'Gordura',     val: totalF, meta: userGoals.f },
                ].map(({ label, val, meta }) => (
                  <div key={label} className="insight-row">
                    <span className="insight-label">{label}</span>
                    <span className="insight-val">{val}g / {meta}g</span>
                    <span className="insight-diff" style={{ color: val < meta ? 'var(--warning)' : 'var(--success)' }}>
                      {val < meta ? `faltou ${meta - val}g` : 'ok ✓'}
                    </span>
                  </div>
                ))}
                <div className="insight-row" style={{ marginTop: 8 }}>
                  <span className="insight-label">Status do dia</span>
                  <span style={{ color: todayFinished ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {todayFinished ? `✅ Finalizado (${todayCalTotal} kcal)` : '⏳ Não finalizado ainda'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Semanal ── */}
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
                    <ReferenceLine y={CAL_META} stroke="var(--success)" strokeDasharray="4 4"
                      label={{ value: 'Meta', fill: 'var(--success)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="cals" stroke="var(--primary)" strokeWidth={2}
                      dot={{ fill: 'var(--primary)', r: 4 }} name="kcal" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {weekWeightData.length >= 2 && (
                <div className="card">
                  <div className="card-title">Peso — Últimos 7 Dias</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={weekWeightData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                      <Line type="monotone" dataKey="peso" stroke="var(--success)" strokeWidth={2}
                        dot={{ fill: 'var(--success)', r: 4 }} name="kg" />
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
                      const { cals } = calcDayMacros(mealsData, d)
                      const total    = cals + (dayStats[d]?.caloriasExtras || 0)
                      const fin      = dayStats[d]?.finalizado
                      const diff     = CAL_META - total
                      const status   = fin
                        ? `✅ ${Math.abs(diff)} ${diff >= 0 ? 'abaixo' : 'acima'}`
                        : total > CAL_MAX ? '⚠️ Acima' : total > 0 ? '⏳ Parcial' : '—'
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
                  ['Total da semana',  `${weekTotalCals} kcal`],
                  ['Meta da semana',   `${weekMeta} kcal`],
                  ['Resultado',        `${weekDiff >= 0 ? '+' : ''}${weekDiff} kcal`],
                  ['Dias finalizados', `${weekFinalizados}/7`],
                  ['Média diária',     `${Math.round(weekTotalCals / 7)} kcal`],
                ].map(([k, v]) => (
                  <div key={k} className="summary-row">
                    <span className="summary-key">{k}</span>
                    <span className="summary-val">{v}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title">Insights</div>
                {weekInsights.map((ins, i) => <div key={i} className="insight-item">💡 {ins}</div>)}
              </div>
            </div>
          )}

          {/* ── Mensal ── */}
          {statsSubTab === 'mensal' && (
            <div>
              <div className="card">
                <div className="card-title">Calorias por Semana — 30 Dias</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                    <ReferenceLine y={CAL_META * 7} stroke="var(--success)" strokeDasharray="4 4"
                      label={{ value: 'Meta', fill: 'var(--success)', fontSize: 11 }} />
                    <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} name="kcal total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {weightTrendData.length >= 2 && (
                <div className="card">
                  <div className="card-title">Tendência de Peso — 30 Dias</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weightTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
                      <Line type="monotone" dataKey="peso" stroke="var(--success)" strokeWidth={2}
                        dot={{ fill: 'var(--success)', r: 4 }} name="kg" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="card">
                <div className="card-title">Por Semana</div>
                <table className="stats-table">
                  <thead><tr><th>Semana</th><th>kcal total</th><th>Dias fin.</th></tr></thead>
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
                  const totalMes = monthlyChartData.reduce((s, w) => s + w.total, 0)
                  const metaMes  = CAL_META * 30
                  const finMes   = monthDates.filter(d => dayStats[d]?.finalizado).length
                  return [
                    ['Total do mês',     `${totalMes.toLocaleString()} kcal`],
                    ['Meta do mês',      `${metaMes.toLocaleString()} kcal`],
                    ['Status',           totalMes <= metaMes ? 'No alvo ✅' : `${(totalMes - metaMes).toLocaleString()} kcal acima`],
                    ['Dias finalizados', `${finMes}/30`],
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

        {/* ══════════════════════════════════════════════════════ CONFIG */}
        <div className={`tab-content ${activeTab === 'config' ? 'active' : ''}`}>

          {/* Minhas Metas */}
          <div className="card">
            <div className="card-title">Minhas Metas</div>
            <div className="config-goals">
              {([
                { key: 'cals', label: 'Calorias', unit: 'kcal' },
                { key: 'p',    label: 'Proteína',    unit: 'g' },
                { key: 'c',    label: 'Carboidrato',  unit: 'g' },
                { key: 'f',    label: 'Gordura',      unit: 'g' },
              ] as { key: keyof typeof DEFAULT_GOALS; label: string; unit: string }[]).map(({ key, label, unit }) => (
                <div key={key} className="config-goal-row">
                  <label className="config-goal-label">{label}</label>
                  <div className="config-goal-input-wrap">
                    <input
                      type="number"
                      className="config-goal-input"
                      value={userGoals[key]}
                      onChange={e => updateGoal(key, e.target.value)}
                    />
                    <span className="config-goal-unit">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-cancel" style={{ marginTop: 12 }} onClick={resetGoals}>
              ↩ Reset Padrão ({DEFAULT_GOALS.cals} kcal · P {DEFAULT_GOALS.p}g · C {DEFAULT_GOALS.c}g · G {DEFAULT_GOALS.f}g)
            </button>
          </div>

          {/* Meu Cardápio */}
          <div className="card">
            <div className="card-title">Meu Cardápio</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Toque em 🔄 na aba Hoje para substituir qualquer alimento. As substituições ficam salvas aqui.
            </p>
            {MEALS.map((meal, mealIdx) => (
              <div key={mealIdx} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>
                  {meal[0]}
                </div>
                {meal[1].map((item, itemIdx) => {
                  const globalIdx = MEAL_GROUPS.slice(0, mealIdx).reduce((a, b) => a + b, 0) + itemIdx
                  const sub = substitutes[globalIdx]
                  return (
                    <div key={globalIdx} className="config-item-row">
                      <div>
                        <div style={{ fontSize: 13 }}>{sub ? sub : item[0]}</div>
                        {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>original: {item[0]}</div>}
                      </div>
                      {sub && (
                        <button className="config-reset-btn" onClick={() => chooseSubstitute(globalIdx, null)}>
                          ↩
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            {Object.keys(substitutes).length > 0 && (
              <button className="btn btn-cancel" style={{ marginTop: 8 }}
                onClick={() => { setSubstitutes({}); saveData({ substitutes: {} }) }}>
                ↩ Resetar todos os substitutos
              </button>
            )}
          </div>

        </div>
      </div>

      <footer>💪 Consistência vence tudo. Você consegue!</footer>
    </div>
  )
}
