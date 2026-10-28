// Lista de fontes do app. Para adicionar ou trocar uma fonte, edite só este arquivo.
//
// categoria:
//   "checagem" -> agências de checagem (dizem se algo é verdade ou boato)
//   "oficial"  -> órgãos públicos (leis, votações, decisões do governo)
//   "veiculo"  -> imprensa do dia a dia
//
// Os endereços de feed mudam de vez em quando. Rode `npm run checar-fontes`
// para ver quais estão funcionando e corrija aqui o que estiver quebrado.
// Para testar um endereço novo antes: npm run checar-fontes -- https://...
//
// Ficaram de fora por não terem feed útil (testado em 28/10/2026):
//   Projeto Comprova: /feed/ só tem um item de 2019; /index.xml dá 404.
//     As checagens dele saem nos veículos parceiros, e a aba Verificar busca no site.
//   Planalto (gov.br): o feed só traz a agenda de visitas e para por semanas.
//   Agência Gov, STF e TSE: sem feed ou com feed desatualizado.

export const FONTES = [
  // Checagem
  {
    id: 'aosfatos',
    nome: 'Aos Fatos',
    categoria: 'checagem',
    site: 'https://www.aosfatos.org',
    feed: 'https://www.aosfatos.org/noticias/feed/',
  },
  {
    id: 'lupa',
    nome: 'Agência Lupa',
    categoria: 'checagem',
    site: 'https://lupa.uol.com.br',
    feed: 'https://lupa.uol.com.br/feed',
  },
  {
    id: 'fatooufake',
    nome: 'G1 Fato ou Fake',
    categoria: 'checagem',
    site: 'https://g1.globo.com/fato-ou-fake/',
    feed: 'https://g1.globo.com/rss/g1/fato-ou-fake/',
  },
  {
    id: 'estadaoverifica',
    nome: 'Estadão Verifica',
    categoria: 'checagem',
    site: 'https://www.estadao.com.br/estadao-verifica/',
    feed: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/estadao-verifica/',
  },
  {
    id: 'boatos',
    nome: 'Boatos.org',
    categoria: 'checagem',
    site: 'https://www.boatos.org',
    feed: 'https://www.boatos.org/feed',
  },
  {
    id: 'efarsas',
    nome: 'E-farsas',
    categoria: 'checagem',
    site: 'https://www.e-farsas.com',
    feed: 'https://www.e-farsas.com/feed',
  },

  // Fontes oficiais
  {
    id: 'senado',
    nome: 'Agência Senado',
    categoria: 'oficial',
    site: 'https://www12.senado.leg.br/noticias',
    feed: 'https://www12.senado.leg.br/noticias/feed/todasnoticias/RSS',
  },
  {
    id: 'camara',
    nome: 'Agência Câmara',
    categoria: 'oficial',
    site: 'https://www.camara.leg.br/noticias',
    feed: 'https://www.camara.leg.br/noticias/rss/ultimas-noticias',
  },
  {
    id: 'agenciabrasil',
    nome: 'Agência Brasil',
    categoria: 'oficial',
    site: 'https://agenciabrasil.ebc.com.br',
    feed: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml',
  },

  // Veículos
  {
    id: 'g1',
    nome: 'G1',
    categoria: 'veiculo',
    site: 'https://g1.globo.com',
    feed: 'https://g1.globo.com/rss/g1/',
  },
  {
    id: 'folha',
    nome: 'Folha de S.Paulo',
    categoria: 'veiculo',
    site: 'https://www.folha.uol.com.br',
    feed: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml',
  },
  {
    id: 'estadao',
    nome: 'Estadão',
    categoria: 'veiculo',
    site: 'https://www.estadao.com.br',
    feed: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/',
  },
  {
    id: 'uol',
    nome: 'UOL',
    categoria: 'veiculo',
    site: 'https://noticias.uol.com.br',
    feed: 'https://rss.uol.com.br/feed/noticias.xml',
  },
  {
    id: 'bbc',
    nome: 'BBC News Brasil',
    categoria: 'veiculo',
    site: 'https://www.bbc.com/portuguese',
    feed: 'https://feeds.bbci.co.uk/portuguese/rss.xml',
  },
  {
    id: 'poder360',
    nome: 'Poder360',
    categoria: 'veiculo',
    site: 'https://www.poder360.com.br',
    feed: 'https://www.poder360.com.br/feed/',
  },
];

export const CATEGORIAS = {
  checagem: 'Checagem',
  oficial: 'Fonte oficial',
  veiculo: 'Veículo',
};
