<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import {
        Coins,
        Settings,
        Receipt,
        HelpCircle,
        LogOut,
        ChevronRight,
        ShieldCheck,
        Info,
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { getCurrentUser, getAuthLoaded, clearAuthState } from "$lib/stores/auth.svelte";
    import { getCreditBalance } from "$lib/stores/credits.svelte";
    import { getIsAdmin } from "$lib/stores/admin.svelte";
    import { adminNavItems } from "$lib/config/navigation";
    import { authClient } from "$lib/auth-client";
    import { Skeleton } from "$lib/components/ui/skeleton";

    let user = $derived(getCurrentUser());
    let loading = $derived(!getAuthLoaded());
    let balance = $derived(getCreditBalance());
    let isAdmin = $derived(getIsAdmin());

    interface MenuItem {
        label: string;
        description?: string;
        icon: typeof Coins;
        href?: string;
        action?: () => void;
        badge?: string;
        destructive?: boolean;
    }

    let menuItems: MenuItem[] = $derived([
        {
            label: "积分",
            description: `余额 ${balance.toLocaleString()} 积分`,
            icon: Coins,
            href: "/me/credits",
        },
        {
            label: "交易记录",
            description: "查看积分交易明细",
            icon: Receipt,
            href: "/me/credits",
        },
    ]);

    const settingsItems: MenuItem[] = [
        {
            label: "账号设置",
            description: "修改个人信息",
            icon: Settings,
            href: "/me/settings",
        },
        {
            label: "帮助与反馈",
            description: "获取帮助或提交反馈",
            icon: HelpCircle,
            href: "/me/help",
        },
        {
            label: "关于",
            description: "版本信息与功能介绍",
            icon: Info,
            href: "/me/about",
        },
    ];

    async function handleSignOut() {
        try {
            await authClient.signOut({
                fetchOptions: {
                    onSuccess: () => {
                        clearAuthState();
                        goto("/sign-in");
                    },
                },
            });
        } catch (err) {
            console.error("Sign out failed:", err);
        }
    }

    function getInitials(name?: string | null): string {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    }
</script>

<section class="flex w-full flex-col items-center px-4 py-6">
    <div class="w-full max-w-lg">
        {#if loading}
            <div class="flex flex-col items-center gap-3 py-8">
                <Skeleton class="h-20 w-20 rounded-full" />
                <Skeleton class="h-6 w-32" />
                <Skeleton class="h-4 w-48" />
            </div>
        {:else}
            <!-- Profile Header -->
            <div class="flex flex-col items-center gap-3 py-4">
                <Avatar.Root class="h-20 w-20">
                    {#if user?.image}
                        <Avatar.Image src={user.image} alt={user?.name || "用户"} />
                    {:else}
                        <Avatar.Fallback class="text-xl">
                            {getInitials(user?.name)}
                        </Avatar.Fallback>
                    {/if}
                </Avatar.Root>
                <div class="text-center">
                    <h1 class="text-xl font-semibold">{user?.name || "用户"}</h1>
                    <p class="text-muted-foreground text-sm">{user?.email || ""}</p>
                </div>
            </div>

            <!-- Credit Balance Card -->
            <Card.Root class="mt-4">
                <button class="w-full" onclick={() => goto("/me/credits")}>
                    <Card.Content class="flex items-center gap-4 p-4">
                        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <Coins class="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div class="text-left">
                            <p class="text-muted-foreground text-sm">积分余额</p>
                            <p class="text-2xl font-bold">{balance.toLocaleString()}</p>
                        </div>
                        <ChevronRight class="text-muted-foreground ml-auto h-5 w-5" />
                    </Card.Content>
                </button>
            </Card.Root>

            <!-- Menu Items -->
            <div class="mt-6 space-y-1">
                {#each menuItems as item}
                    <button
                        class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                        onclick={() => item.href ? goto(item.href) : item.action?.()}
                    >
                        <item.icon class="text-muted-foreground h-5 w-5 flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium">{item.label}</p>
                            {#if item.description}
                                <p class="text-muted-foreground text-xs truncate">{item.description}</p>
                            {/if}
                        </div>
                        <ChevronRight class="text-muted-foreground h-4 w-4 flex-shrink-0" />
                    </button>
                {/each}
            </div>

            <Separator class="my-4" />

            <div class="space-y-1">
                {#each settingsItems as item}
                    <button
                        class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                        onclick={() => item.href ? goto(item.href) : item.action?.()}
                    >
                        <item.icon class="text-muted-foreground h-5 w-5 flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium">{item.label}</p>
                            {#if item.description}
                                <p class="text-muted-foreground text-xs truncate">{item.description}</p>
                            {/if}
                        </div>
                        <ChevronRight class="text-muted-foreground h-4 w-4 flex-shrink-0" />
                    </button>
                {/each}
            </div>

            <Separator class="my-4" />

            {#if isAdmin}
                <!-- Admin Section -->
                <div class="space-y-1">
                    <p class="px-3 pb-1 text-xs font-medium text-primary flex items-center gap-1.5">
                        <ShieldCheck class="h-3.5 w-3.5" />
                        管理后台
                    </p>
                    {#each adminNavItems as item}
                        <button
                            class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                            onclick={() => goto(item.href)}
                        >
                            <item.icon class="text-muted-foreground h-5 w-5 flex-shrink-0" />
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium">{item.label}</p>
                            </div>
                            <ChevronRight class="text-muted-foreground h-4 w-4 flex-shrink-0" />
                        </button>
                    {/each}
                </div>

                <Separator class="my-4" />
            {/if}

            <!-- Sign Out -->
            <button
                class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onclick={handleSignOut}
            >
                <LogOut class="h-5 w-5 flex-shrink-0" />
                <p class="text-sm font-medium">退出登录</p>
            </button>
        {/if}
    </div>
</section>
