import { createHash } from 'node:crypto';
import { decodificarBytes, interpretarFeed } from './xml.js';
import { classificarTemas, falaDoBrasil } from './temas.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; NaFonte/0.1; leitor de RSS)';
const MAX_ITENS_POR_FONTE = 40;
const MAX_BYTES = 5 * 1024 * 1024;
// Fonte cuja notícia mais nova é mais antiga que isso aparece como "parada".
export const DIAS_PARADO = 7;

function idDoLink(link) {
  return createHash('sha1').update(link).digest('hex').slice(0, 12);
}

// Alguns feeds misturam coisas que não são notícia: o do gov.br lista as pastas
// do site ("2023", "2024") e o do Comprova tinha um "Test Document". Manchete de
// verdade quase sempre tem pelo menos 3 palavras.
export function pareceNoticia(item) {
  const palavras = item.titulo.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  return palavras.length >= 3;
}

function maisRecentePrimeiro(a, b) {
  return (b.data ?? '').localeCompare(a.data ?? '');
}

export async function baixarFonte(fonte, { fetch = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const resposta = await fetch(fonte.feed, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resposta.ok) throw new Error(`o site respondeu HTTP ${resposta.status}`);

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('feed grande demais');

  const xml = decodificarBytes(bytes, resposta.headers.get('content-type') ?? '');
  const doFeed = interpretarFeed(xml, fonte.feed).filter(pareceNoticia).sort(maisRecentePrimeiro);
  if (doFeed.length === 0) throw new Error('nenhuma notícia encontrada (o endereço do feed pode ter mudado)');

  // Num feed geral (ex.: "Américas" do NYT) pode não ter nada sobre o Brasil agora:
  // isso não é erro, e a data da última publicação continua dizendo se o feed está vivo.
  const itens = fonte.sobreBrasil ? doFeed.filter((item) => falaDoBrasil(`${item.titulo} ${item.resumo}`)) : doFeed;

  return {
    ultimaPublicacao: doFeed[0].data,
    itens: itens.slice(0, MAX_ITENS_POR_FONTE).map(({ tags, ...item }) => ({
      id: idDoLink(item.link),
      ...item,
      fonteId: fonte.id,
      fonteNome: fonte.nome,
      categoria: fonte.categoria,
      idioma: fonte.idioma ?? 'pt',
      temas: classificarTemas({ ...item, tags }, fonte),
    })),
  };
}

function mensagemDeErro(erro) {
  if (erro?.name === 'TimeoutError') return 'o site demorou demais para responder';
  const causa = erro?.cause?.code;
  if (causa === 'ENOTFOUND') return 'endereço não encontrado';
  if (causa === 'ECONNREFUSED' || causa === 'ECONNRESET') return 'conexão recusada';
  return erro?.message ?? String(erro);
}

// Baixa todas as fontes em paralelo. Uma fonte com problema nunca derruba as outras:
// ela aparece com erro em `status` e, se já tinha funcionado antes, mantém as
// notícias da última vez que deu certo (passadas em `anteriores`).
export async function baixarTodas(fontes, { anteriores = {}, agora = Date.now(), ...opcoes } = {}) {
  const resultados = await Promise.allSettled(fontes.map((fonte) => baixarFonte(fonte, opcoes)));
  const sucessoEm = new Date(agora).toISOString();
  const porFonte = {};
  const status = [];

  function situacao(registro) {
    const ultimaNoticia = registro?.ultimaPublicacao ?? null;
    const parado = ultimaNoticia !== null && agora - Date.parse(ultimaNoticia) > DIAS_PARADO * 86400000;
    return { ultimaNoticia, parado };
  }

  resultados.forEach((resultado, i) => {
    const fonte = fontes[i];
    const anterior = anteriores[fonte.id];
    if (resultado.status === 'fulfilled') {
      porFonte[fonte.id] = { ...resultado.value, sucessoEm };
      status.push({ id: fonte.id, ok: true, quantidade: resultado.value.itens.length, sucessoEm, ...situacao(resultado.value) });
    } else {
      if (anterior) porFonte[fonte.id] = anterior;
      status.push({
        id: fonte.id,
        ok: false,
        erro: mensagemDeErro(resultado.reason),
        quantidade: anterior?.itens.length ?? 0,
        sucessoEm: anterior?.sucessoEm ?? null,
        ...situacao(anterior),
      });
    }
  });

  const vistos = new Set();
  const itens = [];
  for (const { itens: daFonte } of Object.values(porFonte)) {
    for (const item of daFonte) {
      if (vistos.has(item.link)) continue;
      vistos.add(item.link);
      itens.push(item);
    }
  }
  return { itens, status, porFonte };
}
