<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/utils";
    import { Send, Loader2, Paperclip, X } from "lucide-svelte";
    import { UI, CHAT_ATTACHMENTS } from "$lib/config/constants";

    type PendingFile = { id: string; file: File; previewUrl: string };

    let {
        input = $bindable(),
        pendingFiles,
        isDragging,
        isOnline,
        isSubmitting,
        isStreaming,
        canSend,
        onSubmit,
        onRemoveFile,
        onOpenFilePicker,
        onPaste,
    }: {
        input: string;
        pendingFiles: PendingFile[];
        isDragging: boolean;
        isOnline: boolean;
        isSubmitting: boolean;
        isStreaming: boolean;
        canSend: boolean;
        onSubmit: () => void;
        onRemoveFile: (id: string) => void;
        onOpenFilePicker: () => void;
        onPaste: (e: ClipboardEvent) => void;
    } = $props();

    let textareaRef = $state<HTMLTextAreaElement | null>(null);

    function autoResize() {
        if (textareaRef) {
            textareaRef.style.height = "auto";
            textareaRef.style.height = Math.min(textareaRef.scrollHeight, UI.TEXTAREA_MAX_HEIGHT) + "px";
        }
    }

    // Sync height when input changes programmatically (clear, quick prompt, etc.)
    $effect(() => {
        input;
        autoResize();
    });

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    }

    export function focus() {
        textareaRef?.focus();
    }

    export function resetHeight() {
        if (textareaRef) {
            textareaRef.style.height = "auto";
        }
    }
</script>

<div class="border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
    <form
        class="mx-auto max-w-3xl"
        onsubmit={(e) => {
            e.preventDefault();
            onSubmit();
        }}
    >
        <!-- 附件预览条 -->
        {#if pendingFiles.length > 0}
            <div class="mb-2 flex flex-wrap gap-2">
                {#each pendingFiles as pf (pf.id)}
                    <div class="group/thumb relative">
                        <img
                            src={pf.previewUrl}
                            alt={pf.file.name}
                            class="h-16 w-16 rounded-lg border border-border object-cover"
                        />
                        <button
                            type="button"
                            onclick={() => onRemoveFile(pf.id)}
                            class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 transition-opacity group-hover/thumb:opacity-100"
                        >
                            <X class="h-3 w-3" />
                        </button>
                    </div>
                {/each}
            </div>
        {/if}

        <div class={cn(
            "relative flex items-end gap-1.5 rounded-2xl border bg-card p-1.5 transition-all focus-within:border-foreground/20 focus-within:shadow-sm",
            isDragging && "border-foreground/20 shadow-sm"
        )}>
            <!-- 附件按钮 -->
            <button
                type="button"
                class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                disabled={!isOnline || isSubmitting || isStreaming || pendingFiles.length >= CHAT_ATTACHMENTS.MAX_FILES}
                onclick={onOpenFilePicker}
            >
                <Paperclip class="h-4 w-4" />
            </button>

            <textarea
                bind:this={textareaRef}
                value={input}
                oninput={(e) => { input = e.currentTarget.value; autoResize(); }}
                onkeydown={handleKeydown}
                onpaste={onPaste}
                placeholder={isOnline ? "输入消息..." : "网络已断开..."}
                rows={1}
                disabled={!isOnline || isSubmitting || isStreaming}
                class="min-h-[36px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
            ></textarea>

            <Button
                type="submit"
                size="icon"
                class="h-9 w-9 flex-shrink-0 rounded-xl"
                disabled={!canSend}
            >
                {#if isSubmitting && !isStreaming}
                    <Loader2 class="h-4 w-4 animate-spin" />
                {:else}
                    <Send class="h-4 w-4" />
                {/if}
            </Button>
        </div>
        <p class="mt-2 text-center text-xs text-muted-foreground">
            AI 可能会产生错误信息，请核实重要内容
        </p>
    </form>
</div>
