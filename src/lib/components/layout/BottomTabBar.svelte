<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { cn } from "$lib/utils";
    import { navItems } from "$lib/config/navigation";
    import { User } from "lucide-svelte";

    const pathname = $derived($page.url.pathname);

    function isActive(href: string): boolean {
        if (href === '/') return pathname === '/';
        return pathname === href || pathname.startsWith(href + '/');
    }
</script>

<!-- Mobile Bottom Tab Bar -->
<div class="bg-background fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t min-[1024px]:hidden">
    {#each navItems as item}
        <button
            onclick={() => goto(item.href)}
            class={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors hover:cursor-pointer",
                isActive(item.href)
                    ? "text-primary"
                    : "text-muted-foreground",
            )}
        >
            <item.icon class="h-5 w-5" />
            <span class="text-[10px] font-medium">{item.label}</span>
        </button>
    {/each}

    <button
        onclick={() => goto('/me')}
        class={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors hover:cursor-pointer",
            isActive('/me')
                ? "text-primary"
                : "text-muted-foreground",
        )}
    >
        <User class="h-5 w-5" />
        <span class="text-[10px] font-medium">我的</span>
    </button>
</div>
