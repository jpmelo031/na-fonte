// Modo leitura: baixa a página da matéria e devolve só o texto dela, sem anúncios,
// menus, "leia também", chamadas de newsletter e outras coisas que não são a notícia.
//
// A extração usa o Readability (o mesmo do modo leitura do Firefox). Por cima dele
// passa um filtro próprio para o lixo que os sites colocam DENTRO do corpo da matéria.
// O app mostra o que o site entrega publicamente; quando o texto vem cortado, ele avisa.
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { decodificarBytes } from './xml.js';
import { normalizar } from './analise.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; NaFonte/0.1; modo leitura)';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BLOCOS = 300;
// Abaixo disso o texto provavelmente é só o começo da matéria.
const CARACTERES_TEXTO_CURTO = 600;

export class ErroLeitura extends Error {
  constructor(mensagem, status = 502) {
    super(mensagem);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function baixarPagina(link, { fetch = globalThis.fetch, timeoutMs = 15000 } = {}) {
  let resposta;
  try {
    resposta = await fetch(link, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (erro) {
    if (erro?.name === 'TimeoutError') throw new ErroLeitura('O site demorou demais para responder.', 504);
    throw new ErroLeitura('Não consegui acessar o site agora.');
  }

  if ([401, 402, 403, 429].includes(resposta.status)) throw new ErroLeitura('O site não deixou o app ler esta matéria.');
  if (resposta.status === 404 || resposta.status === 410) throw new ErroLeitura('A matéria não foi encontrada no site (pode ter sido removida).');
  if (!resposta.ok) throw new ErroLeitura(`O site respondeu com erro (HTTP ${resposta.status}).`);

  const tipo = resposta.headers.get('content-type') ?? '';
  if (tipo && !/html|xml/i.test(tipo)) {
    throw new ErroLeitura('Esta matéria não é uma página de texto (pode ser vídeo, áudio ou PDF).', 415);
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new ErroLeitura('A página é grande demais para o modo leitura.', 413);
  return { html: decodificarBytes(bytes, tipo), url: resposta.url || link };
}

// ---------------------------------------------------------------------------
// Dados estruturados (schema.org NewsArticle)
// ---------------------------------------------------------------------------

function artigosDoJsonLd(document) {
  const encontrados = [];
  const visitar = (no) => {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach(visitar);
    const tipos = [].concat(no['@type'] ?? []);
    if (tipos.some((t) => /Article|Posting|Report/i.test(String(t)))) encontrados.push(no);
    if (no['@graph']) visitar(no['@graph']);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visitar(JSON.parse(script.textContent));
    } catch {
      // JSON-LD quebrado é comum; só ignora
    }
  }
  return encontrados;
}

const falso = (valor) => valor === false || String(valor).toLowerCase() === 'false';

function nomesDosAutores(autor) {
  return [].concat(autor ?? [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Limpeza antes do Readability
// ---------------------------------------------------------------------------

// Caixas de "relacionadas", newsletter, compartilhar etc. Só sai o que for curto,
// para nunca apagar o corpo da matéria por causa de um nome de classe infeliz.
const SELETORES_DE_LIXO = [
  'newsletter', 'relacionad', 'related', 'leia-tambem', 'leiatambem', 'leia-mais', 'saiba-mais',
  'veja-tambem', 'mais-lidas', 'most-read', 'publicidade', 'advert', 'ad-slot', 'share', 'compartilh',
  'social', 'comment', 'comentario', 'recommend', 'recomend', 'promo',
].flatMap((nome) => [`[class*="${nome}"]`, `[id*="${nome}"]`]).join(',');

function limparAntes(document) {
  for (const el of document.querySelectorAll(SELETORES_DE_LIXO)) {
    if ((el.textContent ?? '').length < 1000) el.remove();
  }
}

// ---------------------------------------------------------------------------
// Do HTML do Readability para blocos de texto
// ---------------------------------------------------------------------------

const TIPO_DO_BLOCO = {
  P: 'p', PRE: 'p', DD: 'p', DT: 'p', TR: 'p',
  H1: 'subtitulo', H2: 'subtitulo', H3: 'subtitulo', H4: 'subtitulo', H5: 'subtitulo', H6: 'subtitulo',
  LI: 'item',
  BLOCKQUOTE: 'citacao',
};
const IGNORAR = new Set([
  'FIGURE', 'FIGCAPTION', 'PICTURE', 'IMG', 'VIDEO', 'AUDIO', 'IFRAME', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG',
  'BUTTON', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV', 'ASIDE', 'FOOTER', 'HEADER',
]);
const INLINE = new Set(['A', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'SMALL', 'SUB', 'SUP', 'MARK', 'ABBR', 'CITE', 'Q', 'TIME', 'CODE', 'FONT', 'S', 'DEL', 'INS']);

function arrumarEspacos(texto) {
  return texto.replace(/[ \t\r\f\v\xa0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}

// Texto de um elemento e quanto dele está dentro de links.
function textoEDensidade(el) {
  if (el.tagName === 'TR') {
    const celulas = [...el.querySelectorAll('td, th')].map((c) => arrumarEspacos(c.textContent ?? ''));
    return { texto: celulas.filter(Boolean).join(' | '), emLinks: 0 };
  }
  const copia = el.cloneNode(true);
  for (const ignorado of copia.querySelectorAll([...IGNORAR].join(','))) ignorado.remove();
  for (const br of copia.querySelectorAll('br')) br.replaceWith('\n');
  const emLinks = [...copia.querySelectorAll('a')].reduce((soma, a) => soma + arrumarEspacos(a.textContent ?? '').length, 0);
  return { texto: arrumarEspacos(copia.textContent ?? ''), emLinks };
}

function coletarBlocos(no, saida) {
  let trecho = { texto: '', emLinks: 0 };
  const fechar = () => {
    const texto = arrumarEspacos(trecho.texto);
    if (texto) saida.push({ tipo: 'p', texto, densidadeLinks: trecho.emLinks / texto.length });
    trecho = { texto: '', emLinks: 0 };
  };
  for (const filho of no.childNodes) {
    if (filho.nodeType === 3) {
      trecho.texto += filho.textContent;
      continue;
    }
    if (filho.nodeType !== 1 || IGNORAR.has(filho.tagName)) continue;
    if (filho.tagName === 'BR') {
      trecho.texto += '\n';
    } else if (INLINE.has(filho.tagName)) {
      const { texto, emLinks } = textoEDensidade(filho);
      trecho.texto += texto;
      trecho.emLinks += filho.tagName === 'A' ? texto.length : emLinks;
    } else if (TIPO_DO_BLOCO[filho.tagName]) {
      fechar();
      const { texto, emLinks } = textoEDensidade(filho);
      if (texto) saida.push({ tipo: TIPO_DO_BLOCO[filho.tagName], texto, densidadeLinks: emLinks / texto.length });
    } else {
      fechar();
      coletarBlocos(filho, saida);
    }
  }
  fechar();
  return saida;
}

// ---------------------------------------------------------------------------
// Filtro do que não é a notícia
// ---------------------------------------------------------------------------

// Comparados com o texto sem acento e em minúsculas, só em blocos curtos.
const PADROES_DE_LIXO = [
  /^(leia|veja|confira|ouca|assista) (tambem|mais|ainda)\b/,
  /^(leia|veja) (a|o) (materia|reportagem|texto|video) complet/,
  /^saiba mais\b/,
  /^assista\b/,
  /^(ouca|escute) (o|a|este|esta|nosso|nossa)\b/,
  /^siga\b/,
  /^(clique|toque) aqui/,
  /^(assine|seja assinante|torne se assinante|faca sua assinatura)/,
  /^(receba|cadastre se|inscreva se|assine a newsletter)/,
  /newsletter/,
  /^publicidade$/,
  /^continua (apos|depois) (a|da) publicidade/,
  /^(anuncio|patrocinado|conteudo patrocinado)$/,
  /^(compartilhe|compartilhar)\b/,
  /^(participe|entre) (do|no|em) (nosso |nossa )?(canal|grupo|comunidade)/,
  /(canal|grupo|comunidade) .{0,40}(no|do) (whatsapp|telegram)/,
  /^(baixe|instale) o (nosso )?(app|aplicativo)/,
  /^(reproducao|divulgacao|arquivo pessoal|getty images|reuters|afp|ap photo)$/,
  /^(mais lidas|mais lidos|noticias relacionadas|materias relacionadas|relacionadas|ultimas noticias|leia mais|veja tambem|veja mais)$/,
  /^(comentarios|deixe seu comentario|comente)\b/,
  /^para (continuar|seguir) lendo/,
  /^(continue|siga) lendo/,
  /^(ja e assinante|ja sou assinante|faca (seu )?login|entre na sua conta)/,
  /^(to continue reading|subscribe to (continue|read)|already a subscriber)/,
  /^(read more|related|sign up|subscribe|advertisement|follow us|share this|most read|more on this story|you may also like|recommended)\b/,
  /(uma publicacao compartilhada por|a post shared by|ver essa foto no instagram|view this post on instagram|pic twitter com)/,
];

// Estes dependem da pontuação ("Foto: Reprodução", "Tags: ...", "28/10/2026 10h"),
// então são testados no texto original, em minúsculas.
const PADROES_COM_PONTUACAO = [
  /^(foto|fotos|imagem|imagens|v[ií]deo|cr[eé]dito|arte|ilustra[cç][aã]o)\s*:/,
  /^tags?\s*:/,
  /^edi[cç][aã]o\s*:/,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /^(publicad[oa]|atualizad[oa]|updated|published)( em| on| há| ha| at)?\s*:?\s*(\d{1,2}\/\d{1,2}|\d+ (min|hora|dia)|\d{1,2} de [a-zç]+ de \d{4})/,
];

function pareceLixo(bloco, titulos) {
  const t = normalizar(bloco.texto);
  if (t.length < 2) return true;
  if (titulos.has(t)) return true;
  if (bloco.tipo !== 'subtitulo' && bloco.densidadeLinks >= 0.7) return true;
  if (bloco.texto.length <= 220) {
    const original = bloco.texto.toLowerCase();
    if (PADROES_DE_LIXO.some((padrao) => padrao.test(t))) return true;
    if (PADROES_COM_PONTUACAO.some((padrao) => padrao.test(original))) return true;
  }
  // linha de autoria ("Por Maria Souza", "Por Maria Souza, de Brasília"): o app mostra à parte
  if (bloco.texto.length <= 80 && /^(por|by) /.test(t) && !/[.!?]$/.test(bloco.texto)) return true;
  return false;
}

function semSufixoDoSite(titulo) {
  return titulo.replace(/\s+[|–—-]\s+[^|–—-]{2,40}$/, '');
}

export function filtrarBlocos(blocos, titulosConhecidos = []) {
  const titulos = new Set(titulosConhecidos.filter(Boolean).flatMap((t) => [normalizar(t), normalizar(semSufixoDoSite(t))]));
  const saida = [];
  for (const bloco of blocos) {
    if (pareceLixo(bloco, titulos)) continue;
    const anterior = saida[saida.length - 1];
    if (anterior && normalizar(anterior.texto) === normalizar(bloco.texto)) continue;
    saida.push({ tipo: bloco.tipo, texto: bloco.texto });
    if (saida.length >= MAX_BLOCOS) break;
  }
  // subtítulo no fim (de uma seção que era só links) não serve para nada
  while (saida.length && saida[saida.length - 1].tipo === 'subtitulo') saida.pop();
  return saida;
}

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

export function extrairArtigo(html, { url, titulo } = {}) {
  const { document } = parseHTML(html);
  const jsonLd = artigosDoJsonLd(document);
  const paraAssinantes = jsonLd.some(
    (a) => falso(a.isAccessibleForFree) || [].concat(a.hasPart ?? []).some((p) => falso(p?.isAccessibleForFree)),
  );

  limparAntes(document);
  let lido = null;
  try {
    lido = new Readability(document).parse();
  } catch {
    lido = null;
  }

  const titulos = [titulo, lido?.title];
  let blocos = lido?.content ? filtrarBlocos(coletarBlocos(parseHTML(`<html><body>${lido.content}</body></html>`).document.body, []), titulos) : [];
  let caracteres = blocos.reduce((soma, b) => soma + b.texto.length, 0);

  // Sites que montam o texto com JavaScript costumam deixar o texto completo no JSON-LD.
  // Só usa quando a própria página diz que a matéria é aberta.
  const corpoJsonLd = jsonLd.map((a) => a.articleBody).find((c) => typeof c === 'string' && c.length > caracteres + 200);
  if (caracteres < 500 && corpoJsonLd && !paraAssinantes) {
    blocos = filtrarBlocos(corpoJsonLd.split(/\n+/).map((texto) => ({ tipo: 'p', texto: arrumarEspacos(texto), densidadeLinks: 0 })), titulos);
    caracteres = blocos.reduce((soma, b) => soma + b.texto.length, 0);
  }

  if (caracteres < 150) throw new ErroLeitura('Não encontrei o texto da matéria nesta página. Pode ser uma página de vídeo ou galeria.', 422);

  let site = lido?.siteName ?? null;
  if (!site && url) {
    try {
      site = new URL(url).hostname.replace(/^www\./, '');
    } catch {}
  }

  return {
    titulo: semSufixoDoSite(lido?.title ?? titulo ?? ''),
    autor: (lido?.byline || nomesDosAutores(jsonLd[0]?.author) || '').replace(/^(por|by)\s+/i, '') || null,
    publicadoEm: lido?.publishedTime || jsonLd.find((a) => a.datePublished)?.datePublished || null,
    site,
    blocos,
    caracteres,
    paraAssinantes,
    possivelmenteIncompleto: caracteres < CARACTERES_TEXTO_CURTO,
  };
}

// ---------------------------------------------------------------------------
// Leitor com cache: a mesma matéria aberta de novo não baixa a página outra vez
// ---------------------------------------------------------------------------

export function criarLeitor({ fetch, timeoutMs, validadeMs = 30 * 60 * 1000, maximo = 100 } = {}) {
  const cache = new Map();

  return function ler(item) {
    const guardado = cache.get(item.link);
    if (guardado && Date.now() - guardado.quando < validadeMs) return guardado.promessa;

    const promessa = baixarPagina(item.link, { fetch, timeoutMs }).then(({ html, url }) =>
      extrairArtigo(html, { url, titulo: item.titulo }),
    );
    cache.set(item.link, { quando: Date.now(), promessa });
    promessa.catch(() => cache.delete(item.link)); // erro não fica guardado
    while (cache.size > maximo) cache.delete(cache.keys().next().value);
    return promessa;
  };
}
