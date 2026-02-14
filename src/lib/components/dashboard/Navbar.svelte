<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Sheet from "$lib/components/ui/sheet";
    import { Separator } from "$lib/components/ui/separator";
    import UserProfile from "$lib/components/UserProfile.svelte";
    import { getIsAdmin } from "$lib/stores/admin.svelte";
    import {
        Home,
        Brush,
        MonitorSmartphone,
        GitBranch,
        Menu,
        Coins,
        Package,
        Ticket,
        Server,
    } from "lucide-svelte";

    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
    let sheetOpen = $state(false);
    let isAdmin = $derived(getIsAdmin());
</script>

<div class="flex flex-col">
    <header class="flex h-14 items-center gap-4 border-b px-3 lg:h-[52px]">
        <!-- Mobile menu trigger -->
        <Sheet.Root bind:open={sheetOpen}>
            <Sheet.Trigger class="p-2 transition min-[1024px]:hidden">
                <Menu class="h-5 w-5" />
                <span class="sr-only">Menu</span>
            </Sheet.Trigger>
            <Sheet.Content side="left">
                <Sheet.Header>
                    <a href="/">
                        <Sheet.Title>SvelteKit Starter Kit</Sheet.Title>
                    </a>
                </Sheet.Header>
                <div class="mt-4 flex flex-col space-y-3">
                    <a href="/dashboard" onclick={() => (sheetOpen = false)}>
                        <Button variant="outline" class="w-full">
                            <Home class="mr-2 h-4 w-4" />
                            概览
                        </Button>
                    </a>
                    <a
                        href="/dashboard/chat"
                        onclick={() => (sheetOpen = false)}
                    >
                        <Button variant="outline" class="w-full">
                            <Brush class="mr-2 h-4 w-4" />
                            Chat
                        </Button>
                    </a>
                    <a
                        href="/dashboard/upload"
                        onclick={() => (sheetOpen = false)}
                    >
                        <Button variant="outline" class="w-full">
                            <MonitorSmartphone class="mr-2 h-4 w-4" />
                            上传
                        </Button>
                    </a>
                    <a
                        href="/dashboard/credits"
                        onclick={() => (sheetOpen = false)}
                    >
                        <Button variant="outline" class="w-full">
                            <Coins class="mr-2 h-4 w-4" />
                            积分
                        </Button>
                    </a>
                    {#if isAdmin}
                        <Separator class="my-3" />
                        <p class="text-muted-foreground px-2 text-xs font-medium uppercase">管理</p>
                        <a
                            href="/dashboard/admin/packages"
                            onclick={() => (sheetOpen = false)}
                        >
                            <Button variant="outline" class="w-full">
                                <Package class="mr-2 h-4 w-4" />
                                套餐管理
                            </Button>
                        </a>
                        <a
                            href="/dashboard/admin/codes"
                            onclick={() => (sheetOpen = false)}
                        >
                            <Button variant="outline" class="w-full">
                                <Ticket class="mr-2 h-4 w-4" />
                                兑换码管理
                            </Button>
                        </a>
                        <a
                            href="/dashboard/admin/ai-proxy"
                            onclick={() => (sheetOpen = false)}
                        >
                            <Button variant="outline" class="w-full">
                                <Server class="mr-2 h-4 w-4" />
                                AI Proxy
                            </Button>
                        </a>
                    {/if}
                    <Separator class="my-3" />
                    <a
                        href="/dashboard/settings"
                        onclick={() => (sheetOpen = false)}
                    >
                        <Button variant="outline" class="w-full">
                            <GitBranch class="mr-2 h-4 w-4" />
                            设置
                        </Button>
                    </a>
                </div>
            </Sheet.Content>
        </Sheet.Root>
        <div class="ml-auto flex items-center justify-center gap-2">
            <UserProfile mini={true} />
        </div>
    </header>
    {@render children()}
</div>
