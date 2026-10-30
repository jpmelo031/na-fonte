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
# HTTPS: o certificado do celular (~/https, criado com o termux/https.sh do Minhas Finanças) serve
# para todos os apps; a fogueira lê o HTTPS_DIR do config.env ao acender.
if [ -f ~/https/servidor.crt ] && ! grep -qs '^HTTPS_DIR=' ~/na-fonte/config.env; then
  echo "HTTPS_DIR=$HOME/https" >> ~/na-fonte/config.env
fi
sv restart na-fonte
# Com o certificado, confere se o app voltou respondendo em https://.
if [ -f ~/https/ca.crt ]; then
  https=não
  for _ in $(seq 15); do curl -fs -o /dev/null --cacert ~/https/ca.crt https://127.0.0.1:3000/ && { https=sim; break; }; sleep 1; done
  echo "Na Fonte com HTTPS: $https"
fi
echo "Na Fonte em $(git log -1 --format='%h %s')"
