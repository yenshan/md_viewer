import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Markdown from 'react-markdown';
import { remarkPlugins, rehypePlugins } from './markdown-config';
import { BookOpen, Plus, Search, FileText, X, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Sun, Moon, Coffee, ChevronRight, ArrowUpRight, RefreshCw, Check, Copy, List, ArrowUp, FolderOpen } from 'lucide-react';
import 'katex/dist/katex.min.css';
import './style.css';
import { welcome } from './welcome';

const fonts = {
  sans: { name: 'ゴシック', family: '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif' },
  serif: { name: '明朝', family: '"Iowan Old Style", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif' },
  mono: { name: '等幅', family: '"SFMono-Regular", Consolas, "Hiragino Kaku Gothic ProN", monospace' }
};
function saved(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
const browserFiles = new Map();
const webAPI = {
  restore: async () => ({ documents: [], errors: [] }),
  ready: async () => {},
  onDocumentsOpened: () => () => {},
  open: () => new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.md,.markdown'; input.multiple = true;
    input.onchange = async () => {
      const documents = [], errors = [];
      for (const file of input.files) {
        if (!/\.(md|markdown)$/i.test(file.name) || file.size > 20 * 1024 * 1024) { errors.push(`${file.name}: 20 MB以下のMarkdownファイルを選択してください。`); continue; }
        const id = `${file.name}:${file.lastModified}:${file.size}`;
        browserFiles.set(id, file);
        documents.push({ id, name: file.name, folder: '選択したローカルファイル', content: await file.text(), modified: file.lastModified });
      }
      resolve({ documents, errors });
    };
    input.oncancel = () => resolve({ documents: [], errors: [] }); input.click();
  }),
  remove: async id => { browserFiles.delete(id); },
  reload: async id => { const file = browserFiles.get(id); if (!file) throw new Error('ファイルをもう一度追加してください。'); return { id, name: file.name, folder: '選択したローカルファイル', content: await file.text(), modified: file.lastModified }; },
  image: async () => null,
  openLink: href => window.open(href, '_blank', 'noopener,noreferrer'),
  onOpen: () => () => {}
};
const api = window.folio || webAPI;
function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef();
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const language = children?.props?.className?.match(/language-([^ ]+)/)?.[1] || 'text';
  return <div className="code-block"><div className="code-toolbar"><span>{language}</span><button title="コードをコピー" aria-label="コードをコピー" onClick={async () => { try { await navigator.clipboard.writeText(ref.current.innerText); setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'コピーしました' : 'コピー'}</button></div><pre ref={ref} {...props}>{children}</pre></div>;
}
function LocalImage({ src, alt, documentId, ...props }) {
  const [source, setSource] = useState(null);
  const remote = /^(https?:|data:)/i.test(src || '');
  useEffect(() => { let active = true; setSource(null); if (!remote && src) api.image(documentId, src).then(value => { if (active) setSource(value); }).catch(() => {}); return () => { active = false; }; }, [src, documentId, remote]);
  return remote || source ? <img {...props} src={remote ? src : source} alt={alt || ''} loading="lazy" /> : <span className="image-fallback">画像: {alt || src}（読み込めません）</span>;
}
function App() {
  const [documents, setDocuments] = useState([welcome]);
  const [activeId, setActiveId] = useState(() => saved('folio.active', 'welcome'));
  const [theme, setTheme] = useState(() => { const value = saved('folio.theme', 'light'); return ['light', 'dark', 'sepia'].includes(value) ? value : 'light'; });
  const [font, setFont] = useState(() => { const value = saved('folio.font', 'sans'); return fonts[value] ? value : 'sans'; });
  const [size, setSize] = useState(() => { const value = saved('folio.size', 16); return Number.isFinite(value) ? Math.min(24, Math.max(13, value)) : 16; });
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [outline, setOutline] = useState(false);
  const [viewMode, setViewMode] = useState('preview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef();
  const settingsRef = useRef();
  const active = documents.find(doc => doc.id === activeId) || documents[0];
  const merge = useCallback(result => {
    setDocuments(previous => { const next = [...previous]; for (const doc of result.documents) { const index = next.findIndex(item => item.id === doc.id); if (index >= 0) next[index] = doc; else next.push(doc); } return next; });
    if (result.errors.length) setError(result.errors.join('\n'));
  }, []);
  useEffect(() => api.onDocumentsOpened(result => {
    merge(result);
    if (result.documents.length) setActiveId(result.documents[0].id);
  }), [merge]);
  useEffect(() => {
    api.restore().then(merge).catch(error => setError(error.message)).finally(() => {
      setRestored(true);
      api.ready().catch(error => setError(error.message));
    });
  }, [merge]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('folio.theme', JSON.stringify(theme)); }, [theme]);
  useEffect(() => { localStorage.setItem('folio.font', JSON.stringify(font)); }, [font]);
  useEffect(() => { localStorage.setItem('folio.size', JSON.stringify(size)); }, [size]);
  useEffect(() => { if (restored && active) localStorage.setItem('folio.active', JSON.stringify(active.id)); }, [active, restored]);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); setProgress(0); }, [active?.id, viewMode]);
  const open = useCallback(async () => { setBusy(true); setError(''); try { const result = await api.open(); merge(result); if (result.documents.length) setActiveId(result.documents[0].id); } catch (error) { setError(error.message); } finally { setBusy(false); } }, [merge]);
  useEffect(() => api.onOpen(open), [open]);
  useEffect(() => {
    const handler = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o' && !window.folio) { event.preventDefault(); open(); }
      if (event.key === 'Escape') { setSettings(false); setOutline(false); }
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, [open]);
  useEffect(() => { const handler = event => { if (settingsRef.current && !settingsRef.current.contains(event.target)) setSettings(false); }; document.addEventListener('pointerdown', handler); return () => document.removeEventListener('pointerdown', handler); }, []);
  const remove = async id => { try { await api.remove(id); setDocuments(previous => previous.filter(doc => doc.id !== id)); if (activeId === id) setActiveId('welcome'); } catch (error) { setError(error.message); } };
  const reload = async () => { setBusy(true); try { merge({ documents: [await api.reload(active.id)], errors: [] }); setError(''); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  const [headings, setHeadings] = useState([]);
  useEffect(() => { setHeadings([...(scrollRef.current?.querySelectorAll('h1,h2,h3') || [])].map(item => ({ level: Number(item.tagName[1]), text: item.textContent }))); }, [active?.content, viewMode]);
  const stats = useMemo(() => { const text = active?.content || ''; const chars = Array.from(text.replace(/\s/g, '')).length; return { chars: chars.toLocaleString('ja-JP'), minutes: Math.max(1, Math.ceil(chars / 600)) }; }, [active?.content]);
  const components = useMemo(() => ({
    table: ({ node, ...props }) => <div className="table-scroll" tabIndex={0} role="region" aria-label="Markdownの表"><table {...props} /></div>,
    pre: ({ node, ...props }) => <CodeBlock {...props} />,
    img: ({ node, ...props }) => <LocalImage {...props} documentId={active?.id} />,
    a: ({ node, href, children, ...props }) => <a {...props} href={href} onClick={event => { event.preventDefault(); if (href?.startsWith('#')) { let id; try { id = decodeURIComponent(href.slice(1)); } catch { return; } const targets = [...(scrollRef.current?.querySelectorAll('h1,h2,h3,h4,h5,h6') || [])]; const target = targets.find(item => item.textContent.toLowerCase().replace(/\s+/g, '-') === id.toLowerCase()); target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else if (/^(https?:|mailto:)/i.test(href || '')) Promise.resolve(api.openLink(href)).catch(() => setError('リンクを開けませんでした。')); else setError('ローカルファイルへのリンクは、左上の「ファイルを追加」から開いてください。'); }}>{children}</a>
  }), [active?.id]);
  const visible = documents.filter(doc => `${doc.name} ${doc.folder}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={`app ${sidebar ? '' : 'sidebar-hidden'}`}>
    <aside className="sidebar">
      <div className="window-space" />
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setActiveId('welcome'); }}><span className="brand-icon"><BookOpen size={24} strokeWidth={1.6} /></span><span>folio<span className="brand-dot">.</span></span><span className="brand-tag">MARKDOWN READER</span></a>
      <button className="add-button" onClick={open} disabled={busy}><Plus size={17} />ファイルを追加<span className="key-hint">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'} O</span></button>
      <div className="search"><Search size={15} /><input aria-label="ファイルを検索" placeholder="ファイルを検索…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="検索をクリア" onClick={() => setQuery('')}><X size={13} /></button>}</div>
      <div className="library-heading"><span>ライブラリ</span><span>{documents.length.toString().padStart(2, '0')}</span></div>
      <nav className="file-list" aria-label="Markdownファイル一覧">{visible.map(doc => <div key={doc.id} className={`file-row ${active?.id === doc.id ? 'selected' : ''}`}><button className="file-select" onClick={() => setActiveId(doc.id)} title={`${doc.folder}/${doc.name}`}><FileText size={18} strokeWidth={1.5} /><span><strong>{doc.name}</strong><small>{doc.id === 'welcome' ? 'Folioへようこそ' : doc.folder}</small></span>{active?.id === doc.id && <span className="active-dot" />}</button>{doc.id !== 'welcome' && <button className="remove-file" onClick={() => remove(doc.id)} title="一覧から外す（元ファイルは保持）" aria-label={`${doc.name}を一覧から外す`}><X size={13} /></button>}</div>)}{!visible.length && <div className="no-results">一致するファイルがありません。</div>}</nav>
      <div className="sidebar-bottom"><div className="local-badge"><span />LOCAL & PRIVATE</div><p>あなたの言葉に、静かな居場所を。</p><div className="sidebar-footer"><span>Folio</span><span>v1.0.0 <ArrowUpRight size={12} /></span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumbs"><button className="icon-button" title={sidebar ? 'サイドバーを閉じる' : 'サイドバーを開く'} aria-label="サイドバー切り替え" onClick={() => setSidebar(!sidebar)}>{sidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button><span className="breadcrumb-library">ライブラリ</span><ChevronRight size={13} /><span className="breadcrumb-file">{active?.name || 'Markdown Viewer'}</span></div><div className="toolbar"><div className="view-toggle" role="group" aria-label="表示モード"><button aria-pressed={viewMode === 'preview'} onClick={() => setViewMode('preview')}>プレビュー</button><button aria-pressed={viewMode === 'raw'} onClick={() => setViewMode('raw')}>Raw</button></div>{active?.id !== 'welcome' && active && <button className="icon-button" title="ファイルを再読み込み" aria-label="ファイルを再読み込み" disabled={busy} onClick={reload}><RefreshCw size={16} className={busy ? 'spinning' : ''} /></button>}<button className={`icon-button ${outline && viewMode === 'preview' ? 'is-active' : ''}`} title="目次" aria-label="目次" disabled={viewMode === 'raw'} aria-pressed={outline && viewMode === 'preview'} onClick={() => setOutline(!outline)}><List size={19} /></button><span className="toolbar-divider" /><div className="settings-anchor" ref={settingsRef}><button className={`appearance-button ${settings ? 'is-active' : ''}`} onClick={() => setSettings(!settings)} aria-expanded={settings}><SlidersHorizontal size={16} /><span>表示設定</span></button>{settings && <section className="settings-popover" aria-label="表示設定"><div className="popover-heading"><strong>あなたに合う読み心地</strong><button className="icon-button" aria-label="設定を閉じる" onClick={() => setSettings(false)}><X size={15} /></button></div><label>テーマ</label><div className="theme-options">{[['light', 'ライト', Sun], ['dark', 'ダーク', Moon], ['sepia', 'セピア', Coffee]].map(([value, label, Icon]) => <button key={value} className={`theme-option theme-${value} ${theme === value ? 'chosen' : ''}`} onClick={() => setTheme(value)} aria-pressed={theme === value}><Icon size={18} /><span>{label}</span></button>)}</div><label>フォント</label><div className="font-options">{Object.entries(fonts).map(([value, item]) => <button key={value} style={{ fontFamily: item.family }} className={font === value ? 'chosen' : ''} onClick={() => setFont(value)} aria-pressed={font === value}>{item.name}</button>)}</div><div className="size-label"><label htmlFor="font-size">文字サイズ</label><span>{size} px</span></div><div className="size-slider"><span>A</span><input id="font-size" type="range" min="13" max="24" value={size} onChange={event => setSize(Number(event.target.value))} /><span>A</span></div><p className="settings-note">設定は自動で保存されます</p></section>}</div></div></header>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="通知を閉じる" onClick={() => setError('')}><X size={16} /></button></div>}
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <div className="reading-layout"><div className="reader" ref={scrollRef} onScroll={event => { const el = event.currentTarget; setProgress(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) * 100 : 100); }}><div className={`document-wrap ${viewMode === 'raw' ? 'raw-document' : ''}`}><div className="document-eyebrow"><span className="document-type"><FileText size={13} />{viewMode === 'raw' ? 'MARKDOWN SOURCE' : 'MARKDOWN'}</span><span className="reading-time">約 {stats.minutes} 分で読めます</span></div>{viewMode === 'raw' ? <pre className="raw-source" tabIndex={0} aria-label="Markdownの元テキスト" style={{ fontSize: `${size}px` }}><code>{active?.content || ''}</code></pre> : <article className="markdown" style={{ fontFamily: fonts[font].family, fontSize: `${size}px` }}><Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>{active?.content || ''}</Markdown></article>}<div className="document-end"><span /><BookOpen size={17} strokeWidth={1.2} /><span /></div><button className="back-top" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={13} />ページの先頭へ</button></div></div>{outline && viewMode === 'preview' && <aside className="outline"><div className="outline-title">このドキュメント<button className="icon-button" aria-label="目次を閉じる" onClick={() => setOutline(false)}><X size={14} /></button></div>{headings.length ? headings.map((heading, index) => <button key={index} style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }} onClick={() => scrollRef.current?.querySelectorAll('h1,h2,h3')[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{heading.text}</button>) : <p>見出しがありません。</p>}</aside>}</div>
      <footer className="statusbar"><span><span className="status-dot" />{active?.id === 'welcome' ? '読むことに、集中。' : <><FolderOpen size={12} /><span className="status-path" title={active?.folder}>{active?.folder}</span></>}</span><span>{stats.chars} 文字<span className="status-separator">·</span>UTF-8<span className="status-separator">·</span><span className="status-markdown">{viewMode === 'raw' ? 'Markdown · Raw' : 'Markdown'}</span></span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
