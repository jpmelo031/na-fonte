// Temas do filtro (Política, Economia, Clima...). Para melhorar a classificação,
// edite as listas abaixo: não precisa mexer em mais nada.
//
// secoes:   pedaços do endereço da matéria que já dizem o tema
//           (g1.globo.com/politica/..., folha.uol.com.br/mercado/..., economia.uol.com.br).
// palavras: procuradas no título, no resumo e nas categorias do feed, sem acento.
//           Palavras de até 4 letras precisam aparecer inteiras ("pec" não pega "pecuária");
//           as maiores valem como começo de palavra ("eleic" pega "eleição" e "eleições").
//           Há palavras em inglês e espanhol para a imprensa internacional.
import { normalizar } from './analise.js';

export const TEMAS = [
  {
    id: 'politica',
    nome: 'Política',
    secoes: ['politica', 'poder', 'eleicoes', 'politics', 'elections'],
    palavras: [
      'politic', 'eleic', 'eleito', 'eleitor', 'senad', 'deputad', 'vereador', 'congresso', 'ministr',
      'lula', 'bolsonaro', 'planalto', 'governador', 'prefeit', 'partido', 'stf', 'supremo', 'tse', 'pec',
      'projeto de lei', 'votac', 'voto', 'votos', 'votou', 'cpi', 'impeachment', 'oposic', 'candidat', 'urna',
      'election', 'congress', 'senator', 'lawmaker', 'supreme court', 'eleccion',
    ],
  },
  {
    id: 'economia',
    nome: 'Economia',
    secoes: ['economia', 'mercado', 'financas', 'negocios', 'agronegocio', 'agronegocios', 'business', 'economy', 'money'],
    palavras: [
      'econom', 'inflac', 'ipca', 'juros', 'selic', 'banco central', 'mercado', 'bolsa de valores', 'ibovespa',
      'dolar', 'pib', 'desemprego', 'emprego', 'salario', 'imposto', 'tribut', 'orcament', 'fiscal', 'divida',
      'exporta', 'importa', 'tarifa', 'petrobras', 'combustiv', 'gasolina', 'aposentad', 'inss', 'fgts', 'bpc',
      'bolsa familia', 'credito', 'agronegocio', 'safra', 'investiment',
      'inflation', 'economy', 'tariff', 'trade', 'currency', 'budget', 'arancel',
    ],
  },
  {
    id: 'clima',
    nome: 'Clima e ambiente',
    secoes: ['meio-ambiente', 'ambiente', 'sustentabilidade', 'clima', 'natureza', 'environment', 'climate'],
    palavras: [
      'climat', 'meio ambiente', 'ambiental', 'desmat', 'amazonia', 'floresta', 'queimada', 'incendio florestal',
      'seca', 'estiagem', 'enchente', 'inundac', 'chuva', 'temporal', 'tempestade', 'ciclone', 'onda de calor',
      'calor extremo', 'frente fria', 'geada', 'temperatura', 'el nino', 'la nina', 'aquecimento global',
      'emissoes', 'carbono', 'cop30', 'cop 30', 'sustentab', 'defesa civil', 'alagament', 'deslizament',
      'climate', 'deforestation', 'rainforest', 'wildfire', 'drought', 'flood', 'heatwave', 'environment', 'emissions',
    ],
  },
  {
    id: 'tecnologia',
    nome: 'Ciência e tecnologia',
    secoes: ['tecnologia', 'tec', 'ciencia', 'link', 'tilt', 'technology', 'science'],
    palavras: [
      'tecnolog', 'inteligencia artificial', 'chatgpt', 'openai', 'big tech', 'internet', 'aplicativo', 'app',
      'celular', 'smartphone', 'iphone', 'android', 'redes sociais', 'rede social', 'whatsapp', 'instagram',
      'tiktok', 'google', 'apple', 'microsoft', 'hacker', 'ciberat', 'ciberseg', 'vazamento de dados',
      'dados pessoais', 'software', 'startup', 'robo', 'robos', 'satelit', 'espacia', 'foguete', 'nasa',
      'ciencia', 'cientist',
      'technology', 'artificial intelligence', 'tech', 'cyber', 'science', 'scientist',
    ],
  },
  {
    id: 'saude',
    nome: 'Saúde',
    secoes: ['saude', 'equilibrioesaude', 'bem-estar', 'health'],
    palavras: [
      'saude', 'sus', 'hospital', 'medico', 'medicament', 'medicina', 'vacin', 'doenc', 'dengue', 'chikungunya', 'zika', 'covid', 'gripe',
      'virus', 'epidem', 'pandem', 'cancer', 'diabet', 'anvisa', 'remedio', 'cirurgi', 'obesidade', 'depressao',
      'ansiedade', 'sarampo',
      'health', 'vaccine', 'disease', 'outbreak', 'salud',
    ],
  },
  {
    id: 'educacao',
    nome: 'Educação',
    secoes: ['educacao', 'education'],
    palavras: [
      'educac', 'escola', 'ensino', 'enem', 'universidad', 'faculdade', 'vestibular', 'professor', 'aluno',
      'estudante', 'mec', 'creche', 'alfabetiz', 'sisu', 'fies', 'prouni',
      'education', 'school', 'university', 'student',
    ],
  },
  {
    id: 'seguranca',
    nome: 'Segurança',
    secoes: ['seguranca', 'policia', 'seguranca-publica'],
    palavras: [
      'polici', 'crime', 'criminos', 'criminal', 'preso', 'presa', 'prisao', 'prende', 'assassin', 'homicid',
      'tiroteio', 'baleado', 'assalto', 'roubo', 'furto', 'trafic', 'faccao', 'faccoes', 'pcc', 'comando vermelho',
      'milicia', 'sequestr', 'estelionat', 'fraude', 'violencia', 'feminicid', 'estupr',
      'police', 'gang', 'murder', 'shooting', 'arrest', 'prison', 'violence',
    ],
  },
  {
    id: 'mundo',
    nome: 'Mundo',
    secoes: ['mundo', 'internacional'],
    palavras: [
      'guerra', 'eua', 'estados unidos', 'trump', 'china', 'chines', 'russia', 'ucrania', 'ukrain', 'israel',
      'gaza', 'palestin', 'hamas', 'iran', 'argentin', 'venezuel', 'milei', 'maduro', 'europ', 'onu', 'otan',
      'papa', 'itamaraty', 'embaixad', 'diplomac', 'chanceler', 'g20', 'brics', 'mercosul',
      'putin', 'netanyahu', 'zelensky', 'xi jinping', 'oriente medio', 'iemen', 'houthi', 'siria', 'libano',
      'turquia', 'egito', 'africa', 'asia', 'japao', 'japones', 'coreia', 'taiwan', 'india', 'alemanha',
      'franca', 'frances', 'espanha', 'reino unido', 'canada', 'mexic', 'chile', 'colombia', 'peru',
      'bolivia', 'paragua', 'urugua',
    ],
  },
  {
    id: 'esportes',
    nome: 'Esportes',
    secoes: ['esporte', 'esportes', 'futebol', 'sport', 'football'],
    palavras: [
      'esporte', 'futebol', 'brasileirao', 'campeonato', 'copa do mundo', 'copa do brasil', 'libertadores',
      'sul americana', 'selecao', 'jogador', 'flamengo', 'corinthians', 'palmeiras', 'vasco', 'gremio',
      'cruzeiro', 'botafogo', 'fluminense', 'atletico', 'olimpi', 'nba', 'formula 1', 'tenis', 'volei',
      'basquete', 'ufc', 'fifa', 'neymar',
      'football', 'soccer', 'world cup', 'olympic',
    ],
  },
  {
    id: 'cultura',
    nome: 'Cultura',
    secoes: ['cultura', 'entretenimento', 'pop-arte', 'ilustrada', 'celebridades', 'musica', 'cinema', 'culture', 'music', 'film'],
    palavras: [
      'cultura', 'cinema', 'filme', 'novela', 'musica', 'cantor', 'show', 'festival', 'carnaval', 'livro',
      'literatur', 'teatro', 'exposic', 'museu', 'artista', 'oscar', 'grammy', 'netflix', 'streaming',
      'celebridad', 'ator', 'atores', 'atriz', 'bbb', 'reality',
      'film', 'music', 'singer', 'carnival', 'concert',
    ],
  },
];

