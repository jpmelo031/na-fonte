// HTTPS, para poder instalar o app como aplicativo de verdade (o Chrome só instala sites https://).
// O certificado é o do servidor de casa: no celular do The Far Fire, um só para todos os apps (~/https,
// criado pelo termux/https.sh do Minhas Finanças). Na mesma porta, as conexões TLS vão para o app e as
// http:// recebem uma página que ensina a instalar o certificado no aparelho.
import { readFileSync } from 'node:fs';
import { createServer as criarHttp } from 'node:http';
import { createServer as criarHttps } from 'node:https';
import { createServer as criarTcp } from 'node:net';
import { join } from 'node:path';

/** Lê servidor.key, servidor.crt e ca.crt da pasta. Sem certificado, devolve null (fica só http). */
export function carregarTls(pasta) {
  const ler = (nome) => readFileSync(join(pasta, nome));
  try {
    return { key: ler('servidor.key'), cert: ler('servidor.crt'), ca: ler('ca.crt') };
  } catch (erro) {
    if (erro.code === 'ENOENT') return null;
    throw erro;
  }
}

/** Servidor da porta: só http sem certificado; com ele, https para o app e a página do certificado no http. */
export function criarServidor(tratar, tls) {
  if (!tls) return criarHttp(tratar);
  const seguro = criarHttps({ key: tls.key, cert: tls.cert }, tratar);
  const simples = criarHttp(paginaDoCertificado(tls.ca));
  const servidor = criarTcp((socket) => {
    socket.on('error', () => socket.destroy());
    socket.once('data', (pedaco) => {
      socket.pause();
      socket.unshift(pedaco);
      // Toda conexão TLS começa com o byte 0x16 (handshake).
      (pedaco[0] === 0x16 ? seguro : simples).emit('connection', socket);
      process.nextTick(() => socket.resume());
    });
  });
  /** Troca o certificado sem derrubar o servidor (quando ele é renovado). */
  servidor.recarregarTls = (novo) => seguro.setSecureContext({ key: novo.key, cert: novo.cert });
  servidor.fecharConexoes = () => {
    seguro.closeAllConnections();
    simples.closeAllConnections();
  };
  return servidor;
}

function paginaDoCertificado(ca) {
  return (req, res) => {
    const caminho = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (caminho === '/certificado.crt') {
      res.writeHead(200, {
        'content-type': 'application/x-x509-ca-cert',
        'content-disposition': 'attachment; filename="servidor-de-casa.crt"',
        'cache-control': 'no-store',
      });
      return res.end(ca);
    }
    if (caminho.startsWith('/api/')) {
      res.writeHead(426, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ erro: 'O app agora usa HTTPS.', https: true }));
    }
    // A página responde 200: a checagem da fogueira no The Far Fire (GET http://.../) continua passando.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(PAGINA);
  };
}

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>Na Fonte · HTTPS</title>
<style>
  :root { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  body { margin: 0; background: #f6f7f9; color: #1f2937; line-height: 1.5; }
  main { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p, li { color: #4b5563; font-size: 15px; }
  b { color: #111827; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px 18px; margin-top: 16px; }
  .ok { border-color: #0f766e; background: #ecfdf5; }
  .btn { display: inline-block; background: #0f766e; color: #fff; text-decoration: none; font-weight: 600;
         padding: 10px 16px; border-radius: 12px; margin: 6px 0; }
  .btn.alt { background: #fff; border: 1px solid #d1d5db; color: #111827; }
  ol { padding-left: 20px; margin: 8px 0 0; }
  ol > li { margin-bottom: 14px; }
  details { background: #f3f4f6; border-radius: 12px; padding: 10px 12px; margin: 8px 0; }
  summary { font-weight: 600; color: #111827; cursor: pointer; }
  details p { margin: 8px 0 0; font-size: 14px; }
  .muted { color: #6b7280; font-size: 13px; }
  code { background: #e5e7eb; padding: 1px 6px; border-radius: 6px; }
</style>
</head>
<body>
<main>
  <h1>🔒 O Na Fonte agora usa HTTPS</h1>
  <p>Assim o app pode ser <b>instalado como aplicativo de verdade</b>. Para isso, este aparelho precisa confiar
     no certificado do servidor de casa. É uma vez por aparelho, e vale para todos os apps da casa: se você
     já instalou pelo Minhas Finanças ou pelo Casa em Dia, é o mesmo.</p>

  <div class="card ok" id="pronto" hidden>
    <b>✓ Este aparelho já confia no servidor.</b>
    <p>Abrindo o app…</p>
    <a class="btn" id="abrir1" href="#">Abrir o app</a>
  </div>

  <div class="card" id="passos">
    <ol>
      <li><b>Baixe o certificado do servidor</b><br>
        <a class="btn" href="/certificado.crt" download="servidor-de-casa.crt">Baixar certificado</a></li>
      <li><b>Instale o certificado</b> (escolha o seu aparelho):
        <details open><summary>Android</summary>
          <p>Abra as <b>Configurações</b> e procure por <b>“certificado”</b> na busca. Entre em
          <b>Instalar um certificado → Certificado CA</b>, toque em <b>Instalar mesmo assim</b> e escolha o arquivo
          <code>servidor-de-casa.crt</code> na pasta Downloads.</p>
          <p class="muted">Caminho comum: Configurações → Segurança e privacidade → Mais configurações de segurança →
          Criptografia e credenciais → Instalar um certificado.</p>
        </details>
        <details><summary>Windows</summary>
          <p>Abra o arquivo baixado → <b>Instalar Certificado</b> → <b>Máquina Local</b> → “Colocar todos os certificados no
          repositório a seguir” → <b>Autoridades de Certificação Raiz Confiáveis</b> → Concluir. Depois feche e abra o Chrome.</p>
        </details>
        <details><summary>iPhone / iPad</summary>
          <p>Abra esta página no Safari e baixe o certificado → <b>Permitir</b>. Em <b>Ajustes → Perfil Baixado → Instalar</b>.
          Depois em <b>Ajustes → Geral → Sobre → Ajustes de Confiança de Certificados</b>, ative o “Servidor de casa”.</p>
        </details>
        <details><summary>Mac</summary>
          <p>Abra o arquivo (Acesso às Chaves), clique duas vezes no certificado “Servidor de casa”, abra <b>Confiar</b> e
          escolha <b>Sempre Confiar</b>.</p>
        </details>
        <details><summary>Linux</summary>
          <p>No Chrome: Configurações → Privacidade e segurança → Segurança → Gerenciar certificados → Autoridades → Importar,
          e marque “Confiar neste certificado para identificar sites”.</p>
        </details>
      </li>
      <li><b>Abra o app com HTTPS</b><br>
        <a class="btn alt" id="abrir2" href="#">Abrir o app</a>
        <p class="muted">Se aparecer “Sua conexão não é particular”, o certificado ainda não foi instalado.
        No app aberto por https://, use <b>⋮ → Instalar app</b>.</p>
      </li>
    </ol>
  </div>

</main>
<script>
  var https = 'https://' + location.host + '/';
  document.getElementById('abrir1').href = https;
  document.getElementById('abrir2').href = https;
  // Se este aparelho já confia no certificado, a conexão https funciona e vamos direto para o app.
  fetch(https + 'manifest.webmanifest', { mode: 'no-cors', cache: 'no-store' }).then(function () {
    document.getElementById('pronto').hidden = false;
    document.getElementById('passos').hidden = true;
    setTimeout(function () { location.replace(https + location.hash); }, 600);
  }, function () {});
</script>
</body>
</html>`;
