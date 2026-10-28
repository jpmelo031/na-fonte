// Testa os feeds de src/fontes.js e mostra quais estão funcionando.
// Uso:
//   npm run checar-fontes            testa todas as fontes
//   npm run checar-fontes -- senado  mostra todas as notícias de uma fonte (pelo id)
import { baixarTodas } from '../src/feeds.js';
import { FONTES } from '../src/fontes.js';

const DIAS_PARA_AVISO = 7;
const idEscolhido = process.argv[2];
const fontes = idEscolhido ? FONTES.filter((f) => f.id === idEscolhido) : FONTES;

if (fontes.length === 0) {
  console.log(`Não existe fonte com id "${idEscolhido}". Ids disponíveis:\n  ${FONTES.map((f) => f.id).join(', ')}`);
  process.exit(1);
}

function formatarData(iso) {
  if (!iso) return 'sem data';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

console.log(`Testando ${fontes.length === 1 ? fontes[0].nome : `${fontes.length} fontes`}...\n`);
const { status, porFonte } = await baixarTodas(fontes);
let avisos = 0;

for (const s of status) {
  const fonte = fontes.find((f) => f.id === s.id);
  if (!s.ok) {
    console.log(`  ERRO  ${fonte.nome}: ${s.erro}`);
    console.log(`        feed: ${fonte.feed}`);
    continue;
  }

  const itens = porFonte[s.id].itens;
  const recente = itens[0];
  console.log(`  OK    ${fonte.nome} (${s.quantidade} ${s.quantidade === 1 ? 'notícia' : 'notícias'})  [id: ${fonte.id}]`);
  console.log(`        mais recente: ${recente.titulo} (${formatarData(recente.data)})`);

  const dias = recente.data ? Math.floor((Date.now() - Date.parse(recente.data)) / 86400000) : null;
  if (dias === null) {
    avisos++;
    console.log('        AVISO: as notícias não têm data, então não dá para saber se o feed está atualizado');
  } else if (dias > DIAS_PARA_AVISO) {
    avisos++;
    console.log(`        AVISO: a notícia mais nova é de ${dias} dias atrás; o feed pode estar parado`);
  }

  if (idEscolhido) {
    console.log('\n  Todas as notícias desta fonte:');
    for (const item of itens) console.log(`    ${formatarData(item.data).padEnd(17)} ${item.titulo}`);
  }
}

const comErro = status.filter((s) => !s.ok).length;
console.log(`\n${status.length - comErro} de ${status.length} fontes funcionando${avisos ? `, ${avisos} com aviso` : ''}.`);
if (comErro || avisos) {
  console.log('Para corrigir: abra o site da fonte, procure o link "RSS" e troque o endereço em src/fontes.js.');
  if (!idEscolhido) console.log('Para ver tudo o que uma fonte trouxe: npm run checar-fontes -- <id>');
}
if (comErro) process.exitCode = 1;
