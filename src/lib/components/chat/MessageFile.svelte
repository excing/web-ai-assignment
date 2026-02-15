<script lang="ts">
    import { cn } from "$lib/utils";
    import type { FileUIPart } from "ai";

    let { part, role }: {
        part: FileUIPart;
        role: "user" | "assistant";
    } = $props();

    let isImage = $derived(part.mediaType.startsWith("image/"));
    let isAIImage = $derived(role === "assistant" || !part.filename);
</script>

{#if isImage}
    <a
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        class={cn(
            "group/img relative block overflow-hidden rounded-xl border border-border/60",
            isAIImage && "shadow-sm"
        )}
    >
        <img
            src={part.url}
            alt={part.filename || "AI 生成的图片"}
            class={cn(
                "max-w-full object-contain transition-opacity group-hover/img:opacity-90",
                isAIImage ? "max-h-96 rounded-xl" : "max-h-64"
            )}
            loading="lazy"
        />
    </a>
{/if}
