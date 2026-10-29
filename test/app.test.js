import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { criarApp } from '../src/app.js';

const fixture = (nome) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url));

let servidorFeeds;
let app;
let base;
let feedAForaDoAr = false;
let visitasMateria = 0;

before(async () => {
  // Servidor local que faz o papel dos sites de notícia.
  servidorFeeds = createServer((req, res) => {
    const rotas = {
      '/a.xml': ['application/rss+xml; charset=utf-8', fixture('rss-veiculo-a.xml')],
      '/b.xml': ['text/xml', fixture('rss-latin1.xml')],
      '/oficial.atom': ['application/atom+xml', fixture('atom-oficial.xml')],
      '/checagem.xml': ['application/rss+xml', fixture('rss-checagem.xml')],
      '/pagina.html': ['text/html', Buffer.from('<html><body>Não é um feed</body></html>')],
      '/intl.xml': ['application/rss+xml', Buffer.from(
        '<rss><channel>' +
        "<item><title>Brazil's Lula vows to end deforestation in the Amazon rainforest</title>" +
        '<link>https://intl.exemplo/brazil-amazon</link><pubDate>Wed, 28 Oct 2026 16:00:00 GMT</pubDate></item>' +
        '<item><title>Mexico elects its first new president in decades</title>' +
        '<link>https://intl.exemplo/mexico</link><pubDate>Wed, 28 Oct 2026 17:00:00 GMT</pubDate></item>' +
        '</channel></rss>',
      )],
      '/intl-sem-brasil.xml': ['application/rss+xml', Buffer.from(
        '<rss><channel><item><title>Chile approves new pension reform plan</title>' +
        '<link>https://intl.exemplo/chile</link><pubDate>Wed, 28 Oct 2026 17:30:00 GMT</pubDate></item></channel></rss>',
      )],
      '/velho.xml': ['application/rss+xml', Buffer.from(
        '<rss><channel><item><title>Notícia esquecida de um feed abandonado</title>' +
        '<link>https://velho.exemplo/1</link><pubDate>Tue, 09 Jul 2019 04:17:00 GMT</pubDate></item></channel></rss>',
      )],
    };
    if (req.url === '/a.xml' && feedAForaDoAr) return res.writeHead(503).end();
    // páginas das matérias, para o modo leitura
    if (req.url === '/materia.html') {
      visitasMateria++;
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fixture('materia.html'));
    }
    if (req.url === '/proibido.html') return res.writeHead(403, { 'content-type': 'text/html' }).end('<p>Acesso negado</p>');
    if (req.url === '/arquivo.pdf') return res.writeHead(200, { 'content-type': 'application/pdf' }).end('%PDF-1.4');
    if (req.url === '/com-materia.xml') {
      const base = `http://127.0.0.1:${servidorFeeds.address().port}`;
      const item = (titulo, caminho) => `<item><title>${titulo}</title><link>${base}${caminho}</link><pubDate>Wed, 28 Oct 2026 11:00:00 GMT</pubDate></item>`;
      return res.writeHead(200, { 'content-type': 'application/rss+xml' }).end(
        `<rss><channel>${item('Matéria completa para o modo leitura', '/materia.html')}` +
        `${item('Matéria de um site que bloqueia leitores', '/proibido.html')}` +
        `${item('Documento oficial publicado em formato PDF', '/arquivo.pdf')}</channel></rss>`,
      );
    }
    const rota = rotas[req.url];
    if (!rota) return res.writeHead(500).end();
    res.writeHead(200, { 'content-type': rota[0] }).end(rota[1]);
  });
  await new Promise((resolve) => servidorFeeds.listen(0, '127.0.0.1', resolve));
  const feeds = `http://127.0.0.1:${servidorFeeds.address().port}`;

  const fontes = [
    { id: 'a', nome: 'Veículo A', categoria: 'veiculo', site: 'https://veiculo-a.exemplo', feed: `${feeds}/a.xml` },
    { id: 'b', nome: 'Veículo B', categoria: 'veiculo', site: 'https://veiculo-b.exemplo', feed: `${feeds}/b.xml` },
    { id: 'oficial', nome: 'Órgão Oficial', categoria: 'oficial', site: 'https://oficial.exemplo', feed: `${feeds}/oficial.atom`, tema: 'politica' },
    { id: 'checador', nome: 'Checador X', categoria: 'checagem', site: 'https://checador.exemplo', feed: `${feeds}/checagem.xml` },
    { id: 'quebrado', nome: 'Fonte Quebrada', categoria: 'veiculo', site: 'https://quebrado.exemplo', feed: `${feeds}/nao-existe.xml` },
    { id: 'html', nome: 'Página Comum', categoria: 'veiculo', site: 'https://html.exemplo', feed: `${feeds}/pagina.html` },
    { id: 'commateria', nome: 'Site com Matérias', categoria: 'veiculo', site: 'https://materias.exemplo', feed: `${feeds}/com-materia.xml` },
    { id: 'velho', nome: 'Feed Abandonado', categoria: 'veiculo', site: 'https://velho.exemplo', feed: `${feeds}/velho.xml` },
    { id: 'intl', nome: 'Jornal Estrangeiro', categoria: 'internacional', idioma: 'en', sobreBrasil: true, site: 'https://intl.exemplo', feed: `${feeds}/intl.xml` },
    { id: 'intlsembrasil', nome: 'Outro Estrangeiro', categoria: 'internacional', idioma: 'en', sobreBrasil: true, site: 'https://intl.exemplo', feed: `${feeds}/intl-sem-brasil.xml` },
  ];
  // As notícias das fixtures são de 28/10/2026: o relógio fica fixo nesse dia.
  app = criarApp({ fontes, timeoutMs: 5000, relogio: () => Date.parse('2026-10-28T18:00:00Z') });
  const porta = await app.iniciar(0);
  base = `http://127.0.0.1:${porta}`;
});

