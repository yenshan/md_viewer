#!/bin/sh
set -eu

# 呼び出し元にかかわらず、このプロジェクトで実行する。
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "起動にはNode.js 22.12以上とnpmが必要です。インストール後に再実行してください。" >&2
  exit 1
fi

if [ ! -x node_modules/.bin/vite ] || [ ! -x node_modules/.bin/electron ]; then
  echo "依存パッケージをインストールしています…"
  npm ci --include=dev
fi

echo "Folioをビルドしています…"
npm run build

echo "Folioを起動します。"
exec npm start -- "$@"
