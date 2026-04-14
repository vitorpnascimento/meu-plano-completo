// Banco de dados TACO (Tabela Brasileira de Composição de Alimentos, UNICAMP)
// Valores por 100g do alimento preparado/cru conforme indicado.

export interface TacoFood {
  id:   number
  nome: string
  cat:  string
  kcal: number
  p:    number   // proteína
  c:    number   // carboidrato
  f:    number   // gordura (lipídeos)
}

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
