import { watchFile } from 'node:fs';
import { join } from 'node:path';
import { criarApp } from './src/app.js';
import { FONTES } from './src/fontes.js';
import { carregarTls } from './src/https.js';

const porta = Number(process.env.PORT) || 3000;
// HTTPS_DIR: pasta com servidor.key, servidor.crt e ca.crt (no celular do The Far Fire, ~/https).
const pastaHttps = process.env.HTTPS_DIR;
const tls = pastaHttps ? carregarTls(pastaHttps) : null;
const app = criarApp({ fontes: FONTES, intervaloMinutos: Number(process.env.INTERVALO_MINUTOS) || 15, tls });

app.iniciar(porta).then((p) => {
  console.log(`Na Fonte rodando em ${tls ? 'https' : 'http'}://localhost:${p}`);
  console.log('No celular (mesmo Wi-Fi): use o IP deste computador no lugar de "localhost".');
});

if (tls) {
  // Certificado renovado: passa a usar o novo sem reiniciar.
  watchFile(join(pastaHttps, 'servidor.crt'), { interval: 60 * 60 * 1000 }, () => {
    const novo = carregarTls(pastaHttps);
    if (novo) app.servidor.recarregarTls(novo);
    console.log('Certificado HTTPS recarregado.');
  }).unref();
}
