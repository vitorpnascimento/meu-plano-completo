import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    
    if (!text || text.trim().length < 10) {
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      }, { status: 200 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-20250307",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `VOCÊ DEVE RETORNAR APENAS JSON VÁLIDO. NADA DE TEXTO, MARKDOWN OU EXPLICAÇÕES.

Texto da dieta do usuário:
${text}

EXTRAIR ALIMENTOS E SEUS MACROS.

RETORNE ESTE JSON EXATO (preencha com os dados extraídos):
{
  "meals": {
    "Café da Manhã": [
      {"food": "ovo", "quantity": "2", "unit": "unidade", "kcal": 155, "protein": 12, "carbs": 1, "fat": 11},
      {"food": "pão", "quantity": "1", "unit": "unidade", "kcal": 80, "protein": 2, "carbs": 15, "fat": 1}
    ],
    "Almoço": [
      {"food": "frango", "quantity": "150", "unit": "g", "kcal": 280, "protein": 52, "carbs": 0, "fat": 8},
      {"food": "arroz", "quantity": "100", "unit": "g", "kcal": 130, "protein": 3, "carbs": 28, "fat": 0},
      {"food": "feijão", "quantity": "100", "unit": "g", "kcal": 100, "protein": 8, "carbs": 18, "fat": 0}
    ],
    "Lanche": [
      {"food": "banana", "quantity": "1", "unit": "unidade", "kcal": 90, "protein": 1, "carbs": 23, "fat": 0}
    ]
  },
  "totals": {"kcal": 835, "protein": 78, "carbs": 85, "fat": 20}
}

REGRAS OBRIGATÓRIAS:
1. SEMPRE retorne válido JSON - nunca markdown, código ou texto
2. Se não souber quantidade exata, ESTIME razoavelmente
3. Use macros PADRÃO da TACO (banco de dados alimentar brasileiro)
4. Agrupe por refeição/horário mencionado no texto
5. Se alimento não tem quantidade, estime uma razoável
6. SEM aspas extras, SEM comentários, SEM explicações
7. Ignore: água, café puro, chá puro, sal, temperos SEM quantidade
8. Retorne APENAS JSON válido, nada mais

SEJA LENIENTE - extraia qualquer coisa que pareça ser um alimento.`
        }]
      })
    });

    const data = await response.json();
    let jsonText = "";

    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find((b: any) => b.type === "text");
      if (textBlock && textBlock.text) {
        jsonText = textBlock.text.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
        }
      }
    }

    try {
      const parsed = JSON.parse(jsonText);
      const meals = parsed.meals || {};
      const totals = parsed.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      
      return NextResponse.json({
        meals,
        totals: {
          kcal: Math.round(totals.kcal || 0),
          protein: Math.round(totals.protein || 0),
          carbs: Math.round(totals.carbs || 0),
          fat: Math.round(totals.fat || 0)
        }
      }, { status: 200 });
    } catch (e) {
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        error: "parse_failed"
      }, { status: 200 });
    }

  } catch (error) {
    return NextResponse.json({
      meals: {},
      totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      error: "server_error"
    }, { status: 200 });
  }
}
