<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Send, Paperclip, X } from 'lucide-svelte';
	import { IMAGE_GEN, UI, type AspectRatio } from '$lib/config/constants';
	import { cn } from '$lib/utils';
	import type { ApiTemplate } from './types';
	import { extractPlaceholders } from './types';

	interface AttachedFile {
		id: string;
		file: File;
		previewUrl: string;
	}

	interface Props {
		input: string;
		attachedFiles: AttachedFile[];
		selectedTemplate: ApiTemplate | null;
		selectedRatio: AspectRatio;
		isDragging: boolean;
		onSubmit: () => void;
		onRemoveFile: (id: string) => void;
		onOpenFilePicker: () => void;
		onSelectRatio: (ratio: AspectRatio) => void;
		onDeselectTemplate: () => void;
		onKeyDown: (e: KeyboardEvent) => void;
		onPaste: (e: ClipboardEvent) => void;
		onInput: (value: string) => void;
		onTextareaRef: (el: HTMLTextAreaElement | null) => void;
	}

	let {
		input,
		attachedFiles,
		selectedTemplate,
		selectedRatio,
		isDragging,
		onSubmit,
		onRemoveFile,
		onOpenFilePicker,
		onSelectRatio,
		onDeselectTemplate,
		onKeyDown,
		onPaste,
		onInput,
		onTextareaRef,
	}: Props = $props();

	let internalRef = $state<HTMLTextAreaElement | null>(null);

	$effect(() => {
		onTextareaRef(internalRef);
	});

	let placeholders = $derived(
		selectedTemplate ? extractPlaceholders(selectedTemplate.prompt) : []
	);

	let canSubmit = $derived(
		input.trim() || attachedFiles.length > 0 || (selectedTemplate && placeholders.length > 0)
	);

	function autoResize() {
		if (internalRef) {
			internalRef.style.height = 'auto';
			internalRef.style.height = Math.min(internalRef.scrollHeight, UI.TEXTAREA_MAX_HEIGHT) + 'px';
		}
	}

	function handleInput(e: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
		onInput(e.currentTarget.value);
		autoResize();
	}
</script>

<div class="border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
	<form class="mx-auto max-w-2xl lg:max-w-3xl" onsubmit={(e) => { e.preventDefault(); onSubmit(); }}>
		<!-- Selected template indicator (no placeholders) -->
		{#if selectedTemplate && placeholders.length === 0}
			<div class="mb-2 flex items-center gap-2">
				<Badge variant="secondary" class="rounded-lg bg-primary/5 text-primary/80">模板: {selectedTemplate.name}</Badge>
				<Button variant="ghost" size="icon-sm" class="ml-auto h-5 w-5" onclick={onDeselectTemplate}>
					<X class="h-3 w-3" />
				</Button>
			</div>
		{/if}

		<!-- Attachment previews -->
		{#if attachedFiles.length > 0}
			<div class="mb-2 flex gap-2 overflow-x-auto pb-1">
				{#each attachedFiles as file (file.id)}
					<div class="group/thumb relative flex-shrink-0">
						<img src={file.previewUrl} alt={file.file.name} class="h-14 w-14 rounded-xl border border-border object-cover" />
						<Button
							variant="ghost"
							size="icon-sm"
							class="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110 hover:bg-foreground"
							onclick={() => onRemoveFile(file.id)}
						>
							<X class="h-3 w-3" />
						</Button>
					</div>
				{/each}
			</div>

			<!-- Aspect ratio selector -->
			{#if attachedFiles.length >= 2}
				<div class="mb-2 flex items-center gap-2">
					<span class="text-xs text-muted-foreground/60">画布比例</span>
					<ToggleGroup.Root
						type="single"
						value={selectedRatio}
						onValueChange={(v) => { if (v) onSelectRatio(v as AspectRatio); }}
						variant="outline"
						size="sm"
					>
						{#each IMAGE_GEN.ASPECT_RATIOS as ratio}
							<ToggleGroup.Item value={ratio} class="px-2.5 py-1 text-xs">
								{ratio}
							</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
				</div>
			{/if}
		{/if}

		<!-- Input area -->
		<div class={cn(
			'relative flex items-end gap-1.5 rounded-2xl border bg-card p-1.5 transition-all focus-within:border-foreground/20 focus-within:shadow-sm',
			isDragging && 'border-foreground/20 shadow-sm'
		)}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
							disabled={attachedFiles.length >= IMAGE_GEN.MAX_REFERENCE_IMAGES}
							onclick={onOpenFilePicker}
						>
							<Paperclip class="h-4 w-4" />
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>添加参考图片</Tooltip.Content>
			</Tooltip.Root>

			<textarea
				bind:this={internalRef}
				value={input}
				oninput={handleInput}
				onkeydown={onKeyDown}
				onpaste={onPaste}
				placeholder="描述你想要的图片..."
				rows={1}
				class="min-h-[36px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
			></textarea>

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							type="submit"
							size="icon"
							class="h-9 w-9 flex-shrink-0 rounded-xl"
							disabled={!canSubmit}
						>
							<Send class="h-4 w-4" />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>生成图片 (⌘+Enter)</Tooltip.Content>
			</Tooltip.Root>
		</div>
		<p class="mt-1.5 text-center text-[11px] text-muted-foreground/40">
			⌘+Enter 生成 · 支持拖拽或粘贴参考图
		</p>
	</form>
</div>
