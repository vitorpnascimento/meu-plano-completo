import { NextRequest, NextResponse } from 'next/server'

function sanitize(text: string): string {
  return text
    .replace(/~/g, '')
    .replace(/@/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

/** Always-valid empty response — client shows "nenhum alimento identificado" */
function emptyResult(debugError: string) {
  console.error('[parse-diet] fallback:', debugError)
  return NextResponse.json({
    meals:       {},
    totalMacros: { kcal: 0, p: 0, c: 0, f: 0 },
    success:     false,
    debugError,
  })
}

const PROMPT = (text: string) => `Você é um analisador de dietas. Seu trabalho é ler QUALQUER texto de dieta e extrair os alimentos, mesmo que o texto esteja desorganizado, incompleto ou com erros.

REGRAS ABSOLUTAS:
1. NUNCA rejeite o texto. Sempre retorne alguma coisa.
2. Se não tiver certeza de um alimento, marque confidence: "low" e estime.
3. Se reconheceu bem, marque confidence: "high".
4. Use valores do banco TACO brasileiro para macros, mesmo que aproximados.
5. Para alimentos não reconhecidos, estime com base em similares.
6. Sempre retorne JSON válido. NUNCA retorne mensagem de erro.
7. Se o texto tiver múltiplas opções ("ou", "/"), processe a primeira.
8. "À vontade" ou "livre" = porção modesta (ex: 50g de salada).

REFERÊNCIAS DE PESO:
- 1 ovo = 50g | 1 clara = 30g
- 1 pão francês = 50g | 1 fatia de pão = 25g
- 1 col. sopa = 15g | 1 col. chá = 5g | 1 xícara = 200ml
- 1 concha de feijão/arroz = 80g | 1 scoop de whey = 30g
- 1 banana = 100g | 1 maçã = 130g | 1 laranja = 180g
- 1 pote de iogurte = 170g | 1 copo de leite = 200ml

TEXTO DA DIETA:
"""
${text}
"""

Retorne APENAS JSON, sem texto extra, sem markdown:
{
  "meals": {
    "Café da Manhã": [
      { "name": "Ovo de galinha, cozido", "grams": 150, "kcal": 219, "p": 19.5, "c": 1.6, "f": 14.5, "confidence": "high" }
    ],
    "Almoço": [
      { "name": "Frango, peito, grelhado", "grams": 150, "kcal": 165, "p": 31.0, "c": 0.0, "f": 3.6, "confidence": "high" }
    ]
  },
  "totalMacros": { "kcal": 384, "p": 50.5, "c": 1.6, "f": 18.1 },
  "success": true
}

Refeições válidas: "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", "Jantar", "Ceia".
Inclua apenas refeições que tenham alimentos identificados. Some corretamente o totalMacros.`

export async function POST(req: NextRequest) {
  // ── 1. Parse request body ─────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  const raw  = body?.text?.trim()
  console.log('[parse-diet] input length:', raw?.length ?? 0)

  if (!raw)               return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (raw.length > 10000) return NextResponse.json({ error: 'text too long' },    { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const text = sanitize(raw)
  console.log('[parse-diet] sanitized length:', text.length)

  // ── 2. Call Anthropic ─────────────────────────────────────────────────────
  let responseText = ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages:   [{ role: 'user', content: PROMPT(text) }],
      }),
    })

    console.log('[parse-diet] anthropic status:', res.status)

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[parse-diet] anthropic error body:', errBody)
      return emptyResult(`upstream_${res.status}: ${errBody.slice(0, 200)}`)
    }

    const data = await res.json()
    responseText = (data?.content?.[0]?.text ?? '').trim()
    console.log('[parse-diet] response length:', responseText.length)
    console.log('[parse-diet] response preview:', responseText.slice(0, 300))
  } catch (fetchErr) {
    console.error('[parse-diet] fetch error:', fetchErr)
    return emptyResult(`fetch_error: ${String(fetchErr).slice(0, 200)}`)
  }

  // ── 3. Extract JSON ───────────────────────────────────────────────────────
  const start = responseText.indexOf('{')
  const end   = responseText.lastIndexOf('}')
  console.log('[parse-diet] JSON bounds: start=', start, 'end=', end)

  if (start === -1 || end === -1 || end <= start) {
    return emptyResult(`no_json_found. raw: ${responseText.slice(0, 300)}`)
  }

  let parsed: any
  try {
    parsed = JSON.parse(responseText.slice(start, end + 1))
    console.log('[parse-diet] JSON parsed OK, meals keys:', Object.keys(parsed?.meals ?? {}))
  } catch (parseErr1) {
    console.warn('[parse-diet] first parse failed, trying cleaned:', parseErr1)
    try {
      const cleaned = responseText.slice(start, end + 1).replace(/[\x00-\x1F\x7F]/g, ' ')
      parsed = JSON.parse(cleaned)
      console.log('[parse-diet] cleaned parse OK')
    } catch (parseErr2) {
      console.error('[parse-diet] both parses failed:', parseErr2)
      return emptyResult(`json_parse_error: ${String(parseErr2).slice(0, 200)}`)
    }
  }

  // ── 4. Validate meals ─────────────────────────────────────────────────────
  if (!parsed?.meals || typeof parsed.meals !== 'object') {
    console.error('[parse-diet] no meals object. parsed keys:', Object.keys(parsed ?? {}))
    return emptyResult(`no_meals_key. keys: ${Object.keys(parsed ?? {}).join(', ')}`)
  }

  // ── 5. Sanitize numeric fields ────────────────────────────────────────────
  for (const [mealName, items] of Object.entries(parsed.meals) as [string, any[]][]) {
    if (!Array.isArray(items)) {
      console.warn('[parse-diet] meal not array:', mealName, typeof items)
      parsed.meals[mealName] = []
      continue
    }
    for (const item of items) {
      item.grams = Number(item.grams) || 100
      item.kcal  = Number(item.kcal)  || 0
      item.p     = Number(item.p)     || 0
      item.c     = Number(item.c)     || 0
      item.f     = Number(item.f)     || 0
      item.confidence = item.confidence === 'low' ? 'low' : 'high'
    }
    // Remove empty meal
    if (parsed.meals[mealName].length === 0) delete parsed.meals[mealName]
  }

  // ── 6. Recompute totalMacros ──────────────────────────────────────────────
  let kcal = 0, p = 0, c = 0, f = 0
  for (const items of Object.values(parsed.meals) as any[][]) {
    for (const item of items) { kcal += item.kcal; p += item.p; c += item.c; f += item.f }
  }
  parsed.totalMacros = { kcal: Math.round(kcal), p: +p.toFixed(1), c: +c.toFixed(1), f: +f.toFixed(1) }
  parsed.success = true

  const totalItems = Object.values(parsed.meals as Record<string, any[]>).reduce((s, a) => s + a.length, 0)
  console.log('[parse-diet] done. meals:', Object.keys(parsed.meals).length, 'items:', totalItems, 'kcal:', parsed.totalMacros.kcal)

  return NextResponse.json(parsed)
}
