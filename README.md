# Na Fonte

Notícias de fontes confiáveis, checagens e um filtro rápido contra boatos, num lugar só.

A ideia é trocar o feed infinito de reels por uma leitura curta, vinda direto de quem apura:
agências de checagem, órgãos oficiais e veículos de imprensa com linhas editoriais diferentes.

## O que o app faz

| Aba | Para quê |
| --- | --- |
| **Hoje** | Mostra os **assuntos noticiados por várias fontes ao mesmo tempo** (quanto mais redações independentes, mais difícil ser boato), avisa quando uma fonte oficial também noticiou e quando existe checagem sobre o assunto. Embaixo, as últimas notícias, com filtro por fontes oficiais e veículos. |
| **Checagens** | O que Comprova, Aos Fatos, Lupa, Fato ou Fake, Estadão Verifica e outros confirmaram ou desmentiram, com o veredito (Falso / Enganoso / Verdadeiro) quando ele aparece no título. |
| **Verificar** | Você cola o texto de um reel, post ou mensagem de WhatsApp. O app procura checagens e notícias sobre o assunto, aponta sinais típicos de boato (CAIXA ALTA, "URGENTE!!!", "compartilhe antes que apaguem", falta de fonte) e gera buscas prontas nas agências de checagem. |
| **Fontes** | Lista de todas as fontes, com indicação de quais estão funcionando, e o filtro rápido para reels. |

O app **não decide o que é verdade**. Ele junta as fontes, mostra quem mais está falando do mesmo
assunto e aponta checagens. Todas as regras estão em [`src/analise.js`](src/analise.js), escritas
para serem lidas e ajustadas.

## Como rodar

Precisa só do [Node.js](https://nodejs.org) 20 ou mais novo. O projeto não usa nenhuma biblioteca
externa, então não precisa de `npm install`.

```bash
npm start
```

Depois abra <http://localhost:3000>.

**No celular:** com o computador e o celular no mesmo Wi-Fi, abra `http://IP-DO-COMPUTADOR:3000`
no navegador do celular (o IP aparece nas configurações de rede do computador). No menu do navegador,
use "Adicionar à tela inicial" para ele virar um ícone como um app.

As fontes são atualizadas sozinhas a cada 15 minutos (mude com `INTERVALO_MINUTOS=30 npm start`).

### Rodar direto no celular Android (Termux)

Dá para rodar o app inteiro no próprio celular com o [Termux](https://termux.dev).

```bash
# 1. Atualizar o Termux e instalar Node, git e o GitHub CLI (responda "y" / Enter)
pkg update && pkg upgrade
pkg install nodejs git gh

# 2. Entrar no GitHub (o repositório é privado)
gh auth login        # GitHub.com > HTTPS > Y > Login with a web browser

# 3. Baixar o app
gh repo clone jpmelo031/priv-neutons
cd priv-neutons

# 4. Testar as fontes e abrir o app
npm run checar-fontes
npm start
```

Com o `npm start` rodando, abra o Chrome do celular em <http://localhost:3000> e use
"Adicionar à tela inicial". Para o Android não fechar o Termux em segundo plano, rode
`termux-wake-lock` antes do `npm start`. Para parar o app: `CTRL` + `C` no Termux.

Para pegar atualizações depois: `cd priv-neutons && git pull`.

## Conferir se as fontes estão funcionando

Endereços de RSS mudam de vez em quando. Para testar todos:

```bash
npm run checar-fontes
```

Ele mostra `OK` ou `ERRO` para cada fonte, com a data da notícia mais nova, e avisa quando um feed
parece parado. Para ver tudo o que uma fonte trouxe, use o id dela: `npm run checar-fontes -- planalto`.
Para testar um endereço novo antes de colocar no app: `npm run checar-fontes -- https://site.com/feed/`.
Se alguma falhar, abra o site dela, procure o link
"RSS" (geralmente no rodapé) e troque o endereço em [`src/fontes.js`](src/fontes.js). Uma fonte com
problema nunca derruba o app: ela só aparece em vermelho na aba Fontes e o app continua mostrando
as notícias da última vez que ela funcionou.

> Os endereços dos feeds foram montados a partir dos padrões que cada site usa, mas não puderam ser
> testados no ambiente onde o app foi criado (sem acesso a esses sites). Rode o comando acima na
> primeira vez.

## Adicionar ou tirar fontes

Tudo fica em [`src/fontes.js`](src/fontes.js). Cada fonte tem nome, site, endereço do feed e
categoria (`checagem`, `oficial` ou `veiculo`). Para adicionar, copie um bloco e troque os dados.

## Como o app decide as coisas

- **Assuntos em vários veículos:** compara as palavras importantes dos títulos das últimas 48 horas
  (palavras raras pesam mais que "governo" ou "Brasil") e junta manchetes parecidas de fontes
  **diferentes**. Repetir a mesma notícia na mesma fonte não conta como confirmação.
- **Checagens relacionadas:** procura checagens que tenham as palavras importantes do assunto ou do
  texto colado.
- **Sinais de boato:** uma lista de padrões de forma (palavras alarmistas, caixa alta, excesso de
  exclamação, emojis de alerta, pedido para compartilhar, "a mídia esconde") e de sinais de
  confiança (cita lei, data, instituição ou quem disse). Isso mede o jeito de escrever, não a verdade.
- **"Título sensacionalista?":** aparece em manchetes que têm pelo menos dois sinais de forma.

## Testes

```bash
npm test
```

## Estrutura

```
server.js            inicia o servidor
src/fontes.js        lista de fontes (edite aqui)
src/feeds.js         baixa os feeds, com tolerância a falhas
src/xml.js           lê RSS e Atom (inclusive feeds em ISO-8859-1)
src/analise.js       agrupamento, checagens relacionadas e sinais de boato
src/app.js           servidor HTTP e API (/api/noticias, /api/verificar)
public/              a interface (HTML, CSS e JS puros)
scripts/             checar-fontes
test/                testes automáticos
```

## Ideias para depois

- Colocar online (Render, Railway ou Fly.io rodam `npm start` direto) para abrir de qualquer lugar.
- Resumo diário de 5 minutos por e-mail ou Telegram com os assuntos em várias fontes.
- Avisar quando sair uma checagem sobre algo que você colou na aba Verificar.
- Fontes regionais e mais veículos de linhas editoriais diferentes.
