import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
export const remarkPlugins = [remarkGfm, remarkMath];
export const rehypePlugins = [rehypeKatex, [rehypeHighlight, { detect: false }]];
