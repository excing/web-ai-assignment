<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card } from '$lib/components/ui/card';
	import { Loader2, Send, ImageIcon, Download, ExternalLink } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface MediaResource {
		type: 'image' | 'video' | 'audio' | 'file' | 'url';
		data: string;
		mimeType?: string;
		filename?: string;
		isBase64?: boolean;
	}

	let input = $state('');
	let isLoading = $state(false);
	let mediaResources = $state<MediaResource[]>([]);

	async function handleSubmit() {
		if (!input.trim() || isLoading) return;

		isLoading = true;
		mediaResources = [];

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

			const result = await res.json();
			mediaResources = result.mediaResources || [];

			if (mediaResources.length === 0) {
				toast.info('未生成任何图片，请尝试更具体的描述');
			} else {
				toast.success(`成功生成 ${mediaResources.length} 个媒体资源`);
			}
		} catch (error) {
			console.error('Generate image error:', error);
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

	function downloadImage(resource: MediaResource, index: number) {
		const link = document.createElement('a');
		link.href = resource.data;
		link.download = resource.filename || `generated-image-${index + 1}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		toast.success('下载成功');
	}

	const quickPrompts = [
		'一只可爱的猫咪在花园里玩耍',
		'未来城市的夜景，霓虹灯闪烁',
		'宁静的湖边日落景色',
		'科幻风格的太空站'
	];

	function useQuickPrompt(prompt: string) {
		input = prompt;
	}
</script>

<div class="container mx-auto max-w-6xl p-6">
	<div class="mb-6">
		<h1 class="mb-2 flex items-center gap-2 text-3xl font-bold">
			<ImageIcon class="h-8 w-8 text-primary" />
			AI 图片生成
		</h1>
		<p class="text-muted-foreground">使用 AI 生成精美图片，支持多种风格和场景</p>
	</div>

	<!-- 输入区域 -->
	<Card class="mb-6 p-6">
		<div class="space-y-4">
			<div>
				<label for="prompt" class="mb-2 block text-sm font-medium">描述你想要的图片</label>
				<Textarea
					id="prompt"
					bind:value={input}
					onkeydown={handleKeyDown}
					placeholder="例如：一只可爱的猫咪在花园里玩耍&#10;&#10;提示：按 Ctrl/Cmd + Enter 快速生成"
					class="min-h-[120px] resize-none"
					disabled={isLoading}
				/>
			</div>

			<!-- 快捷提示词 -->
			<div>
				<p class="mb-2 text-sm text-muted-foreground">快捷提示词：</p>
				<div class="flex flex-wrap gap-2">
					{#each quickPrompts as prompt}
						<Button
							variant="outline"
							size="sm"
							onclick={() => useQuickPrompt(prompt)}
							disabled={isLoading}
						>
							{prompt}
						</Button>
					{/each}
				</div>
			</div>

			<div class="flex justify-end">
				<Button onclick={handleSubmit} disabled={!input.trim() || isLoading} class="gap-2">
					{#if isLoading}
						<Loader2 class="h-4 w-4 animate-spin" />
						生成中...
					{:else}
						<Send class="h-4 w-4" />
						生成图片
					{/if}
				</Button>
			</div>
		</div>
	</Card>

	<!-- 加载状态 -->
	{#if isLoading}
		<Card class="flex items-center justify-center p-12">
			<div class="flex flex-col items-center gap-4">
				<Loader2 class="h-12 w-12 animate-spin text-primary" />
				<p class="text-muted-foreground">正在生成图片，请稍候...</p>
			</div>
		</Card>
	{/if}

	<!-- 图片展示区域 -->
	{#if mediaResources.length > 0 && !isLoading}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-semibold">生成结果 ({mediaResources.length})</h2>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each mediaResources as resource, index}
					<Card class="overflow-hidden">
						<div class="relative aspect-square bg-muted">
							{#if resource.type === 'image'}
								<img
									src={resource.data}
									alt={resource.filename || `生成的图片 ${index + 1}`}
									class="h-full w-full object-cover"
								/>
							{:else if resource.type === 'video'}
								<video src={resource.data} controls class="h-full w-full object-cover">
									<track kind="captions" />
								</video>
							{:else if resource.type === 'audio'}
								<div class="flex h-full items-center justify-center p-4">
									<audio src={resource.data} controls class="w-full">
										<track kind="captions" />
									</audio>
								</div>
							{:else}
								<div class="flex h-full items-center justify-center">
									<ImageIcon class="h-16 w-16 text-muted-foreground" />
								</div>
							{/if}
						</div>

						<div class="p-4">
							<div class="mb-3 flex items-center justify-between">
								<div class="flex-1">
									{#if resource.filename}
										<p class="truncate text-sm font-medium">{resource.filename}</p>
									{/if}
									{#if resource.mimeType}
										<p class="text-xs text-muted-foreground">{resource.mimeType}</p>
									{/if}
									{#if resource.isBase64}
										<span class="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
											Base64
										</span>
									{/if}
								</div>
							</div>

							<div class="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									class="flex-1 gap-2"
									onclick={() => downloadImage(resource, index)}
								>
									<Download class="h-4 w-4" />
									下载
								</Button>
								{#if !resource.isBase64}
									<Button
										variant="outline"
										size="sm"
										onclick={() => window.open(resource.data, '_blank')}
									>
										<ExternalLink class="h-4 w-4" />
									</Button>
								{/if}
							</div>
						</div>
					</Card>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 空状态 -->
	{#if mediaResources.length === 0 && !isLoading}
		<Card class="p-12 text-center">
			<ImageIcon class="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
			<h3 class="mb-2 text-lg font-semibold">开始创作</h3>
			<p class="text-muted-foreground">输入描述，让 AI 为你生成精美图片</p>
		</Card>
	{/if}
</div>
