import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baixarTodas } from './feeds.js';
import { TEMAS } from './temas.js';
import {
  agruparAssuntos,
  analisarTexto,
  buscarRelacionados,
  detectarVeredito,
  linksDeBusca,
  manchetePareceAlarmista,
} from './analise.js';

const PASTA_PUBLICA = fileURLToPath(new URL('../public/', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const CABECALHOS_SEGURANCA = {
  'content-security-policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export function criarApp({ fontes, intervaloMinutos = 15, fetch, timeoutMs, relogio = Date.now } = {}) {
  let ultimo = { itens: [], status: [], porFonte: {}, atualizadoEm: null };
  let resposta = null; // JSON de /api/noticias já pronto
  let emAndamento = null;
  let temporizador = null;

  function montarResposta() {
    const itens = [...ultimo.itens].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
    const checagens = itens
      .filter((item) => item.categoria === 'checagem')
      .map((item) => ({ ...item, veredito: detectarVeredito(item.titulo) }));
    const noticias = itens
      .filter((item) => item.categoria === 'oficial' || item.categoria === 'veiculo')
      .map((item) => ({ ...item, alarmista: manchetePareceAlarmista(item.titulo) }));
    const internacional = itens.filter((item) => item.categoria === 'internacional');

    const assuntos = agruparAssuntos(itens, { agora: relogio() }).map(({ palavras, ...assunto }) => ({
      ...assunto,
      checagens: buscarRelacionados(assunto.itens.map((i) => i.titulo).join(' '), checagens, { limite: 2 }),
    }));

    const statusPorId = Object.fromEntries(ultimo.status.map((s) => [s.id, s]));
    return {
      atualizadoEm: ultimo.atualizadoEm,
      fontes: fontes.map(({ id, nome, categoria, site, idioma = 'pt' }) => ({ id, nome, categoria, site, idioma, ...statusPorId[id] })),
      temas: TEMAS.map(({ id, nome }) => ({ id, nome })),
      assuntos,
      checagens: checagens.slice(0, 80),
      noticias: noticias.slice(0, 150),
      internacional: internacional.slice(0, 80),
    };
  }

  async function atualizar() {
    if (emAndamento) return emAndamento;
    emAndamento = (async () => {
      const resultado = await baixarTodas(fontes, { anteriores: ultimo.porFonte, agora: relogio(), fetch, timeoutMs });
      ultimo = { ...resultado, atualizadoEm: new Date().toISOString() };
      resposta = montarResposta();
      const ok = resultado.status.filter((s) => s.ok).length;
      console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${ok}/${fontes.length} fontes atualizadas, ${resultado.itens.length} notícias`);
    })().finally(() => {
      emAndamento = null;
    });
    return emAndamento;
  }

  async function lerCorpo(req, limite = 20000) {
    let corpo = '';
    for await (const pedaco of req) {
      corpo += pedaco;
      if (corpo.length > limite) throw Object.assign(new Error('texto grande demais'), { status: 413 });
    }
    return corpo;
  }

  function enviarJson(res, status, dados) {
    res.writeHead(status, { ...CABECALHOS_SEGURANCA, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(dados));
  }

  async function servirArquivo(res, caminhoUrl) {
    const relativo = caminhoUrl === '/' ? 'index.html' : decodeURIComponent(caminhoUrl).replace(/^\/+/, '');
    const caminho = normalize(join(PASTA_PUBLICA, relativo));
    if (!caminho.startsWith(PASTA_PUBLICA) || caminho.split(sep).includes('..')) {
      res.writeHead(404).end();
      return;
    }
    try {
      const conteudo = await readFile(caminho);
      res.writeHead(200, {
        ...CABECALHOS_SEGURANCA,
        'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(conteudo);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    }
  }

  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/api/noticias' && req.method === 'GET') {
        if (!resposta) await atualizar();
        return enviarJson(res, 200, resposta);
      }

      if (url.pathname === '/api/verificar' && req.method === 'POST') {
        const { texto = '', autor } = JSON.parse((await lerCorpo(req)) || '{}');
        if (typeof texto !== 'string' || !texto.trim()) return enviarJson(res, 400, { erro: 'Cole um texto para analisar.' });
        if (!resposta) await atualizar();
        return enviarJson(res, 200, {
          analise: analisarTexto(texto, { autor }),
          checagens: buscarRelacionados(texto, resposta.checagens),
          noticias: buscarRelacionados(texto, [...resposta.noticias, ...resposta.internacional]),
          buscas: linksDeBusca(texto),
        });
      }

      if (req.method === 'GET' || req.method === 'HEAD') return await servirArquivo(res, url.pathname);
      res.writeHead(405).end();
    } catch (erro) {
      if (erro instanceof SyntaxError || erro instanceof URIError) return enviarJson(res, 400, { erro: 'Pedido inválido.' });
      if (erro.status) return enviarJson(res, erro.status, { erro: erro.message });
      console.error(erro);
      enviarJson(res, 500, { erro: 'Erro interno.' });
    }
  });

  return {
    servidor,
    atualizar,
    iniciar(porta = 3000) {
      atualizar().catch((erro) => console.error('Falha ao atualizar as fontes:', erro));
      temporizador = setInterval(() => atualizar().catch((erro) => console.error(erro)), intervaloMinutos * 60 * 1000);
      temporizador.unref();
      return new Promise((resolve) => servidor.listen(porta, () => resolve(servidor.address().port)));
    },
    parar() {
      clearInterval(temporizador);
      return new Promise((resolve) => servidor.close(resolve));
    },
  };
}
