import { criarApp } from './src/app.js';
import { FONTES } from './src/fontes.js';

const porta = Number(process.env.PORT) || 3000;
const app = criarApp({ fontes: FONTES, intervaloMinutos: Number(process.env.INTERVALO_MINUTOS) || 15 });

app.iniciar(porta).then((p) => {
  console.log(`Na Fonte rodando em http://localhost:${p}`);
  console.log('No celular (mesmo Wi-Fi): use o IP deste computador no lugar de "localhost".');
});
