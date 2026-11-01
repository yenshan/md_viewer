# Folio

Electron + React製のシンプルなMarkdownビューアーです。日本語UIで、ファイルの保存場所にかかわらず、選択したMarkdownをひとつの一覧で管理できます。

## 起動

Node.js 22.12以上（または対応する新しいLTS）とnpmを使用してください。

`start.sh` で起動できます。初回は必要な依存パッケージを自動でインストールし、ビルドしてElectronを起動します。

```sh
./start.sh
```

別のディレクトリーから絶対パスで実行することもできます。開発モードで起動する場合:

```sh
npm install
npm run dev
```

配布用のフロントエンドをビルドして起動する場合:

```sh
npm run build
npm start
```

## macOSアプリのビルド

macOS上で次を実行すると、実行中のNode.jsと同じアーキテクチャーの `Folio.app` を作成します。依存パッケージが未インストールの場合は自動でインストールします。

```sh
./build-mac.sh
```

Apple Silicon向けは `./build-mac.sh --arm64`、Intel向けは `./build-mac.sh --x64`、両対応版は `./build-mac.sh --universal` で指定できます。

出力先は `release/mac-arm64/Folio.app`（Apple Silicon）、`release/mac/Folio.app`（Intel）、`release/mac-universal/Folio.app`（両対応）です。Finderから開くか、アプリケーションフォルダーにコピーして使用できます。このビルドはローカル利用向けのアドホック署名を使用し、Appleの証明書や公証は使用しません。

### FinderからMarkdownを開く

`build-mac.sh` でビルドした新しい `Folio.app` をアプリケーションフォルダーへコピーして一度起動してください。Finderで `.md` / `.markdown` を右クリックし、「このアプリケーションで開く」→「Folio」を選択できます。候補に出ない場合は「その他…」から `Folio.app` を選択してください。

未起動ならアプリを起動してファイルを表示し、起動済みなら既存のウィンドウのライブラリに追加して表示します。複数ファイルの選択やDockのアプリアイコンへのドロップにも対応します。既定のアプリは自動変更しません。

インストーラーを作成する場合は `npm run dist`。macOSはDMG、WindowsはNSIS、LinuxはAppImageを使用します。各OS上でのビルドを推奨します。配布用の署名・公証は別途設定が必要です。

## 使い方

- 「ファイルを追加」または `⌘O` / `Ctrl+O` で `.md` / `.markdown` を複数選択します。別のフォルダーのファイルは、続けて追加できます。
- 左の一覧でファイルを切り替えます。同名のファイルもフルパスで区別します。検索は名前とパスを対象にします。
- 一覧の × は一覧から外す操作です。元ファイルは削除しません。
- 開いたファイルの内容を外部エディターで更新したら、上部の再読み込みボタンで反映します。
- 「表示設定」でライト・ダーク・セピア、ゴシック・明朝・等幅、文字サイズを変更できます。
- 上部の「プレビュー」「Raw」で、レンダリング結果と元のMarkdownテキストを切り替えられます。Rawは読み取り専用の等幅表示で、テキストを選択・コピーできます。
- 目次ボタンから見出しへ移動できます。コードブロックにはコピーボタンがあります。

## Markdown対応

`react-markdown` と `remark-gfm` で表・チェックリスト・取り消し線などを表示します。`rehype-highlight` は言語指定のあるコードフェンスをHighlight.jsで色分けします。`remark-math` + `rehype-katex` は `$...$` と `$$...$$` の数式を表示します。

ライブラリ: [react-markdown](https://github.com/remarkjs/react-markdown)、[Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)。

Markdown中のHTML・スクリプトは実行しません。外部リンクは標準ブラウザーで開きます。ローカル画像はMarkdownと同じフォルダーまたはその配下にあるPNG/JPEG/GIF/WebP/AVIFに対応します。外部HTTPS画像はネットワーク接続を使用します。ローカルファイルへのリンクは「ファイルを追加」で開いてください。

ファイル一覧（フルパス）はElectronのuserData内の `library.json`、テーマ・フォント・選択ファイルはアプリのlocalStorageに保存します。元のMarkdownは読み取り専用で、アップロードしません。1ファイルの上限は20 MBです。

`npm run dev:web` はブラウザーでのUI確認用です。ブラウザーではファイル一覧の再起動後の復元、パス表示、相対画像表示が制限されます。通常はElectronで使用してください。

## 確認

```sh
npm test
npm run build
```

Electron上の操作・設定復元などの統合テストは `npm run test:electron` で実行できます。GUIアプリの起動を許可する環境が必要です。
