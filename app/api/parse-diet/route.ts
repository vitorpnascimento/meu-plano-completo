import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    
    if (!text || text.trim().length < 20) {
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        debugError: "text_too_short"
      }, { status: 200 });
    }

    console.log("[parse-diet] input length:", text.length);
    console.log("[parse-diet] API key presente:", !!process.env.ANTHROPIC_API_KEY);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-20250307",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Você é um assistente para app de dieta. Você SEMPRE retorna JSON válido.

DIETA DO USUÁRIO:
${text}

TAREFA: Extrair TODOS os alimentos mencionados e seus macros APROXIMADOS.

ACEITA QUALQUER FORMATO:
- "Café: 2 ovos, 1 pão"
- "Almoço: 150g frango, arroz, feijão"
- "Lanche: 1 banana, 2 colheres amendoim"
- Até mesmo listas sem estrutura clara

RETORNE SEMPRE este JSON (mesmo com estimativas):
{
  "meals": {
    "Café da Manhã": [
      { "food": "ovo", "quantity": "2 unidades", "kcal": 155, "protein": 12, "carbs": 1, "fat": 11 }
    ],
    "Almoço": [
      { "food": "frango", "quantity": "150g", "kcal": 280, "protein": 52, "carbs": 0, "fat": 8 }
    ]
  },
  "totals": {
    "kcal": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  }
}

REGRAS:
1. Se não achar quantidade exata, ESTIME (ex: "1 pão" = 80-150g)
2. Use macros PADRÃO da TACO para cada alimento
3. SEM "confidence" ou avisos - apenas retorne o JSON
4. Se o usuário mencionar "sal", "água", "café puro" SEM quantidade, IGNORE
5. Agrupe por refeição/horário mencionado
6. Sempre retorne válido JSON mesmo com dados incompletos

Retorne APENAS o JSON, sem markdown ou texto extra.`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("[parse-diet] API error:", response.status, response.statusText);
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        debugError: `api_error_${response.status}`
      }, { status: 200 });
    }

    const data = await response.json();
    console.log("[parse-diet] response:", data);

    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      console.error("[parse-diet] no content in response");
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        debugError: "no_content"
      }, { status: 200 });
    }

    const textContent = data.content.find((block: any) => block.type === "text");
    if (!textContent) {
      console.error("[parse-diet] no text content found");
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        debugError: "no_text_content"
      }, { status: 200 });
    }

    let jsonText = textContent.text.trim();
    
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    console.log("[parse-diet] cleaned text:", jsonText.substring(0, 200));

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("[parse-diet] JSON parse error:", e);
      return NextResponse.json({
        meals: {},
        totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        debugError: "json_parse_error"
      }, { status: 200 });
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    if (parsedData.meals && typeof parsedData.meals === "object") {
      for (const mealName in parsedData.meals) {
        const items = parsedData.meals[mealName];
        if (Array.isArray(items)) {
          for (const item of items) {
            totalKcal += (item.kcal || 0);
            totalProtein += (item.protein || 0);
            totalCarbs += (item.carbs || 0);
            totalFat += (item.fat || 0);
          }
        }
      }
    }

    return NextResponse.json({
      meals: parsedData.meals || {},
      totals: {
        kcal: Math.round(totalKcal),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat)
      }
    }, { status: 200 });

  } catch (error) {
    console.error("[parse-diet] catch error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      meals: {},
      totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      debugError: error instanceof Error ? error.message : "unknown_error"
    }, { status: 200 });
  }
}
