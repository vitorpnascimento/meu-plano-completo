import { NextRequest, NextResponse } from 'next/server'

/** Strip symbols that confuse models but carry no nutritional info */
function sanitize(text: string): string {
  return text
    .replace(/~/g, '')                   // "~350g" → "350g"
    .replace(/@/g, '')                   // stray @
    .replace(/\r\n/g, '\n')             // normalize line endings
    .replace(/\t/g, '  ')               // tabs → spaces
    .replace(/[ ]{3,}/g, '  ')          // collapse excessive spaces
    .replace(/\n{4,}/g, '\n\n\n')       // max 3 blank lines
    .trim()
}

const PROMPT = (text: string) => `Você é um nutricionista brasileiro experiente.
Sua tarefa é ler um texto de dieta em QUALQUER formato e extrair os alimentos por refeição.

REGRAS OBRIGATÓRIAS:
1. Aceite qualquer formato: listas, tabelas, texto corrido, com símbolos, erros de digitação, abreviações
2. Ignore símbolos decorativos (*, -, —, •, >, |, números de lista)
3. Para "Opção 1 / Opção 2": escolha a opção 1 como principal e marque confidence: "low"
4. Para quantidades vagas ("a vontade", "à vontade", "livre"): use uma porção modesta e marque confidence: "low"
5. Para suplementos: "1 scoop de whey" = 30g de proteína em pó (whey), "1 dose de creatina" = 5g
6. Nunca rejeite um alimento — se tiver dúvida, estime e marque confidence: "low"
7. Refeição padrão se não indicada: coloque em "Almoço" se parecer refeição principal, senão "Lanche da Tarde"

REFERÊNCIAS DE PESO (use quando a quantidade não estiver em gramas):
- 1 ovo inteiro = 50g | 1 clara = 30g | 1 gema = 20g
- 1 pão francês = 50g | 1 fatia de pão de forma = 25g
- 1 colher de sopa (col. sopa / cs) = 15g (sólidos) ou 15ml (líquidos)
- 1 colher de chá (col. chá / cc) = 5g
- 1 xícara = 200ml | 1 copo = 200ml
- 1 concha de feijão/lentilha = 80g | 1 concha de arroz = 60g
- 1 scoop de whey = 30g | 1 dose de albumina = 20g
- 1 banana = 100g | 1 maçã = 130g | 1 laranja = 180g | 1 kiwi = 80g
- 1 fatia de queijo = 30g | 1 fatia de frios = 20g
- 100ml de leite = 100g | 1 pote de iogurte = 170g
- "porção" sem especificação = 100g

TEXTO DA DIETA:
"""
${text}
"""

Responda SOMENTE com JSON válido, sem texto antes ou depois, sem markdown:
{
  "meals": {
    "Café da Manhã": [
      { "name": "Nome realista do alimento", "grams": 100, "kcal": 150, "p": 10.0, "c": 20.0, "f": 5.0, "confidence": "high" }
    ]
  },
  "totalMacros": { "kcal": 2000, "p": 150.0, "c": 250.0, "f": 60.0 }
}

Refeições válidas: "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", "Jantar", "Ceia".
Inclua só refeições com alimentos. Some corretamente o totalMacros.`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const raw  = body?.text?.trim()
  if (!raw)          return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (raw.length > 10000) return NextResponse.json({ error: 'text too long' }, { status: 400 })

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

    const data = await res.json()
    const responseText = (data?.content?.[0]?.text ?? '').trim()

    // Robust JSON extraction: find the outermost { } block
    const start = responseText.indexOf('{')
    const end   = responseText.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(responseText.slice(start, end + 1))
    } catch {
      // Try stripping control chars and retry
      const cleaned = responseText.slice(start, end + 1).replace(/[\x00-\x1F\x7F]/g, ' ')
      parsed = JSON.parse(cleaned)
    }

    if (!parsed?.meals || typeof parsed.meals !== 'object') {
      return NextResponse.json({ error: 'Invalid structure' }, { status: 500 })
    }

    // Sanitize: ensure all numeric fields are numbers, not strings
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

    // Recompute totalMacros from items (don't trust model's sum)
    let kcal = 0, p = 0, c = 0, f = 0
    for (const items of Object.values(parsed.meals) as any[][]) {
      for (const item of items) {
        kcal += item.kcal; p += item.p; c += item.c; f += item.f
      }
    }
    parsed.totalMacros = {
      kcal: Math.round(kcal),
      p:    +p.toFixed(1),
      c:    +c.toFixed(1),
      f:    +f.toFixed(1),
    }

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
