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
