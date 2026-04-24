'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ClipboardList, Scale, BarChart3, Settings,
  Flag, CheckCircle2, RotateCcw,
  Sun, Moon,
  FileDown, Copy, ArrowLeft,
  Camera, Trash2,
  Wifi, WifiOff, Cloud, RefreshCw,
  User as UserIcon, Target, Calculator, Utensils, ArrowLeftRight,
  TrendingUp, TrendingDown, Minus as MinusIcon,
  Dumbbell, Lightbulb, ChevronDown, Trophy,
  AlertTriangle, Plus as PlusIcon, Radio, Upload,
  Search, Zap, Bot, Flame, Coins, Sparkles, GripVertical, BookMarked,
  ShoppingCart, CalendarDays, Activity,
  Users, Share2, Download,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { User } from 'firebase/auth'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import {
  isFirebaseConfigured,
  subscribeToAuthState,
  logoutUser,
  saveUserData,
  subscribeToUserData,
  loadUserProfile,
  saveUserProfile,
  shareDiet as fbShareDiet,
  loadDietByCode,
  updateDietPublic,
  loadPublicDiets,
  deleteSharedDiet,
  shareSubstitution,
  loadPublicSubstitutions,
  shareCustomFood,
  loadPublicCustomFoods,
  type UserProfile,
  type SharedDiet,
  type CommunitySubstitution,
  type CommunityFood,
} from '../lib/firebase'
import LoginScreen from './components/LoginScreen'
import ProfileSetup from './components/ProfileSetup'
import {
  searchTACO, fuzzyMatchTACO, generateDiet, getSubstitutes,
  getTodaySubstitutes, formatTacoItemName, naturalGrams, searchWithAI,
  BUDGET_IDS, FOOD_UNITS, DIET_VARIANT_COUNT, TACO,
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

interface CustomFood {
  id:            string
  name:          string
  kcal:          number
  p:             number
  c:             number
  f:             number
  grams:         number   // tamanho da porção padrão
  gramsPerUnit?: number   // gramas por unidade (ex: 25g/fatia)
  initialUnits?: number   // quantidade inicial padrão (ex: 2 fatias)
  createdBy?:    { uid: string; username: string; avatar: { type: 'preset'|'upload'; preset?: string; url?: string } }
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

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_IDS    = ['indigo','emerald','rose','orange','purple','cyan','amber','teal'] as const
const AVATAR_COLORS = ['#6366F1','#10B981','#F43F5E','#F97316','#8B5CF6','#06B6D4','#EAB308','#14B8A6']
const AVATAR_EMOJIS = ['💪','🥗','🎯','🏃','⚡','🏊','⭐','🌿']

function avatarBg(preset?: string)    { return AVATAR_COLORS[AVATAR_IDS.indexOf((preset ?? 'indigo') as any)] ?? '#6366F1' }
function avatarEmoji(preset?: string) { return AVATAR_EMOJIS[AVATAR_IDS.indexOf((preset ?? 'indigo') as any)] ?? '💪' }

function CommunityAvatar({ av, size = 32 }: { av: SharedDiet['authorAvatar']; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: av.type === 'upload' ? 'transparent' : avatarBg(av.preset),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, overflow: 'hidden', border: '2px solid var(--primary-mid)',
    }}>
      {av.type === 'upload' && av.url
        ? <img src={av.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
        : avatarEmoji(av.preset)
      }
    </div>
  )
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

/** Todas as refeições disponíveis para seleção (onboarding + gerenciamento) */
const ALL_MEAL_OPTIONS = [
  { id: 'cafe',         label: 'Café da Manhã',  desc: 'manhã cedo'       },
  { id: 'lanche_manha', label: 'Lanche da Manhã', desc: 'meio da manhã'   },
  { id: 'almoco',       label: 'Almoço',          desc: 'hora do almoço'  },
  { id: 'lanche',       label: 'Lanche da Tarde', desc: 'meio da tarde'   },
  { id: 'jantar',       label: 'Jantar',          desc: 'à noite'         },
  { id: 'ceia',         label: 'Ceia',            desc: 'antes de dormir' },
] as const

/** Participação calórica de cada refeição (usada na redistribuição ao adicionar/remover) */
const MEAL_CAL_SHARES: Record<string, number> = {
  cafe: 0.20, lanche_manha: 0.10, almoco: 0.35,
  lanche: 0.15, jantar: 0.25, ceia: 0.05,
}

/** Ordem canônica das refeições */
const MEAL_ORDER = ['cafe', 'lanche_manha', 'almoco', 'lanche', 'jantar', 'ceia']

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

// ─── Lista de Compras — unidades práticas de mercado ──────────────────────────

/** Unidades de compra contáveis e universais por ID TACO.
 *  Apenas itens com tamanho fixo e bem definido — tudo mais exibe em g/kg. */
const SHOPPING_PACK: Record<number, { label: string; size: number }> = {
  // Ovos (1 ovo ≈ 50g)
  19: { label: 'ovos',         size: 50  },
  20: { label: 'ovos',         size: 50  },
  21: { label: 'ovos',         size: 50  },
  // Iogurte natural (pote padrão de 165g)
  48: { label: 'potes (165g)', size: 165 },
  49: { label: 'potes (165g)', size: 165 },
  99: { label: 'potes (165g)', size: 165 },
  // Requeijão (pote padrão de 200g)
  54: { label: 'potes (200g)', size: 200 },
  98: { label: 'potes (200g)', size: 200 },
  // Whey / suplemento proteico (dose de 20g)
  55: { label: 'doses (20g)',  size: 20  },
  56: { label: 'doses (20g)',  size: 20  },
  57: { label: 'doses (20g)',  size: 20  },
  // Frutas contáveis
  58: { label: 'bananas',      size: 100 },  // Banana prata (1 un ≈ 100g)
  59: { label: 'bananas',      size: 80  },  // Banana nanica (1 un ≈ 80g)
  60: { label: 'maçãs',        size: 130 },  // Maçã fuji (1 un ≈ 130g)
}

/** Mapeia categorias TACO → categorias de mercado */
const TACO_CAT_TO_SHOP: Record<string, string> = {
  'Carnes':      'Proteínas',
  'Peixes':      'Proteínas',
  'Ovos':        'Proteínas',
  'Leguminosas': 'Grãos e Leguminosas',
  'Cereais':     'Cereais e Pães',
  'Tubérculos':  'Legumes e Verduras',
  'Laticínios':  'Laticínios',
  'Suplementos': 'Suplementos',
  'Frutas':      'Frutas',
  'Hortaliças':  'Legumes e Verduras',
  'Gorduras':    'Óleos e Gorduras',
  'Oleaginosas': 'Oleaginosas',
  'Condimentos': 'Outros',
  'Bebidas':     'Outros',
  'Outros':      'Outros',
}

const SHOP_CAT_ORDER = [
  'Proteínas', 'Laticínios', 'Cereais e Pães', 'Grãos e Leguminosas',
  'Legumes e Verduras', 'Frutas', 'Oleaginosas', 'Óleos e Gorduras',
  'Suplementos', 'Outros',
]

/** Extrai nome-base e gramas de um nome de item.
 *  Suporta: "Ovo cozido (2 un) 100g", "Frango 180g", "Requeijão (60g)" */
function parseItemName(fullName: string): { baseName: string; grams: number | null } {
  // "Name (Xword) Yg" — unidade entre parens, gramas fora
  const mUnit = fullName.match(/^(.+?)\s*\(\d+\s*\w+\)\s*(\d+)g$/)
  if (mUnit) return { baseName: mUnit[1].trim(), grams: parseInt(mUnit[2]) }
  // "Name Yg" — gramas simples no final
  const mSimple = fullName.match(/^(.+?)\s+(\d+)g$/)
  if (mSimple) return { baseName: mSimple[1].trim(), grams: parseInt(mSimple[2]) }
  // "Name (Yg)" — gramas dentro de parênteses
  const mParen = fullName.match(/^(.+?)\s*\((\d+)\s*g\)$/)
  if (mParen) return { baseName: mParen[1].trim(), grams: parseInt(mParen[2]) }
  return { baseName: fullName.trim(), grams: null }
}

/** Converte gramas semanais em quantidade de compra legível */
function toShoppingLabel(weeklyG: number, tacoId: number | null): string {
  const pack = tacoId !== null ? SHOPPING_PACK[tacoId] : undefined
  if (pack) {
    const qty = Math.ceil(weeklyG / pack.size)
    if (pack.label === 'kg') {
      const kg = (weeklyG / 1000).toFixed(1).replace('.', ',')
      return `${kg} kg`
    }
    const unitName = pack.label.replace(/\s*\(.*?\)/, '').trim()
    return `${qty} ${unitName} (${weeklyG.toLocaleString('pt-BR')}g)`
  }
  if (weeklyG >= 1000) return `${(weeklyG / 1000).toFixed(1).replace('.', ',')} kg`
  return `${weeklyG.toLocaleString('pt-BR')} g`
}

/** Normaliza nome para chave de deduplicação.
 *  Remove tudo a partir do primeiro parêntese (quantidade, unidade, gramas)
 *  e depois limpa pontuação, acentos e espaços. */
function normShopKey(name: string): string {
  return name
    .replace(/\s*\(.*/, '')           // remove a partir do primeiro "(" até o fim
    .replace(/\s+\d+\s*g?\s*$/i, '')  // remove número solto no final: "50g", "100"
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Busca o ID TACO para usar o SHOPPING_PACK apenas quando a correspondência é válida.
 *  Garante que a primeira palavra significativa do nome do item aparece no alimento encontrado,
 *  evitando falsos positivos como "doce de leite" → "Leite de vaca" → litros. */
function getValidTacoMatch(baseName: string): { id: number; cat: string } | null {
  const match = fuzzyMatchTACO(baseName)
  if (!match) return null
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const matchNorm  = n(match.nome)
  const firstWord  = n(baseName).split(/[\s,]+/).find(w => w.length >= 3) ?? ''
  if (!firstWord || !matchNorm.includes(firstWord)) return null
  return { id: match.id, cat: match.cat }
}

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
  if (Math.abs(diff) <= 50) return { msg: 'No alvo! Você atingiu sua meta!',                                    color: 'var(--success)', badge: '●' }
  if (diff < 0)             return { msg: `Você comeu pouco! Margem: +${Math.abs(diff)} kcal pra próximos dias`, color: 'var(--warning)', badge: '●' }
  return                           { msg: `Passou da meta em ${diff} kcal. Pode compensar amanhã`,               color: 'var(--warning)', badge: '●' }
}

function macroDesc(item: { kcal: number; p: number; c: number; f: number }) {
  return `${item.kcal} kcal · P ${item.p}g · C ${item.c}g · G ${item.f}g`
}

/** Fonte única de verdade para metas de macros.
 *  Proteína: 2g/kg (máx 40% das kcal) · Gordura: 25% · Carbo: resto */
function computeMacros(targetCals: number, pesoKg: number): { p: number; c: number; f: number } {
  // Cap protein at 40 % of calories so carbs never go negative
  const rawP = Math.round(pesoKg * 2)
  const p    = Math.min(rawP, Math.floor(targetCals * 0.40 / 4))
  const f    = Math.round(targetCals * 0.25 / 9)
  const c    = Math.max(0, Math.round((targetCals - p * 4 - f * 9) / 4))
  return { p, c, f }
}

/** Mínimo de calorias seguro para geração/cálculo de dieta. */
const MIN_SAFE_CALS = 1000

/** Escala todos os itens de uma refeição proporcionalmente para atingir targetKcal. */
function scaleMealItems(meal: Meal, targetKcal: number): Meal {
  const currentKcal = meal.items.reduce((s, it) => s + it.kcal, 0)
  if (currentKcal === 0 || targetKcal === currentKcal) return meal
  const ratio = targetKcal / currentKcal
  return {
    ...meal,
    items: meal.items.map(it => ({
      ...it,
      kcal: Math.round(it.kcal * ratio),
      p:    +(it.p * ratio).toFixed(1),
      c:    +(it.c * ratio).toFixed(1),
      f:    +(it.f * ratio).toFixed(1),
    })),
  }
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
  if      (pct >= 80) insights.push(`${pct}% de adesão — excelente!`)
  else if (pct >= 50) insights.push(`${pct}% de adesão — bom progresso, pode melhorar`)
  else if (n   >   1) insights.push(`${pct}% de adesão — foco nos próximos dias`)

  const margin = avgCals - goals.cals
  if (Math.abs(margin) <= 150)  insights.push(`Média calórica: ${avgCals} kcal/dia (${margin >= 0 ? '+' : ''}${margin} da meta)`)
  else if (margin < 0)          insights.push(`Média calórica baixa: ${avgCals} kcal/dia — tente consumir mais`)
  else                          insights.push(`Média calórica alta: ${avgCals} kcal/dia (+${margin} kcal acima da meta)`)

  if (weightDiff !== null) {
    if      (weightDiff < 0) insights.push(`Perdeu ${Math.abs(weightDiff)}kg no período`)
    else if (weightDiff > 0) insights.push(`Ganhou ${weightDiff}kg no período`)
    else                     insights.push(`Peso estável no período`)
    if (weeklyTrend !== null && dates.length >= 7)
      insights.push(`Tendência: ${weeklyTrend > 0 ? '+' : ''}${weeklyTrend}kg/semana`)
  }
  if (avgP >= goals.p) insights.push(`Proteína em dia: ${avgP}g/dia (meta ${goals.p}g)`)
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

const BLANK_ITEM_FORM = { name: '', kcal: '', p: '', c: '', f: '', hasUnits: false as boolean, gramsPerUnit: '' as string, initialUnits: '' as string }
const BLANK_SUB_FORM  = { name: '', kcal: '', p: '', c: '', f: '', targetId: '' }

function SyncIcon({ status }: { status: SyncStatus }) {
  if (status === 'synced')  return <Wifi size={14} style={{ color:'var(--success)' }} />
  if (status === 'idle')    return <Cloud size={14} />
  if (status === 'syncing') return <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
  if (status === 'offline') return <WifiOff size={14} style={{ color:'var(--error)' }} />
  if (status === 'error')   return <AlertTriangle size={14} style={{ color:'var(--error)' }} />
  return null
}

/** Adiciona alimento à biblioteca pessoal sem duplicar por nome. Puro — sem side effects. */
function addFoodToLibrary(
  current: CustomFood[],
  item: { name: string; kcal: number; p: number; c: number; f: number; gramsPerUnit?: number; initialUnits?: number },
  grams = 100,
  createdBy?: CustomFood['createdBy'],
): CustomFood[] {
  const name = item.name.trim()
  if (!name || current.some(cf => cf.name.toLowerCase() === name.toLowerCase())) return current
  const entry: CustomFood = { id: newId(), name, kcal: item.kcal, p: item.p, c: item.c, f: item.f, grams }
  if (item.gramsPerUnit !== undefined) entry.gramsPerUnit = item.gramsPerUnit
  if (item.initialUnits !== undefined) entry.initialUnits = item.initialUnits
  if (createdBy) entry.createdBy = createdBy
  return [...current, entry]
}

/** Pesquisa na biblioteca pessoal por correspondência simples (case-insensitive). */
function searchCustomFoods(query: string, foods: CustomFood[]): CustomFood[] {
  if (!query || query.trim().length < 2) return []
  const q = query.toLowerCase()
  return foods.filter(f => f.name.toLowerCase().includes(q))
}

// ─── SortableItemBlock ─────────────────────────────────────────────────────────

interface SortableItemBlockProps {
  item:     MealItem
  onEdit:   () => void
  onDelete: () => void
}

function SortableItemBlock({ item, onEdit, onDelete }: SortableItemBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="config-item-row">
      <button className="meal-drag-handle item-drag-handle" {...attributes} {...listeners} tabIndex={-1} title="Arrastar para reordenar">
        <GripVertical size={13}/>
      </button>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div>
        <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{macroDesc(item)}</div>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="config-reset-btn" onClick={onEdit}>Editar</button>
        <button className="config-reset-btn" style={{ color:'var(--warning)' }} onClick={onDelete}>✕</button>
      </div>
    </div>
  )
}

// ─── SortableMealBlock ─────────────────────────────────────────────────────────

interface SortableMealBlockProps {
  meal:             Meal
  mealIdx:          number
  dndSensors:       ReturnType<typeof useSensors>
  onEditItem:       (item: MealItem) => void
  onDeleteItem:     (itemId: string) => void
  onAddManual:      () => void
  onSearchTACO:     () => void
  onItemsReorder:   (newItems: MealItem[]) => void
  onOpenMyFoods:    () => void
  hasCustomFoods:   boolean
}

function SortableMealBlock({
  meal, mealIdx: _mealIdx, dndSensors,
  onEditItem, onDeleteItem, onAddManual, onSearchTACO, onItemsReorder,
  onOpenMyFoods, hasCustomFoods,
}: SortableMealBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meal.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    marginBottom: 20,
  }

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const items = meal.items ?? []
    const oldIdx = items.findIndex(it => it.id === active.id)
    const newIdx = items.findIndex(it => it.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    onItemsReorder(arrayMove(items, oldIdx, newIdx))
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <button
          className="meal-drag-handle"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          title="Arrastar refeição para reordenar"
        >
          <GripVertical size={15}/>
        </button>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--primary)' }}>
          {meal.title} · ~{(meal.items ?? []).reduce((s, it) => s + it.kcal, 0)} kcal
        </div>
      </div>
      {/* Itens com drag-and-drop interno */}
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleItemDragEnd}
      >
        <SortableContext items={(meal.items ?? []).map(it => it.id)} strategy={verticalListSortingStrategy}>
          {(meal.items ?? []).map(item => (
            <SortableItemBlock
              key={item.id}
              item={item}
              onEdit={() => onEditItem(item)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <div style={{ display:'flex', gap:6, marginTop:8 }}>
        <button className="config-reset-btn" style={{ flex:1, textAlign:'center' }} onClick={onAddManual}>+ Adicionar manual</button>
        {hasCustomFoods && (
          <button className="config-reset-btn my-foods-btn" style={{ flex:1, textAlign:'center' }} onClick={onOpenMyFoods}>
            <BookMarked size={13}/> Meus Alimentos
          </button>
        )}
        <button className="config-reset-btn" style={{ flex:1, textAlign:'center' }} onClick={onSearchTACO}><Search size={13}/> Buscar TACO</button>
      </div>
    </div>
  )
}

// ─── Home ──────────────────────────────────────────────────────────────────────

export default function Home() {

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [authUser,      setAuthUser]      = useState<User | null>(null)
  const [authLoading,   setAuthLoading]   = useState(true)
  const [userProfile,   setUserProfile]   = useState<UserProfile | null | undefined>(undefined)
  const [editingProfile,setEditingProfile]= useState(false)

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
  const [isDark, setIsDark] = useState(false) // light por padrão

  // ── Onboarding ───────────────────────────────────────────────────────────────
  // 0=off  1=modal boas-vindas  2=hint calc  3=hint dieta  4=done toast
  const [onboardingStep, setOnboardingStep] = useState<0|1|2|3|4>(0)
  // Tela dedicada de onboarding (fluxo guiado: passo 1=calc, passo 2=refeições, passo 3=gerar dieta)
  const [onboardingScreen,     setOnboardingScreen]     = useState(false)
  const [onboardingScreenStep, setOnboardingScreenStep] = useState<1|2|3>(1)
  const [onboardingMealIds,    setOnboardingMealIds]    = useState<string[]>([])
  const [customCalGoal,        setCustomCalGoal]        = useState('')

  // ── Gerenciar refeições ──────────────────────────────────────────────────────
  const [refeicaoToast,   setRefeicaoToast]   = useState(false)
  const [mealManageWarn,  setMealManageWarn]  = useState(false)

  // ── Setup gate ───────────────────────────────────────────────────────────────
  // Sugestão de regerar dieta quando meta calórica muda
  const [suggestRegen, setSuggestRegen] = useState(false)
  // Seções expansíveis do Config — todas fechadas por padrão
  const [configSections, setConfigSections] = useState<Record<string, boolean>>({})

  const [showFinalize,            setShowFinalize]            = useState(false)
  const [finObs,                  setFinObs]                  = useState('')
  const [finExtras,               setFinExtras]               = useState('')
  const [showWeightHistory,       setShowWeightHistory]       = useState(false)
  const [showDeleteWeightConfirm, setShowDeleteWeightConfirm] = useState(false)

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
  const [showTACO,            setShowTACO]            = useState(false)
  const [tacoQuery,           setTacoQuery]           = useState('')
  const [tacoResults,         setTacoResults]         = useState<TacoFood[]>([])
  const [tacoSelected,        setTacoSelected]        = useState<TacoFood | null>(null)
  const [tacoPorcao,          setTacoPorcao]          = useState('100')
  const [tacoMealIdx,         setTacoMealIdx]         = useState(0)
  // Biblioteca pessoal de alimentos
  const [customFoods,         setCustomFoods]         = useState<CustomFood[]>([])
  const [tacoCustomSelected,  setTacoCustomSelected]  = useState<CustomFood | null>(null)
  const [tacoCustomPorcao,    setTacoCustomPorcao]    = useState('')

  // ── Modal Meus Alimentos ──────────────────────────────────────────────────────
  const [showMyFoods,          setShowMyFoods]          = useState(false)
  const [myFoodsMealIdx,       setMyFoodsMealIdx]       = useState(0)
  const [myFoodsQuery,         setMyFoodsQuery]         = useState('')
  const [myFoodsDeleteConfirm, setMyFoodsDeleteConfirm] = useState<string | null>(null)
  const [myFoodsPendingAdd,    setMyFoodsPendingAdd]    = useState<{ food: CustomFood; qty: number } | null>(null)

  // ── Comunidade ──────────────────────────────────────────────────────────────
  const [shareDietModal,   setShareDietModal]   = useState<null|{code:string;isPublic:boolean}>(null)
  const [shareDietLoading, setShareDietLoading] = useState(false)
  const [dietCodeModal,    setDietCodeModal]    = useState(false)
  const [dietCodeInput,    setDietCodeInput]    = useState('')
  const [dietCodePreview,  setDietCodePreview]  = useState<SharedDiet|null>(null)
  const [dietCodeLoading,  setDietCodeLoading]  = useState(false)
  const [dietCodeError,    setDietCodeError]    = useState('')
  const [dietCodeConfirm,  setDietCodeConfirm]  = useState(false)
  const [communityDiets,      setCommunityDiets]      = useState<SharedDiet[]>([])
  const [communityDietsReady, setCommunityDietsReady] = useState(false)
  const [communityDietDetail, setCommunityDietDetail] = useState<SharedDiet|null>(null)
  const [communitySubs,      setCommunitySubs]      = useState<CommunitySubstitution[]>([])
  const [communityFoods,     setCommunityFoods]     = useState<CommunityFood[]>([])
  const [viewProfileModal,   setViewProfileModal]   = useState<null|{username:string;avatar:{type:'preset'|'upload';preset?:string;url?:string}}>(null)
  const [showFoodPicker,     setShowFoodPicker]     = useState(false)
  const [foodPickerQuery,    setFoodPickerQuery]    = useState('')
  const [foodPickerLoading,  setFoodPickerLoading]  = useState(false)
  const [foodPickerDone,     setFoodPickerDone]     = useState<string|null>(null)
  const [shareSubItem,   setShareSubItem]   = useState<null|{original:MealItem;sub:SubOption}>(null)
  const [shareSubReason, setShareSubReason] = useState('')
  const [shareSubDone,   setShareSubDone]   = useState(false)
  const [shareSubLoading,setShareSubLoading]= useState(false)

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
  const [calcDeficit,   setCalcDeficit]   = useState<'leve'|'mod'|'agr'|'custom'|null>(null)
  const [showBio,       setShowBio]       = useState(false)
  const bioFileRef = useRef<HTMLInputElement>(null)

  // ── Gerar Dieta ───────────────────────────────────────────────────────────────
  const [dietTarget,    setDietTarget]    = useState('')
  const [dietBudget,      setDietBudget]      = useState(false)
  const [dietVariantIdx,    setDietVariantIdx]    = useState(0)
  const [generatedDiet,     setGeneratedDiet]     = useState<GeneratedMeal[] | null>(null)
  const [dietSubModal,      setDietSubModal]      = useState<{mealIdx:number; itemIdx:number} | null>(null)
  const [dietSubs,          setDietSubs]          = useState<TacoFood[]>([])
  const [showHistoryModal,   setShowHistoryModal]   = useState(false)
  const [showShoppingModal,  setShowShoppingModal]  = useState(false)
  const [shoppingByMealOpen, setShoppingByMealOpen] = useState(false)

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

    // customFoods: biblioteca pessoal de alimentos
    if (Array.isArray(d.customFoods)) {
      setCustomFoods(d.customFoods)
    } else if (d.customFoods && typeof d.customFoods === 'object') {
      setCustomFoods(Object.values(d.customFoods))
    }

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
    setCustomFoods([])
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

  // ── Profile Load Effect ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isFirebaseConfigured() || !authUser) {
      setUserProfile(null)
      return
    }
    setUserProfile(undefined) // loading
    loadUserProfile(authUser.uid).then(p => setUserProfile(p))
  }, [authUser])

  // ── Data Load Effect (real-time Firestore sync) ──────────────────────────────

  useEffect(() => {
    if (!isFirebaseConfigured() || !authUser) return

    setSyncStatus('syncing')

    // Cache do localStorage (só usa se pertence a este usuário)
    const savedUserId = localStorage.getItem('dietUserId')
    const localRaw    = savedUserId === authUser.uid ? localStorage.getItem('dietAppData') : null
    const localData   = localRaw ? (() => { try { return JSON.parse(localRaw) } catch { return null } })() : null
    const localWH     = localData?.weightHistory || localData?.weights || {}

    let firstSnapshot = true

    const unsub = subscribeToUserData(authUser.uid, (fbData) => {
      if (firstSnapshot) {
        firstSnapshot = false
        if (fbData) {
          // Usuário existente: Firestore é autoritativo, restaura fotos locais
          applyData(fbData, localWH)
          setSyncStatus('synced')
        } else if (localData && Object.keys(localData).length > 0) {
          // Primeiro login neste device: migra localStorage pro Firestore
          applyData(localData)
          setSyncStatus('syncing')
          saveUserData(authUser.uid, localData).then(ok =>
            setSyncStatus(ok ? 'synced' : 'offline')
          )
        } else {
          // Novo usuário: dados zerados → mostra onboarding
          applyData({ meals: NEW_USER_MEALS, userGoals: NEW_USER_GOALS })
          setSyncStatus('idle')
          const done = localStorage.getItem(`onboarding_done_${authUser.uid}`)
          if (!done) setOnboardingStep(1)
        }
        localStorage.setItem('dietUserId', authUser.uid)
      } else if (fbData) {
        // Atualização em tempo real (outro device salvou)
        applyData(fbData, localWH)
        setSyncStatus('synced')
      } else {
        // null no snapshot subsequente = erro ou documento deletado
        setSyncStatus('offline')
      }
    })

    return unsub
  }, [authUser, applyData])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!openAlt) return
    const fn = () => setOpenAlt(null)
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [openAlt])

  // ── Tema: inicializa do localStorage (light por padrão) ─────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    setIsDark(saved === 'dark')
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

  useEffect(() => {
    if (activeTab === 'comunidade') handleLoadCommunity()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = (overrides: Record<string, any> = {}) => {
    const data = {
      meals, alternatives, activeSubs, checked, dayStats,
      weightHistory: weightsData, userGoals, customFoods,
      ...overrides,
    }
    // localStorage pode falhar em modo privado ou quando o storage estiver cheio
    try {
      localStorage.setItem('dietAppData', JSON.stringify(data))
    } catch {
      // Firebase ainda salva abaixo; dados não são perdidos se houver conexão
    }

    if (isFirebaseConfigured() && authUser) {
      setSyncStatus('syncing')
      saveUserData(authUser.uid, data)
        .then(ok => setSyncStatus(ok ? 'synced' : 'offline'))
        .catch(() => setSyncStatus('error'))
    }
  }

  // ── Ações: Auth ─────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logoutUser()
    localStorage.removeItem('dietUserId')
    // resetState() é chamado pelo onAuthStateChanged automaticamente
  }

  // ── Ações: Comunidade ────────────────────────────────────────────────────────

  const handleShareDiet = async () => {
    if (!authUser || !userProfile) return
    setShareDietLoading(true)
    const totalCals = meals.reduce((s, m) => s + m.items.reduce((ss: number, i: MealItem) => ss + i.kcal, 0), 0)
    const macros = meals.reduce((acc, m) => ({
      p: acc.p + m.items.reduce((s: number, i: MealItem) => s + i.p, 0),
      c: acc.c + m.items.reduce((s: number, i: MealItem) => s + i.c, 0),
      g: acc.g + m.items.reduce((s: number, i: MealItem) => s + i.f, 0),
    }), { p: 0, c: 0, g: 0 })
    const code = await fbShareDiet(authUser.uid, userProfile, meals as any, totalCals, macros)
    if (code) setShareDietModal({ code, isPublic: false })
    setShareDietLoading(false)
  }

  const handleTogglePublic = async (isPublic: boolean) => {
    if (!shareDietModal) return
    const ok = await updateDietPublic(shareDietModal.code, isPublic)
    if (ok) setShareDietModal({ ...shareDietModal, isPublic })
  }

  const handleDietCodeSearch = async () => {
    if (!dietCodeInput.trim()) return
    setDietCodeLoading(true); setDietCodeError(''); setDietCodePreview(null); setDietCodeConfirm(false)
    const diet = await loadDietByCode(dietCodeInput.trim())
    if (diet) setDietCodePreview(diet)
    else setDietCodeError('Código não encontrado. Verifique e tente novamente.')
    setDietCodeLoading(false)
  }

  const handleUseDiet = (diet: SharedDiet, withGoals = false) => {
    const newMeals = diet.dietData as Meal[]
    setMeals(newMeals)
    if (withGoals) {
      const newGoals = { cals: diet.totalCals, p: diet.macros.p, c: diet.macros.c, f: diet.macros.g }
      setUserGoals(newGoals)
      save({ meals: newMeals, userGoals: newGoals })
    } else {
      save({ meals: newMeals })
    }
    setDietCodeModal(false); setDietCodeInput(''); setDietCodePreview(null)
    setDietCodeError(''); setDietCodeConfirm(false)
    setCommunityDietDetail(null)
  }

  const handlePublishToCommunity = async () => {
    if (!authUser || !userProfile) return
    setShareDietLoading(true)
    const totalCals = meals.reduce((s, m) => s + m.items.reduce((ss: number, i: MealItem) => ss + i.kcal, 0), 0)
    const macros = meals.reduce((acc, m) => ({
      p: acc.p + m.items.reduce((s: number, i: MealItem) => s + i.p, 0),
      c: acc.c + m.items.reduce((s: number, i: MealItem) => s + i.c, 0),
      g: acc.g + m.items.reduce((s: number, i: MealItem) => s + i.f, 0),
    }), { p: 0, c: 0, g: 0 })
    const code = await fbShareDiet(authUser.uid, userProfile, meals as any, totalCals, macros)
    if (code) {
      await updateDietPublic(code, true)
      // Recarrega lista da comunidade
      const diets = await loadPublicDiets()
      setCommunityDiets(diets)
    }
    setShareDietLoading(false)
  }

  const handleLoadCommunity = async () => {
    if (communityDietsReady) return
    setCommunityDietsReady(true)
    const [diets, foods] = await Promise.all([loadPublicDiets(), loadPublicCustomFoods()])
    setCommunityDiets(diets)
    setCommunityFoods(foods)
  }

  const handleShareSub = async () => {
    if (!authUser || !userProfile || !shareSubItem) return
    setShareSubLoading(true)
    const { original, sub } = shareSubItem
    await shareSubstitution(authUser.uid, userProfile, {
      originalFood:     original.name,
      substituteFood:   sub.name,
      originalMacros:   { kcal: original.kcal, p: original.p, c: original.c, f: original.f },
      substituteMacros: { kcal: sub.kcal, p: sub.p, c: sub.c, f: sub.f },
      reason:           shareSubReason.trim(),
    })
    setShareSubDone(true)
    setShareSubLoading(false)
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
    const isChecking = !newChecked[today][itemId]
    if (newChecked[today][itemId]) delete newChecked[today][itemId]
    else newChecked[today][itemId] = true
    setChecked(newChecked)
    save({ checked: newChecked })
    // Fase 3: haptic feedback + check animation
    if (isChecking) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
      const el = document.getElementById(`chk-${itemId}`)
      if (el) { el.classList.add('check-anim'); el.addEventListener('animationend', () => el.classList.remove('check-anim'), { once: true }) }
    }
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

  const unfinalizarDia = () => {
    const today = getToday()
    const newDS = { ...dayStats, [today]: { ...dayStats[today], finalizado: false } }
    setDayStats(newDS)
    save({ dayStats: newDS })
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

  // Estado de rascunho para inputs de meta — permite campo vazio durante digitação
  const [goalDrafts, setGoalDrafts] = useState<Partial<Record<keyof typeof DEFAULT_GOALS, string>>>({})

  const handleGoalChange = (key: keyof typeof DEFAULT_GOALS, val: string) => {
    setGoalDrafts(prev => ({ ...prev, [key]: val }))
  }

  const handleGoalBlur = (key: keyof typeof DEFAULT_GOALS) => {
    const draft = goalDrafts[key]
    if (draft === undefined) return
    const num = parseInt(draft)
    const prev = userGoals[key]
    // Valor inválido ou zero → mantém o valor anterior
    const final = (!draft || isNaN(num) || num <= 0) ? prev : num
    setGoalDrafts(prev => { const n = { ...prev }; delete n[key]; return n })
    if (final !== userGoals[key]) {
      const ng = { ...userGoals, [key]: final }
      setUserGoals(ng); save({ userGoals: ng })
      if (meals.some(m => (m.items ?? []).length > 0)) setSuggestRegen(true)
    }
  }

  // Mantido para compatibilidade com outros usos (ex: geração de dieta via calculadora)
  const updateGoal = (key: keyof typeof DEFAULT_GOALS, val: string) => {
    const num = parseInt(val); if (isNaN(num) || num <= 0) return
    const ng = { ...userGoals, [key]: num }
    setUserGoals(ng); save({ userGoals: ng })
    if (num !== userGoals[key] && meals.some(m => (m.items ?? []).length > 0)) {
      setSuggestRegen(true)
    }
  }

  const resetGoals = () => { setUserGoals(DEFAULT_GOALS); save({ userGoals: DEFAULT_GOALS }) }

  // ── Ações: Cardápio ─────────────────────────────────────────────────────────

  const openItemModal = (mode: 'edit'|'add', mealIdx: number, item?: MealItem) => {
    setItemModal({ mode, mealIdx, item })
    setItemForm(item ? { name: item.name, kcal: String(item.kcal), p: String(item.p), c: String(item.c), f: String(item.f), hasUnits: false, gramsPerUnit: '', initialUnits: '' } : BLANK_ITEM_FORM)
  }

  const saveItemModal = () => {
    if (!itemModal) return
    const baseName = itemForm.name || 'Sem nome'
    const kcal = parseFloat(itemForm.kcal) || 0
    const p    = parseFloat(itemForm.p)    || 0
    const c    = parseFloat(itemForm.c)    || 0
    const f    = parseFloat(itemForm.f)    || 0

    // Calcular nome e unitQty se unidades estiverem ativadas
    const gramsPerUnit = itemForm.hasUnits ? (parseFloat(itemForm.gramsPerUnit) || 0) : 0
    const initialUnits = itemForm.hasUnits ? (parseInt(itemForm.initialUnits)  || 1) : 0
    const hasValidUnits = itemForm.hasUnits && gramsPerUnit > 0 && initialUnits > 0
    const totalGrams = hasValidUnits ? gramsPerUnit * initialUnits : 0

    const itemName = hasValidUnits
      ? `${baseName} (${initialUnits} un) ${totalGrams}g`
      : baseName

    const saved: MealItem = {
      id:   itemModal.item?.id || newId(),
      name: itemName,
      kcal, p, c, f,
      ...(hasValidUnits ? { unitQty: initialUnits } : {}),
    }
    const nm = meals.map((m, mi) => mi !== itemModal.mealIdx ? m : {
      ...m,
      items: itemModal.mode === 'edit'
        ? m.items.map(it => it.id === saved.id ? saved : it)
        : [...m.items, saved],
    })
    // Salva na biblioteca pessoal quando adicionando novo alimento
    let newCustomFoods = customFoods
    if (itemModal.mode === 'add') {
      const cb = userProfile ? { uid: authUser?.uid ?? '', username: userProfile.username, avatar: { type: userProfile.avatarType, preset: userProfile.avatarPreset, url: userProfile.avatarType === 'upload' ? userProfile.avatarUrl : undefined } } : undefined
      newCustomFoods = addFoodToLibrary(
        customFoods,
        { name: baseName, kcal, p, c, f,
          ...(hasValidUnits ? { gramsPerUnit, initialUnits } : {}) },
        hasValidUnits ? totalGrams : 100,
        cb as CustomFood['createdBy'],
      )
      if (newCustomFoods !== customFoods) setCustomFoods(newCustomFoods)
    }
    setMeals(nm)
    save({ meals: nm, customFoods: newCustomFoods })
    setItemModal(null)
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
    setTacoMealIdx(mealIdx); setTacoQuery(''); setTacoResults([]); setTacoSelected(null)
    setTacoPorcao('100'); setTacoCustomSelected(null); setTacoCustomPorcao('')
    setShowTACO(true)
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
    // Salva automaticamente na biblioteca pessoal
    const createdBy = userProfile ? { uid: authUser?.uid ?? '', username: userProfile.username, avatar: { type: userProfile.avatarType, preset: userProfile.avatarPreset, url: userProfile.avatarType === 'upload' ? userProfile.avatarUrl : undefined } } : undefined
    const newCustomFoods = addFoodToLibrary(customFoods, newItem, 100, createdBy as CustomFood['createdBy'])
    if (newCustomFoods !== customFoods) setCustomFoods(newCustomFoods)
    setMeals(nm)
    save({ meals: nm, customFoods: newCustomFoods })
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
      // Mifflin-St Jeor (mais preciso que Harris-Benedict)
      tmb = calcSexo === 'M'
        ? 10 * peso + 6.25 * altura - 5 * idade + 5
        : 10 * peso + 6.25 * altura - 5 * idade - 161
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
      emagrecer: Math.round(tdee * 0.75), // prévia: déficit moderado de 25%
      ganhar:    Math.round(tdee * 1.20), // prévia: superávit moderado de 20%
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
    // Fonte única de verdade: salva calorias + macros calculados pela fórmula
    const peso = parseFloat(calcPeso)
    const macros = peso > 0 ? computeMacros(cals, peso) : {}
    const ng = { ...userGoals, cals, ...macros }
    setUserGoals(ng)
    save({ userGoals: ng })
    // Tela dedicada de onboarding: avança para passo 2 (escolha de refeições) sem sair da tela
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

  // ── DnD: reordenar refeições ─────────────────────────────────────────────────

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleMealDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = meals.findIndex(m => m.id === active.id)
    const newIndex = meals.findIndex(m => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(meals, oldIndex, newIndex)
    setMeals(reordered)
    save({ meals: reordered })
  }

  // ── Ações: Reordenar alimentos dentro de uma refeição ────────────────────────

  const handleItemsReorder = (mealId: string, newItems: MealItem[]) => {
    const nm = meals.map(m => m.id === mealId ? { ...m, items: newItems } : m)
    setMeals(nm)
    save({ meals: nm })
  }

  // ── Ações: Gerenciar Refeições ───────────────────────────────────────────────

  const handleRemoveMeal = (mealId: string) => {
    if (meals.length <= 3) {
      setMealManageWarn(true)
      setTimeout(() => setMealManageWarn(false), 2500)
      return
    }
    const remaining = meals.filter(m => m.id !== mealId)
    const total     = userGoals.cals
    const totalShare = remaining.reduce((s, m) => s + (MEAL_CAL_SHARES[m.id] ?? 0.15), 0)
    const updated = remaining.map(m => {
      const share = MEAL_CAL_SHARES[m.id] ?? 0.15
      return scaleMealItems(m, Math.round(total * share / totalShare))
    })
    setMeals(updated)
    save({ meals: updated })
    setRefeicaoToast(true)
    setTimeout(() => setRefeicaoToast(false), 3000)
  }

  const handleAddMeal = (mealId: string) => {
    if (meals.length >= 6) return
    const option = ALL_MEAL_OPTIONS.find(o => o.id === mealId)
    if (!option) return
    const total      = userGoals.cals
    const allIds     = [...meals.map(m => m.id), mealId]
    const totalShare = allIds.reduce((s, id) => s + (MEAL_CAL_SHARES[id] ?? 0.15), 0)
    // Rescale existing meals
    const rescaled = meals.map(m => {
      const share = MEAL_CAL_SHARES[m.id] ?? 0.15
      return scaleMealItems(m, Math.round(total * share / totalShare))
    })
    // Generate items for the new meal
    const newMealKcal = Math.round(total * (MEAL_CAL_SHARES[mealId] ?? 0.15) / totalShare)
    const macroTargets = (userGoals.p > 0 && userGoals.c > 0 && userGoals.f > 0)
      ? { p: userGoals.p, c: userGoals.c, f: userGoals.f } : undefined
    const generated = generateDiet(newMealKcal, dietBudget, [mealId], macroTargets)
    const newMealItems: MealItem[] = generated.length > 0
      ? generated[0].items.map(gi => {
          const unitInfo = FOOD_UNITS[gi.food.id]
          const unitQty  = unitInfo ? Math.max(1, Math.round(gi.grams / unitInfo.unitWeight)) : undefined
          return {
            id: newId(), name: formatTacoItemName(gi.food, gi.grams),
            kcal: gi.kcal, p: gi.p, c: gi.c, f: gi.f,
            ...(unitQty !== undefined ? { unitQty } : {}),
          }
        })
      : []
    const newMeal: Meal = { id: mealId, title: option.label, items: newMealItems }
    const sorted = [...rescaled, newMeal].sort(
      (a, b) => MEAL_ORDER.indexOf(a.id) - MEAL_ORDER.indexOf(b.id)
    )
    setMeals(sorted)
    save({ meals: sorted })
    setRefeicaoToast(true)
    setTimeout(() => setRefeicaoToast(false), 3000)
  }

  // ── Ações: Gerar Dieta ────────────────────────────────────────────────────────

  const handleGenerateDiet = (variantIdx?: number) => {
    const target = parseInt(dietTarget)
    if (!target || target < MIN_SAFE_CALS) return
    const idx = variantIdx ?? 0
    setDietVariantIdx(idx)
    const macroTargets = (userGoals.p > 0 && userGoals.c > 0 && userGoals.f > 0)
      ? { p: userGoals.p, c: userGoals.c, f: userGoals.f }
      : undefined
    setGeneratedDiet(generateDiet(target, dietBudget, onboardingScreen ? onboardingMealIds : undefined, macroTargets, idx))
  }

  const handleNextDietVariant = () => {
    const next = (dietVariantIdx + 1) % DIET_VARIANT_COUNT
    handleGenerateDiet(next)
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
    // Fonte única de verdade: salva os macros REAIS entregues pela dieta gerada.
    // Isso garante que "Minha Meta" reflita exatamente o que o cardápio entrega.
    const allItems = generatedDiet.flatMap(m => m.items)
    const actualP  = Math.round(allItems.reduce((s, it) => s + it.p, 0))
    const actualC  = Math.round(allItems.reduce((s, it) => s + it.c, 0))
    const actualF  = Math.round(allItems.reduce((s, it) => s + it.f, 0))
    const actualKcal = allItems.reduce((s, it) => s + it.kcal, 0)
    const target = parseInt(dietTarget)
    const ng = {
      ...userGoals,
      cals: target > 0 ? target : actualKcal,
      p: actualP,
      c: actualC,
      f: actualF,
    }
    if (ng !== userGoals) setUserGoals(ng)
    setMeals(nm)
    save({ meals: nm, userGoals: ng })
    setGeneratedDiet(null)
    setActiveTab('hoje')
    setShowShoppingModal(true) // mostra lista de compras logo após salvar a dieta
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

  const weightHistoryAsc = useMemo(() =>
    Object.entries(weightsData as Record<string, any>)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, entry]) => ({
        date, label: dateLabel(date),
        peso: rawPeso(entry), foto: rawFoto(entry), calorias: rawCalorias(entry),
      }))
      .filter(e => e.peso !== null) as { date:string; label:string; peso:number; foto:string|null; calorias:number|null }[]
  , [weightsData])

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

  const weekDates  = useMemo(() => getLastNDates(7),  [])
  const monthDates = useMemo(() => getLastNDates(30), [])

  // Memoizado: 7 chamadas calcDayMacros só recalculam quando meals/checked/activeSubs mudam
  const weeklyChartData = useMemo(() => weekDates.map(d => ({
    label: dateLabel(d),
    cals: calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0),
  })), [weekDates, meals, checked, activeSubs, dayStats])

  // Memoizado: 30 chamadas calcDayMacros
  const monthlyChartData = useMemo(() => {
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
  }, [monthDates, meals, checked, activeSubs, dayStats])

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

  const dualChartData = useMemo(() =>
    monthDates
      .map(d => {
        const peso = rawPeso(weightsData[d])
        const cals = calcDayMacros(meals, checked[d] || {}, activeSubs).cals + (dayStats[d]?.caloriasExtras || 0)
        return { label: dateLabel(d), peso: peso ?? undefined, cals: cals > 0 ? cals : undefined }
      })
      .filter(d => d.peso !== undefined || d.cals !== undefined)
  , [monthDates, weightsData, meals, checked, activeSubs, dayStats])

  const weekFirstW     = weekWeightData[0]?.peso ?? null
  const weekLastW      = weekWeightData[weekWeightData.length - 1]?.peso ?? null
  const weekWeightDiff = weekFirstW !== null && weekLastW !== null ? +((weekLastW - weekFirstW).toFixed(1)) : null

  const weekBadgeColor = weekDiff < -200 ? 'var(--warning)' : weekDiff > 200 ? '#e53935' : 'var(--success)'
  const weekBadgeText  = weekDiff < 0 ? `${Math.abs(weekDiff)} kcal abaixo` : weekDiff > 0 ? `${weekDiff} kcal acima` : 'Semana no alvo'

  const allItemOptions = meals.flatMap(m => (m.items ?? []).map(it => ({ id: it.id, label: `${m.title} → ${it.name}` })))

  // ── Streak de dias consecutivos (≥70% da meta calórica ou dia finalizado) ────
  const streakDays = useMemo(() => {
    const threshold = userGoals.cals * 0.7
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const { cals } = calcDayMacros(meals, checked[key] || {}, activeSubs)
      const ok = cals >= threshold || !!dayStats[key]?.finalizado
      if (ok) { streak++; continue }
      if (i === 0) continue // hoje pode ainda não ter atingido
      break
    }
    return streak
  }, [checked, dayStats, meals, activeSubs, userGoals.cals])

  // ── Últimos 14 dias para o histórico compacto ────────────────────────────────
  const last14Days = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key  = d.toISOString().slice(0, 10)
      const macros = calcDayMacros(meals, checked[key] || {}, activeSubs)
      const extra  = dayStats[key]?.caloriasExtras ?? 0
      const totalCals = macros.cals + extra
      return {
        key,
        label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }),
        cals: totalCals,
        p: macros.p, c: macros.c, f: macros.f,
        finalizado: !!dayStats[key]?.finalizado,
        isToday: i === 0,
      }
    }).filter(d => d.cals > 0 || d.finalizado)
  , [checked, dayStats, meals, activeSubs])

  // ── Lista de compras semanal (por refeição) ───────────────────────────────────
  // ── Lista de compras: agrega, deduplica e converte para unidades práticas ────
  const shoppingData = useMemo(() => {
    type AggItem = { baseName: string; weeklyG: number; tacoId: number | null; cat: string; inMeals: string[] }
    const agg = new Map<string, AggItem>()

    // 1ª passagem: quais normShopKeys têm ao menos um item com grama explícita no nome
    const keysWithExplicitGrams = new Set<string>()
    for (const meal of meals) {
      for (const item of (meal.items ?? [])) {
        const { baseName, grams } = parseItemName(item.name)
        if (grams !== null) keysWithExplicitGrams.add(normShopKey(baseName))
      }
    }

    // 2ª passagem: agrega itens
    for (const meal of meals) {
      for (const item of (meal.items ?? [])) {
        const { baseName, grams } = parseItemName(item.name)
        const key = normShopKey(baseName)

        let dailyG = grams
        if (dailyG === null) {
          // Se outro item com mesmo nome tem grama explícita, este é duplicata sem dado — ignorar
          if (keysWithExplicitGrams.has(key)) continue
          // Item único sem grama no nome: estima pelas kcal + densidade TACO
          const tacoFood = TACO.find(f => f.id === getValidTacoMatch(baseName)?.id)
          if (tacoFood && tacoFood.kcal > 0 && item.kcal > 0) {
            dailyG = Math.round(item.kcal / tacoFood.kcal * 100)
          } else {
            dailyG = 100
          }
        }

        const weeklyG   = dailyG * 7
        const tacoMatch = getValidTacoMatch(baseName)
        const tacoId    = tacoMatch?.id ?? null
        const cat       = TACO_CAT_TO_SHOP[tacoMatch?.cat ?? ''] ?? 'Outros'
        const existing  = agg.get(key)
        if (existing) {
          existing.weeklyG += weeklyG
          if (!existing.inMeals.includes(meal.title)) existing.inMeals.push(meal.title)
          if (existing.tacoId === null && tacoId !== null) existing.tacoId = tacoId
        } else {
          agg.set(key, { baseName, weeklyG, tacoId, cat, inMeals: [meal.title] })
        }
      }
    }

    // Agrupa por categoria na ordem definida
    const byCat = new Map<string, { name: string; label: string; inMeals: string[] }[]>()
    for (const item of Array.from(agg.values())) {
      const entry = { name: item.baseName, label: toShoppingLabel(item.weeklyG, item.tacoId), inMeals: item.inMeals }
      const arr   = byCat.get(item.cat) ?? []
      arr.push(entry)
      byCat.set(item.cat, arr)
    }
    const byCategory = SHOP_CAT_ORDER
      .filter(cat => byCat.has(cat))
      .map(cat => ({ cat, items: byCat.get(cat)!.sort((a, b) => a.name.localeCompare(b.name)) }))

    // Vista por refeição (secundária)
    const byMeal = meals
      .filter(m => (m.items ?? []).length > 0)
      .map(m => ({
        title: m.title,
        items: (m.items ?? []).map(item => {
          const { baseName, grams } = parseItemName(item.name)
          const tacoId = getValidTacoMatch(baseName)?.id ?? null
          let dailyG = grams
          if (dailyG === null) {
            const tacoFood = TACO.find(f => f.id === tacoId)
            if (tacoFood && tacoFood.kcal > 0 && item.kcal > 0) {
              dailyG = Math.round(item.kcal / tacoFood.kcal * 100)
            } else {
              dailyG = 100
            }
          }
          const label = toShoppingLabel(dailyG * 7, tacoId)
          return { name: baseName, label }
        }),
      }))

    return { byCategory, byMeal, total: agg.size }
  }, [meals])

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
        <div className="auth-loading-logo"><Dumbbell size={40} style={{ color:'var(--primary)' }}/></div>
        <div className="auth-loading-text">Carregando...</div>
      </div>
    )
  }

  if (firebaseConfigured && !authUser) {
    return <LoginScreen />
  }

  // ── Perfil de usuário ────────────────────────────────────────────────────────
  if (firebaseConfigured && authUser && userProfile === undefined) {
    // Carregando perfil — reutiliza tela de loading
    return (
      <div className="auth-loading">
        <div className="auth-loading-logo"><Activity size={40} style={{ color:'var(--primary)' }}/></div>
        <div className="auth-loading-text">Carregando perfil...</div>
      </div>
    )
  }

  if (firebaseConfigured && authUser && userProfile === null && !editingProfile) {
    return (
      <ProfileSetup
        user={authUser}
        onComplete={p => setUserProfile(p)}
        onLogout={handleLogout}
      />
    )
  }

  if (editingProfile && authUser) {
    return (
      <ProfileSetup
        user={authUser}
        existingProfile={userProfile ?? undefined}
        onComplete={p => { setUserProfile(p); setEditingProfile(false) }}
        onLogout={handleLogout}
      />
    )
  }

  // ── Tela dedicada de onboarding ──────────────────────────────────────────────

  if (onboardingScreen) {
    const totalKcalOnb = generatedDiet ? generatedDiet.reduce((s, m) => s + m.actualKcal, 0) : 0
    const targetOnb    = parseInt(dietTarget) || 1
    const diffOnb      = totalKcalOnb - targetOnb
    const diffColorOnb = Math.abs(diffOnb) <= 100 ? 'var(--success)' : diffOnb > 0 ? 'var(--error)' : 'var(--warning)'
    const diffTextOnb  = Math.abs(diffOnb) <= 100 ? 'No alvo' : diffOnb > 0 ? `+${diffOnb} kcal acima` : `${Math.abs(diffOnb)} kcal abaixo`

    return (
      <div className="onb-screen">
        {/* Header */}
        <div className="onb-header">
          <div className="onb-logo"><Dumbbell size={20}/> Meu Plano</div>
          <div className="onb-progress-row">
            <div className={`onb-step-dot ${onboardingScreenStep >= 1 ? 'active' : ''} ${onboardingScreenStep > 1 ? 'done' : ''}`}>
              {onboardingScreenStep > 1 ? '✓' : '1'}
            </div>
            <div className={`onb-step-connector ${onboardingScreenStep > 1 ? 'done' : ''}`} />
            <div className={`onb-step-dot ${onboardingScreenStep >= 2 ? 'active' : ''} ${onboardingScreenStep > 2 ? 'done' : ''}`}>
              {onboardingScreenStep > 2 ? '✓' : '2'}
            </div>
            <div className={`onb-step-connector ${onboardingScreenStep > 2 ? 'done' : ''}`} />
            <div className={`onb-step-dot ${onboardingScreenStep >= 3 ? 'active' : ''}`}>3</div>
          </div>
          <div className="onb-step-subtitle">
            {onboardingScreenStep === 1
              ? 'Passo 1 — Calcule sua meta calórica'
              : onboardingScreenStep === 2
              ? 'Passo 2 — Escolha suas refeições'
              : 'Passo 3 — Gere sua dieta personalizada'}
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
                  <Radio size={14}/> Importar Bioimpedância <span className="bio-optional">(opcional)</span> <ChevronDown size={12} style={{ transform: showBio ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
                </button>
                {showBio && (
                  <div className="bio-content">
                    <div className="bio-upload-zone" onClick={() => bioFileRef.current?.click()}>
                      <div className="bio-upload-icon"><Upload size={28} style={{ color:'var(--primary)' }}/></div>
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
                    {calcGordura && <div className="bio-formula-note"><CheckCircle2 size={13}/> Usando Katch-McArdle (mais preciso com % gordura)</div>}
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
                <div className="activity-grid">
                  {([
                    { v:'sed',   label:'Sedentário',   desc:'sem exercício' },
                    { v:'leve',  label:'Leve',          desc:'1–3×/sem' },
                    { v:'mod',   label:'Moderado',      desc:'3–5×/sem' },
                    { v:'int',   label:'Intenso',       desc:'5–7×/sem' },
                    { v:'muito', label:'Muito Intenso', desc:'atleta' },
                  ] as const).map(({ v, label, desc }) => (
                    <button key={v}
                      className={`activity-btn ${calcAtividade === v ? 'active' : ''}`}
                      onClick={() => setCalcAtividade(v)}>
                      <span className="activity-btn-label">{label}</span>
                      <span className="activity-btn-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="calc-field" style={{ marginTop:10 }}>
                <label className="calc-label">Objetivo Principal</label>
                <div className="calc-obj-row">
                  {([
                    { v:'emagrecer', label:'Emagrecer' },
                    { v:'manter',    label:'Manter'    },
                    { v:'ganhar',    label:'Ganhar'    },
                  ] as const).map(({ v, label }) => (
                    <button key={v} className={`calc-obj-btn ${calcObjetivo === v ? 'active' : ''}`}
                      onClick={() => setCalcObjetivo(v)}>{label}</button>
                  ))}
                </div>
              </div>
              <button className="btn" style={{ marginTop:14 }} onClick={handleCalc}
                disabled={!calcPeso || !calcAltura || !calcIdade}>
                <Calculator size={15}/> Calcular
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
                      { obj:'emagrecer', label:'EMAGRECER', val:calcResult.emagrecer, desc:'déficit · perda de peso' },
                      { obj:'manter',    label:'MANTER',    val:calcResult.manter,    desc:'igual ao TDEE · manutenção' },
                      { obj:'ganhar',    label:'GANHAR',    val:calcResult.ganhar,    desc:'superávit · ganho de massa' },
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
                        {calcObjetivo === 'emagrecer' ? 'Escolha o déficit:' : 'Escolha o superávit:'}
                      </div>
                      <div className="deficit-row">
                        {([
                          { id:'leve', label:'Leve',      pctEm:15, pctGan:10, desc:'Confortável' },
                          { id:'mod',  label:'Moderado',  pctEm:25, pctGan:20, desc:'Recomendado' },
                          { id:'agr',  label:'Agressivo', pctEm:35, pctGan:30, desc:'Rápido' },
                        ] as const).map(({ id, label, pctEm, pctGan, desc }) => {
                          const pct  = calcObjetivo === 'emagrecer' ? pctEm : pctGan
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
                        <button
                          className={`deficit-btn ${calcDeficit === 'custom' ? 'active' : ''}`}
                          onClick={() => setCalcDeficit('custom')}>
                          <div className="deficit-btn-label">Meta própria</div>
                          <div className="deficit-btn-cals">—</div>
                          <div className="deficit-btn-desc">Personalizado</div>
                        </button>
                      </div>
                      {calcDeficit === 'custom' && (
                        <div className="custom-goal-row">
                          <input type="number" className="login-input" style={{ flex:1 }}
                            value={customCalGoal} onChange={e => setCustomCalGoal(e.target.value)}
                            onFocus={e => e.currentTarget.select()}
                            placeholder="Ex: 1500" />
                          <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>kcal/dia</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Botão único Usar → */}
                  <button
                    className="btn"
                    style={{ marginTop:14, width:'100%' }}
                    disabled={
                      (calcObjetivo !== 'manter' && calcDeficit === null) ||
                      (calcDeficit === 'custom' && (!customCalGoal || parseInt(customCalGoal) < MIN_SAFE_CALS))
                    }
                    onClick={() => {
                      if (calcObjetivo === 'manter') {
                        useDietCals(calcResult.manter, 'manter')
                      } else if (calcDeficit === 'custom') {
                        useDietCals(parseInt(customCalGoal), calcObjetivo)
                      } else {
                        const pcts = calcObjetivo === 'emagrecer'
                          ? { leve:15, mod:25, agr:35 }
                          : { leve:10, mod:20, agr:30 }
                        const pct  = pcts[calcDeficit as 'leve'|'mod'|'agr']
                        const cals = calcObjetivo === 'emagrecer'
                          ? Math.round(calcResult.tdee * (1 - pct / 100))
                          : Math.round(calcResult.tdee * (1 + pct / 100))
                        useDietCals(cals, calcObjetivo)
                      }
                    }}>
                    <Calculator size={14}/> Usar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Passo 2: Escolha de Refeições ── */}
          {onboardingScreenStep === 2 && (
            <div className="onb-step-content">
              <p className="onb-meal-intro">Quais refeições você faz no dia a dia?</p>
              <div className="meal-checkbox-list">
                {([
                  { id:'cafe',         label:'Café da Manhã',   desc:'manhã cedo' },
                  { id:'lanche_manha', label:'Lanche da Manhã', desc:'meio da manhã' },
                  { id:'almoco',       label:'Almoço',           desc:'hora do almoço' },
                  { id:'lanche',       label:'Lanche da Tarde',  desc:'meio da tarde' },
                  { id:'jantar',       label:'Jantar',           desc:'à noite' },
                  { id:'ceia',         label:'Ceia',             desc:'antes de dormir' },
                ] as const).map(({ id, label, desc }) => {
                  const checked = onboardingMealIds.includes(id)
                  return (
                    <label key={id} className={`meal-checkbox-item ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        setOnboardingMealIds(prev =>
                          checked
                            ? prev.filter(m => m !== id)
                            : [...prev, id]
                        )
                      }} />
                      <span className="meal-checkbox-label">{label}</span>
                      <span className="meal-checkbox-desc">{desc}</span>
                    </label>
                  )
                })}
              </div>
              {onboardingMealIds.length < 3 && (
                <p className="meal-min-warn">Selecione ao menos 3 refeições</p>
              )}
              <div className="onb-nav-row">
                <button className="onb-nav-back" onClick={() => setOnboardingScreenStep(1)}>
                  <ArrowLeft size={14}/> Voltar
                </button>
                <button className="btn onb-nav-next"
                  disabled={onboardingMealIds.length < 3}
                  onClick={() => setOnboardingScreenStep(3)}>
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* ── Passo 3: Gerar Dieta ── */}
          {onboardingScreenStep === 3 && (
            <div className="onb-step-content">
              {/* Resumo da meta calculada — somente leitura */}
              <div className="onb-meta-summary">
                <div className="onb-meta-cals">
                  <span className="onb-meta-cals-val">{parseInt(dietTarget) > 0 ? parseInt(dietTarget).toLocaleString('pt-BR') : '—'}</span>
                  <span className="onb-meta-cals-unit">kcal/dia</span>
                </div>
                <div className="onb-meta-macros">
                  <span style={{ color:'var(--protein-color)' }}>P {userGoals.p}g</span>
                  <span className="onb-meta-dot">·</span>
                  <span style={{ color:'var(--carb-color)' }}>C {userGoals.c}g</span>
                  <span className="onb-meta-dot">·</span>
                  <span style={{ color:'var(--fat-color)' }}>G {userGoals.f}g</span>
                </div>
                <div className="onb-meta-hint">Para ajustar, volte ao passo 1 ou edite em Config → Minha Meta</div>
              </div>
              <div className="calc-field" style={{ marginTop:14 }}>
                <label className="calc-label">Preferência de alimentos</label>
                <div className="calc-obj-row">
                  <button className={`calc-obj-btn ${!dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(false)}><Sparkles size={14}/> Melhor qualidade</button>
                  <button className={`calc-obj-btn ${dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(true)}><Coins size={14}/> Simples / Barato</button>
                </div>
              </div>
              <div className="onb-nav-row">
                <button className="onb-nav-back" onClick={() => setOnboardingScreenStep(2)}>
                  <ArrowLeft size={14}/> Voltar
                </button>
                <button className="btn onb-nav-next" onClick={() => handleGenerateDiet()}
                  disabled={!dietTarget || parseInt(dietTarget) < MIN_SAFE_CALS}>
                  <Zap size={15}/> Gerar Dieta
                </button>
              </div>

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
                    <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                      <button className="btn btn-small btn-cancel" style={{ flex:1 }} onClick={handleNextDietVariant}>
                        <RefreshCw size={13}/> Ver outra opção
                        <span style={{ opacity:0.6, marginLeft:4 }}>({dietVariantIdx + 1}/{DIET_VARIANT_COUNT})</span>
                      </button>
                      {Math.abs(diffOnb) > 150 && (
                        <button className="btn btn-small btn-cancel" style={{ flex:1 }} onClick={() => handleGenerateDiet(dietVariantIdx)}>
                          <RefreshCw size={13}/> Reajustar para meta
                        </button>
                      )}
                    </div>
                    <button className="btn" style={{ marginTop:8, width:'100%' }} onClick={saveDiet}>
                      <CheckCircle2 size={15}/> Salvar e começar!
                    </button>
                    <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(var(--primary-rgb, 99,102,241), .07)', borderRadius:8, display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}>
                      <ShoppingCart size={13} style={{ flexShrink:0 }}/> Ao salvar, você verá automaticamente a lista de compras para a semana.
                    </div>
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
                              {BUDGET_IDS.has(item.food.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
                            </div>
                          </div>
                          <button className="diet-sub-btn" title="Substituir" onClick={() => openDietSubModal(mi, ii)}><ArrowLeftRight size={13}/></button>
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
                <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><ArrowLeftRight size={16}/> Substituir Alimento na Dieta</div>
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
                              {BUDGET_IDS.has(sub.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
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
                  <div className="sub-section-label"><Search size={13}/> Buscar qualquer alimento</div>
                  <input type="text" className="login-input"
                    placeholder="Ex: batata doce, atum, tofu, peixe..."
                    value={dietSubSearchQuery} autoComplete="off"
                    onChange={e => handleDietSubSearch(e.target.value)} />
                  {dietSubSearching && (
                    <div className="sub-search-loading"><span><Bot size={13}/> Consultando IA...</span></div>
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
              <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><ArrowLeftRight size={16}/> Substituir Alimento</div>
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
                          {BUDGET_IDS.has(alt.food.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
                        </div>
                        <div className="taco-result-cat">{alt.kcal} kcal · P{alt.p}g · C{alt.c}g · G{alt.f}g</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Campo de Busca ── */}
              <div className="sub-search-section">
                <div className="sub-section-label"><Search size={13}/> Buscar outro alimento</div>
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
                    <span><Bot size={13}/> Consultando IA...</span>
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
                          {BUDGET_IDS.has(res.food.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
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
              <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><ArrowLeftRight size={16}/> Substituir Alimento na Dieta</div>
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
                            {BUDGET_IDS.has(sub.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
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
                <div className="sub-section-label"><Search size={13}/> Buscar qualquer alimento</div>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Ex: batata doce, atum, tofu, peixe..."
                  value={dietSubSearchQuery}
                  autoComplete="off"
                  onChange={e => handleDietSubSearch(e.target.value)}
                />
                {dietSubSearching && (
                  <div className="sub-search-loading"><span><Bot size={13}/> Consultando IA...</span></div>
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
                            {BUDGET_IDS.has(res.food.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
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
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><Search size={16}/> Banco TACO — Buscar Alimento</div>

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
                if (tacoCustomSelected) setTacoCustomSelected(null)
              }}
            />

            {/* Resultados de busca — computados inline para sempre refletir customFoods atual */}
            {(() => {
              const customMatches = searchCustomFoods(tacoQuery, customFoods)
              const hasResults    = (customMatches.length > 0 || tacoResults.length > 0) && !tacoSelected && !tacoCustomSelected
              if (!hasResults) return null
              return (
                <div className="taco-results">
                  {/* Meus alimentos — aparecem primeiro */}
                  {customMatches.map(cf => (
                    <button
                      key={cf.id}
                      className="taco-result-item"
                      onClick={() => {
                        setTacoCustomSelected(cf)
                        setTacoCustomPorcao(String(cf.grams))
                        setTacoResults([])
                      }}
                    >
                      <div className="taco-result-name">
                        {cf.name}
                        <span className="taco-custom-badge">Meu alimento</span>
                      </div>
                      <div className="taco-result-cat">{cf.kcal} kcal · P{cf.p}g · C{cf.c}g · G{cf.f}g</div>
                    </button>
                  ))}
                  {/* Resultados TACO */}
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
              )
            })()}

            {/* Alimento pessoal selecionado */}
            {tacoCustomSelected && (
              <div className="taco-calc-preview">
                <div className="taco-calc-name">
                  {tacoCustomSelected.name}
                  <span className="taco-custom-badge" style={{ marginLeft: 8 }}>Meu alimento</span>
                </div>
                <div className="taco-calc-cat">Porção padrão: {tacoCustomSelected.grams}g</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
                  <input
                    type="number"
                    className="login-input"
                    style={{ width: 100, textAlign: 'center' }}
                    value={tacoCustomPorcao}
                    min={1}
                    onChange={e => setTacoCustomPorcao(e.target.value)}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>gramas</span>
                </div>
                {(() => {
                  const g     = parseFloat(tacoCustomPorcao) || tacoCustomSelected.grams
                  const ratio = tacoCustomSelected.grams > 0 ? g / tacoCustomSelected.grams : 1
                  return (
                    <div className="taco-calc-macros">
                      <span><Flame size={13}/> {Math.round(tacoCustomSelected.kcal * ratio)} kcal</span>
                      <span>P {+(tacoCustomSelected.p * ratio).toFixed(1)}g</span>
                      <span>C {+(tacoCustomSelected.c * ratio).toFixed(1)}g</span>
                      <span>G {+(tacoCustomSelected.f * ratio).toFixed(1)}g</span>
                    </div>
                  )
                })()}
                <button
                  className="btn"
                  style={{ marginTop: 8 }}
                  disabled={!tacoCustomPorcao || parseFloat(tacoCustomPorcao) <= 0}
                  onClick={() => {
                    const g     = parseFloat(tacoCustomPorcao) || tacoCustomSelected.grams
                    const ratio = tacoCustomSelected.grams > 0 ? g / tacoCustomSelected.grams : 1
                    const item: MealItem = {
                      id:   newId(),
                      name: tacoCustomSelected.name,
                      kcal: Math.round(tacoCustomSelected.kcal * ratio),
                      p:    +(tacoCustomSelected.p * ratio).toFixed(1),
                      c:    +(tacoCustomSelected.c * ratio).toFixed(1),
                      f:    +(tacoCustomSelected.f * ratio).toFixed(1),
                    }
                    const nm = meals.map((m, mi) => mi !== tacoMealIdx ? m : { ...m, items: [...m.items, item] })
                    setMeals(nm); save({ meals: nm }); setShowTACO(false)
                    setTacoCustomSelected(null)
                  }}
                >
                  <CheckCircle2 size={14}/> Adicionar a {meals[tacoMealIdx]?.title}
                </button>
                <button
                  className="btn btn-cancel"
                  style={{ marginTop: 6 }}
                  onClick={() => { setTacoCustomSelected(null); setTacoQuery('') }}
                >
                  ← Buscar outro
                </button>
              </div>
            )}

            {/* Alimento TACO selecionado */}
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
                      <span><Flame size={13}/> {Math.round(tacoSelected.kcal * m)} kcal</span>
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
                  <CheckCircle2 size={14}/> Adicionar a {meals[tacoMealIdx]?.title}
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
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><Scale size={16}/> Histórico de Peso</div>

            <div className="wh-stats-grid">
              {[
                { label: 'Peso inicial', val: firstW !== null ? `${firstW}kg` : '—' },
                { label: 'Peso atual',   val: lastW  !== null ? `${lastW}kg`  : '—' },
                { label: 'Perda total',  val: totalLoss !== null
                    ? `${totalLoss > 0 ? '-' : totalLoss < 0 ? '+' : ''}${Math.abs(totalLoss)}kg`
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
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Evolução do Peso</div>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={weightHistoryAsc} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-light)', borderRadius: 10, fontSize: 13 }}
                      formatter={(v: any) => [`${v}kg`, 'Peso']}
                    />
                    <Area type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2.5}
                      fill="url(#pesoGrad)" dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
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
                            {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}kg`}
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

      {/* ══ Modal: Apagar Histórico de Peso ══ */}
      {showDeleteWeightConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteWeightConfirm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8, color:'var(--error)' }}>
              <Trash2 size={18}/> Apagar histórico de peso
            </div>
            <p style={{ fontSize:14, color:'var(--text-secondary)', margin:'8px 0 20px' }}>
              Tem certeza? Todos os registros de peso serão removidos.<br/>
              <strong>Esta ação não pode ser desfeita.</strong>
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowDeleteWeightConfirm(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => {
                setWeightsData({})
                save({ weightHistory: {} })
                setShowDeleteWeightConfirm(false)
              }}>Apagar tudo</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Dia Finalizado ══ */}
      {showFinalize && (
        <div className="modal-overlay" onClick={() => setShowFinalize(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><Flag size={18}/> Finalizar Dia</div>
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

      {/* ══ Modal: Histórico de 14 Dias ══ */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <CalendarDays size={16}/> Histórico Recente
            </div>
            {last14Days.length === 0 ? (
              <div style={{ color:'var(--text-secondary)', fontSize:13, textAlign:'center', padding:'16px 0' }}>
                Nenhum dado registrado ainda.
              </div>
            ) : last14Days.map(day => {
              const pct = userGoals.cals > 0 ? Math.min(100, (day.cals / userGoals.cals) * 100) : 0
              const barColor = pct >= 90 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)'
              return (
                <div key={day.key} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:12, fontWeight: day.isToday ? 600 : 400, color: day.isToday ? 'var(--primary)' : 'var(--text-secondary)', textTransform:'capitalize' }}>
                      {day.isToday ? 'Hoje' : day.label}
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, color:'var(--text-secondary)' }}>
                        P{day.p}g · C{day.c}g · G{day.f}g
                      </span>
                      <span style={{ fontSize:12, fontWeight:600 }}>
                        {day.cals > 0 ? `${day.cals.toLocaleString('pt-BR')} kcal` : '—'}
                      </span>
                      {day.finalizado && <CheckCircle2 size={13} style={{ color:'var(--success)' }} />}
                    </div>
                  </div>
                  <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:4, transition:'width .4s' }} />
                  </div>
                </div>
              )
            })}
            {streakDays >= 2 && (
              <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(255,160,0,.08)', borderRadius:8, display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                <Flame size={15} style={{ color:'var(--warning)' }}/> <strong>{streakDays} dias seguidos</strong> batendo a meta!
              </div>
            )}
            <button className="btn btn-cancel" style={{ marginTop:14 }} onClick={() => setShowHistoryModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Lista de Compras Semanal ══ */}
      {showShoppingModal && (
        <div className="modal-overlay" onClick={() => setShowShoppingModal(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ShoppingCart size={16}/> Lista de Compras Semanal
              {shoppingData.total > 0 && (
                <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:400 }}>({shoppingData.total} itens)</span>
              )}
            </div>

            {shoppingData.byCategory.length === 0 ? (
              <div style={{ color:'var(--text-secondary)', fontSize:13, textAlign:'center', padding:'16px 0' }}>
                Nenhum item no cardápio ainda.
              </div>
            ) : (
              <>
                {/* ── Vista principal: por categoria ── */}
                {shoppingData.byCategory.map(({ cat, items }) => (
                  <div key={cat} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--primary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                      {cat}
                    </div>
                    {items.map((item, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                        <span style={{ marginRight:8 }}>☐ {item.name}</span>
                        <span style={{ fontWeight:600, whiteSpace:'nowrap', color:'var(--text-primary)' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                ))}

                {/* ── Vista secundária: por refeição (colapsável) ── */}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4 }}>
                  <button
                    onClick={() => setShoppingByMealOpen(p => !p)}
                    style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-secondary)', background:'none', border:'none', cursor:'pointer', padding:0, width:'100%' }}>
                    <ChevronDown size={14} style={{ transform: shoppingByMealOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0 }}/>
                    {shoppingByMealOpen ? 'Ocultar' : 'Ver'} detalhamento por refeição
                  </button>
                  {shoppingByMealOpen && (
                    <div style={{ marginTop:10 }}>
                      {shoppingData.byMeal.map(group => (
                        <div key={group.title} style={{ marginBottom:10 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' }}>{group.title}</div>
                          {group.items.map((item, i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', color:'var(--text-secondary)', borderBottom:'1px solid var(--border)' }}>
                              <span>{item.name}</span>
                              <span style={{ whiteSpace:'nowrap', marginLeft:8 }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Copiar */}
                <button className="btn btn-small" style={{ width:'100%', marginTop:12 }} onClick={() => {
                  const lines = ['🛒 LISTA DE COMPRAS SEMANAL', '']
                  shoppingData.byCategory.forEach(({ cat, items }) => {
                    lines.push(`── ${cat.toUpperCase()} ──`)
                    items.forEach(it => lines.push(`☐ ${it.name}: ${it.label}`))
                    lines.push('')
                  })
                  lines.push('Gerado pelo Meu Plano Completo')
                  navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
                }}>
                  <Copy size={13}/> Copiar lista
                </button>
              </>
            )}
            <button className="btn btn-cancel" style={{ marginTop:8 }} onClick={() => setShowShoppingModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Editar / Adicionar Item ══ */}
      {itemModal && (
        <div className="modal-overlay" onClick={() => setItemModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{itemModal.mode === 'edit' ? 'Editar Alimento' : 'Novo Alimento'}</div>
            {[
              { key:'name', label:'Nome', type:'text',   placeholder:'Ex: Frango' },
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

            {/* Seção opcional de unidades */}
            <div className="unit-section">
              <div className="unit-toggle-row">
                <span className="modal-label" style={{ margin: 0 }}>Este alimento tem unidades?</span>
                <button
                  type="button"
                  className={`unit-toggle-btn ${itemForm.hasUnits ? 'unit-toggle-btn--on' : ''}`}
                  onClick={() => setItemForm(prev => ({ ...prev, hasUnits: !prev.hasUnits }))}
                >
                  {itemForm.hasUnits ? 'Sim' : 'Não'}
                </button>
              </div>
              {itemForm.hasUnits && (
                <div className="unit-fields">
                  <div>
                    <label className="modal-label">Gramas por unidade</label>
                    <input
                      type="number"
                      className="modal-input"
                      placeholder="Ex: 25"
                      min={1}
                      value={itemForm.gramsPerUnit}
                      onChange={e => setItemForm(prev => ({ ...prev, gramsPerUnit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="modal-label">Quantidade inicial</label>
                    <input
                      type="number"
                      className="modal-input"
                      placeholder="Ex: 2"
                      min={1}
                      value={itemForm.initialUnits}
                      onChange={e => setItemForm(prev => ({ ...prev, initialUnits: e.target.value }))}
                    />
                  </div>
                  {itemForm.gramsPerUnit && itemForm.initialUnits && (
                    <div className="unit-preview">
                      {parseInt(itemForm.initialUnits) || 0} un × {parseFloat(itemForm.gramsPerUnit) || 0}g = {Math.round((parseInt(itemForm.initialUnits) || 0) * (parseFloat(itemForm.gramsPerUnit) || 0))}g total
                    </div>
                  )}
                </div>
              )}
            </div>

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
              <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}><BarChart3 size={16}/> Gerar Relatório</div>

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
                    {fmt(ds[0])} → {fmt(ds[ds.length - 1])} ({ds.length} dias)
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
                  <div className="report-title">Meu Plano — Relatório {reportResult.periodLabel}</div>
                  <div className="report-subtitle">Período: {reportResult.dateRange}</div>
                </div>
                <button className="report-close-btn" onClick={() => setShowReport(false)}>✕</button>
              </div>

              {/* Barra de ações — topo (fix Safari mobile) */}
              <div className="report-action-bar report-action-bar--top">
                <button className="btn btn-cancel btn-small" style={{ width:'auto' }}
                  onClick={() => { setReportStep('select'); setReportResult(null) }}>
                  <ArrowLeft size={14}/> Novo
                </button>
                <button className="btn btn-small" style={{ width:'auto' }} onClick={copyReportToClipboard}>
                  <Copy size={14}/> Copiar
                </button>
                <button className="btn btn-small" style={{ width:'auto' }} onClick={() => window.print()}>
                  <FileDown size={14}/> PDF
                </button>
              </div>

              <div className="report-body">

                {/* Seção 1: Resumo */}
                <div className="report-section">
                  <div className="report-section-title"><BarChart3 size={14}/> Resumo Geral</div>
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
                  <div className="report-section-title"><Utensils size={14}/> Macros (média/dia)</div>
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
                  <div className="report-section-title"><TrendingUp size={14}/> Calorias no Período</div>
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
                    <div className="report-section-title"><Scale size={14}/> Peso no Período</div>
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
                  <div className="report-section-title"><Dumbbell size={14}/> Macros Médios vs Meta</div>
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
                  <div className="report-section-title"><Lightbulb size={14}/> Insights Automáticos</div>
                  {reportResult.insights.map((ins, i) => (
                    <div key={i} className="report-insight">• {ins}</div>
                  ))}
                </div>

                <div className="report-footer">
                  Gerado em {reportResult.generatedAt} · Meu Plano
                </div>
              </div>

              {/* Barra de ações — rodapé */}
              <div className="report-action-bar">
                <button className="btn btn-cancel btn-small" style={{ width:'auto' }}
                  onClick={() => { setReportStep('select'); setReportResult(null) }}>
                  <ArrowLeft size={14}/> Novo
                </button>
                <button className="btn btn-small" style={{ width:'auto' }} onClick={copyReportToClipboard}>
                  <Copy size={14}/> Copiar
                </button>
                <button className="btn btn-small" style={{ width:'auto' }} onClick={() => window.print()}>
                  <FileDown size={14}/> PDF
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
            <div style={{ marginBottom: 12 }}><Sparkles size={48} style={{ color:'var(--primary)' }}/></div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Bem-vindo ao Meu Plano!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
              Vamos configurar sua dieta em <strong style={{ color: 'var(--primary)' }}>3 passos</strong>:<br />
              <span style={{ display: 'inline-block', marginTop: 8, textAlign:'left' }}>
                <Calculator size={13}/> Calcule sua meta calórica<br />
                <Utensils size={13}/> Gere sua dieta personalizada<br />
                <ClipboardList size={13}/> Comece a acompanhar!
              </span>
            </div>
            <button className="btn" style={{ width: '100%' }}
              onClick={() => {
                setOnboardingStep(2)
                setOnboardingScreen(true)
                setOnboardingScreenStep(1)
              }}>
              <Calculator size={15}/> Calcular meta e gerar dieta
            </button>
            <button className="btn btn-cancel" style={{ marginTop: 10, width: '100%' }}
              onClick={() => {
                setOnboardingStep(0)
                if (authUser) localStorage.setItem(`onboarding_done_${authUser.uid}`, '1')
                else          localStorage.setItem('onboarding_done', '1')
                setActiveTab('config')
                setConfigSections(prev => ({ ...prev, cardapio: true }))
              }}>
              Montar minha própria dieta
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header>
        <div className="header-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {userProfile && (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: userProfile.avatarType === 'upload' ? 'transparent'
                    : (['indigo','emerald','rose','orange','purple','cyan','amber','teal'] as const)
                        .reduce((m,id,i) => ({ ...m, [id]: ['#6366F1','#10B981','#F43F5E','#F97316','#8B5CF6','#06B6D4','#EAB308','#14B8A6'][i] }), {} as any)
                        [userProfile.avatarPreset ?? 'indigo'] ?? '#6366F1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, overflow: 'hidden', border: '2px solid var(--primary-mid)',
                }}>
                  {userProfile.avatarType === 'upload' && userProfile.avatarUrl
                    ? <img src={userProfile.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                    : (['💪','🥗','🎯','🏃','⚡','🏊','⭐','🌿'] as const)[
                        ['indigo','emerald','rose','orange','purple','cyan','amber','teal'].indexOf(userProfile.avatarPreset ?? 'indigo')
                      ] ?? '💪'
                  }
                </div>
              )}
              <div>
                <h1>
                  {userProfile ? `Olá, ${userProfile.displayName.split(' ')[0]}!` : 'Meu Plano'}
                  {' '}<span className="brand-dot" />
                </h1>
                <div className="subtitle">
                  {userProfile ? `@${userProfile.username}` : 'Dieta · Treino · Progresso'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {firebaseConfigured && syncStatus !== 'unconfigured' && (
                <div className={`sync-badge sync-badge--${syncStatus}`}>
                  <SyncIcon status={syncStatus} />
                </div>
              )}
              <button
                className="theme-toggle"
                title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                onClick={() => setIsDark(d => !d)}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banner de progresso de setup (caminho automático, steps 2-3) */}
      {inAutoSetup && (
        <div className="setup-progress-banner">
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><Settings size={13}/> Configure seu plano primeiro —</span>
          <span className="setup-progress-steps">
            Passo {onboardingStep === 2 ? '1' : '2'}/2: {onboardingStep === 2 ? 'Calculadora' : 'Gerar Dieta'}
          </span>
        </div>
      )}

      <div className="container">
        {/* Tab bar — oculto no mobile (substituído pela bottom nav) */}
        <div className="tabs">
          {[
            { id:'hoje',         icon:<ClipboardList size={15}/>, label:'Hoje'       },
            { id:'peso',         icon:<Scale size={15}/>,         label:'Peso'       },
            { id:'estatísticas', icon:<BarChart3 size={15}/>,     label:'Stats'      },
            { id:'comunidade',   icon:<Users size={15}/>,         label:'Comunidade' },
            { id:'config',       icon:<Settings size={15}/>,      label:'Config'     },
          ].map(t => (
            <button key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              disabled={inAutoSetup && t.id !== 'config'}
              onClick={() => setActiveTab(t.id)}>
              {t.icon}{' '}{t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ HOJE */}
        <div className={`tab-content ${activeTab === 'hoje' ? 'active' : ''}`}>

          {/* Onboarding: toast de conclusão */}
          {onboardingStep === 4 && (
            <div className="onboarding-done-banner">
              <CheckCircle2 size={15}/> Tudo pronto! Seu cardápio está configurado. Comece a marcar as refeições!
            </div>
          )}

          {/* ── Hero do Dia — anel SVG + macros inline ── */}
          {(() => {
            const diff       = liveDayTotal - CAL_META
            const onTarget   = Math.abs(diff) <= 50
            const color      = onTarget ? 'var(--success)' : diff < 0 ? 'var(--warning)' : 'var(--error)'
            const statusText = onTarget
              ? '✓ No alvo — meta atingida!'
              : diff < 0
                ? `Faltam ${Math.abs(diff)} kcal`
                : `+${diff} kcal acima da meta`
            const pct    = Math.min(100, CAL_META > 0 ? (liveDayTotal / CAL_META) * 100 : 0)
            const r      = 42
            const circ   = 2 * Math.PI * r        // ~263.9
            const offset = circ * (1 - pct / 100)
            const dateStr    = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
            const mealsMeta  = meals.filter(m => (m.items ?? []).length > 0).length
            return (
              <div className="day-hero-card"
                onClick={() => { setActiveTab('estatísticas'); setStatsSubTab('diario') }}>
                <div className="day-hero-header">
                  <span className="day-hero-date">{dateStr}</span>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    {streakDays >= 2 && (
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--warning)', background:'rgba(255,160,0,.12)', borderRadius:8, padding:'2px 8px', display:'flex', alignItems:'center', gap:3 }}>
                        <Flame size={12}/> {streakDays} dias
                      </span>
                    )}
                    <span className="day-hero-meal-badge">{mealsCompleted}/{mealsMeta} refeições</span>
                  </div>
                </div>
                <div className="day-hero-body">
                  {/* Anel SVG */}
                  <div className="day-hero-ring-wrap">
                    <svg viewBox="0 0 100 100" className="day-hero-svg" aria-hidden="true">
                      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
                      <circle cx="50" cy="50" r={r} fill="none"
                        stroke={color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.34,1.56,0.64,1)', transformOrigin: '50px 50px', transform: 'rotate(-90deg)' }}
                      />
                    </svg>
                    <div className="day-hero-kcal">
                      <span className="day-hero-kcal-num">{liveDayTotal.toLocaleString('pt-BR')}</span>
                      <span className="day-hero-kcal-unit">kcal</span>
                      <span className="day-hero-kcal-meta">de {CAL_META.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  {/* Macro mini bars */}
                  <div className="day-hero-macros">
                    {[
                      { label: 'P', val: totalP, meta: userGoals.p, c: 'var(--protein-color)' },
                      { label: 'C', val: totalC, meta: userGoals.c, c: 'var(--carb-color)'    },
                      { label: 'G', val: totalF, meta: userGoals.f, c: 'var(--fat-color)'     },
                    ].map(({ label, val, meta, c }) => (
                      <div key={label} className="day-hero-macro-row">
                        <span className="day-hero-macro-label" style={{ color: c }}>{label}</span>
                        <div className="day-hero-macro-bar-wrap">
                          <div className="day-hero-macro-bar-fill"
                            style={{ width: `${Math.min(100, meta > 0 ? (val/meta)*100 : 0)}%`, background: c }} />
                        </div>
                        <span className="day-hero-macro-val">{val}g</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="day-hero-status" style={{ color }}>{statusText}</div>
              </div>
            )
          })()}

          {/* Ação rápida: lista de compras */}
          {meals.some(m => (m.items ?? []).length > 0) && (
            <button
              onClick={() => setShowShoppingModal(true)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, width:'100%', padding:'9px 0', marginBottom:4, background:'var(--surface)', border:'1px dashed var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>
              <ShoppingCart size={14}/> Lista de Compras Semanal
            </button>
          )}

          {/* Refeições colapsáveis */}
          {meals.length === 0 || meals.every(m => (m.items ?? []).length === 0) ? (
            <div className="card">
              <div className="empty-state">
                <svg className="empty-state-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="40" cy="40" r="38" stroke="var(--primary)" strokeWidth="2" strokeDasharray="6 4" />
                  <path d="M26 52 C26 44 30 36 40 36 C50 36 54 44 54 52" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="33" cy="30" r="4" fill="var(--primary)" opacity="0.5" />
                  <circle cx="47" cy="30" r="4" fill="var(--primary)" opacity="0.5" />
                  <path d="M34 48 L46 48" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div className="empty-state-title">Cardápio vazio</div>
                <div className="empty-state-desc">Monte seu plano alimentar nas configurações para começar a acompanhar.</div>
                <button className="btn btn-small empty-state-action" onClick={() => setActiveTab('config')}>
                  Configurar cardápio
                </button>
              </div>
            </div>
          ) : meals.map(meal => {
            const items       = meal.items ?? []
            const isExpanded  = !!expandedMeals[meal.id]
            const checkedCount = items.filter(it => todayChecked[it.id]).length
            const mealStatus  = items.length === 0 ? 'empty' : checkedCount === 0 ? 'empty' : checkedCount < items.length ? 'partial' : 'complete'
            const mealKcal    = items.reduce((s, it) => s + (activeSubs[it.id]?.kcal ?? it.kcal) * (todayChecked[it.id] ? 1 : 0), 0)
            const mealKcalTotal = items.reduce((s, it) => s + (activeSubs[it.id]?.kcal ?? it.kcal), 0)
            return (
              <div key={meal.id} className={`meal-collapse-card meal--${mealStatus}`}>
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
                  <ChevronDown size={14} className={`meal-collapse-arrow ${isExpanded ? 'meal-collapse-arrow--open' : ''}`} />
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
                            <div id={`chk-${item.id}`} className={`checkbox ${todayChecked[item.id] ? 'checked' : ''}`}>
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
                              onClick={() => setTodaySubItem(item)}><ArrowLeftRight size={13}/></button>
                            {displayQty !== undefined && (
                              <>
                                <button className="qty-btn" title="Diminuir quantidade"
                                  disabled={displayQty <= 1}
                                  onClick={() => adjustQuantity(meal.id, item.id, 'decrease', displayQty)}><MinusIcon size={12}/></button>
                                <button className="qty-btn" title="Aumentar quantidade"
                                  disabled={displayQty >= 99}
                                  onClick={() => adjustQuantity(meal.id, item.id, 'increase', displayQty)}><PlusIcon size={12}/></button>
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
              <CheckCircle2 size={26} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="day-finalized-title">Dia Finalizado às {todayStat.timestamp}</div>
                <div className="day-finalized-feedback" style={{ color: todayFeedback.color }}>{todayFeedback.msg}</div>
                {todayStat.observacoes && <div className="day-finalized-obs">"{todayStat.observacoes}"</div>}
              </div>
              <button className="btn btn-reabrir" onClick={unfinalizarDia}>
                <RotateCcw size={14} /> Reabrir
              </button>
            </div>
          ) : (
            <button className="btn btn-finalizar" onClick={() => setShowFinalize(true)}>
              <Flag size={16} /> Finalizar Dia
            </button>
          )}

          {/* ── Histórico Recente ── */}
          {last14Days.length > 1 && (
            <div className="card" style={{ marginTop:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div className="card-title" style={{ margin:0 }}><CalendarDays size={15} style={{ verticalAlign:'middle', marginRight:5 }}/>Histórico Recente</div>
                <button className="btn btn-small btn-cancel" style={{ width:'auto', padding:'3px 10px', fontSize:12 }}
                  onClick={() => setShowHistoryModal(true)}>Ver tudo</button>
              </div>
              {last14Days.slice(0, 7).map(day => {
                const pct = userGoals.cals > 0 ? Math.min(100, (day.cals / userGoals.cals) * 100) : 0
                const barColor = pct >= 90 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)'
                return (
                  <div key={day.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--text-secondary)', width:80, flexShrink:0, textTransform:'capitalize' }}>{day.label}</span>
                    <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:3, transition:'width .4s' }} />
                    </div>
                    <span style={{ fontSize:11, color:'var(--text-secondary)', width:60, textAlign:'right', flexShrink:0 }}>
                      {day.cals > 0 ? `${day.cals.toLocaleString('pt-BR')} kcal` : '—'}
                    </span>
                    {day.finalizado && <CheckCircle2 size={12} style={{ color:'var(--success)', flexShrink:0 }} />}
                  </div>
                )
              })}
            </div>
          )}

        </div>

        {/* ══════════════════════════════════════════════════════ PESO */}
        <div className={`tab-content ${activeTab === 'peso' ? 'active' : ''}`}>

          {(() => {
            // Delta: compara peso de hoje com o registro anterior
            const prevEntry  = todayWeight !== null ? weightHistoryDesc[1] : weightHistoryDesc[0]
            const prevWeight = prevEntry?.peso ?? null
            const deltaBase  = todayWeight ?? (weightHistoryDesc[0]?.peso ?? null)
            const delta      = deltaBase !== null && prevWeight !== null && (todayWeight !== null ? prevWeight !== deltaBase : true)
              ? +((deltaBase - prevWeight).toFixed(1)) : null

            if (todayWeight !== null || weightHistoryAsc.length > 0) {
              const displayWeight = todayWeight ?? weightHistoryDesc[0]?.peso
              const isToday       = todayWeight !== null
              return (
                <div className="weight-hero-card">
                  <div className="weight-hero-date">
                    {isToday
                      ? new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
                      : `Último registro · ${new Date((weightHistoryDesc[0]?.date ?? '') + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'2-digit' })}`
                    }
                  </div>
                  <div className="weight-hero-value-row">
                    <span className="weight-hero-num">{displayWeight}</span>
                    <span className="weight-hero-unit">kg</span>
                  </div>
                  {delta !== null && (
                    <div className={`weight-hero-delta ${delta < 0 ? 'weight-hero-delta--down' : delta > 0 ? 'weight-hero-delta--up' : 'weight-hero-delta--same'}`}>
                      {delta < 0 ? '↓' : delta > 0 ? '↑' : '='}
                      {' '}{delta < 0 ? '' : '+'}{delta}kg vs anterior
                    </div>
                  )}
                  {totalLoss !== null && totalLoss !== 0 && (
                    <div className="weight-hero-total-loss">
                      {totalLoss > 0 ? `Total perdido: −${totalLoss}kg` : `Total ganho: +${Math.abs(totalLoss)}kg`}
                      {' · '}{weightHistoryAsc.length} registros
                    </div>
                  )}
                  {todayWeightFoto && <img src={todayWeightFoto} alt="Foto de hoje" className="today-weight-photo" style={{ marginBottom: 14 }} />}
                  <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                    <button className="btn btn-small" style={{ width: 'auto' }}
                      onClick={() => setShowWeightHistory(true)}>
                      Ver histórico completo
                    </button>
                    <button className="btn-ghost-danger"
                      onClick={() => setShowDeleteWeightConfirm(true)}>
                      <Trash2 size={13}/> Apagar histórico
                    </button>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {weightHistoryAsc.length === 0 && (
            <div className="card">
              <div className="empty-state" style={{ paddingTop: 28, paddingBottom: 8 }}>
                <svg className="empty-state-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="12" y="50" width="8" height="18" rx="2" fill="var(--primary)" opacity="0.3" />
                  <rect x="24" y="38" width="8" height="30" rx="2" fill="var(--primary)" opacity="0.5" />
                  <rect x="36" y="28" width="8" height="40" rx="2" fill="var(--primary)" opacity="0.7" />
                  <rect x="48" y="20" width="8" height="48" rx="2" fill="var(--primary)" />
                  <circle cx="60" cy="14" r="8" fill="var(--success)" opacity="0.8" />
                  <path d="M57 14 L59.5 16.5 L63 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="empty-state-title">Nenhum registro ainda</div>
                <div className="empty-state-desc">Registre seu peso abaixo. Quanto mais consistente, mais útil fica o histórico.</div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">{todayWeight !== null ? 'Atualizar Peso de Hoje' : 'Registrar Peso'}</div>
            <input type="number" placeholder="Seu peso em kg" step="0.1" id="weight-input" />
            <label className="photo-upload-label">
              {weightPhoto
                ? <><CheckCircle2 size={15}/> Foto selecionada</>
                : <><Camera size={15}/> Adicionar foto (opcional)</>
              }
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
                <div className="card-title" style={{ marginBottom: 0, display:'flex', alignItems:'center', gap:6 }}><TrendingUp size={15}/> Seu Progresso</div>
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
                  <div className="insight-item"><Trophy size={13}/> Você perdeu <strong>{totalLoss}kg</strong> desde o início ({weightHistoryAsc.length} registros)</div>
                )}
                {totalLoss !== null && totalLoss < 0 && (
                  <div className="insight-item"><TrendingUp size={13}/> Ganhou <strong>{Math.abs(totalLoss)}kg</strong> desde o início — ajuste a dieta se necessário</div>
                )}
                {weeklyAvg !== null && weeklyAvg > 0 && (
                  <div className="insight-item"><TrendingDown size={13}/> Tendência: perdendo <strong>{weeklyAvg}kg/semana</strong>{weeklyAvg >= 0.3 && weeklyAvg <= 1 ? ' — bom ritmo!' : weeklyAvg > 1 ? ' — ritmo muito alto' : ''}</div>
                )}
                {(() => {
                  const lastEntry = weightHistoryAsc[weightHistoryAsc.length - 1]
                  if (!lastEntry?.calorias) return null
                  const diff = CAL_META - lastEntry.calorias
                  return (
                    <div className="insight-item">
                      {diff > 100
                        ? <><AlertTriangle size={13} style={{ color:'var(--warning)' }}/> Calorias: margem de -{diff} kcal/dia — pode comer mais</>
                        : diff < -100
                          ? <><AlertTriangle size={13} style={{ color:'var(--error)' }}/> Calorias: {Math.abs(diff)} kcal acima da meta no último registro</>
                          : <><CheckCircle2 size={13} style={{ color:'var(--success)' }}/> Calorias dentro da meta no último registro</>}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <div className="report-btn-row">
            <button className="btn btn-small btn-pdf" style={{ width:'auto' }}
              onClick={() => window.print()}>
              <FileDown size={14}/> PDF
            </button>
            <button className="btn btn-small btn-report" style={{ width:'auto' }}
              onClick={() => { setShowReport(true); setReportStep('select'); setReportResult(null) }}>
              <BarChart3 size={14}/> Gerar Relatório
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
                  <span>{weekWeightDiff < 0 ? <TrendingDown size={20} style={{ color:'var(--success)' }}/> : weekWeightDiff > 0 ? <TrendingUp size={20} style={{ color:'var(--warning)' }}/> : <MinusIcon size={20} style={{ color:'var(--text-secondary)' }}/>}</span>
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
                      const status = fin ? `${Math.abs(diff)} ${diff>=0?'abaixo':'acima'}` : cals > CAL_MAX ? 'Acima' : cals > 0 ? 'Parcial' : '—'
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
                  return [['Total',`${tot.toLocaleString()} kcal`],['Meta',`${met.toLocaleString()} kcal`],['Status',tot<=met?'No alvo':`${(tot-met).toLocaleString()} kcal acima`],['Finalizados',`${fin}/30`]].map(([k,v])=>(
                    <div key={k} className="summary-row"><span className="summary-key">{k}</span><span className="summary-val">{v}</span></div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════ COMUNIDADE */}
        <div className={`tab-content ${activeTab === 'comunidade' ? 'active' : ''}`}>

          {/* ── Cardápios da Comunidade ── */}
          <div className="config-section" style={{ marginBottom: 12 }}>
            <div className="config-section-header" style={{ cursor:'default' }}>
              <div className="config-section-title-group">
                <span className="config-section-label"><Users size={15}/> Cardápios da Comunidade</span>
                <span className="config-section-desc">Cardápios públicos compartilhados por outros usuários</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                {firebaseConfigured && authUser && userProfile && (
                  <button className="config-reset-btn" style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--primary)' }}
                    onClick={handlePublishToCommunity} disabled={shareDietLoading}>
                    <Users size={13}/> Publicar
                  </button>
                )}
                <button className="config-reset-btn" style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-secondary)' }}
                  onClick={async () => { setCommunityDietsReady(false); const [d,f] = await Promise.all([loadPublicDiets(),loadPublicCustomFoods()]); setCommunityDiets(d); setCommunityFoods(f); setCommunityDietsReady(true) }}>
                  <RefreshCw size={13}/>
                </button>
              </div>
            </div>
            <div style={{ padding: '0 4px 12px' }}>
              {!communityDietsReady && (
                <div style={{ textAlign:'center', color:'var(--text-secondary)', padding:'24px 0', fontSize:13 }}>
                  Carregando...
                </div>
              )}
              {communityDietsReady && communityDiets.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--text-secondary)', padding:'24px 0', fontSize:13 }}>
                  Nenhum cardápio público ainda. Seja o primeiro a compartilhar!
                </div>
              )}
              {communityDiets.map(diet => (
                <div key={diet.code} style={{
                  background:'var(--surface-2)', borderRadius:12, padding:'12px 14px',
                  marginBottom:10, border:'1px solid var(--border)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <button onClick={() => setViewProfileModal({ username: diet.authorUsername, avatar: diet.authorAvatar })}
                      style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      <CommunityAvatar av={diet.authorAvatar} size={36} />
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>@{diet.authorUsername}</div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                          {new Date(diet.createdAt).toLocaleDateString('pt-BR')} · {diet.dietData.length} refeições
                        </div>
                      </div>
                    </button>
                    <div style={{ marginLeft:'auto', textAlign:'right' }}>
                      <div style={{ fontWeight:700, fontSize:15, color:'var(--primary)' }}>{diet.totalCals} kcal</div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)' }}>P{diet.macros.p}g C{diet.macros.c}g G{diet.macros.g}g</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-small" style={{ width:'auto', flex:1, background:'var(--surface)', color:'var(--text-primary)' }}
                      onClick={() => setCommunityDietDetail(diet)}>
                      Ver detalhes
                    </button>
                    <button className="btn btn-small" style={{ width:'auto', flex:1 }}
                      onClick={() => setCommunityDietDetail(diet)}>
                      Ver / Usar
                    </button>
                    {diet.authorUid === authUser?.uid && (
                      <button className="config-reset-btn" style={{ color:'var(--error)', display:'flex', alignItems:'center', gap:3 }}
                        onClick={async () => {
                          if (!window.confirm('Remover este cardápio da comunidade?')) return
                          await deleteSharedDiet(diet.code)
                          setCommunityDiets(prev => prev.filter(d => d.code !== diet.code))
                        }}>
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Meus Alimentos da Comunidade ── */}
          <div className="config-section">
            <div className="config-section-header" style={{ cursor:'default' }}>
              <div className="config-section-title-group">
                <span className="config-section-label"><BookMarked size={15}/> Meus Alimentos da Comunidade</span>
                <span className="config-section-desc">Alimentos publicados por usuários</span>
              </div>
              {firebaseConfigured && authUser && userProfile && customFoods.length > 0 && (
                <button className="config-reset-btn" style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--primary)', flexShrink:0 }}
                  onClick={() => { setShowFoodPicker(true); setFoodPickerQuery(''); setFoodPickerDone(null) }}>
                  <Users size={13}/> Publicar
                </button>
              )}
            </div>
            <div style={{ padding: '0 4px 12px' }}>
              {communityDietsReady && communityFoods.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--text-secondary)', padding:'24px 0', fontSize:13 }}>
                  Nenhum alimento publicado ainda.
                </div>
              )}
              {communityFoods.map(food => (
                <div key={food.id} style={{
                  background:'var(--surface-2)', borderRadius:12, padding:'12px 14px',
                  marginBottom:10, border:'1px solid var(--border)',
                }}>
                  <button onClick={() => setViewProfileModal({ username: food.authorUsername, avatar: food.authorAvatar })}
                    style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    <CommunityAvatar av={food.authorAvatar} size={28} />
                    <span style={{ fontSize:12, color:'var(--text-secondary)' }}>@{food.authorUsername}</span>
                  </button>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{food.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                        {food.kcal} kcal · P{food.p}g · C{food.c}g · G{food.f}g · {food.grams}g
                      </div>
                    </div>
                    {firebaseConfigured && authUser && (
                      <button className="btn btn-small" style={{ width:'auto', flexShrink:0 }}
                        onClick={() => {
                          const newFood: CustomFood = {
                            id:        `cf_${Date.now()}`,
                            name:      food.name,
                            kcal:      food.kcal,
                            p:         food.p,
                            c:         food.c,
                            f:         food.f,
                            grams:     food.grams,
                            createdBy: { uid: food.authorUid, username: food.authorUsername, avatar: food.authorAvatar },
                          }
                          const updated = [...customFoods, newFood]
                          setCustomFoods(updated)
                          save({ customFoods: updated })
                        }}>
                        + Adicionar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════ CONFIG */}
        <div className={`tab-content ${activeTab === 'config' ? 'active' : ''}`}>

          {/* ── Seção: Conta ── */}
          {firebaseConfigured && authUser && (
            <div className="config-section">
              <div className="config-section-header" onClick={() => toggleConfigSection('conta')}>
                <div className="config-section-title-group">
                  <span className="config-section-label"><UserIcon size={15}/> Minha Conta</span>
                  <span className="config-section-desc">Gerencie login e sincronização</span>
                </div>
                <ChevronDown size={15} className={`config-section-arrow ${configSections.conta ? 'open' : ''}`} />
              </div>
              {configSections.conta && (
                <div className="config-section-body">
                  {/* Avatar + info do perfil */}
                  {userProfile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                        background: userProfile.avatarType === 'upload' ? 'transparent'
                          : (['indigo','emerald','rose','orange','purple','cyan','amber','teal'] as const)
                              .reduce((m,id,i) => ({ ...m, [id]: ['#6366F1','#10B981','#F43F5E','#F97316','#8B5CF6','#06B6D4','#EAB308','#14B8A6'][i] }), {} as any)
                              [userProfile.avatarPreset ?? 'indigo'] ?? '#6366F1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, overflow: 'hidden', border: '2px solid var(--primary-mid)',
                      }}>
                        {userProfile.avatarType === 'upload' && userProfile.avatarUrl
                          ? <img src={userProfile.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                          : (['💪','🥗','🎯','🏃','⚡','🏊','⭐','🌿'] as const)[
                              ['indigo','emerald','rose','orange','purple','cyan','amber','teal'].indexOf(userProfile.avatarPreset ?? 'indigo')
                            ] ?? '💪'
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile.displayName}</div>
                        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>@{userProfile.username}</div>
                        {userProfile.birthDate && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {new Date(userProfile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                      <button className="btn btn-small" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setEditingProfile(true)}>
                        Editar
                      </button>
                    </div>
                  )}
                  <div className="account-row" style={{ marginTop: userProfile ? 0 : 8 }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{authUser.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display:'flex', alignItems:'center', gap:4 }}>
                        <SyncIcon status={syncStatus} />
                        {syncStatus === 'synced'  && 'Sincronizado'}
                        {syncStatus === 'syncing' && 'Sincronizando...'}
                        {syncStatus === 'offline' && 'Offline — dados salvos localmente'}
                        {syncStatus === 'idle'    && 'Conectado'}
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
                <span className="config-section-label"><Target size={15}/> Minha Meta</span>
                <span className="config-section-desc">Defina seu objetivo calórico</span>
              </div>
              <ChevronDown size={15} className={`config-section-arrow ${configSections.metas ? 'open' : ''}`} />
            </div>
            {configSections.metas && (
              <div className="config-section-body">
                <div className="config-goals" style={{ marginTop: 8 }}>
                  {([{ key:'cals', label:'Calorias', unit:'kcal' },{ key:'p', label:'Proteína', unit:'g' },{ key:'c', label:'Carboidrato', unit:'g' },{ key:'f', label:'Gordura', unit:'g' }] as { key: keyof typeof DEFAULT_GOALS; label:string; unit:string }[]).map(({ key, label, unit }) => (
                    <div key={key} className="config-goal-row">
                      <label className="config-goal-label">{label}</label>
                      <div className="config-goal-input-wrap">
                        <input
                          type="number"
                          className="config-goal-input"
                          value={goalDrafts[key] ?? userGoals[key]}
                          onChange={e => handleGoalChange(key, e.target.value)}
                          onBlur={() => handleGoalBlur(key)}
                          onFocus={e => e.currentTarget.select()}
                        />
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

          {/* ── Seção: Minhas Refeições ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('refeicoes')}>
              <div className="config-section-title-group">
                <span className="config-section-label"><Utensils size={15}/> Minhas Refeições</span>
                <span className="config-section-desc">{meals.length} refeição{meals.length !== 1 ? 'ões' : ''} ativa{meals.length !== 1 ? 's' : ''}</span>
              </div>
              <ChevronDown size={15} className={`config-section-arrow ${configSections.refeicoes ? 'open' : ''}`} />
            </div>
            {configSections.refeicoes && (
              <div className="config-section-body">
                <div className="meals-manage-list">
                  {meals.map(meal => (
                    <div key={meal.id} className="meal-manage-item">
                      <span className="meal-manage-name">{meal.title}</span>
                      <button
                        className="meal-manage-remove-btn"
                        onClick={() => handleRemoveMeal(meal.id)}
                        title="Remover refeição"
                        aria-label={`Remover ${meal.title}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {mealManageWarn && (
                  <p className="meal-manage-warn">Mínimo de 3 refeições necessário</p>
                )}
                {(() => {
                  const activeMealIds = meals.map(m => m.id)
                  const available = ALL_MEAL_OPTIONS.filter(o => !activeMealIds.includes(o.id))
                  if (available.length === 0 || meals.length >= 6) return null
                  return (
                    <div className="meal-add-row">
                      <span className="meal-add-label">Adicionar:</span>
                      <div className="meal-add-btns">
                        {available.map(opt => (
                          <button key={opt.id} className="meal-add-btn" onClick={() => handleAddMeal(opt.id)}>
                            <PlusIcon size={11}/> {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ── Seção: Calcular ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('calc')}>
              <div className="config-section-title-group">
                <span className="config-section-label"><Calculator size={15}/> Calcular</span>
                <span className="config-section-desc">Recalcule seus dados nutricionais</span>
              </div>
              <ChevronDown size={15} className={`config-section-arrow ${configSections.calc ? 'open' : ''}`} />
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
                    <Radio size={14}/> Importar Bioimpedância <span className="bio-optional">(opcional)</span> <ChevronDown size={12} style={{ transform: showBio ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
                  </button>
                  {showBio && (
                    <div className="bio-content">
                      <div className="bio-upload-zone" onClick={() => bioFileRef.current?.click()}>
                        <div className="bio-upload-icon"><Upload size={28} style={{ color:'var(--primary)' }}/></div>
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
                      {calcGordura && <div className="bio-formula-note"><CheckCircle2 size={13}/> Usando Katch-McArdle (mais preciso com % gordura)</div>}
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
                  <div className="activity-grid">
                    {([
                      { v:'sed',   label:'Sedentário',   desc:'sem exercício' },
                      { v:'leve',  label:'Leve',          desc:'1–3×/sem' },
                      { v:'mod',   label:'Moderado',      desc:'3–5×/sem' },
                      { v:'int',   label:'Intenso',       desc:'5–7×/sem' },
                      { v:'muito', label:'Muito Intenso', desc:'atleta' },
                    ] as const).map(({ v, label, desc }) => (
                      <button key={v}
                        className={`activity-btn ${calcAtividade === v ? 'active' : ''}`}
                        onClick={() => setCalcAtividade(v)}>
                        <span className="activity-btn-label">{label}</span>
                        <span className="activity-btn-desc">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="calc-field" style={{ marginTop:10 }}>
                  <label className="calc-label">Objetivo Principal</label>
                  <div className="calc-obj-row">
                    {([
                      { v:'emagrecer', label:'Emagrecer' },
                      { v:'manter',    label:'Manter'    },
                      { v:'ganhar',    label:'Ganhar'    },
                    ] as const).map(({ v, label }) => (
                      <button key={v} className={`calc-obj-btn ${calcObjetivo === v ? 'active' : ''}`}
                        onClick={() => setCalcObjetivo(v)}>{label}</button>
                    ))}
                  </div>
                </div>
                <button className="btn" style={{ marginTop:14 }} onClick={handleCalc}
                  disabled={!calcPeso || !calcAltura || !calcIdade}>
                  <Calculator size={15}/> Calcular
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
                        { obj:'emagrecer', label:'EMAGRECER', val:calcResult.emagrecer, desc:'déficit · perda de peso' },
                        { obj:'manter',    label:'MANTER',    val:calcResult.manter,    desc:'igual ao TDEE · manutenção' },
                        { obj:'ganhar',    label:'GANHAR',    val:calcResult.ganhar,    desc:'superávit · ganho de massa' },
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
                          {calcObjetivo === 'emagrecer' ? 'Escolha o déficit:' : 'Escolha o superávit:'}
                        </div>
                        <div className="deficit-row">
                          {([
                            { id:'leve', label:'Leve',      pctEm:15, pctGan:10, desc:'Confortável' },
                            { id:'mod',  label:'Moderado',  pctEm:25, pctGan:20, desc:'Recomendado' },
                            { id:'agr',  label:'Agressivo', pctEm:35, pctGan:30, desc:'Rápido' },
                          ] as const).map(({ id, label, pctEm, pctGan, desc }) => {
                            const pct  = calcObjetivo === 'emagrecer' ? pctEm : pctGan
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
                          <button
                            className={`deficit-btn ${calcDeficit === 'custom' ? 'active' : ''}`}
                            onClick={() => setCalcDeficit('custom')}>
                            <div className="deficit-btn-label">Meta própria</div>
                            <div className="deficit-btn-cals">—</div>
                            <div className="deficit-btn-desc">Personalizado</div>
                          </button>
                        </div>
                        {calcDeficit === 'custom' && (
                          <div className="custom-goal-row">
                            <input type="number" className="login-input" style={{ flex:1 }}
                              value={customCalGoal} onChange={e => setCustomCalGoal(e.target.value)}
                              onFocus={e => e.currentTarget.select()}
                              placeholder="Ex: 1500" />
                            <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>kcal/dia</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Botão único Usar → */}
                    <button
                      className="btn"
                      style={{ marginTop:14, width:'100%' }}
                      disabled={
                        (calcObjetivo !== 'manter' && calcDeficit === null) ||
                        (calcDeficit === 'custom' && (!customCalGoal || parseInt(customCalGoal) < MIN_SAFE_CALS))
                      }
                      onClick={() => {
                        if (calcObjetivo === 'manter') {
                          useDietCals(calcResult.manter, 'manter')
                        } else if (calcDeficit === 'custom') {
                          useDietCals(parseInt(customCalGoal), calcObjetivo)
                        } else {
                          const pcts = calcObjetivo === 'emagrecer'
                            ? { leve:15, mod:25, agr:35 }
                            : { leve:10, mod:20, agr:30 }
                          const pct  = pcts[calcDeficit as 'leve'|'mod'|'agr']
                          const cals = calcObjetivo === 'emagrecer'
                            ? Math.round(calcResult.tdee * (1 - pct / 100))
                            : Math.round(calcResult.tdee * (1 + pct / 100))
                          useDietCals(cals, calcObjetivo)
                        }
                      }}>
                      <Calculator size={14}/> Usar
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
                <span className="config-section-label"><Utensils size={15}/> Gerar Dieta</span>
                <span className="config-section-desc">Monte seu cardápio automático</span>
              </div>
              <ChevronDown size={15} className={`config-section-arrow ${configSections.dieta ? 'open' : ''}`} />
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
                      value={dietTarget} onChange={e => setDietTarget(e.target.value)}
                      onFocus={e => e.currentTarget.select()}
                      placeholder="Ex: 1600" />
                    <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>kcal/dia</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>
                    Use <strong>Calcular</strong> acima para obter o valor ideal para você.
                  </div>
                </div>
                <div className="calc-field" style={{ marginTop:12 }}>
                  <label className="calc-label">Preferência de alimentos</label>
                  <div className="calc-obj-row">
                    <button className={`calc-obj-btn ${!dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(false)}><Sparkles size={14}/> Melhor qualidade</button>
                    <button className={`calc-obj-btn ${dietBudget ? 'active' : ''}`} onClick={() => setDietBudget(true)}><Coins size={14}/> Simples / Barato</button>
                  </div>
                </div>
                <button className="btn" style={{ marginTop:14 }} onClick={() => handleGenerateDiet()}
                  disabled={!dietTarget || parseInt(dietTarget) < MIN_SAFE_CALS}>
                  <Zap size={15}/> Gerar Dieta Automaticamente
                </button>

                {generatedDiet && (() => {
                  const totalKcal = generatedDiet.reduce((s, m) => s + m.actualKcal, 0)
                  const target    = parseInt(dietTarget) || 1
                  const totalP    = generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.p, 0)
                  const totalC    = generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.c, 0)
                  const totalF    = generatedDiet.flatMap(m => m.items).reduce((s, i) => s + i.f, 0)
                  const diff      = totalKcal - target
                  const diffColor = Math.abs(diff) <= 100 ? 'var(--success)' : diff > 0 ? 'var(--error)' : 'var(--warning)'
                  const diffText  = Math.abs(diff) <= 100 ? 'No alvo' : diff > 0 ? `+${diff} kcal acima` : `${Math.abs(diff)} kcal abaixo`
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
                        <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                          <button className="btn btn-small btn-cancel" style={{ flex:1 }} onClick={handleNextDietVariant}>
                            <RefreshCw size={13}/> Ver outra opção
                            <span style={{ opacity:0.6, marginLeft:4 }}>({dietVariantIdx + 1}/{DIET_VARIANT_COUNT})</span>
                          </button>
                          {Math.abs(diff) > 150 && (
                            <button className="btn btn-small btn-cancel" style={{ flex:1 }} onClick={() => handleGenerateDiet(dietVariantIdx)}>
                              <RefreshCw size={13}/> Reajustar para meta
                            </button>
                          )}
                        </div>
                        <button className="btn" style={{ marginTop:8, width:'100%' }} onClick={saveDiet}>
                          <CheckCircle2 size={15}/> Salvar como Meu Cardápio
                        </button>
                        <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(var(--primary-rgb, 99,102,241), .07)', borderRadius:8, display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}>
                          <ShoppingCart size={13} style={{ flexShrink:0 }}/> Ao salvar, você verá automaticamente a lista de compras para a semana.
                        </div>
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
                                  {BUDGET_IDS.has(item.food.id) && <span className="diet-budget-badge"><Coins size={11}/></span>}
                                </div>
                              </div>
                              <button className="diet-sub-btn" title="Substituir" onClick={() => openDietSubModal(mi, ii)}><ArrowLeftRight size={13}/></button>
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
                <span className="config-section-label"><ClipboardList size={15}/> Meu Cardápio</span>
                <span className="config-section-desc">Edite e organize seus alimentos</span>
              </div>
              <ChevronDown size={15} className={`config-section-arrow ${configSections.cardapio ? 'open' : ''}`} />
            </div>
            {configSections.cardapio && (
              <div className="config-section-body">
                {/* ── Buscar TACO + Lista de Compras + Comunidade ── */}
                <div style={{ display:'flex', gap:6, marginBottom:16, marginTop:8, flexWrap:'wrap' }}>
                  <button className="btn btn-small" style={{ width:'auto' }} onClick={() => openTACO(0)}><Search size={13}/> Buscar TACO</button>
                  <button className="btn btn-small" style={{ width:'auto' }} onClick={() => setShowShoppingModal(true)}><ShoppingCart size={13}/> Lista de Compras</button>
                  {firebaseConfigured && authUser && userProfile && (<>
                    <button className="btn btn-small" style={{ width:'auto', background:'var(--surface-2)', color:'var(--text-primary)' }}
                      onClick={handleShareDiet} disabled={shareDietLoading}>
                      <Share2 size={13}/> Compartilhar
                    </button>
                    <button className="btn btn-small" style={{ width:'auto', background:'var(--surface-2)', color:'var(--text-primary)' }}
                      onClick={() => { setDietCodeModal(true); setDietCodeInput(''); setDietCodePreview(null); setDietCodeError(''); setDietCodeConfirm(false) }}>
                      <Download size={13}/> Importar
                    </button>
                    <button className="btn btn-small" style={{ width:'auto', background:'var(--surface-2)', color:'var(--primary)' }}
                      onClick={handlePublishToCommunity} disabled={shareDietLoading}>
                      <Users size={13}/> Publicar na comunidade
                    </button>
                  </>)}
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

                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleMealDragEnd}
                >
                  <SortableContext items={meals.map(m => m.id)} strategy={verticalListSortingStrategy}>
                    {meals.map((meal, mealIdx) => (
                      <SortableMealBlock
                        key={meal.id}
                        meal={meal}
                        mealIdx={mealIdx}
                        dndSensors={dndSensors}
                        onEditItem={item => openItemModal('edit', mealIdx, item)}
                        onDeleteItem={itemId => deleteMealItem(mealIdx, itemId)}
                        onAddManual={() => openItemModal('add', mealIdx)}
                        onSearchTACO={() => openTACO(mealIdx)}
                        onItemsReorder={newItems => handleItemsReorder(meal.id, newItems)}
                        hasCustomFoods={customFoods.length > 0}
                        onOpenMyFoods={() => {
                          setMyFoodsMealIdx(mealIdx)
                          setMyFoodsQuery('')
                          setMyFoodsDeleteConfirm(null)
                          setShowMyFoods(true)
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>

          {/* ── Seção: Substituidores ── */}
          <div className="config-section">
            <div className="config-section-header" onClick={() => toggleConfigSection('subs')}>
              <div className="config-section-title-group">
                <span className="config-section-label"><ArrowLeftRight size={15}/> Substituidores</span>
                <span className="config-section-desc">Gerencie alternativas por alimento</span>
              </div>
              <ChevronDown size={15} className={`config-section-arrow ${configSections.subs ? 'open' : ''}`} />
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
                              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                {firebaseConfigured && authUser && userProfile && (
                                  <button className="config-reset-btn" title="Compartilhar com a comunidade"
                                    onClick={() => { setShareSubItem({ original: item, sub: alt }); setShareSubReason(''); setShareSubDone(false) }}>
                                    <Share2 size={12}/>
                                  </button>
                                )}
                                <button className="config-reset-btn" onClick={() => deleteAlt(item.id, alt.id)}>✕</button>
                              </div>
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

      {/* ══ Toast: dieta desatualizada após edição manual de meta ══ */}
      {suggestRegen && (
        <div className="regen-toast">
          <div className="regen-toast-body">
            <Utensils size={16} style={{ flexShrink: 0 }}/>
            <span>Sua meta mudou. Deseja gerar uma nova dieta com base nos novos valores?</span>
          </div>
          <div className="regen-toast-actions">
            <button className="regen-toast-dismiss" onClick={() => setSuggestRegen(false)}>
              Agora não
            </button>
            <button className="btn regen-toast-confirm" onClick={() => {
              setDietTarget(String(userGoals.cals))
              setActiveTab('config')
              setConfigSections(s => ({ ...s, dieta: true, metas: false }))
              setSuggestRegen(false)
            }}>
              Gerar nova dieta
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal: Meus Alimentos ══ */}
      {showMyFoods && (
        <div className="modal-overlay" onClick={() => { setShowMyFoods(false); setMyFoodsDeleteConfirm(null); setMyFoodsPendingAdd(null) }}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <BookMarked size={16}/> Meus Alimentos
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="config-goal-label" style={{ marginBottom: 6 }}>Adicionar em:</label>
              <select
                className="login-input"
                value={myFoodsMealIdx}
                onChange={e => setMyFoodsMealIdx(Number(e.target.value))}
              >
                {meals.map((m, i) => <option key={m.id} value={i}>{m.title}</option>)}
              </select>
            </div>

            <input
              type="text"
              className="login-input"
              placeholder="Buscar na biblioteca..."
              value={myFoodsQuery}
              autoFocus
              onChange={e => { setMyFoodsQuery(e.target.value); setMyFoodsDeleteConfirm(null); setMyFoodsPendingAdd(null) }}
              style={{ marginBottom: 10 }}
            />

            {(() => {
              const q = myFoodsQuery.trim().toLowerCase()
              const filtered = q.length >= 1
                ? customFoods.filter(cf => cf.name.toLowerCase().includes(q))
                : customFoods
              if (filtered.length === 0) {
                return (
                  <div className="my-foods-empty">
                    {customFoods.length === 0
                      ? 'Nenhum alimento salvo ainda. Adicione alimentos manualmente e eles aparecerão aqui.'
                      : 'Nenhum alimento encontrado.'}
                  </div>
                )
              }
              return (
                <div className="my-foods-list">
                  {filtered.map(cf => (
                    <div key={cf.id} className="my-foods-item">
                      <div className="my-foods-info">
                        <div className="my-foods-name">{cf.name}</div>
                        <div className="my-foods-macros">
                          {cf.kcal} kcal · P{cf.p}g · C{cf.c}g · G{cf.f}g
                          {cf.gramsPerUnit ? ` · ${cf.grams}g` : ` · ${cf.grams}g`}
                        </div>
                        {cf.gramsPerUnit && (
                          <div className="my-foods-unit-hint">1 un = {cf.gramsPerUnit}g</div>
                        )}
                        {cf.createdBy && (
                          <button
                            onClick={() => setViewProfileModal({ username: cf.createdBy!.username, avatar: cf.createdBy!.avatar })}
                            style={{ display:'flex', alignItems:'center', gap:4, marginTop:3, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                            <CommunityAvatar av={cf.createdBy.avatar} size={16} />
                            <span style={{ fontSize:11, color:'var(--text-secondary)' }}>@{cf.createdBy.username}</span>
                          </button>
                        )}
                      </div>
                      <div className="my-foods-actions">
                        {myFoodsDeleteConfirm === cf.id ? (
                          <div className="my-foods-confirm">
                            <span className="my-foods-confirm-text">Remover {cf.name} da sua biblioteca?</span>
                            <button
                              className="config-reset-btn"
                              style={{ color: 'var(--error)', fontSize: 11 }}
                              onClick={() => {
                                const updated = customFoods.filter(f => f.id !== cf.id)
                                setCustomFoods(updated)
                                save({ customFoods: updated })
                                setMyFoodsDeleteConfirm(null)
                                if (myFoodsPendingAdd?.food.id === cf.id) setMyFoodsPendingAdd(null)
                              }}
                            >
                              Remover
                            </button>
                            <button
                              className="config-reset-btn"
                              style={{ fontSize: 11 }}
                              onClick={() => setMyFoodsDeleteConfirm(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : myFoodsPendingAdd?.food.id === cf.id ? (
                          <div className="my-foods-unit-picker">
                            <span className="my-foods-unit-picker-label">Quantas unidades?</span>
                            <div className="my-foods-unit-picker-row">
                              <button
                                className="qty-btn"
                                disabled={myFoodsPendingAdd.qty <= 1}
                                onClick={() => setMyFoodsPendingAdd(p => p ? { ...p, qty: Math.max(1, p.qty - 1) } : p)}
                              ><MinusIcon size={12}/></button>
                              <span className="my-foods-unit-qty">{myFoodsPendingAdd.qty}</span>
                              <button
                                className="qty-btn"
                                disabled={myFoodsPendingAdd.qty >= 99}
                                onClick={() => setMyFoodsPendingAdd(p => p ? { ...p, qty: Math.min(99, p.qty + 1) } : p)}
                              ><PlusIcon size={12}/></button>
                            </div>
                            <button
                              className="config-reset-btn"
                              style={{ fontSize: 11, color: 'var(--primary)' }}
                              onClick={() => {
                                const { food, qty } = myFoodsPendingAdd
                                const ratio = food.gramsPerUnit && food.initialUnits
                                  ? (qty * food.gramsPerUnit) / (food.initialUnits * food.gramsPerUnit)
                                  : qty / (food.initialUnits ?? 1)
                                const item: MealItem = {
                                  id:   newId(),
                                  name: `${food.name} (${qty} un) ${Math.round((food.gramsPerUnit ?? 0) * qty)}g`,
                                  kcal: Math.round(food.kcal * ratio),
                                  p:    +(food.p * ratio).toFixed(1),
                                  c:    +(food.c * ratio).toFixed(1),
                                  f:    +(food.f * ratio).toFixed(1),
                                  unitQty: qty,
                                }
                                const nm = meals.map((m, mi) => mi !== myFoodsMealIdx ? m : { ...m, items: [...m.items, item] })
                                setMeals(nm); save({ meals: nm })
                                setMyFoodsPendingAdd(null); setShowMyFoods(false)
                              }}
                            >
                              Confirmar
                            </button>
                            <button
                              className="config-reset-btn"
                              style={{ fontSize: 11 }}
                              onClick={() => setMyFoodsPendingAdd(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="config-reset-btn"
                              style={{ fontSize: 11, color: 'var(--primary)' }}
                              onClick={() => {
                                if (cf.gramsPerUnit && cf.initialUnits) {
                                  setMyFoodsPendingAdd({ food: cf, qty: cf.initialUnits })
                                  setMyFoodsDeleteConfirm(null)
                                } else {
                                  const item: MealItem = {
                                    id:   newId(),
                                    name: cf.name,
                                    kcal: cf.kcal,
                                    p:    cf.p,
                                    c:    cf.c,
                                    f:    cf.f,
                                  }
                                  const nm = meals.map((m, mi) => mi !== myFoodsMealIdx ? m : { ...m, items: [...m.items, item] })
                                  setMeals(nm); save({ meals: nm }); setShowMyFoods(false)
                                }
                              }}
                            >
                              Adicionar
                            </button>
                            <button
                              className="config-reset-btn my-foods-delete-btn"
                              title="Remover da biblioteca"
                              onClick={() => { setMyFoodsDeleteConfirm(cf.id); setMyFoodsPendingAdd(null) }}
                            >
                              <Trash2 size={13}/>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            <button
              className="btn btn-cancel"
              style={{ marginTop: 14 }}
              onClick={() => { setShowMyFoods(false); setMyFoodsDeleteConfirm(null); setMyFoodsPendingAdd(null) }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal: Compartilhar Cardápio ══ */}
      {shareDietModal && (
        <div className="modal-overlay" onClick={() => setShareDietModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Share2 size={16}/> Compartilhar cardápio</div>

            <div style={{ background:'var(--surface-2)', borderRadius:10, padding:'14px 16px', marginBottom:16, textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:6 }}>Código do cardápio</div>
              <div style={{ fontSize:24, fontWeight:800, letterSpacing:3, color:'var(--primary)' }}>{shareDietModal.code}</div>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <button className="btn btn-small" style={{ flex:1 }}
                onClick={() => navigator.clipboard.writeText(shareDietModal.code)}>
                <Copy size={13}/> Copiar código
              </button>
              <button className="btn btn-small" style={{ flex:1 }}
                onClick={() => navigator.clipboard.writeText(`https://meu-plano-completo-mnreihyyo-vitor-pinheiro-s-projects.vercel.app`)}>
                <Copy size={13}/> Copiar link
              </button>
            </div>

            <button className="btn btn-small" style={{ width:'100%', marginBottom:12, background:'#25D366', color:'#fff' }}
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Veja meu cardápio no Meu Plano! Código: ${shareDietModal.code}`)}`, '_blank')}>
              WhatsApp
            </button>

            <button className="btn btn-cancel" style={{ marginTop:4 }} onClick={() => setShareDietModal(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Importar Cardápio ══ */}
      {dietCodeModal && (
        <div className="modal-overlay" onClick={() => setDietCodeModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Download size={16}/> Importar cardápio</div>

            <div style={{ marginBottom:12 }}>
              <label className="config-goal-label" style={{ marginBottom:6 }}>Código do cardápio</label>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Ex: VITOR-X7K2"
                  value={dietCodeInput}
                  onChange={e => setDietCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleDietCodeSearch()}
                  style={{ flex:1, letterSpacing:2 }}
                />
                <button className="btn btn-small" style={{ width:'auto' }}
                  onClick={handleDietCodeSearch} disabled={dietCodeLoading || !dietCodeInput.trim()}>
                  {dietCodeLoading ? '...' : 'Buscar'}
                </button>
              </div>
              {dietCodeError && <div className="login-error" style={{ marginTop:6 }}>{dietCodeError}</div>}
            </div>

            {dietCodePreview && (
              <div style={{ background:'var(--surface-2)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <CommunityAvatar av={dietCodePreview.authorAvatar} size={36} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>@{dietCodePreview.authorUsername}</div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{dietCodePreview.dietData.length} refeições</div>
                  </div>
                  <div style={{ marginLeft:'auto', textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'var(--primary)' }}>{dietCodePreview.totalCals} kcal</div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)' }}>P{dietCodePreview.macros.p}g C{dietCodePreview.macros.c}g G{dietCodePreview.macros.g}g</div>
                  </div>
                </div>
                {dietCodePreview.dietData.map((meal: any) => (
                  <div key={meal.id} style={{ marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{meal.title}</div>
                    {meal.items.map((item: any) => (
                      <div key={item.id} style={{ fontSize:11, color:'var(--text-secondary)', paddingLeft:8 }}>
                        {item.name} — {item.kcal} kcal
                      </div>
                    ))}
                  </div>
                ))}
                {!dietCodeConfirm ? (
                  <button className="btn" style={{ marginTop:10 }}
                    onClick={() => setDietCodeConfirm(true)}>
                    Usar este cardápio
                  </button>
                ) : (
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8 }}>Isso vai substituir seu cardápio atual:</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn" style={{ flex:1 }}
                        onClick={() => handleUseDiet(dietCodePreview)}>
                        Só o cardápio
                      </button>
                      <button className="btn" style={{ flex:1, background:'var(--success)', color:'#fff' }}
                        onClick={() => handleUseDiet(dietCodePreview, true)}>
                        + metas<br/>
                        <span style={{ fontSize:11, opacity:0.85 }}>{dietCodePreview.totalCals} kcal</span>
                      </button>
                    </div>
                    <button className="btn btn-cancel" style={{ marginTop:8 }} onClick={() => setDietCodeConfirm(false)}>Cancelar</button>
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-cancel" onClick={() => setDietCodeModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Detalhe Cardápio da Comunidade ══ */}
      {communityDietDetail && (
        <div className="modal-overlay" onClick={() => setCommunityDietDetail(null)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <CommunityAvatar av={communityDietDetail.authorAvatar} size={40} />
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>@{communityDietDetail.authorUsername}</div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  {communityDietDetail.totalCals} kcal · P{communityDietDetail.macros.p}g C{communityDietDetail.macros.c}g G{communityDietDetail.macros.g}g
                </div>
              </div>
            </div>
            <div style={{ maxHeight:360, overflowY:'auto', marginBottom:12 }}>
              {communityDietDetail.dietData.map((meal: any) => (
                <div key={meal.id} style={{ marginBottom:10 }}>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:4, color:'var(--primary)' }}>{meal.title}</div>
                  {meal.items.map((item: any) => (
                    <div key={item.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', borderBottom:'1px solid var(--border)' }}>
                      <span>{item.name}</span>
                      <span style={{ color:'var(--text-secondary)' }}>{item.kcal} kcal</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8 }}>Isso vai substituir seu cardápio atual.</div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <button className="btn" style={{ flex:1 }}
                onClick={() => handleUseDiet(communityDietDetail)}>
                Só o cardápio
              </button>
              <button className="btn" style={{ flex:1, background:'var(--success)', color:'#fff' }}
                onClick={() => handleUseDiet(communityDietDetail, true)}>
                Cardápio + metas<br/>
                <span style={{ fontSize:11, opacity:0.85 }}>{communityDietDetail.totalCals} kcal</span>
              </button>
            </div>
            <button className="btn btn-cancel" onClick={() => setCommunityDietDetail(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Publicar Alimento na Comunidade ══ */}
      {showFoodPicker && (
        <div className="modal-overlay" onClick={() => setShowFoodPicker(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><BookMarked size={16}/> Publicar alimento na comunidade</div>

            {foodPickerDone ? (
              <div style={{ textAlign:'center', padding:'16px 0' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
                <div style={{ fontWeight:600, marginBottom:4 }}>Publicado!</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)' }}>"{foodPickerDone}" já está na comunidade.</div>
                <button className="btn" style={{ marginTop:16 }} onClick={() => setShowFoodPicker(false)}>Fechar</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Buscar nos meus alimentos..."
                  value={foodPickerQuery}
                  autoFocus
                  onChange={e => setFoodPickerQuery(e.target.value)}
                  style={{ marginBottom:10 }}
                />
                {(() => {
                  const q = foodPickerQuery.trim().toLowerCase()
                  const filtered = q ? customFoods.filter(f => f.name.toLowerCase().includes(q)) : customFoods
                  if (filtered.length === 0) return (
                    <div style={{ textAlign:'center', color:'var(--text-secondary)', padding:'16px 0', fontSize:13 }}>
                      {customFoods.length === 0 ? 'Nenhum alimento salvo. Adicione alimentos em Meu Cardápio.' : 'Nenhum resultado.'}
                    </div>
                  )
                  return (
                    <div className="my-foods-list">
                      {filtered.map(cf => (
                        <div key={cf.id} className="my-foods-item">
                          <div className="my-foods-info">
                            <div className="my-foods-name">{cf.name}</div>
                            <div className="my-foods-macros">{cf.kcal} kcal · P{cf.p}g · C{cf.c}g · G{cf.f}g · {cf.grams}g</div>
                          </div>
                          <button className="btn btn-small" style={{ width:'auto', flexShrink:0 }}
                            disabled={foodPickerLoading}
                            onClick={async () => {
                              if (!authUser || !userProfile) return
                              setFoodPickerLoading(true)
                              await shareCustomFood(authUser.uid, userProfile, {
                                name: cf.name, kcal: cf.kcal, p: cf.p, c: cf.c, f: cf.f, grams: cf.grams ?? 100,
                              })
                              const foods = await loadPublicCustomFoods()
                              setCommunityFoods(foods)
                              setFoodPickerDone(cf.name)
                              setFoodPickerLoading(false)
                            }}>
                            Publicar
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <button className="btn btn-cancel" style={{ marginTop:12 }} onClick={() => setShowFoodPicker(false)}>Fechar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ Modal: Perfil de Usuário ══ */}
      {viewProfileModal && (
        <div className="modal-overlay" onClick={() => setViewProfileModal(null)}>
          <div className="modal-card" style={{ textAlign:'center' }} onClick={e => e.stopPropagation()}>
            <CommunityAvatar av={viewProfileModal.avatar} size={72} />
            <div style={{ fontWeight:700, fontSize:18, marginTop:12 }}>@{viewProfileModal.username}</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:4 }}>
              Perfil público · Meu Plano
            </div>
            <button className="btn btn-cancel" style={{ marginTop:16 }} onClick={() => setViewProfileModal(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ══ Modal: Compartilhar Substituição ══ */}
      {shareSubItem && (
        <div className="modal-overlay" onClick={() => { setShareSubItem(null); setShareSubReason(''); setShareSubDone(false) }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Share2 size={16}/> Compartilhar substituição</div>
            {shareSubDone ? (
              <div style={{ textAlign:'center', padding:'16px 0' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
                <div style={{ fontWeight:600, marginBottom:4 }}>Compartilhado!</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)' }}>Sua substituição já está na comunidade.</div>
                <button className="btn" style={{ marginTop:16 }} onClick={() => { setShareSubItem(null); setShareSubReason(''); setShareSubDone(false) }}>Fechar</button>
              </div>
            ) : (
              <>
                <div style={{ background:'var(--surface-2)', borderRadius:10, padding:'10px 12px', marginBottom:12, fontSize:13 }}>
                  <span style={{ fontWeight:600 }}>{shareSubItem.original.name}</span>
                  <span style={{ color:'var(--text-secondary)', margin:'0 8px' }}>→</span>
                  <span style={{ fontWeight:600, color:'var(--primary)' }}>{shareSubItem.sub.name}</span>
                </div>
                <label className="config-goal-label" style={{ marginBottom:6 }}>Motivo (opcional)</label>
                <input type="text" className="login-input" placeholder='Ex: "mais barato", "sem glúten"'
                  value={shareSubReason} onChange={e => setShareSubReason(e.target.value)} style={{ marginBottom:12 }} />
                <button className="btn" onClick={handleShareSub} disabled={shareSubLoading}>
                  {shareSubLoading ? 'Compartilhando...' : 'Compartilhar com a comunidade'}
                </button>
                <button className="btn btn-cancel" style={{ marginTop:8 }} onClick={() => { setShareSubItem(null); setShareSubReason(''); setShareSubDone(false) }}>Cancelar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ Toast: refeições atualizadas ══ */}
      {refeicaoToast && (
        <div className="refeicao-toast">
          <Utensils size={15} style={{ flexShrink: 0 }}/>
          <span>Refeições atualizadas — calorias redistribuídas ✓</span>
        </div>
      )}

      {/* ══ Bottom Navigation (mobile only) ══ */}
      <nav className="bottom-nav">
        {[
          { id:'hoje',         icon:<ClipboardList size={22}/>, label:'Hoje'  },
          { id:'peso',         icon:<Scale size={22}/>,         label:'Peso'  },
          { id:'estatísticas', icon:<BarChart3 size={22}/>,     label:'Stats' },
          { id:'comunidade',   icon:<Users size={22}/>,         label:'Comunidade' },
          { id:'config',       icon:<Settings size={22}/>,      label:'Config'},
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

      <footer><Dumbbell size={13}/> Consistência vence tudo. Você consegue!</footer>
    </div>
  )
}
