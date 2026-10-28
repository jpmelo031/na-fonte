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

before(async () => {
  // Servidor local que faz o papel dos sites de notícia.
  servidorFeeds = createServer((req, res) => {
    const rotas = {
      '/a.xml': ['application/rss+xml; charset=utf-8', fixture('rss-veiculo-a.xml')],
      '/b.xml': ['text/xml', fixture('rss-latin1.xml')],
      '/oficial.atom': ['application/atom+xml', fixture('atom-oficial.xml')],
      '/checagem.xml': ['application/rss+xml', fixture('rss-checagem.xml')],
      '/pagina.html': ['text/html', Buffer.from('<html><body>Não é um feed</body></html>')],
    };
    if (req.url === '/a.xml' && feedAForaDoAr) return res.writeHead(503).end();
    const rota = rotas[req.url];
    if (!rota) return res.writeHead(500).end();
    res.writeHead(200, { 'content-type': rota[0] }).end(rota[1]);
  });
  await new Promise((resolve) => servidorFeeds.listen(0, '127.0.0.1', resolve));
  const feeds = `http://127.0.0.1:${servidorFeeds.address().port}`;

  const fontes = [
    { id: 'a', nome: 'Veículo A', categoria: 'veiculo', site: 'https://veiculo-a.exemplo', feed: `${feeds}/a.xml` },
    { id: 'b', nome: 'Veículo B', categoria: 'veiculo', site: 'https://veiculo-b.exemplo', feed: `${feeds}/b.xml` },
    { id: 'oficial', nome: 'Órgão Oficial', categoria: 'oficial', site: 'https://oficial.exemplo', feed: `${feeds}/oficial.atom` },
    { id: 'checador', nome: 'Checador X', categoria: 'checagem', site: 'https://checador.exemplo', feed: `${feeds}/checagem.xml` },
    { id: 'quebrado', nome: 'Fonte Quebrada', categoria: 'veiculo', site: 'https://quebrado.exemplo', feed: `${feeds}/nao-existe.xml` },
    { id: 'html', nome: 'Página Comum', categoria: 'veiculo', site: 'https://html.exemplo', feed: `${feeds}/pagina.html` },
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

  // "Test Document" (checagem) e a pasta "2023" (oficial) não são notícias
  assert.equal(dados.checagens.length, 3);
  assert.ok(!dados.checagens.some((c) => c.titulo === 'Test Document'));
  assert.ok(!dados.noticias.some((n) => n.titulo === '2023'));
  assert.equal(dados.checagens.find((c) => c.titulo.startsWith('É falso')).veredito, 'falso');
  assert.ok(dados.noticias.every((n) => n.categoria !== 'checagem'));
  assert.equal(dados.noticias.find((n) => n.titulo.startsWith('URGENTE')).alarmista, true);
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
