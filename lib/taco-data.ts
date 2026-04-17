// Banco de dados TACO (Tabela Brasileira de Composição de Alimentos, UNICAMP)
// + alimentos complementares estimados com base em USDA/literatura.
// Valores por 100g.

export interface TacoFood {
  id:   number
  nome: string
  cat:  string
  kcal: number
  p:    number   // proteína (g)
  c:    number   // carboidrato (g)
  f:    number   // gordura (g)
}

/** IDs de alimentos acessíveis / baratos para dietas econômicas */
export const BUDGET_IDS = new Set<number>([
  2, 4, 11, 13,                       // frango cozido, coxa, carne moída, atum
  19, 20,                              // ovos
  23, 24, 25, 27, 34,                  // arroz, aveia, pão francês, cuscuz
  36, 37, 38,                          // batata, batata doce, mandioca
  40, 41, 43, 45,                      // feijão carioca, preto, lentilha, ervilha
  46, 47, 48,                          // leite, iogurte natural
  58, 59, 60, 61, 62,                  // banana, maçã, laranja, mamão
  72, 73, 74, 75, 77, 78, 80, 82, 83, 85, 86, 87, 88, // hortaliças
  90, 92, 93,                          // óleo soja, amendoim, pasta amendoim
  99, 101, 104, 106, 107, 108, 110, 111, 112, 113, 114, 115, // new budget foods
])

// ─── Tipos para geração de dieta ──────────────────────────────────────────────

export interface GeneratedItem {
  food:  TacoFood
  grams: number
  kcal:  number
  p:     number
  c:     number
  f:     number
}

export interface GeneratedMeal {
  mealId:     string
  title:      string
  targetKcal: number
  actualKcal: number
  items:      GeneratedItem[]
}

export type GeneratedDiet = GeneratedMeal[]

