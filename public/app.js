// Interface do Na Fonte. Todo texto vindo dos feeds entra via textContent
// (nunca innerHTML), para que um feed não consiga injetar HTML na página.

const NOMES_CATEGORIA = { checagem: 'Checagem', oficial: 'Fonte oficial', veiculo: 'Veículo', internacional: 'Imprensa internacional' };
const NOMES_VEREDITO = { falso: 'Falso', enganoso: 'Enganoso', verdadeiro: 'Verdadeiro' };
const ABAS = ['hoje', 'lafora', 'checagens', 'verificar', 'fontes'];

let dados = null;
const filtros = { noticias: 'todas', checagens: 'todas', temaHoje: 'todos', temaLafora: 'todos' };

// O tema escolhido fica guardado neste aparelho (se o navegador deixar).
for (const chave of ['temaHoje', 'temaLafora']) {
  try {
    filtros[chave] = localStorage.getItem(`na-fonte:${chave}`) || 'todos';
  } catch {}
}
function lembrar(chave, valor) {
  try {
    localStorage.setItem(`na-fonte:${chave}`, valor);
  } catch {}
}

function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (nome === 'class') elemento.className = valor;
    else elemento.setAttribute(nome, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

function linkExterno(href, ...filhos) {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...filhos);
}

const relativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
function haQuanto(iso) {
  if (!iso) return '';
  const minutos = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (minutos > -1) return 'agora';
  if (minutos > -60) return relativo.format(minutos, 'minute');
  const horas = Math.round(minutos / 60);
  if (horas > -24) return relativo.format(horas, 'hour');
  const data = new Date(iso);
  const formato = { day: '2-digit', month: 'short' };
  if (data.getFullYear() !== new Date().getFullYear()) formato.year = 'numeric';
  return data.toLocaleDateString('pt-BR', formato);
}

function seloCategoria(categoria, nome) {
  return el('span', { class: `selo selo-${categoria}`, title: NOMES_CATEGORIA[categoria] }, nome);
}

function seloVeredito(veredito) {
  return veredito ? el('span', { class: `selo selo-${veredito}` }, NOMES_VEREDITO[veredito]) : null;
}

function vazio(texto) {
  return el('p', { class: 'vazio' }, texto);
}

function nomeDoTema(id) {
  return dados.temas.find((t) => t.id === id)?.nome ?? id;
}

function temaCombina(item, tema) {
  return tema === 'todos' || (item.temas ?? []).includes(tema);
}

function rotuloTemas(temas = []) {
  return temas.map((tema) => el('span', { class: 'selo selo-tema' }, nomeDoTema(tema)));
}

function seloIdioma(item) {
  return item.idioma && item.idioma !== 'pt' ? el('span', { class: 'selo selo-idioma' }, item.idioma.toUpperCase()) : null;
}

function linkTraduzir(item) {
  if (!item.idioma || item.idioma === 'pt') return null;
  const url = `https://translate.google.com/translate?sl=auto&tl=pt&u=${encodeURIComponent(item.link)}`;
  return linkExterno(url, 'Ler traduzido para o português');
}

function textoVazio(tema, padrao) {
  return tema === 'todos' ? padrao : `Nada de ${nomeDoTema(tema)} por aqui agora. Escolha outro tema ou "Todos".`;
}

// ---------------------------------------------------------------------------
// Aba Hoje
// ---------------------------------------------------------------------------

function temasDoAssunto(assunto) {
  return [...new Set(assunto.itens.flatMap((i) => i.temas ?? []))].slice(0, 2);
}

