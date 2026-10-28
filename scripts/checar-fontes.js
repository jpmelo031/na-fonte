// Testa todos os feeds de src/fontes.js e mostra quais estão funcionando.
// Uso: npm run checar-fontes
import { baixarTodas } from '../src/feeds.js';
import { FONTES } from '../src/fontes.js';

console.log(`Testando ${FONTES.length} fontes...\n`);
const { status, porFonte } = await baixarTodas(FONTES);

for (const s of status) {
  const fonte = FONTES.find((f) => f.id === s.id);
  if (s.ok) {
    const recente = porFonte[s.id].itens[0];
    console.log(`  OK    ${fonte.nome} (${s.quantidade} notícias)`);
    console.log(`        mais recente: ${recente.titulo}`);
  } else {
    console.log(`  ERRO  ${fonte.nome}: ${s.erro}`);
    console.log(`        feed: ${fonte.feed}`);
  }
}

const comErro = status.filter((s) => !s.ok).length;
console.log(`\n${status.length - comErro} de ${status.length} fontes funcionando.`);
if (comErro) {
  console.log('Para corrigir: abra o site da fonte, procure o link "RSS" e troque o endereço em src/fontes.js.');
  process.exitCode = 1;
}
