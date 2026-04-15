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
  const body = await req.json().catch(() => null)
  const raw  = body?.text?.trim()
  if (!raw)               return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (raw.length > 10000) return NextResponse.json({ error: 'text too long' },    { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const text = sanitize(raw)

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

    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 })

    const data         = await res.json()
    const responseText = (data?.content?.[0]?.text ?? '').trim()

    // Robust JSON extraction
    const start = responseText.indexOf('{')
    const end   = responseText.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(responseText.slice(start, end + 1))
    } catch {
      const cleaned = responseText.slice(start, end + 1).replace(/[\x00-\x1F\x7F]/g, ' ')
      parsed = JSON.parse(cleaned)
    }

    if (!parsed?.meals || typeof parsed.meals !== 'object') {
      return NextResponse.json({ error: 'Invalid structure' }, { status: 500 })
    }

    // Sanitize numeric fields
    for (const items of Object.values(parsed.meals) as any[][]) {
      for (const item of items) {
        item.grams = Number(item.grams) || 100
        item.kcal  = Number(item.kcal)  || 0
        item.p     = Number(item.p)     || 0
        item.c     = Number(item.c)     || 0
        item.f     = Number(item.f)     || 0
        item.confidence = item.confidence === 'low' ? 'low' : 'high'
      }
    }

    // Recompute totalMacros from items
    let kcal = 0, p = 0, c = 0, f = 0
    for (const items of Object.values(parsed.meals) as any[][]) {
      for (const item of items) { kcal += item.kcal; p += item.p; c += item.c; f += item.f }
    }
    parsed.totalMacros = { kcal: Math.round(kcal), p: +p.toFixed(1), c: +c.toFixed(1), f: +f.toFixed(1) }
    parsed.success = true

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
