<script lang="ts">
    import { Chat } from "@ai-sdk/svelte";
    import type { FileUIPart } from "ai";
    import { getCurrentUser } from "$lib/stores/auth.svelte";
    import { getCreditBalance, fetchCreditBalance } from "$lib/stores/credits.svelte";
    import { setHeaderSlots, clearHeaderSlots } from "$lib/stores/page-header.svelte";
    import { parseError, type ChatError } from "$lib/utils/chat-errors";
    import { highlightCodeBlocks, injectCopyButtons } from "$lib/utils/markdown";
    import { generateUUID } from "$lib/utils/uuid";
    import { CREDITS, CHAT_ATTACHMENTS, UI } from "$lib/config/constants";
    import { useFileManagement } from "$lib/composables/use-file-management.svelte";
    import { compressImage } from "$lib/utils/image-compress";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Button } from "$lib/components/ui/button";
    import { ImageIcon, History, SquarePen, Trash2, MessageSquare, WifiOff, AlertCircle } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { tick, onMount } from "svelte";
    import { browser } from "$app/environment";
    import {
        ChatEmptyState,
        ChatMessageList,
        ChatInputArea,
        ChatScrollButton,
    } from "$lib/components/chat";
    import {
        saveChatSession,
        loadChatSession,
        deleteChatSession,
        getChatSessionList,
        revokeActiveObjectUrls,
        type SessionMeta,
    } from "$lib/stores/chat";

    // ── 状态 ──
    let input = $state("");
    let messagesContainer = $state<HTMLDivElement | null>(null);
    let fileInputRef = $state<HTMLInputElement | null>(null);
    let inputAreaRef = $state<ChatInputArea | null>(null);

    let shouldAutoScroll = $state(true);
    let showScrollButton = $state(false);
    let isSubmitting = $state(false);
    let lastError = $state<ChatError | null>(null);
    let isOnline = $state(true);
    let failedMessage = $state<string | null>(null);

    // ── File management (composable) ──
    const fileMgr = useFileManagement({
        maxFiles: CHAT_ATTACHMENTS.MAX_FILES,
        allowedTypes: CHAT_ATTACHMENTS.ALLOWED_TYPES,
        deduplicateByName: false,
    });

    let pendingFiles = $derived(fileMgr.pendingFiles);
    let isDragging = $derived(fileMgr.isDragging);

    let user = $derived(getCurrentUser());
    let creditBalance = $derived(getCreditBalance());
    let showLowBalance = $derived(isOnline && creditBalance < CREDITS.LOW_BALANCE_WARNING);

    // ── 聊天历史状态 ──
    let currentSessionId = $state<string>(generateUUID());
    let sessionMetas = $state<SessionMeta[]>([]);

    // ── Top Bar snippet 注入 ──
    $effect(() => {
        setHeaderSlots({ left: headerLeft, center: headerCenter, right: headerRight });
        return () => clearHeaderSlots();
    });

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

    // ── Chat 实例 ──
    function handleError(error: Error | unknown) {
        console.error("Chat error:", error);
        lastError = parseError(error, isOnline);
        if (lastError.action?.href) {
            toast.error(lastError.message, {
                action: { label: lastError.action.label, onClick: () => goto(lastError!.action!.href!) },
            });
        } else {
            toast.error(lastError.message);
        }
    }

    function handleFinish(options: { isError: boolean; isAbort: boolean; isDisconnect: boolean }) {
        isSubmitting = false;
        if (options.isError || options.isDisconnect) {
            if (!lastError) {
                lastError = options.isDisconnect
                    ? { type: 'network', message: "连接已断开", retryable: true }
                    : { type: 'unknown', message: "请求失败，请重试", retryable: true };
                toast.error(lastError.message);
            }
        } else if (!options.isAbort) {
            fetchCreditBalance();
            autoSaveCurrentChat();
        }
    }

    const chat = new Chat({
        onError: (error) => handleError(error),
        onFinish: (options) => handleFinish(options),
    });

    let isStreaming = $derived(chat.status === "streaming");
    let lastMessage = $derived(chat.messages[chat.messages.length - 1]);

    // ── 网络监听 ──
    onMount(() => {
        if (browser) {
            isOnline = navigator.onLine;
            const handleOnline = () => { isOnline = true; toast.success("网络已恢复"); };
            const handleOffline = () => { isOnline = false; toast.error("网络连接已断开"); };
            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);

            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
                revokeActiveObjectUrls();
            };
        }
    });

    // 响应式加载：用户变化时重新加载聊天历史列表
    $effect(() => {
        if (user?.id) {
            refreshSessionList();
        }
    });

    // ── 聊天历史管理 ──
    async function refreshSessionList() {
        try {
            const userId = user?.id;
            if (!userId) return;
            sessionMetas = await getChatSessionList(userId);
        } catch (err) {
            console.warn("Failed to load chat history:", err);
        }
    }

    async function autoSaveCurrentChat() {
        if (chat.messages.length === 0) return;
        const userId = user?.id;
        if (!userId) return;
        try {
            await saveChatSession(userId, currentSessionId, chat.messages);
            await refreshSessionList();
        } catch (err) {
            console.warn("Failed to auto-save chat:", err);
        }
    }

    async function handleNewChat() {
        if (chat.messages.length > 0) {
            await autoSaveCurrentChat();
        }
        revokeActiveObjectUrls();
        chat.messages = [];
        currentSessionId = generateUUID();
        lastError = null;
        failedMessage = null;
        input = "";
        fileMgr.clearAll();
    }

    async function handleLoadChat(id: string) {
        if (id === currentSessionId) return;
        if (chat.messages.length > 0) {
            await autoSaveCurrentChat();
        }
        try {
            const messages = await loadChatSession(id);
            if (messages) {
                chat.messages = messages;
                currentSessionId = id;
                lastError = null;
                failedMessage = null;
                input = "";
                fileMgr.clearAll();
                await tick();
                scrollToBottom(false);
            } else {
                toast.error("聊天记录不存在");
            }
        } catch (err) {
            console.error("Failed to load chat:", err);
            toast.error("加载聊天记录失败");
        }
    }

    async function handleDeleteChat(id: string) {
        try {
            await deleteChatSession(id);
            await refreshSessionList();
            if (id === currentSessionId) {
                revokeActiveObjectUrls();
                chat.messages = [];
                currentSessionId = generateUUID();
                lastError = null;
                failedMessage = null;
            }
        } catch (err) {
            console.error("Failed to delete chat:", err);
            toast.error("删除聊天记录失败");
        }
    }

    // ── 滚动控制 ──
    function checkScrollPosition() {
        if (!messagesContainer) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceFromBottom <= UI.CHAT_SCROLL_THRESHOLD) {
            shouldAutoScroll = true;
            showScrollButton = false;
        } else {
            shouldAutoScroll = false;
            showScrollButton = true;
        }
    }

    async function scrollToBottom(smooth = true) {
        await tick();
        if (messagesContainer) {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: smooth ? "smooth" : "instant",
            });
            shouldAutoScroll = true;
            showScrollButton = false;
        }
    }

    $effect(() => {
        const messageCount = chat.messages.length;
        const firstPart = lastMessage?.parts?.[0];
        const _ = firstPart?.type === "text" ? (firstPart as { type: "text"; text: string }).text : "";
        if (messageCount > 0 && shouldAutoScroll) {
            scrollToBottom(false);
        }
    });

    // 流结束后：高亮代码块 + 注入复制按钮
    let prevStreaming = $state(false);
    $effect(() => {
        const streaming = isStreaming;
        const messageCount = chat.messages.length;
        if ((prevStreaming && !streaming) || (messageCount > 0 && !streaming)) {
            if (messagesContainer) {
                tick().then(() => {
                    requestAnimationFrame(() => {
                        if (!messagesContainer) return;
                        highlightCodeBlocks(messagesContainer).then(() => {
                            if (messagesContainer) injectCopyButtons(messagesContainer);
                        });
                    });
                });
            }
        }
        prevStreaming = streaming;
    });

    // ── 附件管理 (delegated to composable) ──
    async function buildFileUIParts(): Promise<FileUIPart[]> {
        const maxSize = CHAT_ATTACHMENTS.MAX_FILE_SIZE;
        const parts: FileUIPart[] = [];
        for (const pf of pendingFiles) {
            const file = pf.file.size > maxSize ? await compressImage(pf.file, maxSize) : pf.file;
            const url = await fileMgr.fileToDataUrl(file);
            parts.push({ type: 'file', mediaType: file.type, filename: file.name, url });
        }
        return parts;
    }

    function openFilePicker() { fileInputRef?.click(); }

    function handleFileInput(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files) fileMgr.addFiles(target.files);
        target.value = "";
    }

    // ── 发送 ──
    function canSend(): boolean {
        return !!(input.trim() || pendingFiles.length > 0) && !isSubmitting && !isStreaming && isOnline;
    }

    async function sendMessage(message: string, files?: FileUIPart[]) {
        if ((!message.trim() && (!files || files.length === 0)) || isSubmitting || isStreaming || !isOnline) return;
        failedMessage = message;
        lastError = null;
        isSubmitting = true;
        shouldAutoScroll = true;
        inputAreaRef?.resetHeight();

        if (files && files.length > 0) {
            chat.sendMessage({ text: message || undefined, files } as Parameters<typeof chat.sendMessage>[0]);
        } else {
            chat.sendMessage({ text: message });
        }
    }

    async function handleSubmit() {
        if (!canSend()) return;
        const message = input.trim();
        input = "";
        let files: FileUIPart[] | undefined;
        if (pendingFiles.length > 0) {
            files = await buildFileUIParts();
            fileMgr.clearAll();
        }
        sendMessage(message, files);
    }

    function retryLastMessage() {
        if (!failedMessage || isSubmitting || isStreaming) return;
        sendMessage(failedMessage);
    }

    function useQuickPrompt(prompt: string) {
        input = prompt;
        inputAreaRef?.focus();
    }
