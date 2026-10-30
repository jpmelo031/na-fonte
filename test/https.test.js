import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { get as getHttp } from 'node:http';
import { get as getHttps } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { criarApp } from '../src/app.js';
import { carregarTls } from '../src/https.js';

let temOpenssl = true;
try {
  execFileSync('openssl', ['version'], { stdio: 'ignore' });
} catch {
  temOpenssl = false;
}

let pasta;
let tls;
let app;
let porta;

/** Um certificado raiz e um do servidor para 127.0.0.1, como o termux/https.sh do Minhas Finanças faz. */
function gerarCertificados(dir) {
  const openssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'ignore' });
  openssl('req', '-x509', '-new', '-nodes', '-newkey', 'rsa:2048', '-days', '30', '-keyout', 'ca.key', '-out', 'ca.crt',
    '-subj', '/CN=Teste CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign');
  writeFileSync(join(dir, 'ext'), 'basicConstraints=CA:FALSE\nsubjectAltName=IP:127.0.0.1\n');
  openssl('req', '-new', '-nodes', '-newkey', 'rsa:2048', '-keyout', 'servidor.key', '-out', 'servidor.csr', '-subj', '/CN=127.0.0.1');
  openssl('x509', '-req', '-in', 'servidor.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '30',
    '-extfile', 'ext', '-out', 'servidor.crt');
}

const pedir = (get, url, opcoes = {}) =>
  new Promise((resolve, reject) => {
    get(url, { agent: false, ...opcoes }, (res) => {
      let corpo = '';
      res.on('data', (c) => (corpo += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo }));
    }).on('error', reject);
  });

before(async () => {
  if (!temOpenssl) return;
  pasta = mkdtempSync(join(tmpdir(), 'na-fonte-https-'));
  gerarCertificados(pasta);
  tls = carregarTls(pasta);
  app = criarApp({ fontes: [], tls });
  porta = await app.iniciar(0);
});

after(async () => {
  if (!temOpenssl) return;
  await app.parar();
  rmSync(pasta, { recursive: true, force: true });
});

test('sem certificado na pasta, fica só no http', () => {
  assert.equal(carregarTls(join(tmpdir(), 'nao-existe-na-fonte')), null);
});

test('com certificado, o app abre em https e o http ensina a instalar o certificado', { skip: !temOpenssl && 'sem openssl' }, async () => {
  const seguro = await pedir(getHttps, `https://127.0.0.1:${porta}/`, { ca: tls.ca });
  assert.equal(seguro.status, 200);
  assert.match(seguro.corpo, /manifest\.webmanifest/);
  // Sem confiar no certificado, a conexão é recusada.
  await assert.rejects(pedir(getHttps, `https://127.0.0.1:${porta}/`));

  // A página do http responde 200: é a checagem da fogueira no The Far Fire.
  const pagina = await pedir(getHttp, `http://127.0.0.1:${porta}/`);
  assert.equal(pagina.status, 200);
  assert.match(pagina.corpo, /agora usa HTTPS/);
  const certificado = await pedir(getHttp, `http://127.0.0.1:${porta}/certificado.crt`);
  assert.equal(certificado.headers['content-type'], 'application/x-x509-ca-cert');
  assert.equal(certificado.corpo, tls.ca.toString());
  assert.equal((await pedir(getHttp, `http://127.0.0.1:${porta}/api/noticias`)).status, 426);

  // Certificado renovado entra sem reiniciar.
  app.servidor.recarregarTls(tls);
  assert.equal((await pedir(getHttps, `https://127.0.0.1:${porta}/manifest.webmanifest`, { ca: tls.ca })).status, 200);
});
