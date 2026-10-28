import { createHash } from 'node:crypto';
import { decodificarBytes, interpretarFeed } from './xml.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; NaFonte/0.1; leitor de RSS)';
const MAX_ITENS_POR_FONTE = 40;
const MAX_BYTES = 5 * 1024 * 1024;

function idDoLink(link) {
  return createHash('sha1').update(link).digest('hex').slice(0, 12);
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
  const itens = interpretarFeed(xml, fonte.feed);
  if (itens.length === 0) throw new Error('nenhuma notícia encontrada (o endereço do feed pode ter mudado)');

  return itens.slice(0, MAX_ITENS_POR_FONTE).map((item) => ({
    id: idDoLink(item.link),
    ...item,
    fonteId: fonte.id,
    fonteNome: fonte.nome,
    categoria: fonte.categoria,
  }));
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
export async function baixarTodas(fontes, { anteriores = {}, ...opcoes } = {}) {
  const resultados = await Promise.allSettled(fontes.map((fonte) => baixarFonte(fonte, opcoes)));
  const agora = new Date().toISOString();
  const porFonte = {};
  const status = [];

  resultados.forEach((resultado, i) => {
    const fonte = fontes[i];
    const anterior = anteriores[fonte.id];
    if (resultado.status === 'fulfilled') {
      porFonte[fonte.id] = { itens: resultado.value, sucessoEm: agora };
      status.push({ id: fonte.id, ok: true, quantidade: resultado.value.length, sucessoEm: agora });
    } else {
      if (anterior) porFonte[fonte.id] = anterior;
      status.push({
        id: fonte.id,
        ok: false,
        erro: mensagemDeErro(resultado.reason),
        quantidade: anterior?.itens.length ?? 0,
        sucessoEm: anterior?.sucessoEm ?? null,
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
