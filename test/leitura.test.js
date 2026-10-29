import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroLeitura, extrairArtigo, filtrarBlocos } from '../src/leitura.js';
import { decodificarBytes } from '../src/xml.js';

const fixture = (nome) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8');

test('fica só o texto da matéria: sem menu, anúncio, "leia também", relacionadas, tags', () => {
  const artigo = extrairArtigo(fixture('materia.html'), {
    url: 'https://jornal.exemplo/politica/pec.html',
    titulo: 'Senado aprova PEC da escala 6x1 em primeiro turno',
  });
  assert.deepEqual(artigo.blocos, [
    { tipo: 'p', texto: 'O Senado aprovou nesta terça-feira, em primeiro turno, a proposta de emenda à Constituição que reduz a jornada máxima de trabalho no país. Foram 61 votos a favor e 10 contra, em uma sessão que durou mais de seis horas.' },
    { tipo: 'p', texto: 'A proposta ainda precisa passar por um segundo turno de votação antes de seguir para a Câmara dos Deputados, onde deve enfrentar resistência de parte da bancada empresarial.' },
    { tipo: 'subtitulo', texto: 'O que diz o texto' },
    { tipo: 'p', texto: 'O texto prevê uma transição de dois anos para que as empresas se adaptem. Durante esse período, a jornada cairia gradualmente de 44 para 40 horas semanais, sem redução de salário.' },
    { tipo: 'item', texto: 'Jornada máxima: de 44 para 40 horas semanais' },
    { tipo: 'item', texto: 'Transição: dois anos a partir da promulgação' },
    { tipo: 'citacao', texto: 'É uma conquista histórica para quem trabalha seis dias por semana e descansa só um.' },
    { tipo: 'p', texto: 'Segundo o relator, a mudança deve beneficiar cerca de 30 milhões de trabalhadores que hoje cumprem seis dias de trabalho para um de descanso.' },
    { tipo: 'p', texto: 'Vídeo que circula nas redes sociais mostra o momento da votação no plenário.' },
  ]);
  assert.equal(artigo.titulo, 'Senado aprova PEC da escala 6x1 em primeiro turno');
  assert.equal(artigo.autor, 'Maria Souza');
  assert.equal(artigo.site, 'Jornal Exemplo');
  assert.equal(artigo.publicadoEm, '2026-10-28T12:00:00-03:00');
  assert.equal(artigo.paraAssinantes, false);
  assert.equal(artigo.possivelmenteIncompleto, false);
});

test('usa o texto do JSON-LD quando a página monta a matéria com JavaScript', () => {
  const artigo = extrairArtigo(fixture('materia-jsonld.html'), { url: 'https://www.portal.exemplo/n/1' });
  assert.deepEqual(artigo.blocos.map((b) => b.texto), [
    'A Defesa Civil emitiu alerta para três cidades do litoral depois de uma madrugada de chuva forte.',
    'Em algumas regiões choveu em 12 horas o esperado para o mês inteiro, segundo os meteorologistas.',
    'Os moradores de áreas de risco devem procurar abrigos municipais caso a chuva continue nas próximas horas.',
  ]);
  assert.equal(artigo.autor, 'Ana Lima');
  assert.equal(artigo.publicadoEm, '2026-10-28T09:00:00-03:00');
  assert.equal(artigo.site, 'portal.exemplo');
});

test('matéria para assinantes: mostra só o que a página exibe e avisa', () => {
  const artigo = extrairArtigo(fixture('materia-assinantes.html'), { titulo: 'Os bastidores da negociação do orçamento' });
  assert.equal(artigo.paraAssinantes, true);
  assert.equal(artigo.possivelmenteIncompleto, true);
  const texto = artigo.blocos.map((b) => b.texto).join(' ');
  assert.match(texto, /^Durante três semanas/);
  assert.doesNotMatch(texto, /só assinantes podem ler/, 'não usa o texto escondido no JSON-LD');
  assert.doesNotMatch(texto, /continuar lendo/i);
});

test('página sem texto de matéria vira um erro explicado', () => {
  assert.throws(() => extrairArtigo(fixture('pagina-video.html')), (erro) => erro instanceof ErroLeitura && erro.status === 422);
});

test('página em ISO-8859-1 com <meta charset>', () => {
  const html = fixture('materia.html').replace('<meta charset="utf-8">', '<meta charset="iso-8859-1">');
  const bytes = new Uint8Array(Buffer.from(html, 'latin1'));
  const artigo = extrairArtigo(decodificarBytes(bytes, 'text/html'), {});
  assert.match(artigo.blocos[0].texto, /terça-feira/);
});

test('o filtro não apaga parágrafos de verdade parecidos com lixo', () => {
  const blocos = [
    'Vídeo que circula nas redes mostra o ministro discursando.',
    'A mensagem circulou no WhatsApp',
    'Publicada em 2020, a lei previa uma regra de transição.',
    'Por causa da chuva, a votação foi adiada.',
    'Veja como cada senador votou na lista abaixo.',
  ].map((texto) => ({ tipo: 'p', texto, densidadeLinks: 0 }));
  assert.equal(filtrarBlocos(blocos).length, blocos.length);
});

test('o filtro tira chamadas, créditos e linhas de autoria', () => {
  const lixo = [
    'LEIA MAIS: Câmara aprova outro projeto',
    'Siga o g1 no Instagram',
    'Assine a newsletter e receba as notícias',
    'Foto: Reprodução/Redes sociais',
    'Continua após a publicidade',
    'Por Maria Souza',
    'Entre no canal do Jornal no WhatsApp e receba as notícias',
    'Atualizado em 28/10/2026 13h',
    'Read more: Brazil votes on labour reform',
    'Uma publicação compartilhada por Fulano (@fulano)',
  ].map((texto) => ({ tipo: 'p', texto, densidadeLinks: 0 }));
  assert.deepEqual(filtrarBlocos(lixo), []);
  assert.deepEqual(filtrarBlocos([{ tipo: 'p', texto: 'Notícia relacionada qualquer', densidadeLinks: 1 }]), []);
});
