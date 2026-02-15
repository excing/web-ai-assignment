<script lang="ts">
    import { Brain, ChevronDown } from "lucide-svelte";
    import { renderMarkdown } from "$lib/utils/markdown";
    import type { ReasoningUIPart } from "ai";

    let { part }: { part: ReasoningUIPart } = $props();

    let isThinking = $derived(part.state === "streaming");
</script>

<details class="group rounded-xl border border-border/60 bg-muted/40" open={isThinking}>
    <summary class="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Brain class="h-3.5 w-3.5 flex-shrink-0" />
        {#if isThinking}
            <span class="animate-pulse">思考中...</span>
        {:else}
            <span>已深度思考</span>
        {/if}
        <ChevronDown class="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
    </summary>
    <div class="border-t border-border/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground/80 prose prose-xs max-w-none dark:prose-invert prose-p:my-0.5 prose-pre:my-1">
        {@html renderMarkdown(part.text)}
        {#if isThinking}
            <span class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle"></span>
        {/if}
    </div>
</details>
