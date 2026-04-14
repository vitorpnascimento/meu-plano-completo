import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const food = body?.food?.trim()
  if (!food) return NextResponse.json({ error: 'food is required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const prompt = `Calcule os macronutrientes por 100g do alimento: "${food}".
Responda APENAS com JSON válido no formato: {"kcal":number,"p":number,"c":number,"f":number}
onde kcal=calorias, p=proteína(g), c=carboidrato(g), f=gordura(g).
Seja realista baseado na tabela TACO ou USDA. Sem texto extra.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 })

    const data = await res.json()
    const text = data?.content?.[0]?.text ?? ''
    const match = text.match(/\{[^}]+\}/)
    if (!match) return NextResponse.json({ error: 'Parse failed' }, { status: 500 })

    const macros = JSON.parse(match[0])
    return NextResponse.json(macros)
  } catch (e) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