after(async () => {
  await app.parar();
  await new Promise((resolve) => servidorFeeds.close(resolve));
});

test('GET /api/noticias junta as fontes e mostra quais falharam', async () => {
  const resposta = await fetch(`${base}/api/noticias`);
  assert.equal(resposta.status, 200);
  const dados = await resposta.json();

  const status = Object.fromEntries(dados.fontes.map((f) => [f.id, f]));
  assert.equal(status.a.ok, true);
  assert.equal(status.b.ok, true);
  assert.equal(status.oficial.ok, true);
  assert.equal(status.checador.ok, true);
  assert.equal(status.quebrado.ok, false);
  assert.match(status.quebrado.erro, /HTTP 500/);
  assert.equal(status.html.ok, false);
  assert.match(status.html.erro, /nenhuma notícia/);

  assert.equal(status.a.ultimaNoticia, '2026-10-28T15:00:00.000Z');
  assert.equal(status.a.parado, false);
  assert.equal(status.velho.ok, true);
  assert.equal(status.velho.parado, true);

  // "Test Document" (checagem) e a pasta "2023" (oficial) não são notícias
  assert.equal(dados.checagens.length, 3);
  assert.ok(!dados.checagens.some((c) => c.titulo === 'Test Document'));
  assert.ok(!dados.noticias.some((n) => n.titulo === '2023'));
  assert.equal(dados.checagens.find((c) => c.titulo.startsWith('É falso')).veredito, 'falso');
  assert.ok(dados.noticias.every((n) => n.categoria !== 'checagem'));
  assert.equal(dados.noticias.find((n) => n.titulo.startsWith('URGENTE')).alarmista, true);
});

test('imprensa internacional: só o que fala do Brasil, com idioma e tema', async () => {
  const dados = await (await fetch(`${base}/api/noticias`)).json();
  assert.deepEqual(dados.internacional.map((n) => n.link), ['https://intl.exemplo/brazil-amazon']);
  assert.equal(dados.internacional[0].idioma, 'en');
  assert.ok(dados.internacional[0].temas.includes('clima'));
  assert.ok(dados.noticias.every((n) => n.categoria !== 'internacional'));

  // feed que funciona mas não tem nada do Brasil agora não é erro nem fonte parada
  const semBrasil = dados.fontes.find((f) => f.id === 'intlsembrasil');
  assert.equal(semBrasil.ok, true);
  assert.equal(semBrasil.quantidade, 0);
  assert.equal(semBrasil.ultimaNoticia, '2026-10-28T17:30:00.000Z');
  assert.equal(semBrasil.parado, false);
  assert.equal(semBrasil.idioma, 'en');
});

test('cada notícia vem com seus temas e a lista de temas vai junto', async () => {
  const dados = await (await fetch(`${base}/api/noticias`)).json();
  assert.ok(dados.temas.some((t) => t.id === 'politica' && t.nome === 'Política'));
  assert.ok(dados.noticias.every((n) => Array.isArray(n.temas)));
  // fonte com tema fixo (como Senado e Câmara) + "orçamento" no título
  const orcamento = dados.noticias.find((n) => n.titulo.includes('orçamento'));
  assert.deepEqual([...orcamento.temas].sort(), ['economia', 'politica']);
  const inflacao = dados.noticias.find((n) => n.titulo.startsWith('Inflação'));
  assert.deepEqual(inflacao.temas, ['economia']);
  assert.ok(!('tags' in inflacao), 'as categorias do feed não precisam ir para a tela');
});

