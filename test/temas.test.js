import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarTemas, falaDoBrasil } from '../src/temas.js';

const temas = (titulo, extra = {}, fonte) => classificarTemas({ titulo, link: 'https://exemplo.org/noticia/1', ...extra }, fonte);

test('classifica manchetes reais pelo título', () => {
  // manchetes que apareceram nos feeds em 28/10/2026
  assert.deepEqual(temas('Governo abre crédito de R$ 5,16 bilhões, sendo 91,5% para BPC'), ['economia']);
  assert.deepEqual(temas('Vereador do PT é preso pela segunda vez por gestão financeira de empresa de ônibus ligada ao PCC').sort(), ['politica', 'seguranca']);
  assert.ok(temas('Justiça nega novo habeas corpus e mantém prisão de Deolane Bezerra por suspeita de participação em esquema do PCC').includes('seguranca'));
  assert.deepEqual(temas('Argentina diz que Flávio Bolsonaro entrou no país na noite da terça-feira').sort(), ['mundo', 'politica']);
  assert.deepEqual(temas('É falso que cidades registraram mais votos para Lula que habitantes'), ['politica']);
  assert.deepEqual(temas('Notícia sobre bloqueio de R$ 6 bilhões na Saúde e Educação é de julho de 2024').sort(), ['educacao', 'saude']);
});

test('classifica os outros temas', () => {
  assert.deepEqual(temas('Chuvas fortes atingem o litoral de São Paulo e Defesa Civil emite alerta'), ['clima']);
  assert.deepEqual(temas('Governo lança plano nacional de inteligência artificial'), ['tecnologia']);
  assert.deepEqual(temas('Casos de dengue sobem 30% e hospitais ampliam atendimento'), ['saude']);
  assert.deepEqual(temas('Enem 2026: veja o que cai nas provas deste domingo'), ['educacao']);
  assert.deepEqual(temas('Flamengo vence o Palmeiras e assume a liderança do Brasileirão'), ['esportes']);
  assert.deepEqual(temas('Festival de cinema de Gramado anuncia filmes da competição'), ['cultura']);
  assert.deepEqual(temas('Trump anuncia novas tarifas contra produtos da China').sort(), ['economia', 'mundo']);
});

test('reconhece países e não confunde medição com saúde', () => {
  assert.deepEqual(temas('Houthis pedem retirada imediata do aeroporto de Áden enquanto combates se intensificam no Iêmen'), ['mundo']);
  assert.deepEqual(temas('Pelo menos 30 pessoas morrem na Espanha após colisão entre dois trens'), ['mundo']);
  assert.ok(!temas('Medição da qualidade do ar aponta piora em São Paulo').includes('saude'));
});

test('palavras curtas só valem inteiras', () => {
  assert.ok(!temas('Pecuária bate recorde de exportação de carne').includes('politica'), 'pec != pecuária');
  assert.ok(!temas('Suspeito de golpe é identificado pela câmera').includes('saude'), 'sus != suspeito');
  assert.ok(!temas('Mecânico encontra peça rara em ferro-velho').includes('educacao'), 'mec != mecânico');
});

test('manchete sem tema claro fica sem tema', () => {
  assert.deepEqual(temas('Moradores reclamam de buraco na rua principal do bairro'), []);
});

test('seção do endereço, categorias do feed e tema da fonte também contam', () => {
  const neutra = 'Moradores reclamam de buraco na rua principal do bairro';
  assert.deepEqual(temas(neutra, { link: 'https://g1.globo.com/economia/noticia/2026/10/28/x.ghtml' }), ['economia']);
  assert.deepEqual(temas(neutra, { link: 'https://economia.uol.com.br/noticias/2026/10/28/x.htm' }), ['economia']);
  assert.deepEqual(temas(neutra, { link: 'https://www.poder360.com.br/poder-congresso/x/' }), ['politica']);
  assert.deepEqual(temas(neutra, { tags: ['Meio Ambiente'] }), ['clima']);
  assert.deepEqual(temas(neutra, { tags: ['Saúde'] }), ['saude']);
  assert.deepEqual(temas('Projeto deixa explícito que imprudência do segurado não impede pagamento de seguro', {}, { tema: 'politica' }), ['politica']);
});

test('uma palavra só no resumo não basta, duas bastam', () => {
  assert.deepEqual(temas('Moradores reclamam de buraco na rua', { resumo: 'A prefeitura promete obra.' }), []);
  assert.deepEqual(temas('Moradores reclamam de buraco na rua', { resumo: 'Prefeitura e vereadores prometem obra.' }), ['politica']);
});

test('entende manchetes em inglês e espanhol', () => {
  assert.deepEqual(temas("Brazil's Lula vows to end deforestation in the Amazon rainforest").sort(), ['clima', 'politica']);
  assert.deepEqual(temas('Brazil police kill dozens in Rio gang raid'), ['seguranca']);
  assert.deepEqual(temas('Brasil sube los aranceles y crece la inflación'), ['economia']);
});

test('falaDoBrasil reconhece o Brasil em várias línguas', () => {
  assert.equal(falaDoBrasil('Brazilian court rules on election'), true);
  assert.equal(falaDoBrasil('Le Brésil face à la sécheresse'), true);
  assert.equal(falaDoBrasil('Lula meets Xi in Beijing'), true);
  assert.equal(falaDoBrasil('Incêndios na Amazônia batem recorde'), true);
  assert.equal(falaDoBrasil('Mexico elects new president'), false);
  assert.equal(falaDoBrasil('Amazon announces new data centers'), false);
});
