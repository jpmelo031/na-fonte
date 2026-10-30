#!/data/data/com.termux/files/usr/bin/bash
# Deixa o Na Fonte do celular igual ao GitHub e reacende a fogueira na-fonte. Roda no celular, a
# partir de um clone deste repositório (gh repo clone jpmelo031/na-fonte ~/src/na-fonte):
#   bash ~/src/na-fonte/scripts/atualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export SVDIR="$PREFIX/var/service"

antes=$(git rev-parse HEAD)
git pull -q --ff-only
if [ "$(git rev-parse HEAD)" != "$antes" ] || [ ! -d node_modules ]; then
  npm ci --omit=dev --no-fund --no-audit --loglevel=error
fi
cp -r server.js src public package.json package-lock.json node_modules ~/na-fonte/app/
sv restart na-fonte
echo "Na Fonte em $(git log -1 --format='%h %s')"