export const TACO: TacoFood[] = [
  // ── Carnes e Aves ──────────────────────────────────────────────────────────
  { id:  1, nome:'Frango, filé, grelhado',            cat:'Carnes', kcal:163, p:31.5, c:0.0,  f:3.1  },
  { id:  2, nome:'Frango, filé, cozido',              cat:'Carnes', kcal:176, p:32.7, c:0.0,  f:4.3  },
  { id:  3, nome:'Frango, peito, assado',             cat:'Carnes', kcal:196, p:37.8, c:0.0,  f:4.0  },
  { id:  4, nome:'Frango, coxa sem pele, cozida',     cat:'Carnes', kcal:229, p:27.3, c:0.0,  f:12.7 },
  { id:  5, nome:'Carne bovina, patinho, grelhado',   cat:'Carnes', kcal:187, p:32.1, c:0.0,  f:5.9  },
  { id:  6, nome:'Carne bovina, acém, cozido',        cat:'Carnes', kcal:186, p:29.2, c:0.0,  f:7.0  },
  { id:  7, nome:'Carne bovina, alcatra, grelhada',   cat:'Carnes', kcal:195, p:32.0, c:0.0,  f:6.7  },
  { id:  8, nome:'Carne bovina, filé mignon',         cat:'Carnes', kcal:171, p:32.3, c:0.0,  f:4.1  },
  { id:  9, nome:'Carne bovina, coxão mole, cozido',  cat:'Carnes', kcal:213, p:27.6, c:0.0,  f:11.5 },
  { id: 10, nome:'Carne bovina, contrafilé, grelhado',cat:'Carnes', kcal:226, p:29.9, c:0.0,  f:11.5 },
  { id: 11, nome:'Carne bovina moída, refogada',      cat:'Carnes', kcal:285, p:26.0, c:0.0,  f:19.5 },
  { id: 12, nome:'Peru, filé, assado',                cat:'Carnes', kcal:177, p:33.0, c:0.0,  f:4.0  },
  // ── Peixes e Frutos do Mar ─────────────────────────────────────────────────
  { id: 13, nome:'Atum, em água, enlatado',           cat:'Peixes', kcal:105, p:24.0, c:0.0,  f:0.9  },
  { id: 14, nome:'Salmão, grelhado',                  cat:'Peixes', kcal:182, p:25.0, c:0.0,  f:8.6  },
  { id: 15, nome:'Tilápia, filé, grelhado',           cat:'Peixes', kcal:135, p:28.2, c:0.0,  f:2.1  },
  { id: 16, nome:'Sardinha, em óleo, enlatada',       cat:'Peixes', kcal:220, p:23.7, c:0.0,  f:13.9 },
  { id: 17, nome:'Camarão, cozido',                   cat:'Peixes', kcal:99,  p:20.3, c:0.9,  f:1.4  },
  { id: 18, nome:'Bacalhau, seco, dessalgado',        cat:'Peixes', kcal:132, p:29.2, c:0.0,  f:0.9  },
  // ── Ovos ───────────────────────────────────────────────────────────────────
  { id: 19, nome:'Ovo de galinha, cozido',            cat:'Ovos',   kcal:146, p:13.3, c:0.6,  f:9.5  },
  { id: 20, nome:'Ovo de galinha, mexido',            cat:'Ovos',   kcal:173, p:11.4, c:1.4,  f:13.3 },
  { id: 21, nome:'Ovo de galinha, frito',             cat:'Ovos',   kcal:194, p:13.3, c:0.4,  f:15.3 },
  { id: 22, nome:'Clara de ovo, crua',                cat:'Ovos',   kcal:50,  p:10.9, c:0.7,  f:0.2  },
  // ── Cereais e Derivados ────────────────────────────────────────────────────
  { id: 23, nome:'Arroz branco, cozido',              cat:'Cereais', kcal:128, p:2.5,  c:28.1, f:0.1  },
  { id: 24, nome:'Arroz integral, cozido',            cat:'Cereais', kcal:124, p:2.6,  c:25.8, f:1.0  },
  { id: 25, nome:'Pão francês',                       cat:'Cereais', kcal:300, p:9.4,  c:58.6, f:3.1  },
  { id: 26, nome:'Pão integral',                      cat:'Cereais', kcal:253, p:8.8,  c:47.2, f:3.0  },
  { id: 27, nome:'Aveia, flocos',                     cat:'Cereais', kcal:394, p:13.9, c:66.6, f:8.5  },
  { id: 28, nome:'Macarrão de sêmola, cozido',        cat:'Cereais', kcal:141, p:5.0,  c:29.0, f:0.7  },
  { id: 29, nome:'Tapioca, goma',                     cat:'Cereais', kcal:340, p:0.7,  c:83.7, f:0.1  },
  { id: 30, nome:'Granola tradicional',               cat:'Cereais', kcal:440, p:9.0,  c:65.0, f:17.0 },
  { id: 31, nome:'Biscoito cream cracker',            cat:'Cereais', kcal:444, p:9.5,  c:66.3, f:15.1 },
  { id: 32, nome:'Quinoa, cozida',                    cat:'Cereais', kcal:120, p:4.4,  c:21.3, f:1.9  },
  { id: 33, nome:'Pão de queijo',                     cat:'Cereais', kcal:279, p:5.3,  c:44.0, f:9.3  },
  { id: 34, nome:'Cuscuz, milho, cozido',             cat:'Cereais', kcal:110, p:2.3,  c:24.0, f:0.4  },
  { id: 35, nome:'Fubá, amarelo, cru',                cat:'Cereais', kcal:349, p:7.2,  c:74.2, f:1.7  },
  // ── Tubérculos e Raízes ────────────────────────────────────────────────────
  { id: 36, nome:'Batata inglesa, cozida',            cat:'Tubérculos', kcal:52, p:1.6, c:11.7, f:0.1 },
  { id: 37, nome:'Batata doce, cozida',               cat:'Tubérculos', kcal:77, p:1.4, c:18.4, f:0.1 },
  { id: 38, nome:'Mandioca, cozida',                  cat:'Tubérculos', kcal:125, p:0.6, c:30.1, f:0.3},
  { id: 39, nome:'Inhame, cozido',                    cat:'Tubérculos', kcal:97, p:1.5, c:23.1, f:0.2 },
  // ── Leguminosas ────────────────────────────────────────────────────────────
  { id: 40, nome:'Feijão carioca, cozido',            cat:'Leguminosas', kcal:76,  p:4.5, c:13.6, f:0.5},
  { id: 41, nome:'Feijão preto, cozido',              cat:'Leguminosas', kcal:77,  p:4.5, c:14.0, f:0.5},
  { id: 42, nome:'Feijão branco, cozido',             cat:'Leguminosas', kcal:111, p:8.3, c:19.1, f:0.5},
  { id: 43, nome:'Lentilha, cozida',                  cat:'Leguminosas', kcal:93,  p:7.6, c:16.3, f:0.6},
  { id: 44, nome:'Grão de bico, cozido',              cat:'Leguminosas', kcal:164, p:8.9, c:27.4, f:2.6},
  { id: 45, nome:'Ervilha, cozida',                   cat:'Leguminosas', kcal:92,  p:6.1, c:15.9, f:0.5},
  // ── Laticínios ─────────────────────────────────────────────────────────────
  { id: 46, nome:'Leite de vaca, integral',           cat:'Laticínios', kcal:61,  p:3.2,  c:4.7, f:3.2 },
  { id: 47, nome:'Leite de vaca, desnatado',          cat:'Laticínios', kcal:34,  p:3.4,  c:5.0, f:0.1 },
  { id: 48, nome:'Iogurte natural, integral',         cat:'Laticínios', kcal:66,  p:3.5,  c:4.0, f:4.2 },
  { id: 49, nome:'Iogurte grego',                     cat:'Laticínios', kcal:97,  p:9.0,  c:4.0, f:5.0 },
  { id: 50, nome:'Queijo mussarela',                  cat:'Laticínios', kcal:289, p:22.2, c:3.1, f:21.5},
  { id: 51, nome:'Queijo cottage',                    cat:'Laticínios', kcal:98,  p:11.1, c:3.3, f:4.3 },
  { id: 52, nome:'Queijo ricota',                     cat:'Laticínios', kcal:155, p:10.4, c:3.8, f:11.0},
  { id: 53, nome:'Queijo meia-cura',                  cat:'Laticínios', kcal:329, p:22.5, c:1.6, f:26.0},
  { id: 54, nome:'Requeijão cremoso',                 cat:'Laticínios', kcal:215, p:8.5,  c:4.0, f:18.8},
  // ── Suplementos ────────────────────────────────────────────────────────────
  { id: 55, nome:'Whey protein concentrate',          cat:'Suplementos', kcal:370, p:73.0, c:9.0, f:4.0},
  { id: 56, nome:'Whey protein isolado',              cat:'Suplementos', kcal:360, p:80.0, c:4.0, f:1.0},
  { id: 57, nome:'Caseína',                           cat:'Suplementos', kcal:374, p:80.0, c:4.0, f:2.5},
  // ── Frutas ─────────────────────────────────────────────────────────────────
  { id: 58, nome:'Banana prata',                      cat:'Frutas', kcal:98, p:1.3,  c:26.0, f:0.1 },
  { id: 59, nome:'Banana nanica',                     cat:'Frutas', kcal:92, p:1.3,  c:23.8, f:0.1 },
  { id: 60, nome:'Maçã fuji',                         cat:'Frutas', kcal:68, p:0.3,  c:18.3, f:0.4 },
  { id: 61, nome:'Laranja pêra',                      cat:'Frutas', kcal:37, p:1.0,  c:8.9,  f:0.1 },
  { id: 62, nome:'Mamão papaia',                      cat:'Frutas', kcal:40, p:0.5,  c:10.4, f:0.1 },
  { id: 63, nome:'Morango',                           cat:'Frutas', kcal:30, p:0.8,  c:6.8,  f:0.3 },
  { id: 64, nome:'Abacaxi',                           cat:'Frutas', kcal:48, p:0.9,  c:12.3, f:0.1 },
  { id: 65, nome:'Melão',                             cat:'Frutas', kcal:29, p:0.9,  c:6.7,  f:0.2 },
  { id: 66, nome:'Melancia',                          cat:'Frutas', kcal:33, p:0.9,  c:8.1,  f:0.2 },
  { id: 67, nome:'Manga',                             cat:'Frutas', kcal:64, p:0.9,  c:17.0, f:0.2 },
  { id: 68, nome:'Uva niágara',                       cat:'Frutas', kcal:70, p:0.7,  c:17.5, f:0.4 },
  { id: 69, nome:'Kiwi',                              cat:'Frutas', kcal:61, p:1.1,  c:14.7, f:0.6 },
  { id: 70, nome:'Pera',                              cat:'Frutas', kcal:55, p:0.5,  c:14.8, f:0.1 },
  { id: 71, nome:'Abacate',                           cat:'Frutas', kcal:160, p:2.2, c:6.0,  f:14.9},
  // ── Hortaliças ─────────────────────────────────────────────────────────────
  { id: 72, nome:'Brócolis, cozido',                  cat:'Hortaliças', kcal:29, p:3.2, c:3.9, f:0.5  },
  { id: 73, nome:'Cenoura, cozida',                   cat:'Hortaliças', kcal:29, p:0.9, c:5.2, f:0.2  },
  { id: 74, nome:'Tomate cru',                        cat:'Hortaliças', kcal:15, p:1.1, c:3.1, f:0.2  },
  { id: 75, nome:'Alface',                            cat:'Hortaliças', kcal:11, p:1.3, c:1.7, f:0.2  },
  { id: 76, nome:'Espinafre, cru',                    cat:'Hortaliças', kcal:24, p:2.9, c:2.9, f:0.4  },
  { id: 77, nome:'Abobrinha, cozida',                 cat:'Hortaliças', kcal:17, p:1.0, c:3.3, f:0.1  },
  { id: 78, nome:'Chuchu, cozido',                    cat:'Hortaliças', kcal:17, p:0.7, c:3.6, f:0.1  },
  { id: 79, nome:'Couve, refogada',                   cat:'Hortaliças', kcal:35, p:2.5, c:3.0, f:1.5  },
  { id: 80, nome:'Beterraba, cozida',                 cat:'Hortaliças', kcal:39, p:1.7, c:8.5, f:0.2  },
  { id: 81, nome:'Couve-flor, cozida',                cat:'Hortaliças', kcal:21, p:2.2, c:3.4, f:0.2  },
  { id: 82, nome:'Pepino',                            cat:'Hortaliças', kcal:10, p:0.7, c:2.2, f:0.1  },
  { id: 83, nome:'Cebola crua',                       cat:'Hortaliças', kcal:34, p:1.2, c:7.9, f:0.1  },
  { id: 84, nome:'Alho cru',                          cat:'Hortaliças', kcal:132, p:5.8, c:27.5, f:0.3 },
  { id: 85, nome:'Quiabo, cozido',                    cat:'Hortaliças', kcal:30, p:2.1, c:5.7, f:0.2  },
  { id: 86, nome:'Vagem, cozida',                     cat:'Hortaliças', kcal:28, p:2.0, c:5.4, f:0.2  },
  { id: 87, nome:'Pimentão verde',                    cat:'Hortaliças', kcal:20, p:0.9, c:4.4, f:0.2  },
  { id: 88, nome:'Berinjela, cozida',                 cat:'Hortaliças', kcal:24, p:0.9, c:5.5, f:0.2  },
  // ── Óleos, Gorduras e Oleaginosas ──────────────────────────────────────────
  { id: 89, nome:'Azeite de oliva',                   cat:'Gorduras', kcal:884, p:0.0, c:0.0, f:100.0},
  { id: 90, nome:'Óleo de soja',                      cat:'Gorduras', kcal:884, p:0.0, c:0.0, f:100.0},
  { id: 91, nome:'Manteiga',                          cat:'Gorduras', kcal:726, p:0.4, c:0.0, f:83.2 },
  { id: 92, nome:'Amendoim torrado',                  cat:'Oleaginosas', kcal:581, p:26.2, c:19.7, f:47.5},
  { id: 93, nome:'Pasta de amendoim',                 cat:'Oleaginosas', kcal:595, p:24.0, c:20.0, f:49.0},
  { id: 94, nome:'Castanha do Pará',                  cat:'Oleaginosas', kcal:656, p:14.3, c:15.1, f:63.5},
  { id: 95, nome:'Castanha de caju, torrada',         cat:'Oleaginosas', kcal:570, p:18.5, c:29.1, f:43.9},
  { id: 96, nome:'Nozes',                             cat:'Oleaginosas', kcal:620, p:14.3, c:14.1, f:59.4},
  { id: 97, nome:'Amêndoas cruas',                    cat:'Oleaginosas', kcal:581, p:21.2, c:21.7, f:49.9},
  // ── Laticínios e Derivados (complemento) ──────────────────────────────────
  { id: 98, nome:'Requeijão Light',                   cat:'Laticínios', kcal:138, p:9.5,  c:4.0,  f:9.0  },
  { id: 99, nome:'Iogurte desnatado',                 cat:'Laticínios', kcal:43,  p:4.3,  c:5.8,  f:0.1  },
  { id:100, nome:'Queijo Minas Frescal',              cat:'Laticínios', kcal:264, p:17.4, c:3.2,  f:20.2 },
  { id:101, nome:'Queijo Branco (Padrão)',            cat:'Laticínios', kcal:289, p:19.6, c:2.0,  f:23.0 },
  // ── Condimentos e Temperos ─────────────────────────────────────────────────
  { id:102, nome:'Maionese Light',                    cat:'Condimentos', kcal:241, p:1.0, c:8.0,  f:22.0 },
  { id:103, nome:'Mostarda',                          cat:'Condimentos', kcal:67,  p:4.0, c:7.5,  f:2.5  },
  { id:104, nome:'Mel',                               cat:'Outros',      kcal:304, p:0.3, c:82.4, f:0.0  },
  { id:105, nome:'Ketchup',                           cat:'Condimentos', kcal:112, p:1.7, c:27.0, f:0.1  },
  // ── Bebidas ───────────────────────────────────────────────────────────────
  { id:106, nome:'Café preto s/ açúcar',              cat:'Bebidas', kcal:2,   p:0.1, c:0.0,  f:0.0  },
  { id:107, nome:'Chá s/ açúcar',                    cat:'Bebidas', kcal:1,   p:0.0, c:0.2,  f:0.0  },
  { id:108, nome:'Suco de laranja natural',           cat:'Bebidas', kcal:45,  p:0.7, c:10.4, f:0.2  },
  { id:109, nome:'Água de coco',                      cat:'Bebidas', kcal:19,  p:0.7, c:3.7,  f:0.2  },
  // ── Carnes e Processados (complemento) ────────────────────────────────────
  { id:110, nome:'Carne moída (patinho), crua',       cat:'Carnes', kcal:197, p:19.8, c:0.0, f:12.8 },
  { id:111, nome:'Linguiça calabresa, grelhada',      cat:'Carnes', kcal:335, p:14.6, c:3.0, f:29.9 },
  { id:112, nome:'Peito de peru defumado',            cat:'Carnes', kcal:103, p:18.0, c:1.8, f:2.4  },
  // ── Cereais e Derivados (complemento) ─────────────────────────────────────
  { id:113, nome:'Pão de forma integral',             cat:'Cereais', kcal:247, p:8.1, c:42.5, f:4.7 },
  { id:114, nome:'Cereal integral (flocos)',          cat:'Cereais', kcal:361, p:7.8, c:78.5, f:1.7 },
  { id:115, nome:'Tapioca (beiju, pronto)',           cat:'Cereais', kcal:152, p:0.3, c:37.5, f:0.3 },
  // ── Hortaliças (complemento) ───────────────────────────────────────────────
  { id:116, nome:'Abóbora, cozida',                   cat:'Hortaliças', kcal:17, p:0.5, c:3.6, f:0.2 },
  { id:117, nome:'Espinafre, cozido',                 cat:'Hortaliças', kcal:22, p:2.2, c:2.8, f:0.5 },
  { id:118, nome:'Milho verde, cozido',               cat:'Hortaliças', kcal:74, p:2.5, c:15.5, f:0.8},
  // ── Proteína Vegetal ───────────────────────────────────────────────────────
  { id:119, nome:'Proteína de soja texturizada, hid.',cat:'Leguminosas', kcal:98, p:13.8, c:7.2, f:1.4},
  { id:120, nome:'Tofu',                              cat:'Leguminosas', kcal:76, p:8.1, c:1.9, f:4.2 },
  // ── Sementes ──────────────────────────────────────────────────────────────
  { id:121, nome:'Chia',                              cat:'Oleaginosas', kcal:490, p:16.5, c:42.1, f:30.7},
  { id:122, nome:'Linhaça dourada',                   cat:'Oleaginosas', kcal:534, p:18.1, c:28.9, f:42.2},
]

