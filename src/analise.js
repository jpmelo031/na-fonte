// Regras de análise do app. Tudo aqui é heurística simples e transparente:
// o app NÃO decide o que é verdade. Ele junta fontes, mostra quem mais está
// noticiando o mesmo assunto, aponta checagens relacionadas e sinaliza
// padrões comuns de boato.

const STOPWORDS = new Set(`
a o as os um uma uns umas de da do das dos d em no na nos nas num numa ao aos
e ou mas nem que se para pra pro por pelo pela pelos pelas com sem sob sobre
entre ate apos desde contra como quando onde porque pois ja nao sim tambem so
ser estar foi era sao sera seria esta estao estava ha tem ter tinha vai vao pode podem
deve devem fica ficam faz fazer diz dizem disse afirma segundo
seu sua seus suas meu minha nosso nossa ele ela eles elas isso isto esse essa este
mais menos muito muita muitos muitas pouco todo toda todos todas outro outra outros
qual quais quem cada mesmo mesma ainda apenas bem mal
ano anos dia dias hoje ontem amanha agora semana mes vez vezes
novo nova novos novas primeiro primeira grande maior
veja entenda saiba confira assista leia video videos foto fotos ao vivo
falso falsa verdadeiro verdadeira enganoso enganosa boato boatos fake checagem
mentira verdade post posts publicacao redes sociais viral viraliza circula
usuarios compartilhado compartilhada mostra mostram
urgente atencao alerta bomba chocante absurdo escandalo inacreditavel gravissimo socorro pasmem
compartilhe compartilhem repasse repassem espalhe espalhem divulguem apaguem derrubem
midia imprensa ninguem falando antes olha gente pessoal
`.split(/\s+/).filter(Boolean));

