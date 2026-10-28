// Lista de fontes do app. Para adicionar ou trocar uma fonte, edite só este arquivo.
//
// categoria:
//   "checagem" -> agências de checagem (dizem se algo é verdade ou boato)
//   "oficial"  -> órgãos públicos (leis, votações, decisões do governo)
//   "veiculo"  -> imprensa do dia a dia
//   "internacional" -> imprensa de fora falando do Brasil (aba "Lá fora")
//
// Campos opcionais:
//   idioma: 'en', 'es'...  matérias fora do português ganham o link "Ler traduzido"
//   sobreBrasil: true      do feed só entram as matérias que falam do Brasil
//   tema: 'politica'       tema que vale para tudo da fonte (ids em src/temas.js)
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
    tema: 'politica',
  },
  {
    id: 'camara',
    nome: 'Agência Câmara',
    categoria: 'oficial',
    site: 'https://www.camara.leg.br/noticias',
    feed: 'https://www.camara.leg.br/noticias/rss/ultimas-noticias',
    tema: 'politica',
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

  // Imprensa internacional (aba "Lá fora")
  {
    id: 'dw',
    nome: 'DW Brasil (Alemanha)',
    categoria: 'internacional',
    sobreBrasil: true,
    site: 'https://www.dw.com/pt-br/',
    feed: 'https://rss.dw.com/rdf/rss-br-all',
  },
  {
    id: 'rfi',
    nome: 'RFI Brasil (França)',
    categoria: 'internacional',
    sobreBrasil: true,
    site: 'https://www.rfi.fr/br/',
    feed: 'https://www.rfi.fr/br/rss',
  },
  {
    id: 'guardian',
    nome: 'The Guardian (Reino Unido)',
    categoria: 'internacional',
    idioma: 'en',
    site: 'https://www.theguardian.com/world/brazil',
    feed: 'https://www.theguardian.com/world/brazil/rss',
  },
  {
    id: 'nyt',
    nome: 'The New York Times (EUA)',
    categoria: 'internacional',
    idioma: 'en',
    sobreBrasil: true,
    site: 'https://www.nytimes.com/section/world/americas',
    feed: 'https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml',
  },
  {
    id: 'bbcworld',
    nome: 'BBC News (Reino Unido)',
    categoria: 'internacional',
    idioma: 'en',
    sobreBrasil: true,
    site: 'https://www.bbc.com/news/world/latin_america',
    feed: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml',
  },
  {
    id: 'elpais',
    nome: 'El País (Espanha)',
    categoria: 'internacional',
    idioma: 'es',
    sobreBrasil: true,
    site: 'https://elpais.com/america/',
    feed: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada',
  },
  {
    id: 'france24',
    nome: 'France 24 (França)',
    categoria: 'internacional',
    idioma: 'en',
    sobreBrasil: true,
    site: 'https://www.france24.com/en/americas/',
    feed: 'https://www.france24.com/en/americas/rss',
  },
  {
    id: 'aljazeera',
    nome: 'Al Jazeera (Catar)',
    categoria: 'internacional',
    idioma: 'en',
    sobreBrasil: true,
    site: 'https://www.aljazeera.com/where/brazil/',
    feed: 'https://www.aljazeera.com/xml/rss/all.xml',
  },
];

export const CATEGORIAS = {
  checagem: 'Checagem',
  oficial: 'Fonte oficial',
  veiculo: 'Veículo',
  internacional: 'Imprensa internacional',
};