const MAX_TEMAS_POR_NOTICIA = 2;
const PONTOS_MINIMOS = 2;

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Uma expressão por tema: palavras curtas inteiras, palavras longas como começo de palavra.
function compilar(palavras) {
  const normalizadas = [...new Set(palavras.map(normalizar))].map(escaparRegex);
  const inteiras = normalizadas.filter((p) => p.length <= 4);
  const prefixos = normalizadas.filter((p) => p.length > 4);
  const partes = [];
  if (inteiras.length) partes.push(`(?:^| )(${inteiras.join('|')})(?= |$)`);
  if (prefixos.length) partes.push(`(?:^| )(${prefixos.join('|')})`);
  return new RegExp(partes.join('|'), 'g');
}

const COMPILADOS = TEMAS.map((tema) => ({
  ...tema,
  expressao: compilar(tema.palavras),
  secoesComEspaco: tema.secoes.map((s) => s.replace(/-/g, ' ')),
}));

function palavrasEncontradas(expressao, textoNormalizado) {
  const achadas = new Set();
  for (const achado of textoNormalizado.matchAll(expressao)) achadas.add(achado[1] ?? achado[2]);
  return achadas.size;
}

function segmentosDoLink(link) {
  try {
    const url = new URL(link);
    return [...url.hostname.split('.'), ...url.pathname.split('/')].map((s) => s.toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function secaoCombina(segmento, secoes) {
  return secoes.some((secao) => segmento === secao || segmento.startsWith(`${secao}-`));
}

// Devolve até 2 temas (ids), do mais forte para o mais fraco.
// Pontos: seção do endereço +3, categoria do feed +3, tema fixo da fonte +3,
// cada palavra no título +2, cada palavra no resumo +1.
export function classificarTemas(item, fonte = {}) {
  const titulo = normalizar(item.titulo ?? '');
  const resumo = normalizar(item.resumo ?? '');
  const tags = (item.tags ?? []).map(normalizar);
  const segmentos = segmentosDoLink(item.link ?? '');

  return COMPILADOS
    .map((tema) => {
      let pontos = 0;
      if (segmentos.some((s) => secaoCombina(s, tema.secoes))) pontos += 3;
      if (tags.some((t) => secaoCombina(t, tema.secoesComEspaco) || palavrasEncontradas(tema.expressao, t) > 0)) pontos += 3;
      if (fonte.tema === tema.id) pontos += 3;
      pontos += 2 * palavrasEncontradas(tema.expressao, titulo);
      pontos += palavrasEncontradas(tema.expressao, resumo);
      return { id: tema.id, pontos };
    })
    .filter(({ pontos }) => pontos >= PONTOS_MINIMOS)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, MAX_TEMAS_POR_NOTICIA)
    .map(({ id }) => id);
}

// Para a imprensa internacional: a matéria fala do Brasil?
const SOBRE_O_BRASIL = /(?:^| )(brasil|brazil|bresil|lula|bolsonaro|amazonia|amazon rainforest|rio de janeiro|sao paulo|petrobras|itamaraty)/;

export function falaDoBrasil(texto) {
  return SOBRE_O_BRASIL.test(normalizar(texto ?? ''));
}