test('assuntos em vários veículos aparecem com a checagem relacionada', async () => {
  const dados = await (await fetch(`${base}/api/noticias`)).json();
  const pec = dados.assuntos.find((a) => a.titulo.includes('6x1'));
  assert.ok(pec);
  assert.equal(pec.quantidadeFontes, 3);
  assert.equal(pec.temFonteOficial, true);
  assert.equal(pec.checagens[0].titulo, 'É falso que governo voltou atrás na PEC da escala 6x1');
});

test('uma fonte que cai mantém as notícias da última vez que funcionou', async () => {
  feedAForaDoAr = true;
  try {
    await app.atualizar();
    const dados = await (await fetch(`${base}/api/noticias`)).json();
    const a = dados.fontes.find((f) => f.id === 'a');
    assert.equal(a.ok, false);
    assert.match(a.erro, /HTTP 503/);
    assert.ok(a.sucessoEm);
    assert.ok(dados.noticias.some((n) => n.fonteId === 'a'));
  } finally {
    feedAForaDoAr = false;
  }
});

test('POST /api/verificar analisa o texto e acha a checagem', async () => {
  const resposta = await fetch(`${base}/api/verificar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: '🚨 URGENTE!!! VOLTARAM ATRÁS NA 6X1! Compartilhe', autor: 'anonimo' }),
  });
  assert.equal(resposta.status, 200);
  const corpo = await resposta.json();
  assert.equal(corpo.analise.nivel, 'alto');
  assert.equal(corpo.checagens[0].link, 'https://checador.exemplo/falso-voltou-atras-6x1');
  assert.equal(corpo.buscas.length, 4);
});

test('POST /api/verificar recusa pedidos inválidos', async () => {
  const vazio = await fetch(`${base}/api/verificar`, { method: 'POST', body: JSON.stringify({ texto: '  ' }) });
  assert.equal(vazio.status, 400);
  const quebrado = await fetch(`${base}/api/verificar`, { method: 'POST', body: '{nao e json' });
  assert.equal(quebrado.status, 400);
  const grande = await fetch(`${base}/api/verificar`, { method: 'POST', body: JSON.stringify({ texto: 'a'.repeat(30000) }) });
  assert.equal(grande.status, 413);
});

test('serve a interface com cabeçalhos de segurança', async () => {
  const resposta = await fetch(`${base}/`);
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get('content-type'), /text\/html/);
  assert.match(resposta.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await resposta.text(), /Na Fonte/);
  assert.equal((await fetch(`${base}/app.js`)).headers.get('content-type'), 'text/javascript; charset=utf-8');
});

test('não deixa sair da pasta public', async () => {
  for (const caminho of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json', '/%2e%2e%2fsrc%2ffontes.js', '/%E0%A4%A']) {
    const resposta = await fetch(`${base}${caminho}`);
    assert.ok([400, 404].includes(resposta.status), `${caminho} -> ${resposta.status}`);
  }
});

test('modo leitura: devolve só o texto da matéria e guarda no cache', async () => {
  const dados = await (await fetch(`${base}/api/noticias`)).json();
  const item = dados.noticias.find((n) => n.titulo === 'Matéria completa para o modo leitura');
  const ler = () => fetch(`${base}/api/artigo?id=${item.id}`);

  const resposta = await ler();
  assert.equal(resposta.status, 200);
  const artigo = await resposta.json();
  assert.match(artigo.blocos[0].texto, /^O Senado aprovou nesta terça-feira/);
  assert.ok(artigo.blocos.every((b) => !/LEIA TAMBÉM|Siga o canal|Tags:/.test(b.texto)));
  assert.equal(artigo.autor, 'Maria Souza');

  const visitas = visitasMateria;
  assert.equal((await ler()).status, 200);
  assert.equal(visitasMateria, visitas, 'a segunda leitura vem do cache');
});

test('modo leitura: erros viram mensagens claras', async () => {
  const dados = await (await fetch(`${base}/api/noticias`)).json();
  const id = (titulo) => dados.noticias.find((n) => n.titulo === titulo).id;

  const bloqueado = await fetch(`${base}/api/artigo?id=${id('Matéria de um site que bloqueia leitores')}`);
  assert.equal(bloqueado.status, 502);
  assert.match((await bloqueado.json()).erro, /não deixou o app ler/);

  const pdf = await fetch(`${base}/api/artigo?id=${id('Documento oficial publicado em formato PDF')}`);
  assert.equal(pdf.status, 415);
  assert.match((await pdf.json()).erro, /não é uma página de texto/);

  const desconhecido = await fetch(`${base}/api/artigo?id=nao-existe`);
  assert.equal(desconhecido.status, 404);
});

test('modo leitura: só abre links que vieram dos feeds, nunca um endereço qualquer', async () => {
  const resposta = await fetch(`${base}/api/artigo?url=${encodeURIComponent('http://127.0.0.1:1/admin')}`);
  assert.equal(resposta.status, 404);
});