function semAcentos(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizar(texto) {
  return semAcentos(texto.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Radical bem simples: tira plural e terminações verbais comuns e corta em 6 letras,
// para que "aprova", "aprovou" e "aprovada" (ou "voltou" e "voltaram") contem como
// a mesma palavra.
const TERMINACOES = ['aram', 'eram', 'iram', 'avam', 'ando', 'endo', 'indo', 'ado', 'ada', 'ido', 'ida', 'ou', 'eu', 'iu', 'ar', 'er', 'ir', 'am'];

function radical(palavra) {
  if (/^\d/.test(palavra)) return palavra;
  let p = palavra;
  if (p.length > 4) {
    if (p.endsWith('oes') || p.endsWith('aes')) p = p.slice(0, -3) + 'ao';
    else if (p.endsWith('ais')) p = p.slice(0, -3) + 'al';
    else if (p.endsWith('s')) p = p.slice(0, -1);
  }
  const terminacao = TERMINACOES.find((t) => p.endsWith(t) && p.length - t.length >= 4);
  if (terminacao) p = p.slice(0, -terminacao.length);
  if (p.length > 4 && /[aeo]$/.test(p)) p = p.slice(0, -1);
  return p.slice(0, 6);
}

export function palavrasChave(texto) {
  const saida = new Set();
  for (const palavra of normalizar(texto).split(' ')) {
    if (palavra.length < 3 && !/\d/.test(palavra)) continue;
    if (STOPWORDS.has(palavra)) continue;
    saida.add(radical(palavra));
  }
  return saida;
}

// Peso de cada palavra: quanto mais rara entre as notícias, mais ela identifica um assunto.
export function criarIndice(conjuntos) {
  const frequencia = new Map();
  for (const conjunto of conjuntos) {
    for (const palavra of conjunto) frequencia.set(palavra, (frequencia.get(palavra) ?? 0) + 1);
  }
  const total = conjuntos.length;
  return (palavra) => Math.log((total + 1) / ((frequencia.get(palavra) ?? 0) + 0.5));
}

function comparar(a, b, peso) {
  let comum = 0;
  let pesoComum = 0;
  let pesoA = 0;
  let pesoB = 0;
  for (const palavra of a) {
    pesoA += peso(palavra);
    if (b.has(palavra)) {
      comum++;
      pesoComum += peso(palavra);
    }
  }
  for (const palavra of b) pesoB += peso(palavra);
  return { comum, pesoComum, pesoA, pesoB };
}

function maisRecente(a, b) {
  return (b.data ?? '').localeCompare(a.data ?? '');
}

// ---------------------------------------------------------------------------
// Assuntos em vários veículos
// ---------------------------------------------------------------------------

const LIMIAR_ASSUNTO = 0.4;

// Junta manchetes de fontes diferentes que falam do mesmo assunto.
// Um assunto noticiado por várias redações independentes é bem mais
// confiável do que uma manchete isolada.
export function agruparAssuntos(itens, { agora = Date.now(), janelaHoras = 48, minFontes = 2, limite = 15 } = {}) {
  const corte = agora - janelaHoras * 3600 * 1000;
  const candidatos = itens
    .filter((item) => item.categoria !== 'checagem')
    .filter((item) => !item.data || Date.parse(item.data) >= corte)
    .map((item) => ({ item, palavras: palavrasChave(item.titulo) }))
    .filter(({ palavras }) => palavras.size >= 2)
    .sort((a, b) => maisRecente(a.item, b.item));

  const peso = criarIndice(candidatos.map((c) => c.palavras));
  const grupos = [];

  for (const candidato of candidatos) {
    let melhor = null;
    let melhorValor = 0;
    for (const grupo of grupos) {
      for (const membro of grupo.membros) {
        const { comum, pesoComum, pesoA, pesoB } = comparar(candidato.palavras, membro.palavras, peso);
        const valor = comum ? pesoComum / Math.sqrt(pesoA * pesoB) : 0;
        if (comum >= 2 && valor >= LIMIAR_ASSUNTO && valor > melhorValor) {
          melhor = grupo;
          melhorValor = valor;
        }
      }
    }
    if (melhor) melhor.membros.push(candidato);
    else grupos.push({ membros: [candidato] });
  }

  return grupos
    .map(({ membros }) => {
      // uma manchete por fonte (a mais recente)
      const porFonte = new Map();
      for (const { item } of membros) if (!porFonte.has(item.fonteId)) porFonte.set(item.fonteId, item);
      const doGrupo = [...porFonte.values()];
      const oficial = doGrupo.find((item) => item.categoria === 'oficial');
      return {
        id: doGrupo[0].id,
        titulo: (oficial ?? doGrupo[0]).titulo,
        data: doGrupo[0].data,
        temFonteOficial: Boolean(oficial),
        quantidadeFontes: doGrupo.length,
        itens: doGrupo,
        palavras: new Set(membros.flatMap((m) => [...m.palavras])),
      };
    })
    .filter((grupo) => grupo.quantidadeFontes >= minFontes)
    .sort((a, b) => b.quantidadeFontes - a.quantidadeFontes || maisRecente(a, b))
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// Busca de checagens e notícias relacionadas a um texto
// ---------------------------------------------------------------------------

const LIMIAR_RELACIONADO = 0.5;
// Textos longos (vários títulos juntos, transcrição de vídeo) cobrem menos, mas
// dividir 4 ou mais palavras distintivas já indica o mesmo assunto.
const LIMIAR_MUITAS_PALAVRAS = 0.25;

// Pontua cada item pelo quanto ele cobre as palavras importantes do texto
// procurado (cobertura), com um peso menor para o quanto o item é "só sobre
// isso" (precisão), para que matérias longas não ganhem só por falarem de tudo.
export function buscarRelacionados(texto, itens, { limite = 5 } = {}) {
  const consulta = palavrasChave(texto);
  if (consulta.size === 0) return [];
  const conjuntos = itens.map((item) => palavrasChave(`${item.titulo} ${item.resumo ?? ''}`));
  const peso = criarIndice(conjuntos);
  const minimoComum = Math.min(consulta.size, 2);

  return itens
    .map((item, i) => {
      const { comum, pesoComum, pesoA, pesoB } = comparar(consulta, conjuntos[i], peso);
      const valor = comum ? 0.75 * (pesoComum / pesoA) + 0.25 * (pesoComum / pesoB) : 0;
      return { item, comum, valor };
    })
    .filter(({ valor, comum }) =>
      comum >= minimoComum && (valor >= LIMIAR_RELACIONADO || (comum >= 4 && valor >= LIMIAR_MUITAS_PALAVRAS)))
    .sort((a, b) => b.valor - a.valor || maisRecente(a.item, b.item))
    .slice(0, limite)
    .map(({ item, valor }) => ({ ...item, relevancia: Math.round(valor * 100) / 100 }));
}

// ---------------------------------------------------------------------------
// Veredito das checagens
// ---------------------------------------------------------------------------

const VEREDITOS = [
  ['falso', /\b(e |eh )?(falso|falsa|fake|mentira|boato|nao e verdade)\b/],
  ['enganoso', /\b(enganos[oa]|distorcid[oa]|exagerad[oa]|fora de contexto|sem contexto|tirad[oa] de contexto|insustentavel|montagem|editad[oa])\b/],
  ['verdadeiro', /\b(e verdade|verdadeir[oa]|e real|confirmad[oa])\b/],
];

// Tenta ler o veredito no título da checagem ("É falso que...", "Vídeo fora de contexto...").
export function detectarVeredito(titulo) {
  const t = normalizar(titulo);
  for (const [veredito, padrao] of VEREDITOS) if (padrao.test(t)) return veredito;
  return null;
}

// ---------------------------------------------------------------------------
// Filtro rápido de alarmismo (para textos de reels, posts e mensagens)
// ---------------------------------------------------------------------------

const EXPRESSOES_ALARMISTAS = [
  'urgente', 'acabou', 'acabaram', 'voltaram atrás', 'voltou atrás', 'bomba', 'chocante', 'absurdo',
  'escândalo', 'inacreditável', 'gravíssimo', 'socorro', 'pasmem', 'alerta', 'atenção', 'cuidado',
  'vazou', 'vazado', 'desmascarado', 'desmascarada', 'acabou a mamata', 'fim do', 'fim da', 'é oficial',
  'confirmado', 'aprovaram escondido', 'última hora', 'agora é lei', 'olha o que',
];

const PEDIDOS_DE_COMPARTILHAMENTO = [
  'compartilhe', 'compartilhem', 'repasse', 'repassem', 'espalhe', 'espalhem', 'divulguem',
  'antes que apaguem', 'antes que derrubem', 'antes que tirem', 'manda pra todo mundo',
  'mande para todos', 'manda no grupo',
];

const APELOS_CONSPIRATORIOS = [
  'a mídia não mostra', 'a mídia esconde', 'a grande mídia', 'ninguém está falando', 'ninguém fala',
  'querem esconder', 'não querem que você saiba', 'estão escondendo', 'censurado', 'censurada',
  'a verdade que', 'a imprensa não mostra', 'a tv não mostra',
];

const SIGLAS = new Set([
  'STF', 'STJ', 'TSE', 'TST', 'TCU', 'PEC', 'CLT', 'INSS', 'IBGE', 'SUS', 'CPI', 'PIB', 'CNH',
  'FGTS', 'IPCA', 'SELIC', 'MEC', 'ENEM', 'ANVISA', 'PIX', 'CPF', 'RG', 'ONU', 'OMS', 'EUA', 'USP',
]);

const MESES = 'janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
const INSTITUICOES = /\b(stf|stj|tse|senado|camara|congresso|ministerio|ibge|banco central|receita federal|inss|anvisa|planalto|policia federal|prefeitura|governo federal|tribunal|diario oficial)\b/;

// `texto` já vem normalizado; as expressões ficam com acento para aparecer bonitas na tela.
function contemAlguma(texto, expressoes) {
  return expressoes.filter((expressao) => new RegExp(`(^|[^a-z0-9])${normalizar(expressao)}($|[^a-z0-9])`).test(texto));
}

export function analisarTexto(texto, { autor } = {}) {
  const original = String(texto ?? '').slice(0, 10000);
  const t = normalizar(original);
  const alertas = [];
  const confianca = [];
  let pontos = 0;

  const alarmistas = contemAlguma(t, EXPRESSOES_ALARMISTAS);
  if (alarmistas.length) {
    pontos += alarmistas.length >= 2 ? 35 : 20;
    alertas.push({
      tipo: 'alarmismo',
      texto: `Usa expressões alarmistas (${alarmistas.slice(0, 4).map((e) => `"${e}"`).join(', ')}). Notícia séria raramente fala assim.`,
    });
  }

  const letras = original.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, '').length;
  const palavrasGritadas = (original.match(/\b[A-ZÀ-Þ]{4,}\b/g) ?? []).filter((p) => !SIGLAS.has(p));
  if ((letras.length >= 15 && maiusculas / letras.length > 0.5) || palavrasGritadas.length >= 2) {
    pontos += 20;
    alertas.push({ tipo: 'caixa-alta', texto: 'Muitas palavras em CAIXA ALTA, um jeito comum de chamar atenção na base do susto.' });
  }

  if (/!{2,}|\?!|!\?/.test(original) || (original.match(/!/g) ?? []).length >= 3) {
    pontos += 15;
    alertas.push({ tipo: 'pontuacao', texto: 'Exagero de pontos de exclamação.' });
  }

  if (/[\u{1F6A8}\u{26A0}\u{203C}\u{2757}\u{1F534}\u{1F4E2}\u{1F4A3}\u{1F631}]/u.test(original)) {
    pontos += 15;
    alertas.push({ tipo: 'emoji', texto: 'Emojis de alarme (🚨⚠️‼️), típicos de corrente de WhatsApp.' });
  }

  if (contemAlguma(t, PEDIDOS_DE_COMPARTILHAMENTO).length) {
    pontos += 20;
    alertas.push({ tipo: 'compartilhe', texto: 'Pede para compartilhar com urgência. Desinformação depende de ser espalhada rápido.' });
  }

  if (contemAlguma(t, APELOS_CONSPIRATORIOS).length) {
    pontos += 25;
    alertas.push({ tipo: 'conspiracao', texto: 'Diz que "a mídia esconde" ou que "ninguém está falando". Se fosse grande assim, alguma fonte confiável teria noticiado.' });
  }

  if (/\b(lei|pec|pl|plp|mp|medida provisoria|decreto|portaria|resolucao|emenda constitucional)( complementar)?( n[o0]?)? \d+/.test(t)) {
    confianca.push({ tipo: 'norma', texto: 'Cita uma lei, PEC ou decreto específico. Dá para conferir no site do Senado, da Câmara ou do Planalto.' });
  }
  if (new RegExp(`\\b\\d{1,2}/\\d{1,2}(/\\d{2,4})?\\b|\\b\\d{1,2} de (${MESES})\\b`).test(semAcentos(original.toLowerCase()))) {
    confianca.push({ tipo: 'data', texto: 'Informa uma data concreta.' });
  }
  if (INSTITUICOES.test(t)) {
    confianca.push({ tipo: 'instituicao', texto: 'Menciona uma instituição. Confira se o site oficial dela diz a mesma coisa.' });
  }
  if (/\b(segundo|de acordo com|conforme|informou|afirmou|declarou|disse)\b/.test(t)) {
    confianca.push({ tipo: 'atribuicao', texto: 'Diz quem afirmou a informação.' });
  }
  if (/https?:\/\//i.test(original)) {
    confianca.push({ tipo: 'link', texto: 'Tem link. Veja se ele leva a um site conhecido, não a um blog ou perfil anônimo.' });
  }

  if (autor === 'anonimo') {
    pontos += 20;
    alertas.push({ tipo: 'autor', texto: 'Vem de perfil anônimo ou de "página de notícias" sem jornalista identificado.' });
  } else if (autor === 'veiculo' || autor === 'oficial') {
    confianca.push({ tipo: 'autor', texto: 'Quem publicou é identificável. Mesmo assim, abra o site original: perfis falsos imitam veículos.' });
  }

  if (confianca.length === 0 && t.length > 0) {
    pontos += 15;
    alertas.push({ tipo: 'sem-fonte', texto: 'Não cita fonte concreta: nenhuma lei, data, instituição ou pessoa que tenha dito aquilo.' });
  }

  pontos = Math.max(0, Math.min(100, pontos - Math.min(confianca.length, 3) * 8));
  const nivel = pontos >= 45 ? 'alto' : pontos >= 20 ? 'medio' : 'baixo';
  return { nivel, pontos, alertas, confianca };
}

// Uma manchete é marcada como sensacionalista só pelos sinais de forma
// (palavras alarmistas, caixa alta, exclamações), não pela falta de fonte.
export function manchetePareceAlarmista(titulo) {
  const { alertas } = analisarTexto(titulo);
  const deForma = alertas.filter((a) => ['alarmismo', 'caixa-alta', 'pontuacao', 'emoji', 'compartilhe', 'conspiracao'].includes(a.tipo));
  return deForma.length >= 2 || deForma.some((a) => a.tipo === 'conspiracao' || a.tipo === 'compartilhe');
}

// ---------------------------------------------------------------------------
// Links de busca para continuar a verificação fora do app
// ---------------------------------------------------------------------------

export function termosDeBusca(texto, maximo = 8) {
  const limpo = String(texto ?? '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  if (limpo.length <= 90) return limpo;
  const termos = [];
  const vistos = new Set();
  for (const palavra of limpo.split(/[^\p{L}\p{N}]+/u)) {
    const n = normalizar(palavra);
    if ((n.length < 3 && !/\d/.test(n)) || STOPWORDS.has(n) || vistos.has(n)) continue;
    if (contemAlguma(n, EXPRESSOES_ALARMISTAS).length) continue;
    vistos.add(n);
    termos.push(palavra.toLowerCase());
    if (termos.length >= maximo) break;
  }
  return termos.join(' ');
}

const SITES_DE_CHECAGEM = [
  'projetocomprova.com.br', 'aosfatos.org', 'lupa.uol.com.br', 'g1.globo.com/fato-ou-fake',
  'estadao.com.br/estadao-verifica', 'boatos.org', 'e-farsas.com',
];

export function linksDeBusca(texto) {
  const termos = termosDeBusca(texto);
  if (!termos) return [];
  const q = encodeURIComponent;
  const sites = SITES_DE_CHECAGEM.map((s) => `site:${s}`).join(' OR ');
  return [
    { nome: 'Buscar nas agências de checagem', url: `https://www.google.com/search?q=${q(`${termos} (${sites})`)}` },
    { nome: 'Google Fact Check Explorer', url: `https://toolbox.google.com/factcheck/explorer/search/${q(termos)};hl=pt` },
    { nome: 'Google Notícias', url: `https://news.google.com/search?q=${q(termos)}&hl=pt-BR&gl=BR&ceid=BR:pt-419` },
    { nome: 'Pesquisar com "checagem"', url: `https://www.google.com/search?q=${q(`${termos} checagem`)}` },
  ];
}
