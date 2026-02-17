<script lang="ts">
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Button } from "$lib/components/ui/button";
    import type { SessionMeta } from "$lib/stores/chat-history.svelte";
    import { History, SquarePen, Trash2, MessageSquare } from "lucide-svelte";

    let {
        sessions,
        currentSessionId,
        onNewChat,
        onLoadChat,
        onDeleteChat,
    }: {
        sessions: SessionMeta[];
        currentSessionId: string | null;
        onNewChat: () => void;
        onLoadChat: (id: string) => void;
        onDeleteChat: (id: string) => void;
    } = $props();

    function formatTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "刚刚";
        if (minutes < 60) return `${minutes} 分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} 小时前`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} 天前`;
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
</script>

<div class="flex items-center justify-between border-b px-4 py-2">
    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground">
                <History class="h-4 w-4" />
                <span class="hidden sm:inline">历史记录</span>
                {#if sessions.length > 0}
                    <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs">
                        {sessions.length}
                    </span>
                {/if}
            </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="w-72" align="start">
            {#if sessions.length === 0}
                <div class="flex flex-col items-center gap-2 px-4 py-6 text-center">
                    <MessageSquare class="h-8 w-8 text-muted-foreground/40" />
                    <p class="text-sm text-muted-foreground">暂无历史记录</p>
                </div>
            {:else}
                <DropdownMenu.Label>历史对话</DropdownMenu.Label>
                <DropdownMenu.Separator />
                <div class="max-h-80 overflow-y-auto">
                    {#each sessions as session (session.id)}
                        <DropdownMenu.Item
                            class="group/item flex items-start gap-2 pr-1"
                            disabled={session.id === currentSessionId}
                            onclick={() => onLoadChat(session.id)}
                        >
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium">
                                    {session.title}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    {formatTime(session.updatedAt)}
                                </p>
                            </div>
                            <button
                                type="button"
                                class="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-destructive/10 group-hover/item:opacity-100"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChat(session.id);
                                }}
                            >
                                <Trash2 class="h-3.5 w-3.5 text-destructive" />
                            </button>
                        </DropdownMenu.Item>
                    {/each}
                </div>
            {/if}
        </DropdownMenu.Content>
    </DropdownMenu.Root>

    <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" onclick={onNewChat}>
        <SquarePen class="h-4 w-4" />
        <span class="hidden sm:inline">新建聊天</span>
    </Button>
</div>
