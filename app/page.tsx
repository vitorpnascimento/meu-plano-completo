'use client'

import { useState, useEffect } from 'react'

const MACROS_PER_ITEM = [
  { kcal: 155, p: 12, c: 1, f: 11 },
  { kcal: 150, p: 5, c: 28, f: 2 },
  { kcal: 60, p: 3, c: 1, f: 5 },
  { kcal: 25, p: 0, c: 6, f: 0 },
  { kcal: 10, p: 0, c: 2, f: 0 },
  { kcal: 280, p: 52, c: 0, f: 8 },
  { kcal: 130, p: 3, c: 28, f: 0 },
  { kcal: 20, p: 1, c: 4, f: 0 },
  { kcal: 20, p: 1, c: 4, f: 0 },
  { kcal: 150, p: 5, c: 28, f: 2 },
  { kcal: 120, p: 24, c: 0, f: 2 },
  { kcal: 45, p: 2, c: 0, f: 4 },
  { kcal: 25, p: 0, c: 6, f: 0 },
  { kcal: 10, p: 0, c: 0, f: 1 },
  { kcal: 280, p: 52, c: 0, f: 8 },
  { kcal: 100, p: 2, c: 23, f: 0 },
  { kcal: 20, p: 1, c: 4, f: 0 },
  { kcal: 120, p: 25, c: 2, f: 1 },
  { kcal: 165, p: 20, c: 12, f: 4 },
  { kcal: 15, p: 0, c: 3, f: 0 }
]

const MEALS: [string, string[][]][] = [
  ["Refeição 1 - Café da Manhã (400 kcal)", [
    ["2 ovos inteiros", "155 kcal | P: 12g C: 1g G: 11g"],
    ["2 fatias de pão ou 1 francês", "150 kcal | P: 5g C: 28g G: 2g"],
    ["20-30g requeijão/cream cheese", "60 kcal | P: 3g C: 1g G: 5g"],
    ["1 fruta (banana/maçã/morango)", "25 kcal | P: 0g C: 6g G: 0g"],
    ["Café sem açúcar", "10 kcal | P: 0g C: 2g G: 0g"]
  ]],
  ["Refeição 2 - Almoço (450 kcal)", [
    ["160g frango/carne magra", "280 kcal | P: 52g C: 0g G: 8g"],
    ["150g arroz branco", "130 kcal | P: 3g C: 28g G: 0g"],
    ["Vegetais cozidos à vontade", "20 kcal | P: 1g C: 4g G: 0g"],
    ["Salada crua à vontade", "20 kcal | P: 1g C: 4g G: 0g"]
  ]],
  ["Refeição 3 - Lanche (350 kcal)", [
    ["2 fatias de pão ou 1 francês", "150 kcal | P: 5g C: 28g G: 2g"],
    ["100g frango desfiado ou 4 fatias peru", "120 kcal | P: 24g C: 0g G: 2g"],
    ["15g requeijão", "45 kcal | P: 2g C: 0g G: 4g"],
    ["1 fruta pequena", "25 kcal | P: 0g C: 6g G: 0g"],
    ["10g castanha/amêndoa (extra)", "10 kcal | P: 0g C: 0g G: 1g"]
  ]],
  ["Refeição 4 - Jantar (400 kcal)", [
    ["160g frango/peixe/carne magra", "280 kcal | P: 52g C: 0g G: 8g"],
    ["120-150g arroz ou batata/aipim", "100 kcal | P: 2g C: 23g G: 0g"],
    ["Vegetais + salada", "20 kcal | P: 1g C: 4g G: 0g"]
  ]],
  ["Refeição 5 - Ceia (300 kcal)", [
    ["1 scoop whey (30g)", "120 kcal | P: 25g C: 2g G: 1g"],
    ["1 iogurte natural (165g)", "165 kcal | P: 20g C: 12g G: 4g"],
    ["10-15g aveia (opcional)", "15 kcal | P: 0g C: 3g G: 0g"]
  ]]
]

const MEAL_GROUPS = [5, 4, 5, 3, 3]
const MACRO_GOALS = { p: 195, c: 245, f: 63 }