function cartaoAssunto(assunto) {
  const principal = assunto.itens.find((i) => i.titulo === assunto.titulo) ?? assunto.itens[0];
  return el('article', { class: 'cartao assunto' },
    el('div', { class: 'meta' },
      el('span', { class: 'contagem' }, `${assunto.quantidadeFontes} fontes`),
      el('span', {}, '·'),
      el('span', {}, haQuanto(assunto.data)),
      rotuloTemas(temasDoAssunto(assunto)),
      assunto.temFonteOficial && el('span', { class: 'selo selo-oficial' }, 'Inclui fonte oficial'),
      assunto.checagens.length > 0 && el('span', { class: 'selo selo-checagem' }, 'Tem checagem'),
    ),
    el('h3', {}, linkExterno(principal.link, assunto.titulo)),
    el('details', {},
      el('summary', {}, 'Ver como cada fonte noticiou'),
      el('ul', {}, assunto.itens.map((item) =>
        el('li', {}, seloCategoria(item.categoria, item.fonteNome), ' ', linkExterno(item.link, item.titulo)),
      )),
    ),
    assunto.checagens.map((checagem) =>
      el('div', { class: 'checagem-relacionada' },
        seloVeredito(checagem.veredito), ' ',
        el('strong', {}, `${checagem.fonteNome}: `),
        linkExterno(checagem.link, checagem.titulo),
      ),
    ),
  );
}

function cartaoNoticia(item) {
  const traduzir = linkTraduzir(item);
  return el('article', { class: 'cartao' },
    el('div', { class: 'meta' },
      seloCategoria(item.categoria, item.fonteNome),
      seloIdioma(item),
      el('span', {}, haQuanto(item.data)),
      rotuloTemas(item.temas),
      item.alarmista && el('span', { class: 'selo selo-alarmista', title: 'Título com cara de sensacionalismo. Leia a matéria antes de tirar conclusões.' }, 'Título sensacionalista?'),
    ),
    el('h3', {}, linkExterno(item.link, item.titulo)),
    item.resumo && el('p', { class: 'resumo' }, item.resumo),
    traduzir && el('span', { class: 'traduzir' }, traduzir),
  );
}

function renderizarHoje() {
  const tema = filtros.temaHoje;
  const assuntos = dados.assuntos.filter((a) => a.itens.some((i) => temaCombina(i, tema)));
  document.getElementById('assuntos').replaceChildren(
    ...(assuntos.length
      ? assuntos.map(cartaoAssunto)
      : [vazio(textoVazio(tema, 'Ainda não há assuntos noticiados por duas ou mais fontes nas últimas 48 horas.'))]),
  );

  const lista = dados.noticias
    .filter((n) => filtros.noticias === 'todas' || n.categoria === filtros.noticias)
    .filter((n) => temaCombina(n, tema))
    .slice(0, 60);
  document.getElementById('noticias').replaceChildren(
    ...(lista.length ? lista.map(cartaoNoticia) : [vazio(textoVazio(tema, 'Nenhuma notícia por aqui ainda.'))]),
  );
}

// ---------------------------------------------------------------------------
// Aba Lá fora
// ---------------------------------------------------------------------------

function renderizarLafora() {
  const tema = filtros.temaLafora;
  const lista = dados.internacional.filter((n) => temaCombina(n, tema)).slice(0, 60);
  document.getElementById('internacional').replaceChildren(
    ...(lista.length
      ? lista.map(cartaoNoticia)
      : [vazio(textoVazio(tema, 'Nenhuma matéria da imprensa internacional sobre o Brasil nas fontes do app agora.'))]),
  );
}

// ---------------------------------------------------------------------------
// Aba Checagens
// ---------------------------------------------------------------------------

function cartaoChecagem(item) {
  return el('article', { class: 'cartao' },
    el('div', { class: 'meta' },
      seloVeredito(item.veredito),
      seloCategoria('checagem', item.fonteNome),
      el('span', {}, haQuanto(item.data)),
    ),
    el('h3', {}, linkExterno(item.link, item.titulo)),
    item.resumo && el('p', { class: 'resumo' }, item.resumo),
  );
}

function renderizarChecagens() {
  const lista = dados.checagens.filter((c) => filtros.checagens === 'todas' || c.veredito === filtros.checagens);
  document.getElementById('checagens').replaceChildren(
    ...(lista.length ? lista.map(cartaoChecagem) : [vazio('Nenhuma checagem com esse filtro agora.')]),
  );
}

// ---------------------------------------------------------------------------
// Aba Fontes
// ---------------------------------------------------------------------------