// ─── Funções de busca ────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/** Busca por nome parcial — retorna até 15 resultados ordenados por relevância */
export function searchTACO(query: string): TacoFood[] {
  if (!query || query.trim().length < 2) return []
  const q     = norm(query)
  const words = q.split(/\s+/).filter(w => w.length >= 3)

  return TACO
    .map(food => {
      const n = norm(food.nome)
      if (n.includes(q))                                    return { food, score: 10 }
      const ws = words.reduce((s, w) => s + (n.includes(w) ? 2 : 0), 0)
      // bonus: match first word of query at start of food name
      const bonus = n.startsWith(norm(q.split(' ')[0])) ? 3 : 0
      return { food, score: ws + bonus }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(x => x.food)
}

/** Tenta encontrar o melhor match para um nome de alimento livre (para o parser de PDF) */
export function fuzzyMatchTACO(name: string): TacoFood | null {
  const n     = norm(name)
  const words = n.split(/\s+/).filter(w => w.length >= 3)
  if (words.length === 0 && n.length < 3) return null

  let best: TacoFood | null = null
  let bestScore = 0

  for (const food of TACO) {
    const fn = norm(food.nome)
    let score = 0
    if (fn.includes(n) || n.includes(fn.split(',')[0].split(' ')[0])) score += 5
    score += words.filter(w => fn.includes(w)).length * 2
    if (score > bestScore) { bestScore = score; best = food }
  }

  return bestScore >= 2 ? best : null
}

// ─── IA Fallback ──────────────────────────────────────────────────────────────

/** Consulta API route /api/nutrition para estimar macros via IA quando o TACO não encontra */
export async function searchWithAI(foodName: string): Promise<TacoFood | null> {
  try {
    const res = await fetch('/api/nutrition', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ food: foodName }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.kcal !== 'number') return null
    return {
      id:   -1,
      nome: `${foodName} [IA]`,
      cat:  'IA Estimado',
      kcal: Math.round(data.kcal),
      p:    +(data.p  || 0).toFixed(1),
      c:    +(data.c  || 0).toFixed(1),
      f:    +(data.f  || 0).toFixed(1),
    }
  } catch {
    return null
  }
}

/** Busca no TACO; se não encontrar, tenta via IA. Retorna null se ambos falham. */
export async function searchFoodWithFallback(query: string): Promise<TacoFood | null> {
  const tacoResult = fuzzyMatchTACO(query)
  if (tacoResult) return tacoResult
  return searchWithAI(query)
}

// ─── Geração de Dieta ─────────────────────────────────────────────────────────

/** Template de refeição: lista de {id do alimento TACO, share% das kcal da refeição} */
type SlotDef = { id: number; share: number }

const STD_TEMPLATES: { mealId: string; title: string; calShare: number; slots: SlotDef[] }[] = [
  { mealId:'cafe',         title:'Café da Manhã',    calShare:0.20, slots:[
    { id:49, share:0.40 }, // Iogurte grego
    { id:27, share:0.35 }, // Aveia
    { id:63, share:0.25 }, // Morango
  ]},
  { mealId:'lanche_manha', title:'Lanche da Manhã',  calShare:0.10, slots:[
    { id:58, share:0.50 }, // Banana
    { id:93, share:0.30 }, // Pasta amendoim
    { id:63, share:0.20 }, // Morango
  ]},
  { mealId:'almoco',       title:'Almoço',            calShare:0.35, slots:[
    { id:1,  share:0.40 }, // Frango grelhado
    { id:24, share:0.28 }, // Arroz integral
    { id:37, share:0.18 }, // Batata doce
    { id:72, share:0.10 }, // Brócolis
    { id:89, share:0.04 }, // Azeite
  ]},
  { mealId:'lanche',       title:'Lanche',            calShare:0.15, slots:[
    { id:55, share:0.50 }, // Whey
    { id:58, share:0.30 }, // Banana
    { id:93, share:0.20 }, // Pasta amendoim
  ]},
  { mealId:'jantar',       title:'Jantar',            calShare:0.25, slots:[
    { id:15, share:0.40 }, // Tilápia
    { id:37, share:0.35 }, // Batata doce
    { id:76, share:0.15 }, // Espinafre
    { id:89, share:0.10 }, // Azeite
  ]},
  { mealId:'ceia',         title:'Ceia',              calShare:0.05, slots:[
    { id:57, share:0.60 }, // Caseína
    { id:27, share:0.40 }, // Aveia
  ]},
]

const BUDGET_TEMPLATES: typeof STD_TEMPLATES = [
  { mealId:'cafe',         title:'Café da Manhã',    calShare:0.20, slots:[
    { id:19, share:0.40 }, // Ovo cozido
    { id:25, share:0.40 }, // Pão francês
    { id:58, share:0.20 }, // Banana
  ]},
  { mealId:'lanche_manha', title:'Lanche da Manhã',  calShare:0.10, slots:[
    { id:58, share:0.50 }, // Banana
    { id:92, share:0.30 }, // Amendoim
    { id:60, share:0.20 }, // Maçã
  ]},
  { mealId:'almoco',       title:'Almoço',            calShare:0.35, slots:[
    { id:2,  share:0.38 }, // Frango cozido
    { id:23, share:0.30 }, // Arroz branco
    { id:40, share:0.22 }, // Feijão carioca
    { id:73, share:0.10 }, // Cenoura
  ]},
  { mealId:'lanche',       title:'Lanche',            calShare:0.15, slots:[
    { id:48, share:0.50 }, // Iogurte natural
    { id:60, share:0.30 }, // Maçã
    { id:92, share:0.20 }, // Amendoim
  ]},
  { mealId:'jantar',       title:'Jantar',            calShare:0.25, slots:[
    { id:2,  share:0.40 }, // Frango cozido
    { id:23, share:0.30 }, // Arroz branco
    { id:41, share:0.20 }, // Feijão preto
    { id:77, share:0.10 }, // Abobrinha
  ]},
  { mealId:'ceia',         title:'Ceia',              calShare:0.05, slots:[
    { id:47, share:0.65 }, // Leite desnatado
    { id:27, share:0.35 }, // Aveia
  ]},
]

/** Limite máximo de unidades por refeição para alimentos com porção natural.
 *  Evita resultados absurdos como "32 morangos" na geração automática de dieta. */
const FOOD_MAX_UNITS: Partial<Record<number, number>> = {
  63: 5,   // Morango      (~12g/un)
  64: 3,   // Abacaxi fatia (~80g)
  68: 2,   // Uva cacho    (~60g)
  58: 3,   // Banana prata (~100g)
  59: 3,   // Banana nanica(~100g)
  60: 2,   // Maçã         (~130g)
  61: 2,   // Laranja      (~150g)
  62: 1,   // Mamão        (~300g)
  67: 1,   // Manga        (~250g)
  70: 2,   // Pera         (~150g)
  25: 4,   // Pão francês  (~50g)
  26: 6,   // Pão integral  (~25g/fatia)
  113:6,   // Pão de forma  (~25g/fatia)
}

function buildItem(food: TacoFood, targetKcal: number, share: number): GeneratedItem {
  const slotKcal = targetKcal * share
  const rawGrams = food.kcal > 0 ? (slotKcal / food.kcal) * 100 : 50
  let   grams    = Math.max(10, Math.min(600, Math.round(rawGrams / 5) * 5))

  // Cap grams so the resulting unit count stays within FOOD_MAX_UNITS
  const unitInfo = FOOD_UNITS[food.id]
  const maxUnits = FOOD_MAX_UNITS[food.id]
  if (unitInfo && maxUnits !== undefined) {
    const maxGrams = maxUnits * unitInfo.unitWeight
    if (grams > maxGrams) grams = Math.max(10, maxGrams)
  }

  const mult = grams / 100
  return {
    food,
    grams,
    kcal: Math.round(food.kcal * mult),
    p:    +(food.p * mult).toFixed(1),
    c:    +(food.c * mult).toFixed(1),
    f:    +(food.f * mult).toFixed(1),
  }
}

// ─── Ajuste de macros ─────────────────────────────────────────────────────────

/** Classifica um alimento pelo seu macro dominante em calorias. */
function dominantMacro(food: TacoFood): 'protein' | 'carb' | 'fat' | 'mixed' {
  if (food.kcal <= 0) return 'mixed'
  const pPct = (food.p * 4) / food.kcal
  const cPct = (food.c * 4) / food.kcal
  const fPct = (food.f * 9) / food.kcal
  if (pPct >= 0.35) return 'protein'
  if (cPct >= 0.50) return 'carb'
  if (fPct >= 0.35) return 'fat'
  return 'mixed'
}

/** Reescala as porções da dieta para bater com as metas de macros.
 *  - Alimentos proteicos são escalados para atingir a meta de proteína
 *  - Alimentos de carboidrato para a meta de carbo
 *  - Alimentos gordurosos para a meta de gordura
 *  Tolerância esperada: ±5g por macro (erro de arredondamento e cross-contamination). */
function scaleDietToMacros(
  draft:   GeneratedDiet,
  targets: { p: number; c: number; f: number },
): GeneratedDiet {
  type Role = 'protein' | 'carb' | 'fat' | 'mixed'
  type Ref  = { mi: number; ii: number; item: GeneratedItem; role: Role }

  const refs: Ref[] = draft.flatMap((meal, mi) =>
    meal.items.map((item, ii) => ({ mi, ii, item, role: dominantMacro(item.food) }))
  )

  const sumByRole = (role: Role, macro: 'p' | 'c' | 'f') =>
    refs.filter(r => r.role === role).reduce((s, r) => s + r.item[macro], 0)

  // Contribuição "fixa" (dos alimentos que NÃO serão escalados para esse macro)
  const fixedP = refs.filter(r => r.role !== 'protein').reduce((s, r) => s + r.item.p, 0)
  const fixedC = refs.filter(r => r.role !== 'carb'   ).reduce((s, r) => s + r.item.c, 0)
  const fixedF = refs.filter(r => r.role !== 'fat'    ).reduce((s, r) => s + r.item.f, 0)

  const varP = sumByRole('protein', 'p')
  const varC = sumByRole('carb',    'c')
  const varF = sumByRole('fat',     'f')

  const clampScale = (v: number) => Math.max(0.3, Math.min(4.0, v))
  const pScale = varP > 0 ? clampScale((targets.p - fixedP) / varP) : 1
  const cScale = varC > 0 ? clampScale((targets.c - fixedC) / varC) : 1
  const fScale = varF > 0 ? clampScale((targets.f - fixedF) / varF) : 1

  return draft.map((meal, mi) => {
    const items = meal.items.map((item, ii) => {
      const role  = refs.find(r => r.mi === mi && r.ii === ii)!.role
      const scale = role === 'protein' ? pScale
                  : role === 'carb'    ? cScale
                  : role === 'fat'     ? fScale
                  : 1

      let grams = Math.max(10, Math.min(600, Math.round(item.grams * scale / 5) * 5))
      // Respeitar limite de unidades naturais (ex: máximo 3 bananas)
      const maxUnits = FOOD_MAX_UNITS[item.food.id]
      if (maxUnits !== undefined && FOOD_UNITS[item.food.id]) {
        const maxG = maxUnits * FOOD_UNITS[item.food.id].unitWeight
        if (grams > maxG) grams = Math.max(10, maxG)
      }
      const mult = grams / 100
      return {
        food: item.food, grams,
        kcal: Math.round(item.food.kcal * mult),
        p:    +(item.food.p * mult).toFixed(1),
        c:    +(item.food.c * mult).toFixed(1),
        f:    +(item.food.f * mult).toFixed(1),
      }
    })
    return { ...meal, items, actualKcal: items.reduce((s, it) => s + it.kcal, 0) }
  })
}

// ─── Geração de dieta ─────────────────────────────────────────────────────────

/** Gera uma dieta para a meta calórica informada.
 *  - `mealIds`: filtra e redistribui proporcionalmente as kcal
 *  - `macroTargets`: reescala porções para respeitar metas de P/C/G */
export function generateDiet(
  targetCals:   number,
  preferBudget: boolean,
  mealIds?:     string[],
  macroTargets?: { p: number; c: number; f: number },
): GeneratedDiet {
  const allTemplates = preferBudget ? BUDGET_TEMPLATES : STD_TEMPLATES
  const templates = mealIds
    ? allTemplates.filter(t => mealIds.includes(t.mealId))
    : allTemplates
  // Normalize calShares so they sum to 1.0
  const totalShare = templates.reduce((s, t) => s + t.calShare, 0)
  const draft: GeneratedDiet = templates.map(tpl => {
    const normalizedShare = tpl.calShare / totalShare
    const mealTarget = Math.round(targetCals * normalizedShare)
    const items: GeneratedItem[] = tpl.slots.map(slot => {
      const food = TACO.find(f => f.id === slot.id)
      if (!food) return null
      return buildItem(food, mealTarget, slot.share)
    }).filter(Boolean) as GeneratedItem[]
    return {
      mealId:     tpl.mealId,
      title:      tpl.title,
      targetKcal: mealTarget,
      actualKcal: items.reduce((s, it) => s + it.kcal, 0),
      items,
    }
  })
  // Se macroTargets fornecido, reescala porções para respeitar P/C/G
  return macroTargets ? scaleDietToMacros(draft, macroTargets) : draft
}

// ─── Unidades de Medida ────────────────────────────────────────────────────────

/** Mapa de unidades para alimentos que têm medida natural (unidades, fatias, etc.) */
export const FOOD_UNITS: Record<number, { unit: string; unitWeight: number }> = {
  // Ovos
  19: { unit: 'un',    unitWeight: 50  },
  20: { unit: 'un',    unitWeight: 50  },
  21: { unit: 'un',    unitWeight: 50  },
  22: { unit: 'un',    unitWeight: 30  },  // clara
  // Pães
  25: { unit: 'un',    unitWeight: 50  },  // Pão francês
  26: { unit: 'fatia', unitWeight: 25  },  // Pão integral
  113:{ unit: 'fatia', unitWeight: 25  },  // Pão de forma integral
  33: { unit: 'un',    unitWeight: 30  },  // Pão de queijo
  // Frutas
  58: { unit: 'un',    unitWeight: 100 },  // Banana prata
  59: { unit: 'un',    unitWeight: 80  },  // Banana nanica
  60: { unit: 'un',    unitWeight: 130 },  // Maçã fuji
  61: { unit: 'un',    unitWeight: 150 },  // Laranja
  62: { unit: 'un',    unitWeight: 300 },  // Mamão (meia unidade grande)
  63: { unit: 'un',    unitWeight: 12  },  // Morango
  64: { unit: 'fatia', unitWeight: 80  },  // Abacaxi
  67: { unit: 'un',    unitWeight: 250 },  // Manga
  68: { unit: 'un',    unitWeight: 60  },  // Uva (cacho pequeno)
  69: { unit: 'un',    unitWeight: 80  },  // Kiwi
  70: { unit: 'un',    unitWeight: 150 },  // Pera
  71: { unit: 'un',    unitWeight: 200 },  // Abacate (metade)
}

/** Formata o nome de um alimento TACO com sua unidade de medida natural,
 *  ou em gramas quando não há unidade específica. */
/** Formata o nome de um alimento com unidade natural + grama.
 *  Ex: "Ovo de galinha, cozido (2 un) 100g"  /  "Frango, filé, grelhado 180g" */
export function formatTacoItemName(food: TacoFood, grams: number): string {
  const unitInfo = FOOD_UNITS[food.id]
  if (unitInfo && unitInfo.unitWeight > 0) {
    const qty = Math.max(1, Math.round(grams / unitInfo.unitWeight))
    return `${food.nome} (${qty} ${unitInfo.unit}) ${grams}g`
  }
  return `${food.nome} ${grams}g`
}

/** Retorna a porção "natural" de um alimento TACO em gramas.
 *  Para alimentos com unidade, usa o peso de 1 unidade.
 *  Para demais alimentos, usa 100g. */
export function naturalGrams(food: TacoFood): number {
  const unitInfo = FOOD_UNITS[food.id]
  return unitInfo ? unitInfo.unitWeight : 100
}

/** Encontra alternativas do banco TACO para um item da aba Hoje.
 *  Retorna alimentos com porção ajustada para ~targetKcal. */
export function getTodaySubstitutes(
  targetKcal: number,
  itemName:   string,
): { food: TacoFood; grams: number; kcal: number; p: number; c: number; f: number }[] {
  const matched = fuzzyMatchTACO(itemName)
  const candidates = TACO.filter(f =>
    f.kcal > 0 &&
    f.id !== (matched?.id ?? -999) &&
    (matched ? f.cat === matched.cat : true)
  )
  return candidates
    .map(f => {
      const rawG = (targetKcal / f.kcal) * 100
      const g    = Math.max(10, Math.min(600, Math.round(rawG / 5) * 5))
      const m    = g / 100
      return {
        food: f,
        grams: g,
        kcal:  Math.round(f.kcal * m),
        p:     +(f.p * m).toFixed(1),
        c:     +(f.c * m).toFixed(1),
        f:     +(f.f * m).toFixed(1),
      }
    })
    .sort((a, b) => Math.abs(a.kcal - targetKcal) - Math.abs(b.kcal - targetKcal))
    .slice(0, 8)
}

/** Busca substitutos para um item gerado: mesma categoria, calorias similares. */
export function getSubstitutes(food: TacoFood, grams: number, preferBudget: boolean): TacoFood[] {
  const targetKcal = (food.kcal * grams) / 100
  return TACO
    .filter(f =>
      f.id !== food.id &&
      f.cat === food.cat &&
      f.kcal > 0 &&
      (!preferBudget || BUDGET_IDS.has(f.id))
    )
    .map(f => {
      const altGrams = Math.max(10, Math.min(600, Math.round((targetKcal / f.kcal) * 100 / 5) * 5))
      const altKcal  = Math.round((f.kcal * altGrams) / 100)
      return { food: f, diff: Math.abs(altKcal - targetKcal) }
    })
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 6)
    .map(x => x.food)
}
