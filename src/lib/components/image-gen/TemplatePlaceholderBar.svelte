<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Send, Paperclip, X, Sparkles, ImageIcon, Plus } from 'lucide-svelte';
	import { IMAGE_GEN, type AspectRatio } from '$lib/config/constants';
	import { cn } from '$lib/utils';
	import type { ApiTemplate } from './types';

	interface AttachedFile {
		id: string;
		file: File;
		previewUrl: string;
	}

	interface Props {
		template: ApiTemplate;
		placeholders: string[];
		placeholderValues: Record<string, string>;
		resolvedPrompt: string;
		attachedFiles: AttachedFile[];
		selectedRatio: AspectRatio;
		needsImages: boolean;
		imageCountHint: string;
		isDragging: boolean;
		onPlaceholderChange: (key: string, value: string) => void;
		onSubmit: () => void;
		onDeselectTemplate: () => void;
		onRemoveFile: (id: string) => void;
		onOpenFilePicker: () => void;
		onSelectRatio: (ratio: AspectRatio) => void;
		onKeyDown: (e: KeyboardEvent) => void;
		onPaste: (e: ClipboardEvent) => void;
	}

	let {
		template,
		placeholders,
		placeholderValues,
		resolvedPrompt,
		attachedFiles,
		selectedRatio,
		needsImages,
		imageCountHint,
		isDragging,
		onPlaceholderChange,
		onSubmit,
		onDeselectTemplate,
		onRemoveFile,
		onOpenFilePicker,
		onSelectRatio,
		onKeyDown,
		onPaste,
	}: Props = $props();

	let allFilled = $derived(
		placeholders.every((p) => placeholderValues[p]?.trim())
	);

	let imageRequirementMet = $derived(() => {
		if (!needsImages) return true;
		const count = attachedFiles.length;
		if (template.imageCountMin > 0 && count < template.imageCountMin) return false;
		if (template.imageCountMax > 0 && count > template.imageCountMax) return false;
		return count > 0;
	});

	let canSubmit = $derived(allFilled && imageRequirementMet());

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (canSubmit) onSubmit();
		}
		onKeyDown(e);
	}
</script>

<div
	class="border-t bg-background/95 backdrop-blur-sm"
	style="animation: slideUp 0.2s ease both;"
