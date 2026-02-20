<script lang="ts">
    import { cn } from "$lib/utils";
    import type { FileUIPart } from "ai";
    import ImageGallery from "$lib/components/image-gallery.svelte";
    import type { MediaResource } from "$lib/types/media";

    let { part, role }: {
        part: FileUIPart;
        role: "user" | "assistant";
    } = $props();

    let isImage = $derived(part.mediaType.startsWith("image/"));
    let isAIImage = $derived(role === "assistant" || !part.filename);
    let showGallery = $state(false);

    function handleClick() {
        showGallery = true;
    }

    let galleryImages = $derived<MediaResource[]>([
        { type: 'image', data: part.url, filename: part.filename || (isAIImage ? 'AI 生成的图片' : '用户上传的图片') }
    ]);
</script>

{#if isImage}
    <button
        onclick={handleClick}
        class={cn(
            "group/img relative block overflow-hidden rounded-xl border border-border/60 cursor-pointer",
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
    </button>

    {#if showGallery}
        <ImageGallery images={galleryImages} initialIndex={0} onClose={() => showGallery = false} />
    {/if}
{/if}
