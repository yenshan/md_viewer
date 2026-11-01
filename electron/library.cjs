const fs = require('node:fs/promises');
const path = require('node:path');
const MAX_SIZE = 20 * 1024 * 1024;
const isMarkdown = file => /\.(md|markdown)$/i.test(file);
async function readDocument(file) {
  if (!isMarkdown(file)) throw new Error('Markdownファイルを選択してください。');
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX_SIZE) throw new Error('20 MB以下のMarkdownファイルを選択してください。');
  return { id: file, name: path.basename(file), folder: path.dirname(file), content: await fs.readFile(file, 'utf8'), modified: stat.mtimeMs };
}
module.exports = { isMarkdown, readDocument };
