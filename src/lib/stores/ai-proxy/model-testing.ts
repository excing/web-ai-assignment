/**
 * AI Proxy 模型拉取 + 测试（客户端直连 Provider API）
 */

// ============ 模型列表获取 ============

export async function fetchModelList(provider: string, baseUrl: string, apiKey: string): Promise<string[]> {
	const base = baseUrl.replace(/\/+$/, '');

	switch (provider) {
		case 'anthropic':
			return fetchAnthropicModels(base, apiKey);
		case 'google':
			return fetchGoogleModels(base, apiKey);
		default:
			// openai 及其他兼容接口
			return fetchOpenAIModels(base, apiKey);
	}
}

async function fetchOpenAIModels(baseUrl: string, apiKey: string): Promise<string[]> {
	const res = await fetch(`${baseUrl}/models`, {
		headers: { Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(15000)
	});
	if (!res.ok) {
		throw new Error(`API 返回 ${res.status}`);
	}
	const data = await res.json();
	return ((data.data || []) as { id: string }[])
		.map((m) => m.id)
		.sort((a, b) => a.localeCompare(b));
}

async function fetchAnthropicModels(baseUrl: string, apiKey: string): Promise<string[]> {
	const url = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
	const res = await fetch(url, {
		headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', "Authorization": `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(15000)
	});
	if (!res.ok) {
		throw new Error(`API 返回 ${res.status}`);
	}
	const data = await res.json();
	return ((data.data || []) as { id: string }[])
		.map((m) => m.id)
		.sort((a, b) => a.localeCompare(b));
}

async function fetchGoogleModels(baseUrl: string, apiKey: string): Promise<string[]> {
	const url = baseUrl.includes('/v1beta')
		? `${baseUrl}/models?key=${apiKey}`
		: `${baseUrl}/v1beta/models?key=${apiKey}`;
	const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
	if (!res.ok) {
		throw new Error(`API 返回 ${res.status}`);
	}
	const data = await res.json();
	return ((data.models || []) as { name: string }[])
		.map((m) => {
			const name = m.name || '';
			return name.startsWith('models/') ? name.slice(7) : name;
		})
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
}

// ============ 模型可用性测试 ============

export async function testModelChat(
	provider: string,
	baseUrl: string,
	apiKey: string,
	model: string
): Promise<boolean> {
	const base = baseUrl.replace(/\/+$/, '');

	switch (provider) {
		case 'anthropic':
			return testAnthropicChat(base, apiKey, model);
		case 'google':
			return testGoogleChat(base, apiKey, model);
		default:
			return testOpenAIChat(base, apiKey, model);
	}
}

async function testOpenAIChat(baseUrl: string, apiKey: string, model: string): Promise<boolean> {
	const res = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages: [{ role: 'user', content: 'test' }],
			max_tokens: 5
		}),
		signal: AbortSignal.timeout(30000)
	});
	if (!res.ok) return false;
	const data = await res.json();
	const content = data.choices?.[0]?.message?.content ?? '';
	return content.length > 0;
}

async function testAnthropicChat(baseUrl: string, apiKey: string, model: string): Promise<boolean> {
	const url = baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages: [{ role: 'user', content: 'test' }],
			max_tokens: 5
		}),
		signal: AbortSignal.timeout(30000)
	});
	if (!res.ok) return false;
	const data = await res.json();
	const content = data.content?.[0]?.text ?? '';
	return content.length > 0;
}

async function testGoogleChat(baseUrl: string, apiKey: string, model: string): Promise<boolean> {
	const modelPath = model.startsWith('models/') ? model : `models/${model}`;
	const base = baseUrl.includes('/v1beta') ? baseUrl : `${baseUrl}/v1beta`;
	const url = `${base}/${modelPath}:generateContent?key=${apiKey}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [{ parts: [{ text: 'test' }] }],
			generationConfig: { maxOutputTokens: 5 }
		}),
		signal: AbortSignal.timeout(30000)
	});
	if (!res.ok) return false;
	const data = await res.json();
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
	return text.length > 0;
}
