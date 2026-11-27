#!/bin/bash
set -eu
cd "$(dirname "$0")"
node_path="$(command -v node || true)"
if [ -z "$node_path" ] && [ -x /opt/homebrew/bin/node ]; then node_path=/opt/homebrew/bin/node; fi
if [ -z "$node_path" ] && [ -x /usr/local/bin/node ]; then node_path=/usr/local/bin/node; fi
if [ -z "$node_path" ] && [ -x '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node' ]; then node_path='/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node'; fi
if [ -z "$node_path" ]; then
  printf '%s\n' 'Node.jsが見つかりません。公式サイトからNode.jsをインストールしてください。' 'https://nodejs.org/'
  exit 1
fi
printf '%s\n' '鷲巣麻雀（試作）を起動します。' '同じMacのブラウザで http://127.0.0.1:3000/ を開いてください。' '停止するには、このウインドウで Control + C を押します。'
exec "$node_path" src/server.cjs
