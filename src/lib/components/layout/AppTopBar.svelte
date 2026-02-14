<script lang="ts">
    import { getCreditBalance } from "$lib/stores/credits.svelte";
    import { Coins } from "lucide-svelte";
    import UserProfile from "$lib/components/UserProfile.svelte";

    let balance = $derived(getCreditBalance());
</script>

<header class="bg-background flex h-14 items-center justify-between border-b px-4">
    <!-- Left: Logo (mobile only) -->
    <a href="/" class="flex items-center font-semibold min-[1024px]:hidden">
        <span>SaaS</span>
    </a>

    <!-- Spacer for desktop (sidebar has logo) -->
    <div class="hidden min-[1024px]:block"></div>

    <!-- Right: Credits + User -->
    <div class="flex items-center gap-3">
        <a
            href="/me/credits"
            class="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-sm transition-colors sm:flex"
        >
            <Coins class="h-4 w-4 text-amber-500" />
            <span class="font-medium">{balance.toLocaleString()}</span>
        </a>
        <UserProfile mini={true} />
    </div>
</header>