</script>

<!-- ── Top Bar Snippets ── -->

{#snippet headerLeft()}
    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            <Button variant="ghost" size="sm" class="h-8 gap-1.5 px-2 text-muted-foreground">
                <History class="h-4 w-4" />
                <span class="hidden sm:inline text-xs">历史</span>
                {#if sessionMetas.length > 0}
                    <span class="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] leading-none">
                        {sessionMetas.length}
                    </span>
                {/if}
            </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="w-72" align="start">
            {#if sessionMetas.length === 0}
                <div class="flex flex-col items-center gap-2 px-4 py-6 text-center">
                    <MessageSquare class="h-8 w-8 text-muted-foreground/40" />
                    <p class="text-sm text-muted-foreground">暂无历史记录</p>
                </div>
            {:else}
                <DropdownMenu.Label>历史对话</DropdownMenu.Label>
                <DropdownMenu.Separator />
                <div class="max-h-80 overflow-y-auto">
                    {#each sessionMetas as session (session.id)}
                        <DropdownMenu.Item
                            class="group/item flex items-start gap-2 pr-1"
                            disabled={session.id === currentSessionId}
                            onclick={() => handleLoadChat(session.id)}
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
                                    handleDeleteChat(session.id);
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
{/snippet}

{#snippet headerCenter()}
    {#if !isOnline}
        <div class="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 dark:bg-red-900/20">
            <WifiOff class="h-3 w-3 text-red-500 dark:text-red-400" />
            <span class="text-xs text-red-700 dark:text-red-300">网络已断开</span>
        </div>
    {:else if showLowBalance}
        <a
            href="/me/credits"
            class="flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-0.5 transition-colors hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30"
        >
            <AlertCircle class="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
            <span class="text-xs text-yellow-700 dark:text-yellow-300">余额不足 ({creditBalance})</span>
        </a>
    {/if}
{/snippet}

{#snippet headerRight()}
    <Button variant="ghost" size="sm" class="h-8 gap-1.5 px-2 text-muted-foreground" onclick={handleNewChat}>
        <SquarePen class="h-4 w-4" />
        <span class="hidden sm:inline text-xs">新建</span>
    </Button>
{/snippet}

<!-- ── Page Content ── -->

<div class="relative flex h-full flex-col">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={messagesContainer}
        onscroll={checkScrollPosition}
        ondragover={fileMgr.handleDragOver}
        ondragleave={fileMgr.handleDragLeave}
        ondrop={fileMgr.handleDrop}
        class="flex-1 overflow-y-auto"
    >
        <!-- 拖放叠加层 -->
        {#if isDragging}
            <div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]">
                <div class="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-10 py-8">
                    <ImageIcon class="h-10 w-10 text-primary/60" />
                    <span class="text-sm font-medium text-primary/80">释放以添加图片</span>
                </div>
            </div>
        {/if}

        {#if chat.messages.length === 0 && !isSubmitting}
            <ChatEmptyState {isOnline} onSelectPrompt={useQuickPrompt} />
        {:else}
            <ChatMessageList
                messages={chat.messages}
                {isStreaming}
                {isSubmitting}
                {isOnline}
                {lastError}
                {user}
                onRetry={retryLastMessage}
                onStop={() => chat.stop()}
            />
        {/if}
    </div>

    <ChatScrollButton visible={showScrollButton} onClick={() => scrollToBottom()} />

    <!-- 隐藏的文件选择器 -->
    <input
        bind:this={fileInputRef}
        type="file"
        accept={CHAT_ATTACHMENTS.ALLOWED_TYPES.join(",")}
        multiple
        class="hidden"
        onchange={handleFileInput}
    />

    <ChatInputArea
        bind:this={inputAreaRef}
        bind:input
        {pendingFiles}
        {isDragging}
        {isOnline}
        {isSubmitting}
        {isStreaming}
        canSend={canSend()}
        onSubmit={handleSubmit}
        onRemoveFile={fileMgr.removeFile}
        onOpenFilePicker={openFilePicker}
        onPaste={fileMgr.handlePaste}
    />
</div>