export default function Home() {
  const [activeTab, setActiveTab] = useState('hoje')
  const [mealsData, setMealsData] = useState({})
  const [dayComplete, setDayComplete] = useState({})
  const [trainingData, setTrainingData] = useState({})
  const [weightsData, setWeightsData] = useState({})
  const [notesData, setNotesData] = useState({})
  const [cardioMinutes, setCardioMinutes] = useState('30')
  const [cardioTime, setCardioTime] = useState(0)
  const [isCardioRunning, setIsCardioRunning] = useState(false)
  const [mealCheckboxes, setMealCheckboxes] = useState([])

  const getToday = () => new Date().toISOString().split('T')[0]

  useEffect(() => {
    const saved = localStorage.getItem('dietAppData')
    if (saved) {
      const data = JSON.parse(saved)
      setMealsData(data.meals || {})
      setDayComplete(data.dayComplete || {})
      setTrainingData(data.training || {})
      setWeightsData(data.weights || {})
      setNotesData(data.notes || {})
    }
    
    // Initialize checkboxes state
    initializeMealCheckboxes()
  }, [])

  const initializeMealCheckboxes = () => {
    const today = getToday()
    const todayMeals = mealsData[today] || {}
    const checkboxes = MACROS_PER_ITEM.map((_, idx) => todayMeals[idx] === true)
    setMealCheckboxes(checkboxes)
  }

  const saveData = (overrides = {}) => {
    localStorage.setItem('dietAppData', JSON.stringify({
      meals: mealsData,
      dayComplete,
      training: trainingData,
      weights: weightsData,
      notes: notesData,
      ...overrides
    }))
  }

  const toggleMeal = (idx) => {
    const today = getToday()
    const newMeals = { ...mealsData }
    if (!newMeals[today]) newMeals[today] = {}

    if (newMeals[today][idx]) {
      delete newMeals[today][idx]
    } else {
      newMeals[today][idx] = true
    }

    setMealsData(newMeals)
    const newCheckboxes = [...mealCheckboxes]
    newCheckboxes[idx] = !newCheckboxes[idx]
    setMealCheckboxes(newCheckboxes)
    saveData({ meals: newMeals })
  }

  const toggleDayComplete = () => {
    const today = getToday()
    const newDayComplete = { ...dayComplete, [today]: !dayComplete[today] }
    setDayComplete(newDayComplete)
    saveData({ dayComplete: newDayComplete })
  }

  const addWeight = (weight, date = null) => {
    const finalDate = date || getToday()
    const newWeights = { ...weightsData, [finalDate]: parseFloat(weight) }
    setWeightsData(newWeights)
    saveData({ weights: newWeights })
  }

  const addNote = (text) => {
    const today = getToday()
    const newNotes = { ...notesData }
    if (!newNotes[today]) newNotes[today] = []
    newNotes[today].push({
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    })
    setNotesData(newNotes)
    saveData({ notes: newNotes })
  }

  const calculateMacros = () => {
    const today = getToday()
    const todayMeals = mealsData[today] || {}
    let totalCals = 0, totalP = 0, totalC = 0, totalF = 0, mealsCompleted = 0
    let itemIdx = 0
    
    for (let meal = 0; meal < MEAL_GROUPS.length; meal++) {
      let mealItemsChecked = 0
      for (let i = 0; i < MEAL_GROUPS[meal]; i++) {
        if (todayMeals[itemIdx]) {
          mealItemsChecked++
          totalCals += MACROS_PER_ITEM[itemIdx].kcal
          totalP += MACROS_PER_ITEM[itemIdx].p
          totalC += MACROS_PER_ITEM[itemIdx].c
          totalF += MACROS_PER_ITEM[itemIdx].f
        }
        itemIdx++
      }
      if (mealItemsChecked === MEAL_GROUPS[meal]) mealsCompleted++
    }
    
    return { totalCals, totalP, totalC, totalF, mealsCompleted }
  }

  const { totalCals, totalP, totalC, totalF, mealsCompleted } = calculateMacros()

  useEffect(() => {
    let interval
    if (isCardioRunning && cardioTime > 0) {
      interval = setInterval(() => {
        setCardioTime(prev => prev - 1)
      }, 1000)
    } else if (cardioTime === 0 && isCardioRunning) {
      setIsCardioRunning(false)
    }
    return () => clearInterval(interval)
  }, [isCardioRunning, cardioTime])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div>
      <header>
        <div className="header-content">
          <h1>💪 Meu Plano</h1>
          <div className="subtitle">Acompanhamento de Dieta & Treino</div>
        </div>
      </header>

      <div className="container">
        <div className="tabs">
          {['hoje', 'peso', 'cardio', 'notas'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* TAB: HOJE */}
        <div className={`tab-content ${activeTab === 'hoje' ? 'active' : ''}`}>
          <div className="day-complete-card">
            <div 
              className={`day-complete-checkbox ${dayComplete[getToday()] ? 'checked' : ''}`}
              onClick={toggleDayComplete}
            >
              {dayComplete[getToday()] ? '✓' : '◯'}
            </div>
            <div className="day-complete-text">
              Dia Cumprido: <span>{dayComplete[getToday()] ? 'Sim ✓' : 'Não'}</span>
            </div>
          </div>

          <div className="stats">
            <div className="stat-box">
              <div className="stat-value">{mealsCompleted}/5</div>
              <div className="stat-label">Refeições</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{totalCals}</div>
              <div className="stat-label">kcal</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{Math.min(100, Math.round((totalCals / 1900) * 100))}%</div>
              <div className="stat-label">Meta</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Macronutrientes (Tempo Real)</div>
            <div className="macros-grid">
              <div className="macro-box">
                <div className="macro-label">Proteína</div>
                <div className="macro-value">{totalP}g</div>
                <div className="macro-goal">Meta: 195g</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (totalP / 195) * 100)}%` }}></div>
                </div>
              </div>
              <div className="macro-box">
                <div className="macro-label">Carboidrato</div>
                <div className="macro-value">{totalC}g</div>
                <div className="macro-goal">Meta: 245g</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (totalC / 245) * 100)}%` }}></div>
                </div>
              </div>
              <div className="macro-box">
                <div className="macro-label">Gordura</div>
                <div className="macro-value">{totalF}g</div>
                <div className="macro-goal">Meta: 63g</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (totalF / 63) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {MEALS.map((meal, mealIdx) => (
            <div key={mealIdx} className="card">
              <div className="card-title">{meal[0]}</div>
              {meal[1].map((item, itemIdx) => {
                const globalIdx = MEAL_GROUPS.slice(0, mealIdx).reduce((a, b) => a + b, 0) + itemIdx
                return (
                  <div
                    key={globalIdx}
                    className="meal-item"
                    onClick={() => toggleMeal(globalIdx)}
                  >
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

        {/* TAB: PESO */}
        <div className={`tab-content ${activeTab === 'peso' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-title">Registrar Peso</div>
            <input type="number" placeholder="Seu peso em kg" step="0.1" id="weight-input" />
            <button 
              className="btn"
              onClick={() => {
                const weight = (document.getElementById('weight-input') as HTMLInputElement).value
                if (weight) {
                  addWeight(weight)
                  ;(document.getElementById('weight-input') as HTMLInputElement).value = ''
                }
              }}
            >
              Registrar
            </button>
          </div>

          <div className="card">
            <div className="card-title">Histórico</div>
            {Object.entries(weightsData).reverse().map(([date, weight]: any, idx) => (
              <div key={date} style={{ padding: '12px', background: 'var(--dark)', borderRadius: '6px', marginBottom: '8px', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--primary)' }}>{weight}kg</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(date).toLocaleDateString('pt-BR')}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Meta Inicial</div>
            <div className="stats">
              <div className="stat-box">
                <div className="stat-value">100kg</div>
                <div className="stat-label">Peso Atual</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">-0.5kg</div>
                <div className="stat-label">Meta em 4 Semanas</div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB: CARDIO */}
        <div className={`tab-content ${activeTab === 'cardio' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-title">Timer de Cardio</div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Minutos</label>
              <input 
                type="number" 
                value={cardioMinutes}
                onChange={(e) => setCardioMinutes(e.target.value)}
                min="1"
              />
            </div>
            <div style={{ fontSize: '48px', fontWeight: 'bold', textAlign: 'center', color: 'var(--primary)', margin: '30px 0' }}>
              {formatTime(cardioTime || parseInt(cardioMinutes) * 60)}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-small"
                onClick={() => {
                  setCardioTime(parseInt(cardioMinutes) * 60)
                  setIsCardioRunning(!isCardioRunning)
                }}
                style={{ background: isCardioRunning ? 'var(--warning)' : 'var(--primary)' }}
              >
                {isCardioRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <button 
                className="btn btn-small"
                onClick={() => {
                  setCardioTime(0)
                  setIsCardioRunning(false)
                }}
                style={{ background: 'var(--warning)' }}
              >
                Resetar
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Plano Recomendado</div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Semanas 1-2</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>20-30 min cardio, 4-5x por semana</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Semana 3</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Avaliação: continue ou ajuste intensidade</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Semana 4</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Aumento progressivo ou manutenção</div>
            </div>
          </div>
        </div>

        {/* TAB: NOTAS */}
        <div className={`tab-content ${activeTab === 'notas' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-title">Adicionar Nota</div>
            <textarea 
              placeholder="Como você se sentiu? Comeu fora? Dicas?"
              rows={3}
              id="note-input"
              style={{ marginBottom: '12px' }}
            ></textarea>
            <button 
              className="btn"
              onClick={() => {
                const text = (document.getElementById('note-input') as HTMLTextAreaElement).value
                if (text.trim()) {
                  addNote(text)
                  ;(document.getElementById('note-input') as HTMLTextAreaElement).value = ''
                }
              }}
            >
              Salvar Nota
            </button>
          </div>

          <div className="card">
            <div className="card-title">Minhas Notas</div>
            {notesData[getToday()]?.map((note: any, idx: number) => (
              <div key={idx} style={{ padding: '8px', background: 'var(--dark)', borderRadius: '4px', borderLeft: '2px solid var(--primary)', marginBottom: '8px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{note.timestamp}</strong><br />
                {note.text}
              </div>
            )) || <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Nenhuma nota ainda</div>}
          </div>
        </div>
      </div>

      <footer>
        💪 Consistência vence tudo. Você consegue!
      </footer>
    </div>
  )
}
