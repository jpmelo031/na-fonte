import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparAssuntos,
  analisarTexto,
  buscarRelacionados,
  detectarVeredito,
  linksDeBusca,
  manchetePareceAlarmista,
  palavrasChave,
  termosDeBusca,
} from '../src/analise.js';

const AGORA = Date.parse('2026-10-28T18:00:00Z');
let contador = 0;
function item(fonteId, categoria, titulo, horasAtras = 1, resumo = '') {
  contador++;
  return {
    id: `id${contador}`,
    titulo,
    resumo,
    link: `https://${fonteId}.exemplo/${contador}`,
    data: new Date(AGORA - horasAtras * 3600000).toISOString(),
    fonteId,
    fonteNome: fonteId.toUpperCase(),
    categoria,
  };
}

const NOTICIAS = [
  item('a', 'veiculo', 'Senado aprova PEC que acaba com a escala 6x1 em primeiro turno', 1),
  item('b', 'veiculo', 'Escala 6x1: Senado aprova PEC em votação no plenário', 2),
  item('senado', 'oficial', 'PEC da escala 6x1 é aprovada no Senado e vai ao segundo turno', 3),
  item('a', 'veiculo', 'Inflação de outubro fica em 0,3%, diz IBGE', 4),
  item('c', 'veiculo', 'IPCA: inflação de outubro desacelera para 0,3%, aponta IBGE', 5),
  item('b', 'veiculo', 'Seleção convoca jogadores para amistosos de novembro', 2),
  item('c', 'veiculo', 'Senado aprova indicação de novo embaixador na Argentina', 2),
  item('d', 'veiculo', 'Notícia antiga sobre a escala 6x1 no Senado', 80),
];

const CHECAGENS = [
  item('checador', 'checagem', 'É falso que governo voltou atrás na PEC da escala 6x1', 3,
    'Vídeo que circula nas redes diz que a proposta foi cancelada; tramitação segue normalmente no Senado.'),
  item('checador', 'checagem', 'Foto de enchente no Sul está fora de contexto', 20),
  item('checador', 'checagem', 'É verdade que vacina da gripe está disponível para todas as idades', 30),
];

test('palavrasChave ignora palavras vazias e junta variações', () => {
  const p = palavrasChave('A PEC foi aprovada e os senadores aprovaram');
  assert.ok(p.has('pec'));
  assert.ok(p.has('aprov'));
  assert.ok(!p.has('foi'));
  assert.deepEqual(palavrasChave('6x1'), new Set(['6x1']));
});

test('agrupa a mesma notícia de fontes diferentes e prioriza o título oficial', () => {
  const assuntos = agruparAssuntos(NOTICIAS, { agora: AGORA });
  assert.equal(assuntos.length, 2);

  const [pec, inflacao] = assuntos;
  assert.equal(pec.quantidadeFontes, 3);
  assert.equal(pec.temFonteOficial, true);
  assert.equal(pec.titulo, 'PEC da escala 6x1 é aprovada no Senado e vai ao segundo turno');
  assert.deepEqual(pec.itens.map((i) => i.fonteId).sort(), ['a', 'b', 'senado']);

  assert.equal(inflacao.quantidadeFontes, 2);
  assert.equal(inflacao.temFonteOficial, false);
});

test('não junta assuntos diferentes só porque compartilham uma palavra', () => {
  const assuntos = agruparAssuntos(NOTICIAS, { agora: AGORA });
  const titulos = assuntos.flatMap((a) => a.itens.map((i) => i.titulo));
  assert.ok(!titulos.includes('Senado aprova indicação de novo embaixador na Argentina'));
  assert.ok(!titulos.includes('Notícia antiga sobre a escala 6x1 no Senado'), 'fora da janela de 48h');
});

test('a mesma fonte repetida não conta como confirmação', () => {
  const repetidas = [
    item('a', 'veiculo', 'Governo anuncia novo programa de habitação popular', 1),
    item('a', 'veiculo', 'Novo programa de habitação popular é anunciado pelo governo', 2),
  ];
  assert.equal(agruparAssuntos(repetidas, { agora: AGORA }).length, 0);
});

test('encontra a checagem de um boato colado pelo usuário', () => {
  const texto = '🚨 URGENTE!!! VOLTARAM ATRÁS NA 6X1! A PEC foi cancelada, compartilhe antes que apaguem';
  const achados = buscarRelacionados(texto, CHECAGENS);
  assert.equal(achados[0].titulo, 'É falso que governo voltou atrás na PEC da escala 6x1');
  assert.ok(achados.every((a) => !a.titulo.includes('enchente')));
});

test('acha a checagem mesmo quando o boato usa outras palavras ("voltaram" x "voltou")', () => {
  const achados = buscarRelacionados('🚨 URGENTE!!! VOLTARAM ATRÁS NA 6X1! A mídia não mostra. Compartilhe antes que apaguem', CHECAGENS);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].titulo, 'É falso que governo voltou atrás na PEC da escala 6x1');
});

