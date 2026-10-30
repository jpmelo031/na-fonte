#!/data/data/com.termux/files/usr/bin/bash
# Atualiza o Na Fonte no celular do The Far Fire (a fogueira na-fonte, porta 3000). Roda no
# celular, a partir de um clone deste repositório (na primeira vez: gh repo clone jpmelo031/na-fonte ~/src/na-fonte):
#   bash ~/src/na-fonte/scripts/atualizar.sh            (só se tiver versão nova)
#   bash ~/src/na-fonte/scripts/atualizar.sh --forcar   (reinstala mesmo assim)
# Baixa a versão nova, roda os testes e troca o app em ~/na-fonte/app. Se a versão nova não
# responder em 30 s, a anterior volta.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Primeiro o próprio clone: este script pode ter mudado, então quem roda é a versão nova.
if [ "${ATUALIZADO:-}" != 1 ]; then
  git -C "$REPO" pull -q --ff-only
  export ATUALIZADO=1
  exec bash "$REPO/scripts/atualizar.sh" "$@"
fi

PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export SVDIR="$PREFIX/var/service"
NOME=na-fonte
BASE="$HOME/$NOME"
# Se a fogueira estava caindo e voltando, o runit às vezes perde o primeiro start depois do stop.
acender() { for _ in 1 2 3; do sv start "$NOME" >/dev/null 2>&1 && return 0; done; return 1; }
CHECAGEM=http://127.0.0.1:3000/

if [ ! -d "$SVDIR/$NOME" ]; then
  echo "A fogueira $NOME ainda não existe. Instale uma vez pelo PC, na pasta do the-far-fire: scripts/apps/deploy.sh $NOME" >&2
  exit 1
fi
commit=$(git -C "$REPO" log -1 --format='%h %s')
if [ "$(cat "$BASE/app/.commit" 2>/dev/null)" = "$commit" ] && [ "${1:-}" != "--forcar" ]; then
  echo "O Na Fonte já está na versão mais nova (${commit%% *})."
  exit 0
fi

echo "==> Na Fonte: montando $commit"
(cd "$REPO" && npm ci --omit=dev --no-fund --no-audit && npm test) >"$REPO/atualizar.log" 2>&1 \
  || { tail -30 "$REPO/atualizar.log"; exit 1; }
rm -rf "$BASE/app.novo" && mkdir -p "$BASE/app.novo"
(cd "$REPO" && cp -r server.js src public package.json package-lock.json LICENSE node_modules "$BASE/app.novo/")
echo "$commit" > "$BASE/app.novo/.commit"

echo "==> Na Fonte: reacendendo a fogueira"
sv -w 15 stop "$NOME" >/dev/null 2>&1 || true
rm -rf "$BASE/app.anterior"
if [ -d "$BASE/app" ]; then mv "$BASE/app" "$BASE/app.anterior"; fi
mv "$BASE/app.novo" "$BASE/app"
acender || true

responde() { # qualquer resposta HTTP abaixo de 500 é o app no ar
  local codigo
  for _ in $(seq 30); do
    codigo=$(curl -s -m 3 -o /dev/null -w '%{http_code}' "$CHECAGEM" 2>/dev/null || true)
    case $codigo in 2??|3??|4??) return 0 ;; esac
    sleep 1
  done
  return 1
}
if responde; then
  echo "    no ar: $CHECAGEM responde (${commit%% *})"
  exit 0
fi
echo "    $CHECAGEM não respondeu. Últimas linhas do log:"
tail -n 15 "$PREFIX/var/log/sv/$NOME/current" 2>/dev/null || true
if [ -d "$BASE/app.anterior" ]; then
  echo "    voltando a versão anterior"
  sv -w 15 stop "$NOME" >/dev/null 2>&1 || true
  rm -rf "$BASE/app.falhou" && mv "$BASE/app" "$BASE/app.falhou" && mv "$BASE/app.anterior" "$BASE/app"
  acender || true
fi
exit 1
