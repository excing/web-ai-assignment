<script lang="ts">
    import type { UIMessage } from "@ai-sdk/svelte";
    import { Square } from "lucide-svelte";
    import MessageText from "./MessageText.svelte";
    import MessageFile from "./MessageFile.svelte";
    import MessageReasoning from "./MessageReasoning.svelte";

    let { message, showCursor, onStop }: {
        message: UIMessage;
        showCursor: boolean;
        onStop: () => void;
    } = $props();

    let hasFiles = $derived(message.parts.some((p) => p.type === "file"));
</script>

<!-- 思考过程 -->
{#each message.parts as part}
    {#if part.type === "reasoning" && part.text}
        <MessageReasoning {part} />
    {/if}
{/each}

<!-- 图片区域 -->
{#if hasFiles}
    <div class="flex flex-wrap gap-2 justify-start">
        {#each message.parts as part}
            {#if part.type === "file"}
                <MessageFile {part} role="assistant" />
            {/if}
        {/each}
    </div>
{/if}

<!-- 文本区域 -->
{#each message.parts as part}
    {#if part.type === "text"}
        <MessageText {part} role="assistant" {showCursor} />
    {/if}
{/each}

<!-- 停止生成 -->
{#if showCursor}
    <button
        onclick={onStop}
        class="flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
        <Square class="h-3 w-3" />
        停止生成
    </button>
{/if}
