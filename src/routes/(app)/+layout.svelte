<script lang="ts">
    import AppSidebar from "$lib/components/layout/AppSidebar.svelte";
    import AppTopBar from "$lib/components/layout/AppTopBar.svelte";
    import BottomTabBar from "$lib/components/layout/BottomTabBar.svelte";
    import * as Tooltip from "$lib/components/ui/tooltip";
    import { setCreditBalance } from "$lib/stores/credits.svelte";
    import { setIsAdmin } from "$lib/stores/admin.svelte";
    import ImageGallery from "$lib/components/image-gallery.svelte";
    import { getGalleryState, closeGallery } from "$lib/stores/gallery.svelte";

    let { data, children } = $props();

    const gallery = getGalleryState();

    $effect(() => {
        setCreditBalance(data.creditBalance);
        setIsAdmin(data.isAdmin);
    });
</script>

<Tooltip.Provider>
<div class="flex h-screen w-full overflow-hidden">
    <!-- Desktop Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Top bar -->
        <AppTopBar />

        <!-- Content -->
        <main class="flex-1 overflow-y-auto pb-14 min-[1024px]:pb-0">
            {@render children()}
        </main>
    </div>

    <!-- Mobile Bottom Tab Bar -->
    <BottomTabBar />
</div>
</Tooltip.Provider>

{#if gallery.isOpen}
    <ImageGallery images={gallery.images} initialIndex={gallery.initialIndex} onClose={closeGallery} />
{/if}
