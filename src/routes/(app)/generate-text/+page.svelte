<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card } from '$lib/components/ui/card';
	import { Loader2, Send, Sparkles, Image, Video, Music, File, Link } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';

	interface MediaResource {
		type: 'image' | 'video' | 'audio' | 'file' | 'url';
		data: string;
		mimeType?: string;
		filename?: string;
		isBase64?: boolean;
	}

	let input = $state('');
	let isLoading = $state(false);
	let response = $state<{
		text: string;
		finishReason: string;
		usage: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		};
		reasoning?: string;
		mediaResources: MediaResource[];
	} | null>(null);

	async function handleSubmit() {
		if (!input.trim() || isLoading) return;

		isLoading = true;
		response = null;

		try {
			const res = await fetch('/api/generate-text', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [
						{
							role: 'user',
							parts: [
								{
									type: 'text',
									text: input.trim()
								}
							]
						}
					]
				})
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || '请求失败');
			}

			response = await res.json();
			toast.success('生成完成');
		} catch (error) {
			console.error('Generate text error:', error);
			toast.error(error instanceof Error ? error.message : '生成失败，请重试');
		} finally {
			isLoading = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit();
		}
	}

	let renderedHtml = $derived(response ? marked(response.text) : '');

	function getMediaIcon(type: MediaResource['type']) {
		switch (type) {
			case 'image':
				return Image;
			case 'video':
				return Video;
			case 'audio':
				return Music;
			case 'url':
				return Link;
			default:
				return File;
		}
	}

	function getMediaTypeLabel(type: MediaResource['type']) {
		const labels = {
			image: '图片',
			video: '视频',
			audio: '音频',
			file: '文件',
			url: '链接'
		};
		return labels[type];
	}
</script>

<div class="container mx-auto max-w-4xl p-6">
	<div class="mb-6">
		<h1 class="mb-2 flex items-center gap-2 text-3xl font-bold">
			<Sparkles class="h-8 w-8 text-primary" />
			文本生成测试
		</h1>
		<p class="text-muted-foreground">测试非流式 AI 文本生成服务</p>
	</div>

	<!-- 输入区域 -->
	<Card class="mb-6 p-6">
		<div class="space-y-4">
			<div>
				<label for="prompt" class="mb-2 block text-sm font-medium">输入提示词</label>
				<Textarea
					id="prompt"
					bind:value={input}
					onkeydown={handleKeyDown}
					placeholder="输入你的问题或提示词...&#10;&#10;提示：按 Ctrl/Cmd + Enter 快速发送"
					class="min-h-[120px] resize-none"
					disabled={isLoading}
				/>
			</div>

			<div class="flex justify-end">
				<Button onclick={handleSubmit} disabled={!input.trim() || isLoading} class="gap-2">
					{#if isLoading}
						<Loader2 class="h-4 w-4 animate-spin" />
						生成中...
					{:else}
						<Send class="h-4 w-4" />
						生成文本
					{/if}
				</Button>
			</div>
		</div>
	</Card>

	<!-- 响应区域 -->
	{#if response}
		<div class="space-y-4">
			<!-- 生成的文本 -->
			<Card class="p-6">
				<h2 class="mb-4 text-lg font-semibold">生成结果</h2>
				<div class="prose prose-sm max-w-none dark:prose-invert">
					{@html renderedHtml}
				</div>
			</Card>

			<!-- 推理内容 -->
			{#if response.reasoning}
				<Card class="border-primary/20 bg-primary/5 p-6">
					<h2 class="mb-4 text-lg font-semibold text-primary">推理过程</h2>
					<div class="whitespace-pre-wrap text-sm text-muted-foreground">
						{response.reasoning}
					</div>
				</Card>
			{/if}

			<!-- 多媒体资源 -->
			{#if response.mediaResources && response.mediaResources.length > 0}
				<Card class="p-6">
					<h2 class="mb-4 text-lg font-semibold">多媒体资源 ({response.mediaResources.length})</h2>
					<div class="space-y-4">
						{#each response.mediaResources as resource, index}
							{@const IconComponent = getMediaIcon(resource.type)}
							<div class="flex items-start gap-4 rounded-lg border p-4">
								<div class="flex-shrink-0">
									<IconComponent class="h-6 w-6 text-muted-foreground" />
								</div>
								<div class="flex-1 space-y-2">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium">{getMediaTypeLabel(resource.type)}</span>
										{#if resource.isBase64}
											<span class="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
												Base64
											</span>
										{/if}
										{#if resource.mimeType}
											<span class="text-xs text-muted-foreground">{resource.mimeType}</span>
										{/if}
									</div>
									{#if resource.filename}
										<div class="text-sm text-muted-foreground">{resource.filename}</div>
									{/if}
									{#if resource.type === 'image'}
										<div class="mt-2">
											<img
												src={resource.data}
												alt={resource.filename || '生成的图片'}
												class="max-h-64 rounded border"
											/>
										</div>
									{:else if resource.type === 'video'}
										<div class="mt-2">
											<video src={resource.data} controls class="max-h-64 rounded border">
												<track kind="captions" />
											</video>
										</div>
									{:else if resource.type === 'audio'}
										<div class="mt-2">
											<audio src={resource.data} controls class="w-full">
												<track kind="captions" />
											</audio>
										</div>
									{:else}
										<div class="mt-2">
											<a
												href={resource.data}
												target="_blank"
												rel="noopener noreferrer"
												class="text-sm text-primary hover:underline"
											>
												{resource.data.length > 80
													? resource.data.substring(0, 80) + '...'
													: resource.data}
											</a>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- 元数据 -->
			<Card class="p-6">
				<h2 class="mb-4 text-lg font-semibold">元数据</h2>
				<div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
					<div>
						<div class="text-muted-foreground">完成原因</div>
						<div class="font-medium">{response.finishReason}</div>
					</div>
					<div>
						<div class="text-muted-foreground">输入 Token</div>
						<div class="font-medium">{response.usage.promptTokens}</div>
					</div>
					<div>
						<div class="text-muted-foreground">输出 Token</div>
						<div class="font-medium">{response.usage.completionTokens}</div>
					</div>
					<div>
						<div class="text-muted-foreground">总计 Token</div>
						<div class="font-medium">{response.usage.totalTokens}</div>
					</div>
				</div>
			</Card>
		</div>
	{/if}

	<!-- 加载状态 -->
	{#if isLoading}
		<Card class="flex items-center justify-center p-12">
			<div class="flex flex-col items-center gap-4">
				<Loader2 class="h-12 w-12 animate-spin text-primary" />
				<p class="text-muted-foreground">正在生成文本...</p>
			</div>
		</Card>
	{/if}
</div>
