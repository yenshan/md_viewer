import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Sanitize user HTML before trusted math/highlighting plugins generate markup.
const htmlSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...defaultSchema.tagNames, 'details', 'summary', 'u'])],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ['className', /^language-./, 'math-inline', 'math-display'],
    ],
  },
};
export const remarkPlugins = [remarkGfm, remarkMath];
export const rehypePlugins = [rehypeRaw, [rehypeSanitize, htmlSchema], rehypeKatex, [rehypeHighlight, { detect: false }]];
