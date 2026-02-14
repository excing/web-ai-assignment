<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { cn } from "$lib/utils";
    import { getCreditBalance } from "$lib/stores/credits.svelte";
    import { getIsAdmin } from "$lib/stores/admin.svelte";
    import { navItems, adminNavItems } from "$lib/config/navigation";
    import { Coins, User } from "lucide-svelte";

    const pathname = $derived($page.url.pathname);
    let balance = $derived(getCreditBalance());
    let isAdmin = $derived(getIsAdmin());

    function isActive(href: string): boolean {
        if (href === '/') return pathname === '/';
        return pathname === href || pathname.startsWith(href + '/');
    }
</script>

<!-- Desktop Sidebar -->
<div class="bg-background hidden h-full w-16 flex-col items-center border-r py-4 min-[1024px]:flex">
    <!-- Logo -->
    <a href="/" class="mb-6 flex h-10 w-10 items-center justify-center rounded-lg font-bold text-lg hover:opacity-80">
        S
    </a>

    <!-- Main Nav -->
    <nav class="flex flex-1 flex-col items-center gap-1">
        {#each navItems as item}
            <button
                onclick={() => goto(item.href)}
                class={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:cursor-pointer",
                    isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={item.label}
            >
                <item.icon class="h-5 w-5" />
            </button>
        {/each}

        {#if isAdmin}
            <div class="my-2 h-px w-6 bg-border"></div>
            {#each adminNavItems as item}
                <button
                    onclick={() => goto(item.href)}
                    class={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:cursor-pointer",
                        isActive(item.href)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    title={item.label}
                >
                    <item.icon class="h-5 w-5" />
                </button>
            {/each}
        {/if}
    </nav>

    <!-- Bottom: Credits + Me -->
    <div class="flex flex-col items-center gap-1">
        <button
            onclick={() => goto('/me/credits')}
            class="flex h-10 w-10 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-muted hover:cursor-pointer"
            title="积分: {balance.toLocaleString()}"
        >
            <div class="flex flex-col items-center">
                <Coins class="h-4 w-4" />
                <span class="text-[10px] font-medium leading-tight">{balance >= 10000 ? Math.floor(balance / 1000) + 'k' : balance}</span>
            </div>
        </button>
        <button
            onclick={() => goto('/me')}
            class={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:cursor-pointer",
                isActive('/me')
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            title="我的"
        >
            <User class="h-5 w-5" />
        </button>
    </div>
</div>