>
	<div class="mx-auto max-w-2xl px-4 py-3 lg:max-w-3xl">
		<!-- Header: template info + close -->
		<div class="mb-3 flex items-start gap-3">
			<Avatar.Root class="h-9 w-9 flex-shrink-0 rounded-xl">
				<Avatar.Image src={template.previewImageUrl} alt={template.name} class="rounded-xl" />
				<Avatar.Fallback class="rounded-xl">
					<Sparkles class="h-4 w-4 text-muted-foreground" />
				</Avatar.Fallback>
			</Avatar.Root>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-foreground">{template.name}</span>
					{#if needsImages}
						<Badge variant="secondary" class="text-[10px]">{imageCountHint}</Badge>
					{/if}
				</div>
				{#if template.description}
					<p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{template.description}</p>
				{/if}
			</div>
			<Button variant="ghost" size="icon-sm" class="h-7 w-7 flex-shrink-0 rounded-full" onclick={onDeselectTemplate}>
				<X class="h-3.5 w-3.5" />
			</Button>
		</div>

		<!-- Placeholder inputs -->
		<div class="flex flex-wrap gap-2">
			{#each placeholders as placeholder}
				<div class="flex min-w-[140px] flex-1 items-center gap-1.5">
					<label for="ph-{placeholder}" class="flex-shrink-0 text-xs text-muted-foreground/70">{placeholder}</label>
					<Input
						id="ph-{placeholder}"
						value={placeholderValues[placeholder] ?? ''}
						oninput={(e) => onPlaceholderChange(placeholder, (e.target as HTMLInputElement).value)}
						onkeydown={handleKeyDown}
						onpaste={onPaste}
						placeholder={`${placeholder}...`}
						class="h-8 text-sm"
					/>
				</div>
			{/each}
		</div>

		<!-- Image attachment area (conditional) -->
		{#if needsImages}
			<div class="mt-3">
				{#if attachedFiles.length === 0}
					<!-- Empty state: drop zone -->
					<button
						onclick={onOpenFilePicker}
						class={cn(
							'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs transition-colors',
							isDragging
								? 'border-primary/40 bg-primary/5 text-primary'
								: 'border-border/60 text-muted-foreground/60 hover:border-border hover:bg-accent/30 hover:text-muted-foreground'
						)}
					>
						<ImageIcon class="h-4 w-4" />
						<span>点击或拖拽添加参考图</span>
						{#if imageCountHint}
							<span class="text-muted-foreground/40">({imageCountHint})</span>
						{/if}
					</button>
				{:else}
					<!-- Thumbnails + add more -->
					<div class="flex items-center gap-2">
						<div class="flex gap-1.5 overflow-x-auto">
							{#each attachedFiles as file (file.id)}
								<div class="group/thumb relative flex-shrink-0">
									<img src={file.previewUrl} alt={file.file.name} class="h-12 w-12 rounded-lg border border-border/60 object-cover" />
									<Button
										variant="ghost"
										size="icon-sm"
										class="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110 hover:bg-foreground"
										onclick={() => onRemoveFile(file.id)}
									>
										<X class="h-2.5 w-2.5" />
									</Button>
								</div>
							{/each}

							<!-- Add more button -->
							{#if attachedFiles.length < IMAGE_GEN.MAX_REFERENCE_IMAGES}
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<button
												{...props}
												onclick={onOpenFilePicker}
												class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 text-muted-foreground/50 transition-colors hover:border-border hover:bg-accent/30 hover:text-muted-foreground"
											>
												<Plus class="h-4 w-4" />
											</button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>添加更多参考图</Tooltip.Content>
								</Tooltip.Root>
							{/if}
						</div>

						<!-- Aspect ratio (2+ images) -->
						{#if attachedFiles.length >= 2}
							<div class="ml-auto flex items-center gap-1.5">
								<span class="text-[10px] text-muted-foreground/50">比例</span>
								<ToggleGroup.Root
									type="single"
									value={selectedRatio}
									onValueChange={(v) => { if (v) onSelectRatio(v as AspectRatio); }}
									variant="outline"
									size="sm"
								>
									{#each IMAGE_GEN.ASPECT_RATIOS as ratio}
										<ToggleGroup.Item value={ratio} class="h-6 px-1.5 text-[10px]">
											{ratio}
										</ToggleGroup.Item>
									{/each}
								</ToggleGroup.Root>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Live preview + submit -->
		<div class="mt-3 flex items-end gap-2">
			<div class={cn(
				'min-h-[36px] flex-1 rounded-xl px-3 py-2 text-sm leading-relaxed transition-colors',
				allFilled
					? 'bg-muted/60 text-foreground/80'
					: 'bg-muted/30 text-muted-foreground/40'
			)}>
				{#if allFilled}
					<span class="preview-text">{resolvedPrompt}</span>
				{:else}
					<span class="italic">填写占位符以预览最终描述...</span>
				{/if}
			</div>

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							size="icon"
							class="h-9 w-9 flex-shrink-0 rounded-xl"
							disabled={!canSubmit}
							onclick={onSubmit}
						>
							<Send class="h-4 w-4" />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>生成图片 (⌘+Enter)</Tooltip.Content>
			</Tooltip.Root>
		</div>

		<p class="mt-1.5 text-center text-[11px] text-muted-foreground/40">
			⌘+Enter 生成 · {needsImages ? '支持拖拽或粘贴参考图' : '所有占位符填写后即可生成'}
		</p>
	</div>
</div>

<style>
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.preview-text {
		word-break: break-all;
	}
</style>
