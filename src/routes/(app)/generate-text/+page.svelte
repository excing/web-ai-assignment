<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card } from '$lib/components/ui/card';
	import { Loader2, Send, Sparkles } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';

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
