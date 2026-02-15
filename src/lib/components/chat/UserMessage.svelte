<script lang="ts">
    import type { UIMessage } from "@ai-sdk/svelte";
    import { cn } from "$lib/utils";
    import MessageText from "./MessageText.svelte";
    import MessageFile from "./MessageFile.svelte";

    let { message }: { message: UIMessage } = $props();
</script>

<!-- 按原始顺序显示所有 parts -->
{#each message.parts as part}
    {#if part.type === "file"}
        <MessageFile {part} role="user" />
    {:else if part.type === "text"}
        <MessageText {part} role="user" />
    {/if}
{/each}
