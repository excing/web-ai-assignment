<script lang="ts">
    import { getHeaderLeft, getHeaderCenter, getHeaderRight } from "$lib/stores/page-header.svelte";
    import { getCreditBalance } from "$lib/stores/credits.svelte";
    import { Coins } from "lucide-svelte";
    import UserProfile from "$lib/components/UserProfile.svelte";

    let balance = $derived(getCreditBalance());
    let leftSlot = $derived(getHeaderLeft());
    let centerSlot = $derived(getHeaderCenter());
    let rightSlot = $derived(getHeaderRight());
</script>

<header class="bg-background flex h-14 items-center border-b px-3">
    <!-- Left: page slot or default mobile logo -->
    <div class="flex items-center">
        {#if leftSlot}
            {@render leftSlot()}
        {:else}
            <a href="/" class="flex items-center gap-2 font-semibold min-[1024px]:hidden">
                <img src="/favicon.svg" alt="BingWu AI" class="h-7 w-7" />
                <span>BingWu AI</span>
            </a>
            <div class="hidden min-[1024px]:block"></div>
        {/if}
    </div>

    <!-- Center: page slot (flex-1 to push sides apart) -->
    <div class="flex flex-1 items-center justify-center">
        {#if centerSlot}
            {@render centerSlot()}
        {/if}
    </div>

    <!-- Right: page slot + global chrome -->
    <div class="flex items-center gap-2">
        {#if rightSlot}
            {@render rightSlot()}
        {/if}
        <a
            href="/me/credits"
            class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        >
            <Coins class="h-4 w-4 text-amber-500" />
            <span class="font-medium">{balance.toLocaleString()}</span>
        </a>
        <UserProfile mini={true} />
    </div>
</header>
