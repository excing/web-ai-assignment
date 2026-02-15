<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import { cn } from "$lib/utils";
    import { getErrorIcon, type ChatError } from "$lib/utils/chat-errors";
    import { renderMarkdown } from "$lib/utils/markdown";
    import {
        Bot,
        Square,
        Loader2,
        RefreshCw,
        Brain,
        ChevronDown,
    } from "lucide-svelte";
    import type { UIMessage } from "@ai-sdk/svelte";

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

    function isImageFile(part: { type: string; mediaType?: string }): boolean {
        return part.type === "file" && !!part.mediaType?.startsWith("image/");
    }

    function isAIGeneratedFile(part: { filename?: string }): boolean {
        return !part.filename;
    }
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
    {#each messages as message, i}
        {@const isLastAssistantMessage = message.role === "assistant" && i === messages.length - 1}
        {@const showCursor = isLastAssistantMessage && isStreaming}
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
                        <Avatar.Image
                            src={user.image}
                            alt={user.name || "用户"}
                        />
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
                <!-- 思考过程 -->
                {#each message.parts as part}
                    {#if part.type === "reasoning" && part.text}
                        {@const isThinking = part.state === "streaming"}
                        <details class="group rounded-xl border border-border/60 bg-muted/40" open={isThinking}>
                            <summary class="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                                <Brain class="h-3.5 w-3.5 flex-shrink-0" />
                                {#if isThinking}
                                    <span class="animate-pulse">思考中...</span>
                                {:else}
                                    <span>已深度思考</span>
                                {/if}
                                <ChevronDown class="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                            </summary>
                            <div class="border-t border-border/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground/80 prose prose-xs max-w-none dark:prose-invert prose-p:my-0.5 prose-pre:my-1">
                                {@html renderMarkdown(part.text)}
                                {#if isThinking}
                                    <span class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle"></span>
                                {/if}
                            </div>
                        </details>
                    {/if}
                {/each}

                <!-- 图片 -->
                {#if message.parts.some((p: { type: string; mediaType?: string }) => isImageFile(p))}
                    <div class={cn(
                        "flex flex-wrap gap-2",
                        message.role === "user" ? "justify-end" : "justify-start"
                    )}>
                        {#each message.parts as part}
                            {#if part.type === "file" && isImageFile(part)}
                                {@const isAIImage = message.role === "assistant" || isAIGeneratedFile(part)}
                                <a
                                    href={part.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class={cn(
                                        "group/img relative block overflow-hidden rounded-xl border border-border/60",
                                        isAIImage && "shadow-sm"
                                    )}
                                >
                                    <img
                                        src={part.url}
                                        alt={part.filename || "AI 生成的图片"}
                                        class={cn(
                                            "max-w-full object-contain transition-opacity group-hover/img:opacity-90",
                                            isAIImage ? "max-h-96 rounded-xl" : "max-h-64"
                                        )}
                                        loading="lazy"
                                    />
                                </a>
                            {/if}
                        {/each}
                    </div>
                {/if}

                <!-- 正文 -->
                {#if message.role === "user"}
                    {#if message.parts.some((p: { type: string }) => p.type === "text")}
                        <div class="rounded-2xl px-4 py-3 bg-primary text-primary-foreground">
                            {#each message.parts as part}
                                {#if part.type === "text"}
                                    <div class="whitespace-pre-wrap break-words">{part.text}</div>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                {:else}
                    {#each message.parts as part}
                        {#if part.type === "text"}
                            <div
                                class={cn(
                                    "prose prose-sm max-w-none dark:prose-invert",
                                    "prose-p:my-1.5 prose-p:leading-relaxed",
                                    "prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-white/15",
                                    "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
                                    "prose-headings:my-3",
                                )}
                            >
                                {@html renderMarkdown(part.text)}
                                {#if showCursor}
                                    <span class="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-current align-middle"></span>
                                {/if}
                            </div>
                        {/if}
                    {/each}
                {/if}

                <!-- 停止按钮 -->
                {#if showCursor}
                    <button
                        onclick={onStop}
                        class="flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        <Square class="h-3 w-3" />
                        停止生成
                    </button>
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
