<script lang="ts">
    import { Chat } from "@ai-sdk/svelte";
    import type { FileUIPart } from "ai";
    import { getCurrentUser } from "$lib/stores/auth.svelte";
    import { getCreditBalance, fetchCreditBalance } from "$lib/stores/credits.svelte";
    import { parseError, type ChatError } from "$lib/utils/chat-errors";
    import { highlightCodeBlocks, injectCopyButtons } from "$lib/utils/markdown";
    import { generateUUID } from "$lib/utils/uuid";
    import { ImageIcon } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { tick, onMount } from "svelte";
    import { browser } from "$app/environment";
    import { CHAT_ATTACHMENTS, UI } from "$lib/config/constants";
    import {
        ChatAlertBanners,
        ChatEmptyState,
        ChatHeader,
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
    } from "$lib/stores/chat-history.svelte";

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

    type PendingFile = { id: string; file: File; previewUrl: string };
    let pendingFiles = $state<PendingFile[]>([]);
    let isDragging = $state(false);

    let user = $derived(getCurrentUser());
    let creditBalance = $derived(getCreditBalance());

    // ── 聊天历史状态 ──
    let currentSessionId = $state<string>(generateUUID());
    let sessionMetas = $state<SessionMeta[]>([]);

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
            // 自动保存聊天记录
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

            // 加载历史记录列表
            refreshSessionList();

            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
                revokeActiveObjectUrls();
            };
        }
    });

    // ── 聊天历史管理 ──
    async function refreshSessionList() {
        try {
            sessionMetas = await getChatSessionList();
        } catch (err) {
            console.warn("Failed to load chat history:", err);
        }
    }

    async function autoSaveCurrentChat() {
        if (chat.messages.length === 0) return;
        try {
            await saveChatSession(currentSessionId, chat.messages);
            await refreshSessionList();
        } catch (err) {
            console.warn("Failed to auto-save chat:", err);
        }
    }

    async function handleNewChat() {
        // 保存当前对话（如果有内容）
        if (chat.messages.length > 0) {
            await autoSaveCurrentChat();
        }
        revokeActiveObjectUrls();
        chat.messages = [];
        currentSessionId = generateUUID();
        lastError = null;
        failedMessage = null;
        input = "";
        pendingFiles = [];
    }

    async function handleLoadChat(id: string) {
        if (id === currentSessionId) return;
        // 保存当前对话
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
                pendingFiles = [];
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
            // 如果删除的是当前会话，新建聊天
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

    // ── 附件管理 ──
    function validateFile(file: File): string | null {
        if (!CHAT_ATTACHMENTS.ALLOWED_TYPES.includes(file.type)) {
            return `不支持的文件类型: ${file.type || '未知'}`;
        }
        if (file.size > CHAT_ATTACHMENTS.MAX_FILE_SIZE) {
            return `文件过大（上限 ${CHAT_ATTACHMENTS.MAX_SIZE_LABEL}）`;
        }
        return null;
    }

    function addFiles(files: FileList | File[]) {
        for (const file of Array.from(files)) {
            if (pendingFiles.length >= CHAT_ATTACHMENTS.MAX_FILES) {
                toast.error(`最多同时上传 ${CHAT_ATTACHMENTS.MAX_FILES} 张图片`);
                break;
            }
            const error = validateFile(file);
            if (error) { toast.error(error); continue; }
            pendingFiles = [...pendingFiles, { id: generateUUID(), file, previewUrl: URL.createObjectURL(file) }];
        }
    }

    function removeFile(id: string) {
        const item = pendingFiles.find(f => f.id === id);
        if (item) URL.revokeObjectURL(item.previewUrl);
        pendingFiles = pendingFiles.filter(f => f.id !== id);
    }

    function fileToDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function buildFileUIParts(): Promise<FileUIPart[]> {
        const parts: FileUIPart[] = [];
        for (const pf of pendingFiles) {
            const url = await fileToDataUrl(pf.file);
            parts.push({ type: 'file', mediaType: pf.file.type, filename: pf.file.name, url });
        }
        return parts;
    }

    function openFilePicker() { fileInputRef?.click(); }

    function handleFileInput(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files) addFiles(target.files);
        target.value = "";
    }

    function handlePaste(e: ClipboardEvent) {
        const items = e.clipboardData?.items;
        if (!items) return;
        const imageFiles: File[] = [];
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) imageFiles.push(file);
            }
        }
        if (imageFiles.length > 0) {
            e.preventDefault();
            addFiles(imageFiles);
        }
    }

    // ── 拖放 ──
    function handleDragOver(e: DragEvent) { e.preventDefault(); isDragging = true; }
    function handleDragLeave(e: DragEvent) { e.preventDefault(); isDragging = false; }
    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.files) {
            const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
            if (images.length > 0) addFiles(images);
        }
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
            for (const pf of pendingFiles) URL.revokeObjectURL(pf.previewUrl);
            pendingFiles = [];
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

<div class="relative flex h-full flex-col">
    <ChatHeader
        sessions={sessionMetas}
        {currentSessionId}
        onNewChat={handleNewChat}
        onLoadChat={handleLoadChat}
        onDeleteChat={handleDeleteChat}
    />
    <ChatAlertBanners {isOnline} {creditBalance} />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={messagesContainer}
        onscroll={checkScrollPosition}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
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
        onRemoveFile={removeFile}
        onOpenFilePicker={openFilePicker}
        onPaste={handlePaste}
    />
</div>
