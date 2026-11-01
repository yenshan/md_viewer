const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { isMarkdown, readDocument } = require('../electron/library.cjs');

test('accepts Markdown extensions and rejects other files', () => {
  assert.equal(isMarkdown('notes.MD'), true);
  assert.equal(isMarkdown('notes.markdown'), true);
  assert.equal(isMarkdown('notes.md.exe'), false);
});
test('same-named documents in separate folders remain distinct and preserve Unicode', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'folio-test-'));
  try {
    for (const folder of ['one', 'two']) { await fs.mkdir(path.join(root, folder)); await fs.writeFile(path.join(root, folder, 'note.md'), `# ${folder}\n日本語 $x^2$`); }
    const first = await readDocument(path.join(root, 'one', 'note.md'));
    const second = await readDocument(path.join(root, 'two', 'note.md'));
    assert.notEqual(first.id, second.id);
    assert.equal(first.name, second.name);
    assert.match(first.content, /日本語 \$x\^2\$/);
    assert.equal(typeof first.modified, 'number');
    await assert.rejects(readDocument(path.join(root, 'missing.md')));
    await assert.rejects(readDocument(path.join(root, 'note.txt')), /Markdown/);
    await fs.writeFile(path.join(root, 'big.md'), '');
    const handle = await fs.open(path.join(root, 'big.md'), 'r+');
    await handle.truncate(20 * 1024 * 1024 + 1); await handle.close();
    await assert.rejects(readDocument(path.join(root, 'big.md')), /20 MB/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
