<script lang="ts">
    import { cn } from "$lib/utils";
    import { renderMarkdown } from "$lib/utils/markdown";
    import type { TextUIPart } from "ai";

    let { part, role, showCursor = false }: {
        part: TextUIPart;
        role: "user" | "assistant";
        showCursor?: boolean;
    } = $props();
</script>

{#if role === "user"}
    <div class="rounded-2xl px-4 py-3 bg-primary text-primary-foreground prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-code:rounded prose-code:bg-white/15 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:my-3">
        {@html renderMarkdown(part.text)}
    </div>
{:else}
    <div
        class={cn(
            "prose prose-sm max-w-none dark:prose-invert",
            "prose-p:my-1.5 prose-p:leading-relaxed",
            "prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-white/15",
            "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
            "prose-headings:my-3",
        )}
    >
        {@html renderMarkdown(part.text)}
        {#if showCursor}
            <span class="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-current align-middle"></span>
        {/if}
    </div>
{/if}
