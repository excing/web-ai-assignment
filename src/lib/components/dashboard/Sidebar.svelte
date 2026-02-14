<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { cn } from "$lib/utils";
    import UserProfile from "$lib/components/UserProfile.svelte";
    import { getCreditBalance } from "$lib/stores/credits.svelte";
    import { getIsAdmin } from "$lib/stores/admin.svelte";
    import {
        Home,
        MessageCircle,
        Upload,
        Settings,
        Coins,
        Package,
        Ticket,
        Server,
    } from "lucide-svelte";

    interface NavItem {
        label: string;
        href: string;
        icon: typeof Home;
    }

    const navItems: NavItem[] = [
        {
            label: "概览",
            href: "/dashboard",
            icon: Home,
        },
        {
            label: "Chat",
            href: "/dashboard/chat",
            icon: MessageCircle,
        },
        {
            label: "上传",
            href: "/dashboard/upload",
            icon: Upload,
        },
        {
            label: "积分",
            href: "/dashboard/credits",
            icon: Coins,
        },
    ];

    const adminNavItems: NavItem[] = [
        {
            label: "套餐管理",
            href: "/dashboard/admin/packages",
            icon: Package,
        },
        {
            label: "兑换码管理",
            href: "/dashboard/admin/codes",
            icon: Ticket,
        },
        {
            label: "AI Proxy",
            href: "/dashboard/admin/ai-proxy",
            icon: Server,
        },
    ];

    const pathname = $derived($page.url.pathname);
    let balance = $derived(getCreditBalance());
    let isAdmin = $derived(getIsAdmin());
</script>

<div class="bg-background hidden h-full w-64 border-r min-[1024px]:block">
    <div class="flex h-full flex-col">
        <div class="flex h-[3.45rem] items-center border-b px-4">
            <a
                class="flex items-center font-semibold hover:cursor-pointer"
                href="/"
            >
                <span>SvelteKit Starter Kit</span>
            </a>
        </div>

        <div class="flex items-center gap-2 border-b px-4 py-3">
            <Coins class="h-4 w-4 text-amber-500" />
            <span class="text-muted-foreground text-sm">积分余额</span>
            <span class="ml-auto text-sm font-semibold">{balance.toLocaleString()}</span>
        </div>

        <nav
            class="flex h-full w-full flex-col items-start justify-between space-y-1"
        >
            <div class="w-full space-y-1 p-4">
                {#each navItems as item}
                    <button
                        onclick={() => goto(item.href)}
                        class={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:cursor-pointer",
                            pathname === item.href
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        <item.icon class="h-4 w-4" />
                        {item.label}
                    </button>
                {/each}

                {#if isAdmin}
                    <div class="mt-3 border-t pt-3">
                        <p class="text-muted-foreground mb-1 px-3 text-xs font-medium uppercase">管理</p>
                        {#each adminNavItems as item}
                            <button
                                onclick={() => goto(item.href)}
                                class={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:cursor-pointer",
                                    pathname === item.href
                                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <item.icon class="h-4 w-4" />
                                {item.label}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="flex w-full flex-col gap-2">
                <div class="px-4">
                    <button
                        onclick={() => goto("/dashboard/settings")}
                        class={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:cursor-pointer",
                            pathname === "/dashboard/settings"
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        <Settings class="h-4 w-4" />
                        设置
                    </button>
                </div>
                <UserProfile />
            </div>
        </nav>
    </div>
</div>