function estadoDaFonte(fonte) {
  if (!fonte.ok) {
    return ['erro', fonte.sucessoEm ? `com problema, mostrando de ${haQuanto(fonte.sucessoEm)}` : `fora do ar: ${fonte.erro ?? 'sem resposta'}`];
  }
  if (fonte.parado) return ['aviso', `parada: última notícia ${haQuanto(fonte.ultimaNoticia)}`];
  return ['ok', fonte.ultimaNoticia ? `última notícia ${haQuanto(fonte.ultimaNoticia)}` : `${fonte.quantidade} notícias`];
}

function renderizarFontes() {
  const titulos = { checagem: 'Checagem', oficial: 'Fontes oficiais', veiculo: 'Veículos', internacional: 'Imprensa internacional' };
  const grupos = Object.keys(titulos).map((categoria) => {
    const fontes = dados.fontes.filter((f) => f.categoria === categoria);
    return el('div', { class: 'cartao grupo-fontes' },
      el('h3', {}, titulos[categoria]),
      fontes.map((fonte) => {
        const [classe, texto] = estadoDaFonte(fonte);
        return el('div', { class: 'fonte' },
          linkExterno(fonte.site, fonte.nome),
          el('span', { class: `estado ${classe}`, title: fonte.erro ?? '' }, texto),
        );
      }),
    );
  });
  document.getElementById('lista-fontes').replaceChildren(...grupos);
}

// ---------------------------------------------------------------------------
// Aba Verificar
// ---------------------------------------------------------------------------

const MENSAGENS_NIVEL = {
  alto: ['Muitos sinais de boato', 'O texto tem vários padrões típicos de desinformação. Não compartilhe antes de confirmar em uma fonte confiável.'],
  medio: ['Alguns sinais de alerta', 'Procure a mesma informação em um veículo conhecido ou em uma fonte oficial antes de acreditar.'],
  baixo: ['Poucos sinais de alerta', 'O jeito de escrever não tem cara de boato, mas isso não garante que seja verdade. Confira se alguém confiável confirma.'],
};

function renderizarResultado({ analise, checagens, noticias, buscas }) {
  const [titulo, texto] = MENSAGENS_NIVEL[analise.nivel];
  const blocos = [
    el('div', { class: `cartao nivel nivel-${analise.nivel}` },
      el('h3', {}, titulo),
      el('p', {}, texto),
      analise.alertas.length > 0 && el('ul', { class: 'sinais ruins' }, analise.alertas.map((a) => el('li', {}, a.texto))),
      analise.confianca.length > 0 && el('ul', { class: 'sinais bons' }, analise.confianca.map((a) => el('li', {}, a.texto))),
    ),
    el('div', { class: 'cartao' },
      el('h3', {}, 'Checagens sobre o assunto'),
      checagens.length
        ? el('div', { class: 'lista' }, checagens.map((c) =>
            el('div', {}, el('div', { class: 'meta' }, seloVeredito(c.veredito), seloCategoria('checagem', c.fonteNome), el('span', {}, haQuanto(c.data))), linkExterno(c.link, c.titulo)),
          ))
        : el('p', { class: 'discreto' }, 'Nenhuma checagem recente fala disso. Não quer dizer que é verdade nem mentira: pode ser um assunto novo. Use as buscas abaixo.'),
    ),
    el('div', { class: 'cartao' },
      el('h3', {}, 'O que veículos e fontes oficiais estão dizendo'),
      noticias.length
        ? el('div', { class: 'lista' }, noticias.map((n) =>
            el('div', {}, el('div', { class: 'meta' }, seloCategoria(n.categoria, n.fonteNome), el('span', {}, haQuanto(n.data))), linkExterno(n.link, n.titulo)),
          ))
        : el('p', { class: 'discreto' }, 'Nenhuma notícia recente das fontes do app sobre isso. Se fosse algo grande e verdadeiro, provavelmente alguém já teria noticiado.'),
    ),
    buscas.length > 0 && el('div', { class: 'cartao' },
      el('h3', {}, 'Continuar pesquisando'),
      el('div', { class: 'buscas' }, buscas.map((b) => linkExterno(b.url, b.nome))),
    ),
    el('p', { class: 'aviso' }, 'A análise olha só o jeito como o texto foi escrito e procura nas fontes que o app acompanha. Quem confirma se algo é verdade são as checagens e as fontes originais.'),
  ];
  document.getElementById('resultado').replaceChildren(...blocos.filter(Boolean));
}

