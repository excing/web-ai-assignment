<script lang="ts">
    import type { UIMessage } from "@ai-sdk/svelte";
    import { cn } from "$lib/utils";
    import MessageText from "./MessageText.svelte";
    import MessageFile from "./MessageFile.svelte";

    let { message }: { message: UIMessage } = $props();

    let hasFiles = $derived(message.parts.some((p) => p.type === "file"));
</script>

<!-- 图片区域 -->
{#if hasFiles}
    <div class="flex flex-wrap gap-2 justify-end">
        {#each message.parts as part}
            {#if part.type === "file"}
                <MessageFile {part} role="user" />
            {/if}
        {/each}
    </div>
{/if}

<!-- 文本区域 -->
{#each message.parts as part}
    {#if part.type === "text"}
        <MessageText {part} role="user" />
    {/if}
{/each}
