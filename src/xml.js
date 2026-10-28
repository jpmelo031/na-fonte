// Leitor mínimo de feeds RSS 2.0, RSS 1.0 (RDF) e Atom, sem dependências.
// Não é um parser XML completo: só extrai o que o app precisa de cada item.

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', hellip: '…', bull: '•', middot: '·', deg: '°',
  ordm: 'º', ordf: 'ª', euro: '€', copy: '©', reg: '®', trade: '™',
};

// Gera &aacute;, &Atilde;, &ccedil; etc. a partir das letras + acentos.
const ACENTOS = { acute: 0x301, grave: 0x300, circ: 0x302, tilde: 0x303, uml: 0x308, cedil: 0x327 };
for (const letra of 'aeiouycnAEIOUYCN') {
  for (const [nome, marca] of Object.entries(ACENTOS)) {
    const composta = (letra + String.fromCodePoint(marca)).normalize('NFC');
    if (composta.length === 1) ENTIDADES[letra + nome] = composta;
  }
}

export function decodificarEntidades(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, ent) => {
    if (ent[0] === '#') {
      const hex = ent[1] === 'x' || ent[1] === 'X';
      const codigo = parseInt(ent.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : original;
    }
    return ENTIDADES[ent] ?? ENTIDADES[ent.toLowerCase()] ?? original;
  });
}

// Conteúdo de uma tag -> texto puro (sem CDATA, sem HTML, sem entidades).
export function textoPuro(bruto) {
  if (!bruto) return '';
  let texto = bruto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  texto = decodificarEntidades(texto); // descrições costumam vir com HTML escapado
  texto = texto
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  texto = decodificarEntidades(texto);
  return texto.replace(/\s+/g, ' ').trim();
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function conteudoDaTag(bloco, nomes) {
  for (const nome of nomes) {
    const re = new RegExp(`<${escaparRegex(nome)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaparRegex(nome)}>`, 'i');
    const achado = bloco.match(re);
    if (achado && achado[1].trim()) return achado[1];
  }
  return '';
}

function atributo(tag, nome) {
  const achado = tag.match(new RegExp(`\\s${nome}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return achado ? decodificarEntidades(achado[2] ?? achado[3]) : '';
}

// Só aceita links http(s), para nunca renderizar "javascript:" vindo de um feed.
export function linkSeguro(url, base) {
  try {
    const u = new URL(url.trim(), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function extrairLink(bloco, base) {
  const texto = textoPuro(conteudoDaTag(bloco, ['link', 'feedburner:origLink']));
  if (texto) {
    const link = linkSeguro(texto, base);
    if (link) return link;
  }
  // Atom: <link rel="alternate" href="..."/>
  const tagsLink = bloco.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tagsLink) {
    const rel = atributo(tag, 'rel');
    const href = atributo(tag, 'href');
    if (href && (!rel || rel === 'alternate')) {
      const link = linkSeguro(href, base);
      if (link) return link;
    }
  }
  const guid = textoPuro(conteudoDaTag(bloco, ['guid', 'id']));
  return guid && /^https?:\/\//i.test(guid) ? linkSeguro(guid, base) : null;
}

const MESES_PT = { jan: 'Jan', fev: 'Feb', mar: 'Mar', abr: 'Apr', mai: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', set: 'Sep', out: 'Oct', nov: 'Nov', dez: 'Dec' };

// Aceita RFC 822, ISO 8601 e o formato em português que alguns feeds brasileiros usam
// ("Ter, 28 Out 2026 10:00:00 -0300").
export function interpretarData(texto) {
  if (!texto) return null;
  let t = texto.trim();
  let ms = Date.parse(t);
  if (Number.isNaN(ms)) {
    t = t
      .replace(/^[^\d,]+,\s*/, '')
      .replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?/i, (m, mes) => MESES_PT[mes.toLowerCase()]);
    ms = Date.parse(t);
  }
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function interpretarFeed(xml, base) {
  const itens = [];
  const blocos = xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const [, , bloco] of blocos) {
    const titulo = textoPuro(conteudoDaTag(bloco, ['title']));
    const link = extrairLink(bloco, base);
    if (!titulo || !link) continue;
    const resumo = textoPuro(conteudoDaTag(bloco, ['description', 'summary', 'content:encoded', 'content']));
    const data = interpretarData(textoPuro(conteudoDaTag(bloco, ['pubDate', 'published', 'updated', 'dc:date'])));
    itens.push({ titulo, link, resumo: resumo.length > 320 ? resumo.slice(0, 317).trimEnd() + '…' : resumo, data });
  }
  return itens;
}

// Bytes -> texto, respeitando o charset (vários feeds brasileiros ainda usam ISO-8859-1).
export function decodificarBytes(bytes, contentType = '') {
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const charset =
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ??
    inicio.match(/<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
