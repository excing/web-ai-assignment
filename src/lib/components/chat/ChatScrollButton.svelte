<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { ArrowDown } from "lucide-svelte";

    let { visible, onClick }: { visible: boolean; onClick: () => void } = $props();
</script>

{#if visible}
    <div class="absolute bottom-32 left-1/2 z-10 -translate-x-1/2">
        <Button
            variant="secondary"
            size="icon"
            class="h-8 w-8 rounded-full shadow-lg"
            onclick={onClick}
        >
            <ArrowDown class="h-4 w-4" />
        </Button>
    </div>
{/if}
