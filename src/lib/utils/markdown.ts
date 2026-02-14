/**
 * Markdown 渲染 + Shiki 代码高亮（两阶段策略）
 *
 * 同步阶段：marked.parse() 将 markdown 转为 HTML（流式中每帧调用）
 * 异步阶段：流结束后用 shiki 遍历 DOM 高亮代码块
 */

import { Marked, type Renderer } from 'marked';

// ============ Marked 配置 ============

const renderer: Partial<Renderer> = {
	// 禁用原始 HTML 输入（防 XSS / prompt injection）
	html({ text }) {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	},

	// 代码块：输出带 language class 的 <pre><code>，供后置 shiki 高亮
	code({ text, lang }) {
		const escaped = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
		const langClass = lang ? ` class="language-${lang}"` : '';
		const langAttr = lang ? ` data-lang="${lang}"` : '';
		return `<pre${langAttr}><code${langClass}>${escaped}</code></pre>`;
	},
};

const marked = new Marked({
	gfm: true,
	breaks: true,
	renderer,
});

/**
 * 同步渲染 markdown 为 HTML string
 * 流式输出时每帧调用，性能关键路径
 */
export function renderMarkdown(text: string): string {
	if (!text) return '';
	return marked.parse(text, { async: false }) as string;
}

// ============ Shiki 代码高亮（lazy 加载） ============

type ShikiHighlighter = Awaited<ReturnType<typeof import('shiki')['createHighlighter']>>;

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

function getOrCreateHighlighter(): Promise<ShikiHighlighter> {
	if (!highlighterPromise) {
		highlighterPromise = import('shiki').then(({ createHighlighter }) =>
			createHighlighter({
				themes: ['github-dark', 'github-light'],
				langs: [], // 按需加载
			})
		);
	}
	return highlighterPromise;
}

/**
 * 遍历容器中所有未高亮的代码块，用 shiki 高亮替换
 * 流结束后调用一次
 */
export async function highlightCodeBlocks(container: HTMLElement): Promise<void> {
	const blocks = container.querySelectorAll<HTMLElement>(
		'pre:not([data-highlighted]) code[class*="language-"]'
	);
	if (blocks.length === 0) return;

	const highlighter = await getOrCreateHighlighter();
	const loadedLangs = new Set(highlighter.getLoadedLanguages());

	for (const block of blocks) {
		const pre = block.parentElement;
		if (!pre) continue;

		const lang = block.className.match(/language-([\w+#-]+)/)?.[1] || 'text';
		const code = block.textContent || '';

		// 按需加载语言（未知语言 fallback 到纯文本）
		if (!loadedLangs.has(lang)) {
			try {
				await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0]);
				loadedLangs.add(lang);
			} catch {
				// 语言不支持，跳过高亮，保持原样
				pre.setAttribute('data-highlighted', 'true');
				continue;
			}
		}

		const html = highlighter.codeToHtml(code, {
			lang,
			themes: { light: 'github-light', dark: 'github-dark' },
		});

		// 替换整个 <pre> 元素
		const temp = document.createElement('div');
		temp.innerHTML = html;
		const newPre = temp.firstElementChild as HTMLElement;
		if (newPre) {
			newPre.setAttribute('data-highlighted', 'true');
			// 保留 data-lang 属性（用于 CSS 显示语言标签）
			if (pre.dataset.lang) {
				newPre.setAttribute('data-lang', pre.dataset.lang);
			}
			pre.replaceWith(newPre);
		}
	}
}

/**
 * 为容器中所有代码块注入复制按钮
 * 在 highlightCodeBlocks 之后调用
 */
export function injectCopyButtons(container: HTMLElement): void {
	const pres = container.querySelectorAll<HTMLElement>('pre:not([data-copy-btn])');

	for (const pre of pres) {
		pre.setAttribute('data-copy-btn', 'true');

		const btn = document.createElement('button');
		btn.className = 'code-copy-btn';
		btn.setAttribute('aria-label', '复制代码');
		btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

		btn.addEventListener('click', () => {
			const code = pre.querySelector('code')?.textContent || '';
			navigator.clipboard.writeText(code).then(() => {
				btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
				setTimeout(() => {
					btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
				}, 2000);
			});
		});

		// prepend 确保按钮在 DOM 最前面，不影响代码文本布局
		pre.prepend(btn);
	}
}
