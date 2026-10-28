import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodificarBytes, interpretarData, interpretarFeed, textoPuro } from '../src/xml.js';

const fixture = (nome) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url));

test('lê RSS 2.0 com CDATA e HTML escapado na descrição', () => {
  const itens = interpretarFeed(fixture('rss-veiculo-a.xml').toString('utf8'), 'https://veiculo-a.exemplo/feed');
  assert.equal(itens[0].titulo, 'Senado aprova PEC que acaba com a escala 6x1 em primeiro turno');
  assert.equal(itens[0].link, 'https://veiculo-a.exemplo/politica/pec-6x1');
  assert.equal(itens[0].resumo, 'Texto segue agora para o segundo turno de votação.');
  assert.equal(itens[0].data, '2026-10-28T15:00:00.000Z');
  assert.equal(itens[1].resumo, 'Índice veio abaixo do esperado pelo mercado & analistas.');
});

test('descarta itens com link que não é http(s)', () => {
  const itens = interpretarFeed(fixture('rss-veiculo-a.xml').toString('utf8'));
  assert.equal(itens.length, 3);
  assert.ok(itens.every((i) => i.link.startsWith('https://')));
});

test('lê Atom, entidades e links relativos', () => {
  const itens = interpretarFeed(fixture('atom-oficial.xml').toString('utf8'), 'https://oficial.exemplo/feed.atom');
  assert.equal(itens[0].titulo, 'PEC da escala 6x1 é aprovada no Senado e vai ao segundo turno');
  assert.equal(itens[0].link, 'https://oficial.exemplo/noticias/pec-6x1-aprovada');
  assert.equal(itens[0].resumo, 'Proposta reduz a jornada máxima de trabalho.');
  assert.equal(itens[1].link, 'https://oficial.exemplo/noticias/orcamento-2027');
});

test('decodifica ISO-8859-1 e datas em português', () => {
  const xml = decodificarBytes(new Uint8Array(fixture('rss-latin1.xml')), 'text/xml');
  const itens = interpretarFeed(xml);
  assert.equal(itens[0].titulo, 'Escala 6x1: Senado aprova PEC em votação no plenário');
  assert.equal(itens[0].data, '2026-10-28T16:45:00.000Z');
});

test('charset do cabeçalho HTTP tem prioridade', () => {
  const bytes = new Uint8Array(Buffer.from('<rss><item><title>Notícia</title></item></rss>', 'latin1'));
  assert.match(decodificarBytes(bytes, 'application/rss+xml; charset=ISO-8859-1'), /Notícia/);
});

test('interpretarData lida com formatos variados', () => {
  assert.equal(interpretarData('2026-10-28T10:00:00-03:00'), '2026-10-28T13:00:00.000Z');
  assert.equal(interpretarData('Ter, 27 Out 2026 08:00:00 -0300'), '2026-10-27T11:00:00.000Z');
  assert.equal(interpretarData('28 dez 2026 08:00:00 GMT'), '2026-12-28T08:00:00.000Z');
  assert.equal(interpretarData('ontem'), null);
  assert.equal(interpretarData(''), null);
});

test('textoPuro remove scripts e normaliza espaços', () => {
  assert.equal(textoPuro('<p>Oi<script>alert(1)</script>  <b>mundo</b></p>'), 'Oi mundo');
  assert.equal(textoPuro('&#x1F6A8; &quot;aspas&quot;'), '🚨 "aspas"');
});