test('acha notícias sobre o assunto sem trazer as que só citam o Senado', () => {
  const achados = buscarRelacionados('o senado aprovou mesmo a pec da 6x1?', NOTICIAS);
  const titulos = achados.map((a) => a.titulo);
  assert.ok(titulos.includes('PEC da escala 6x1 é aprovada no Senado e vai ao segundo turno'));
  assert.ok(!titulos.includes('Senado aprova indicação de novo embaixador na Argentina'));
  assert.ok(!titulos.some((t) => t.includes('Inflação')));
});

test('transcrição longa de vídeo ainda acha a checagem certa', () => {
  const transcricao =
    'Pessoal, olha só, o governo voltou atrás na escala 6x1. A PEC que ia acabar com a escala foi cancelada ontem à noite, ' +
    'isso é um absurdo, os trabalhadores vão continuar trabalhando seis dias por semana e ninguém está falando disso.';
  const achados = buscarRelacionados(transcricao, CHECAGENS);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].titulo, 'É falso que governo voltou atrás na PEC da escala 6x1');
});

test('texto longo sem relação não traz checagens', () => {
  const texto =
    'O campeonato brasileiro entra na reta final com três times brigando pelo título. O líder joga fora de casa no domingo, ' +
    'enquanto o segundo colocado recebe o rival em um clássico com estádio lotado e ingressos esgotados há uma semana.';
  assert.deepEqual(buscarRelacionados(texto, [...CHECAGENS, ...NOTICIAS]), []);
});

test('não inventa relação quando não há assunto em comum', () => {
  assert.deepEqual(buscarRelacionados('Receita de bolo de cenoura com cobertura', CHECAGENS), []);
  assert.deepEqual(buscarRelacionados('   ', CHECAGENS), []);
});

test('detecta o veredito no título da checagem', () => {
  assert.equal(detectarVeredito('É falso que governo voltou atrás na PEC'), 'falso');
  assert.equal(detectarVeredito('Foto de enchente no Sul está fora de contexto'), 'enganoso');
  assert.equal(detectarVeredito('É verdade que vacina está disponível'), 'verdadeiro');
  assert.equal(detectarVeredito('Entenda a tramitação da PEC'), null);
});

test('texto típico de boato tem nível alto', () => {
  const r = analisarTexto('🚨 URGENTE!!! VOLTARAM ATRÁS NA 6X1! A mídia não mostra. Compartilhe antes que apaguem', { autor: 'anonimo' });
  assert.equal(r.nivel, 'alto');
  const tipos = r.alertas.map((a) => a.tipo);
  for (const tipo of ['alarmismo', 'caixa-alta', 'pontuacao', 'emoji', 'compartilhe', 'conspiracao', 'autor', 'sem-fonte']) {
    assert.ok(tipos.includes(tipo), `deveria ter alerta de ${tipo}`);
  }
});

test('texto com fonte concreta tem nível baixo', () => {
  const r = analisarTexto(
    'O Senado aprovou em 28 de outubro a PEC 8/2025, que reduz a jornada de trabalho, segundo a Agência Senado. A proposta ainda precisa passar pela Câmara.',
    { autor: 'veiculo' },
  );
  assert.equal(r.nivel, 'baixo');
  assert.deepEqual(r.alertas, []);
  const tipos = r.confianca.map((c) => c.tipo);
  for (const tipo of ['norma', 'data', 'instituicao', 'atribuicao', 'autor']) assert.ok(tipos.includes(tipo), tipo);
});

test('siglas em maiúsculas não contam como gritaria', () => {
  const r = analisarTexto('STF julga ação do INSS sobre FGTS, informou o tribunal');
  assert.ok(!r.alertas.some((a) => a.tipo === 'caixa-alta'));
});

test('manchete sensacionalista é marcada, manchete normal não', () => {
  assert.equal(manchetePareceAlarmista('URGENTE!!! BOMBA no Congresso'), true);
  assert.equal(manchetePareceAlarmista('Senado aprova PEC que acaba com a escala 6x1 em primeiro turno'), false);
  assert.equal(manchetePareceAlarmista('VÍDEO: veja como foi a votação no Senado'), false);
});

test('termos de busca tiram o alarmismo de textos longos', () => {
  const longo = '🚨 URGENTE!!! Atenção pessoal, voltaram atrás na escala 6x1, o Senado cancelou a votação da PEC e ninguém está falando sobre isso, compartilhe';
  const termos = termosDeBusca(longo);
  assert.ok(!/urgente|atencao|atenção/i.test(termos), termos);
  assert.match(termos, /6x1/);
  assert.equal(termosDeBusca('PEC 6x1 voltou atrás?'), 'PEC 6x1 voltou atrás?');
});

test('links de busca apontam para buscadores conhecidos', () => {
  const links = linksDeBusca('PEC 6x1 voltou atrás?');
  assert.equal(links.length, 4);
  for (const { url } of links) assert.match(url, /^https:\/\/(www\.google\.com|toolbox\.google\.com|news\.google\.com)\//);
  assert.match(decodeURIComponent(links[0].url), /site:aosfatos\.org/);
  assert.deepEqual(linksDeBusca(''), []);
});
