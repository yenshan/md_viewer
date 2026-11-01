#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$PROJECT_DIR"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "このスクリプトはmacOS上で実行してください。" >&2
  exit 1
fi

case "${1:-}" in
  "") BUILD_ARCH="" ;;
  --arm64|--x64|--universal) BUILD_ARCH="$1" ;;
  *) echo "使い方: ./build-mac.sh [--arm64|--x64|--universal]" >&2; exit 1 ;;
esac
if [ "$#" -gt 1 ]; then
  echo "使い方: ./build-mac.sh [--arm64|--x64|--universal]" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "ビルドにはNode.js 22.12以上とnpmが必要です。" >&2
  exit 1
fi

if [ ! -x node_modules/.bin/vite ] || [ ! -x node_modules/.bin/electron-builder ]; then
  echo "依存パッケージをインストールしています…"
  npm ci --include=dev
fi

echo "Folioの画面をビルドしています…"
npm run build

# ローカル利用向けのアドホック署名。Appleの証明書や公証は使用しない。
echo "macOSアプリを作成しています…"
if [ -n "$BUILD_ARCH" ]; then
  set -- "$BUILD_ARCH"
else
  set --
fi

# 同じアーキテクチャーなら、インストール済みのElectronを再利用する。
NODE_ARCH=$(node -p 'process.arch')
if [ -x node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ] && \
  { [ -z "$BUILD_ARCH" ] || [ "$BUILD_ARCH" = "--$NODE_ARCH" ]; }; then
  set -- "$@" "--config.electronDist=$PROJECT_DIR/node_modules/electron/dist"
fi

./node_modules/.bin/electron-builder --mac --dir "$@" --publish never \
  --config.mac.identity=- --config.mac.notarize=false

echo "ビルドが完了しました。アプリの出力先:"
find "$PROJECT_DIR/release" -maxdepth 2 -type d -name 'Folio.app' -print
