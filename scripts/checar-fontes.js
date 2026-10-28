// Testa os feeds e mostra quais estão funcionando.
// Uso:
//   npm run checar-fontes                      testa todas as fontes de src/fontes.js
//   npm run checar-fontes -- senado            mostra todas as notícias de uma fonte (pelo id)
//   npm run checar-fontes -- https://... ...   testa endereços novos antes de colocar em src/fontes.js
import { baixarTodas, DIAS_PARADO } from '../src/feeds.js';
import { FONTES } from '../src/fontes.js';

const argumentos = process.argv.slice(2);
const urls = argumentos.filter((a) => /^https?:\/\//i.test(a));
const idEscolhido = urls.length ? null : argumentos[0];

let fontes = FONTES;
if (urls.length) fontes = urls.map((feed, i) => ({ id: `endereco${i + 1}`, nome: feed, categoria: 'teste', site: feed, feed }));
else if (idEscolhido) fontes = FONTES.filter((f) => f.id === idEscolhido);

if (fontes.length === 0) {
  console.log(`Não existe fonte com id "${idEscolhido}". Ids disponíveis:\n  ${FONTES.map((f) => f.id).join(', ')}`);
  process.exit(1);
}

function formatarData(iso) {
  if (!iso) return 'sem data';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

console.log(`Testando ${fontes.length === 1 ? fontes[0].nome : `${fontes.length} ${urls.length ? 'endereços' : 'fontes'}`}...\n`);
const { status, porFonte } = await baixarTodas(fontes);
let avisos = 0;

for (const s of status) {
  const fonte = fontes.find((f) => f.id === s.id);
  if (!s.ok) {
    console.log(`  ERRO  ${fonte.nome}: ${s.erro}`);
    if (!urls.length) console.log(`        feed: ${fonte.feed}`);
    continue;
  }

  const itens = porFonte[s.id].itens;
  const id = urls.length ? '' : `  [id: ${fonte.id}]`;
  console.log(`  OK    ${fonte.nome} (${s.quantidade} ${s.quantidade === 1 ? 'notícia' : 'notícias'})${id}`);
  console.log(`        mais recente: ${itens[0].titulo} (${formatarData(itens[0].data)})`);

  if (!s.ultimaNoticia) {
    avisos++;
    console.log('        AVISO: as notícias não têm data, então não dá para saber se o feed está atualizado');
  } else if (s.parado) {
    avisos++;
    const dias = Math.floor((Date.now() - Date.parse(s.ultimaNoticia)) / 86400000);
    console.log(`        AVISO: a notícia mais nova é de ${dias} dias atrás (limite: ${DIAS_PARADO}); o feed pode estar parado`);
  }

  // endereço novo: mostra uma amostra; fonte escolhida pelo id: mostra tudo
  const lista = idEscolhido ? itens : urls.length ? itens.slice(1, 4) : [];
  if (lista.length) {
    if (idEscolhido) console.log('\n  Todas as notícias desta fonte:');
    for (const item of lista) console.log(`        ${formatarData(item.data).padEnd(17)} ${item.titulo}`);
  }
  if (urls.length) console.log('');
}

const comErro = status.filter((s) => !s.ok).length;
const nome = urls.length ? 'endereços' : 'fontes';
console.log(`\n${status.length - comErro} de ${status.length} ${nome} funcionando${avisos ? `, ${avisos} com aviso` : ''}.`);
if (!urls.length && (comErro || avisos)) {
  console.log('Para corrigir: abra o site da fonte, procure o link "RSS" e troque o endereço em src/fontes.js.');
  if (!idEscolhido) console.log('Para ver tudo o que uma fonte trouxe: npm run checar-fontes -- <id>');
}
if (comErro && !urls.length) process.exitCode = 1;