async function verificar(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const botao = form.querySelector('button');
  const resultado = document.getElementById('resultado');
  botao.disabled = true;
  botao.textContent = 'Analisando…';
  try {
    const resposta = await fetch('api/verificar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto: form.texto.value, autor: form.autor.value || undefined }),
    });
    const corpo = await resposta.json();
    if (!resposta.ok) throw new Error(corpo.erro ?? 'Erro ao analisar.');
    renderizarResultado(corpo);
    resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (erro) {
    resultado.replaceChildren(vazio(erro.message));
  } finally {
    botao.disabled = false;
    botao.textContent = 'Analisar';
  }
}

// ---------------------------------------------------------------------------
// Navegação, filtros e carregamento
// ---------------------------------------------------------------------------

function mostrarAba() {
  const atual = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'hoje';
  for (const aba of ABAS) document.getElementById(`aba-${aba}`).hidden = aba !== atual;
  for (const link of document.querySelectorAll('.abas a')) {
    if (link.dataset.aba === atual) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function ligarFiltro(idGrupo, chave, renderizar) {
  const grupo = document.getElementById(idGrupo);
  grupo.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-filtro]');
    if (!botao) return;
    filtros[chave] = botao.dataset.filtro;
    if (chave.startsWith('tema')) lembrar(chave, filtros[chave]);
    for (const b of grupo.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === botao));
    if (dados) renderizar();
  });
}

// Os botões de tema vêm do servidor (src/temas.js), então são montados quando os dados chegam.
function montarFiltroDeTemas(idGrupo, chave) {
  const grupo = document.getElementById(idGrupo);
  if (grupo.childElementCount) return;
  if (!dados.temas.some((t) => t.id === filtros[chave])) filtros[chave] = 'todos';
  const opcoes = [{ id: 'todos', nome: 'Todos os temas' }, ...dados.temas];
  grupo.replaceChildren(...opcoes.map(({ id, nome }) =>
    el('button', { type: 'button', 'data-filtro': id, 'aria-pressed': String(filtros[chave] === id) }, nome),
  ));
}

function renderizarTudo() {
  montarFiltroDeTemas('filtro-tema-hoje', 'temaHoje');
  montarFiltroDeTemas('filtro-tema-lafora', 'temaLafora');
  renderizarHoje();
  renderizarLafora();
  renderizarChecagens();
  renderizarFontes();
  const funcionando = dados.fontes.filter((f) => f.ok).length;
  document.getElementById('atualizado').textContent =
    `Atualizado ${haQuanto(dados.atualizadoEm)} · ${funcionando} de ${dados.fontes.length} fontes`;
}

async function carregar() {
  const botao = document.getElementById('recarregar');
  botao.setAttribute('aria-busy', 'true');
  if (!dados) {
    for (const id of ['assuntos', 'noticias', 'internacional', 'checagens']) {
      document.getElementById(id).replaceChildren(vazio('Buscando notícias nas fontes… a primeira vez pode levar alguns segundos.'));
    }
  }
  try {
    const resposta = await fetch('api/noticias');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    dados = await resposta.json();
    renderizarTudo();
  } catch {
    document.getElementById('atualizado').textContent = 'Sem conexão com o servidor do app';
    if (!dados) document.getElementById('assuntos').replaceChildren(vazio('Não foi possível carregar. Confira se o servidor está rodando (npm start) e tente de novo.'));
  } finally {
    botao.removeAttribute('aria-busy');
  }
}

window.addEventListener('hashchange', mostrarAba);
document.getElementById('recarregar').addEventListener('click', carregar);
document.getElementById('form-verificar').addEventListener('submit', verificar);
ligarFiltro('filtro-noticias', 'noticias', renderizarHoje);
ligarFiltro('filtro-checagens', 'checagens', renderizarChecagens);
ligarFiltro('filtro-tema-hoje', 'temaHoje', renderizarHoje);
ligarFiltro('filtro-tema-lafora', 'temaLafora', renderizarLafora);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dados && Date.now() - Date.parse(dados.atualizadoEm) > 10 * 60000) carregar();
});
setInterval(() => document.visibilityState === 'visible' && carregar(), 10 * 60000);

mostrarAba();
carregar();
