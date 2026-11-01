const { test } = require('node:test');
const assert = require('node:assert/strict');

test('renders GFM tables, highlighted code, math and task lists with the production pipeline', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: Markdown } = await import('react-markdown');
  const { remarkPlugins, rehypePlugins } = await import('../src/markdown-config.js');
  const { welcome } = await import('../src/welcome.js');
  const render = content => renderToStaticMarkup(React.createElement(Markdown, { remarkPlugins, rehypePlugins }, content));
  const html = render(welcome.content);
  assert.match(html, /<table>/);
  assert.match(html, /<th[^>]*>コンテンツ<\/th>/);
  assert.match(html, /hljs-keyword/);
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
  assert.doesNotMatch(html, /katex-error/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /思考に、余白を。/);
  const unsafe = render('# Safe\n\n<script>window.pwned=true</script>\n\n[bad](javascript:alert(1))');
  assert.doesNotMatch(unsafe, /<script>/);
  assert.doesNotMatch(unsafe, /href="javascript:/);
  assert.match(render('```unknown-language\nhello\n```'), /hello/);
});


test('renders embedded HTML and strips executable markup while preserving fenced HTML as code', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: Markdown } = await import('react-markdown');
  const { remarkPlugins, rehypePlugins } = await import('../src/markdown-config.js');
  const render = content => renderToStaticMarkup(React.createElement(Markdown, { remarkPlugins, rehypePlugins }, content));
  const html = render(`テキスト<br>改行 <u>下線</u> <sup>2</sup> <sub>n</sub>

<details open><summary>詳細</summary><p>説明</p></details>

<table><tr><th>名前</th><th>値</th></tr><tr><td colspan="2">結合セル</td></tr></table>`);
  assert.match(html, /<br\/>/);
  assert.match(html, /<u>下線<\/u>/);
  assert.match(html, /<sup>2<\/sup>/);
  assert.match(html, /<sub>n<\/sub>/);
  assert.match(html, /<details open=""><summary>詳細<\/summary><p>説明<\/p><\/details>/);
  assert.match(html, /<td colSpan="2">結合セル<\/td>/);
  const unsafe = render(`<script>alert(1)</script>

<div onclick="alert(1)" style="position:fixed">表示する本文</div>

<img src="https://example.com/image.png" onerror="alert(1)">

<a href="javascript:alert(1)">リンク</a>

<iframe src="https://example.com"></iframe><object data="https://example.com"></object>`);
  assert.match(unsafe, /表示する本文/);
  assert.match(unsafe, /https:\/\/example.com\/image.png/);
  assert.doesNotMatch(unsafe, /<script|<iframe|<object|onclick=|onerror=|javascript:|style=/i);
  const code = render('```html\n<div>サンプル</div>\n```');
  assert.match(code, /language-html/);
  assert.match(code, /&lt;/);
  assert.doesNotMatch(code, /<div>サンプル<\/div>/);
});
