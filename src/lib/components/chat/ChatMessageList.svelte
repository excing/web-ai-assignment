<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import { cn } from "$lib/utils";
    import { getErrorIcon, type ChatError } from "$lib/utils/chat-errors";
    import { Bot, Loader2, RefreshCw } from "lucide-svelte";
    import type { UIMessage } from "@ai-sdk/svelte";
    import UserMessage from "./UserMessage.svelte";
    import AssistantMessage from "./AssistantMessage.svelte";

    let {
        messages,
        isStreaming,
        isSubmitting,
        isOnline,
        lastError,
        user,
        onRetry,
        onStop,
    }: {
        messages: UIMessage[];
        isStreaming: boolean;
        isSubmitting: boolean;
        isOnline: boolean;
        lastError: ChatError | null;
        user: { name?: string | null; image?: string | null } | null;
        onRetry: () => void;
        onStop: () => void;
    } = $props();

    function getInitials(name?: string | null): string {
        if (!name) return "U";
        return name.charAt(0).toUpperCase();
    }
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
    {#each messages as message, i}
        {@const isLastAssistant = message.role === "assistant" && i === messages.length - 1}
        {@const showCursor = isLastAssistant && isStreaming}
        <div
            class={cn(
                "mb-6 flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
        >
            <!-- 头像 -->
            {#if message.role === "user"}
                <Avatar.Root class="h-8 w-8 flex-shrink-0">
                    {#if user?.image}
                        <Avatar.Image src={user.image} alt={user.name || "用户"} />
                    {/if}
                    <Avatar.Fallback class="bg-primary text-primary-foreground text-xs">
                        {getInitials(user?.name)}
                    </Avatar.Fallback>
                </Avatar.Root>
            {:else}
                <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                    <Bot class="h-4 w-4 text-white" />
                </div>
            {/if}

            <!-- 消息内容 -->
            <div class="flex max-w-[80%] flex-col gap-2 min-w-0">
                {#if message.role === "user"}
                    <UserMessage {message} />
                {:else}
                    <AssistantMessage {message} {showCursor} {onStop} />
                {/if}
            </div>
        </div>
    {/each}

    <!-- 等待 AI 响应 -->
    {#if isSubmitting && !isStreaming}
        <div class="mb-6 flex gap-3">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                <Loader2 class="h-4 w-4 animate-spin text-white" />
            </div>
            <div class="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
                <span class="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]"></span>
                <span class="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]"></span>
                <span class="h-2 w-2 animate-bounce rounded-full bg-foreground/40"></span>
            </div>
        </div>
    {/if}

    <!-- 错误状态 -->
    {#if lastError && !isSubmitting && !isStreaming}
        {@const ErrorIcon = getErrorIcon(lastError.type)}
        <div class="mb-6 flex items-center justify-center gap-3">
            <div class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-800 dark:bg-red-900/20">
                <ErrorIcon class="h-4 w-4 flex-shrink-0 text-red-500" />
                <span class="text-sm text-red-600 dark:text-red-400">{lastError.message}</span>
                {#if lastError.action?.href}
                    <a
                        href={lastError.action.href}
                        class="rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                    >
                        {lastError.action.label}
                    </a>
                {:else if lastError.retryable && isOnline}
                    <button
                        onclick={onRetry}
                        class="flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                    >
                        <RefreshCw class="h-3 w-3" />
                        重试
                    </button>
                {/if}
            </div>
        </div>
    {/if}
</div>
