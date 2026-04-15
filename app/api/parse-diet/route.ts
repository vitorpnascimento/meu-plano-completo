import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const text = body?.text?.trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (text.length > 8000) return NextResponse.json({ error: 'text too long' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const prompt = `Você é um nutricionista especializado em dietas brasileiras.
Analise o texto abaixo e extraia os alimentos organizados por refeição.

Para cada alimento:
- Use o nome mais próximo da tabela TACO (Tabela Brasileira de Composição de Alimentos)
- Estime a quantidade em gramas baseado na descrição (ex: "2 ovos" = 100g, "1 pão francês" = 50g, "1 colher de sopa de azeite" = 13g, "1 xícara de aveia" = 80g)
- Calcule calorias e macros com realismo
- confidence: "high" se claramente identificado, "low" se você teve que supor

Texto da dieta:
"""
${text}
"""

Responda APENAS com JSON válido no formato:
{
  "meals": {
    "Café da Manhã": [
      { "name": "Nome do alimento TACO", "grams": 100, "kcal": 150, "p": 10.0, "c": 20.0, "f": 5.0, "confidence": "high" }
    ]
  },
  "totalMacros": { "kcal": 2000, "p": 150.0, "c": 250.0, "f": 60.0 }
}

Refeições possíveis: "Café da Manhã", "Almoço", "Lanche da Manhã", "Lanche da Tarde", "Jantar", "Ceia".
Inclua apenas refeições que tenham alimentos. Recalcule totalMacros somando tudo. Sem texto extra.`

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
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 })

    const data = await res.json()
    const raw  = (data?.content?.[0]?.text ?? '').trim()

    // Extract JSON from response (may have markdown fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Parse failed' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.meals || typeof parsed.meals !== 'object') {
      return NextResponse.json({ error: 'Invalid structure' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
