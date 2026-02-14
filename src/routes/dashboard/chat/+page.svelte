<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Avatar from "$lib/components/ui/avatar";
    import { cn } from "$lib/utils";
    import { Chat } from "@ai-sdk/svelte";
    import type { FileUIPart } from "ai";
    import { getCurrentUser } from "$lib/stores/auth.svelte";
    import { getCreditBalance, fetchCreditBalance } from "$lib/stores/credits.svelte";
    import { parseError, getErrorIcon, type ChatError } from "$lib/utils/chat-errors";
    import {
        AlertCircle,
        Send,
        Bot,
        Sparkles,
        MessageSquare,
        Zap,
        Lightbulb,
        ArrowDown,
        RefreshCw,
        Square,
        WifiOff,
        Loader2,
        CreditCard,
        LogIn,
        Clock,
        ServerCrash,
        Brain,
        ChevronDown,
        Paperclip,
        X,
        ImageIcon,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { tick, onMount } from "svelte";
    import { browser } from "$app/environment";
    import { CREDITS, UI, CHAT_ATTACHMENTS } from "$lib/config/constants";
    import { renderMarkdown, highlightCodeBlocks, injectCopyButtons } from "$lib/utils/markdown";

    let input = $state("");
    let messagesContainer = $state<HTMLDivElement | null>(null);
    let textareaRef = $state<HTMLTextAreaElement | null>(null);
    let fileInputRef = $state<HTMLInputElement | null>(null);

    // 自动滚动控制
    let shouldAutoScroll = $state(true);
    let showScrollButton = $state(false);

    // 状态管理
    let isSubmitting = $state(false);
    let lastError = $state<ChatError | null>(null);
    let isOnline = $state(true);
    let failedMessage = $state<string | null>(null);

    // ── 附件管理 ──
    type PendingFile = { id: string; file: File; previewUrl: string };
    let pendingFiles = $state<PendingFile[]>([]);
    let isDragging = $state(false);

    // 响应式获取用户和积分
    let user = $derived(getCurrentUser());
    let creditBalance = $derived(getCreditBalance());

    // 处理错误
    function handleError(error: Error | unknown) {
        console.error("Chat error:", error);
        lastError = parseError(error, isOnline);

        // 显示 toast 通知
        if (lastError.action?.href) {
            toast.error(lastError.message, {
                action: {
                    label: lastError.action.label,
                    onClick: () => goto(lastError!.action!.href!),
                },
            });
        } else {
            toast.error(lastError.message);
        }
    }

    // 处理完成（包括错误完成）
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
        }
    }

    const chat = new Chat({
        onError: (error) => {
            handleError(error);
        },
        onFinish: (options) => {
            handleFinish(options);
        },
    });

    // 计算是否正在流式输出
    let isStreaming = $derived(chat.status === "streaming");

    // 获取最后一条消息
    let lastMessage = $derived(chat.messages[chat.messages.length - 1]);

    // 监听网络状态
    onMount(() => {
        if (browser) {
            isOnline = navigator.onLine;

            const handleOnline = () => {
                isOnline = true;
                toast.success("网络已恢复");
            };

            const handleOffline = () => {
                isOnline = false;
                toast.error("网络连接已断开");
            };

            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);

            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
            };
        }
    });

    // 检测是否滚动到底部
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

    // 滚动到底部
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

    // 监听消息变化，自动滚动
    $effect(() => {
        const messageCount = chat.messages.length;
        const firstPart = lastMessage?.parts?.[0];
        const lastContent = firstPart?.type === "text"
            ? (firstPart as { type: "text"; text: string }).text
            : "";

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

    // 自动调整输入框高度
    function autoResize() {
        if (textareaRef) {
            textareaRef.style.height = "auto";
            textareaRef.style.height = Math.min(textareaRef.scrollHeight, UI.TEXTAREA_MAX_HEIGHT) + "px";
        }
    }

    // 处理键盘事件
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    // ── 附件：验证文件 ──
    function validateFile(file: File): string | null {
        if (!CHAT_ATTACHMENTS.ALLOWED_TYPES.includes(file.type)) {
            return `不支持的文件类型: ${file.type || '未知'}`;
        }
        if (file.size > CHAT_ATTACHMENTS.MAX_FILE_SIZE) {
            return `文件过大（上限 ${CHAT_ATTACHMENTS.MAX_SIZE_LABEL}）`;
        }
        return null;
    }

    // ── 附件：添加文件 ──
    function addFiles(files: FileList | File[]) {
        const fileArray = Array.from(files);
        for (const file of fileArray) {
            if (pendingFiles.length >= CHAT_ATTACHMENTS.MAX_FILES) {
                toast.error(`最多同时上传 ${CHAT_ATTACHMENTS.MAX_FILES} 张图片`);
                break;
            }
            const error = validateFile(file);
            if (error) {
                toast.error(error);
                continue;
            }
            const previewUrl = URL.createObjectURL(file);
            pendingFiles = [...pendingFiles, { id: crypto.randomUUID(), file, previewUrl }];
        }
    }

    // ── 附件：移除文件 ──
    function removeFile(id: string) {
        const item = pendingFiles.find(f => f.id === id);
        if (item) URL.revokeObjectURL(item.previewUrl);
        pendingFiles = pendingFiles.filter(f => f.id !== id);
    }

    // ── 附件：文件 → FileUIPart (data URL) ──
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

    // ── 附件：文件选择器 ──
    function openFilePicker() {
        fileInputRef?.click();
    }

    function handleFileInput(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files) addFiles(target.files);
        target.value = ""; // 允许再次选择相同文件
    }

    // ── 附件：粘贴图片 ──
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

    // ── 附件：拖放 ──
    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }
    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
    }
    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.files) {
            const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
            if (images.length > 0) addFiles(images);
        }
    }

    // 判断是否可以发送（有文本或有附件即可）
    function canSend(): boolean {
        const hasContent = !!(input.trim() || pendingFiles.length > 0);
        return hasContent && !isSubmitting && !isStreaming && isOnline;
    }

    // 发送消息（统一逻辑）
    async function sendMessage(message: string, files?: FileUIPart[]) {
        if ((!message.trim() && (!files || files.length === 0)) || isSubmitting || isStreaming || !isOnline) return;

        // 重置状态
        failedMessage = message;
        lastError = null;
        isSubmitting = true;
        shouldAutoScroll = true;

        if (textareaRef) {
            textareaRef.style.height = "auto";
        }

        // 发送消息（AI SDK 自动将 FileUIPart 转为 data URL 并传输）
        if (files && files.length > 0) {
            chat.sendMessage({ text: message || undefined, files } as Parameters<typeof chat.sendMessage>[0]);
        } else {
            chat.sendMessage({ text: message });
        }
    }

    // 提交表单
    async function handleSubmit() {
        if (!canSend()) return;
        const message = input.trim();
        input = "";

        // 构建附件并清空
        let files: FileUIPart[] | undefined;
        if (pendingFiles.length > 0) {
            files = await buildFileUIParts();
            // 释放 blob URL
            for (const pf of pendingFiles) URL.revokeObjectURL(pf.previewUrl);
            pendingFiles = [];
        }

        sendMessage(message, files);
    }

    // 重试发送失败的消息
    function retryLastMessage() {
        if (!failedMessage || isSubmitting || isStreaming) return;
        sendMessage(failedMessage);
    }

    // 停止生成
    function stopGeneration() {
        chat.stop();
    }

    // 快捷提示
    const quickPrompts = [
        { icon: Lightbulb, text: "给我一些创意灵感", prompt: "请给我一些有创意的想法或灵感" },
        { icon: Zap, text: "帮我写一段代码", prompt: "请帮我写一段代码" },
        { icon: MessageSquare, text: "解释一个概念", prompt: "请用简单的语言解释" },
    ];

    function useQuickPrompt(prompt: string) {
        input = prompt;
        textareaRef?.focus();
    }

    // 获取用户名首字母
    function getInitials(name?: string | null): string {
        if (!name) return "U";
        return name.charAt(0).toUpperCase();
    }

    // 判断是否为图片类型的文件 part
    function isImageFile(part: { type: string; mediaType?: string }): boolean {
        return part.type === "file" && !!part.mediaType?.startsWith("image/");
    }
</script>

<div class="relative flex h-[calc(100vh-4rem)] flex-col">
    <!-- 网络断开提示 -->
    {#if !isOnline}
        <div class="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-900/20">
            <div class="mx-auto flex max-w-3xl items-center gap-2 text-sm">
                <WifiOff class="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                <span class="text-red-800 dark:text-red-200">
                    网络连接已断开，请检查网络设置
                </span>
            </div>
        </div>
    {/if}

    <!-- 积分余额警告 -->
    {#if isOnline && creditBalance < CREDITS.LOW_BALANCE_WARNING}
        <div class="border-b border-yellow-200 bg-yellow-50 px-4 py-2 dark:border-yellow-800 dark:bg-yellow-900/20">
            <div class="mx-auto flex max-w-3xl items-center gap-2 text-sm">
                <AlertCircle class="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                <span class="text-yellow-800 dark:text-yellow-200">
                    积分余额不足 ({creditBalance} 积分)
                </span>
                <a
                    href="/dashboard/credits"
                    class="ml-auto font-medium text-yellow-700 underline hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
                >
                    立即充值
                </a>
            </div>
        </div>
    {/if}

    <!-- 消息区域 -->
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
            <!-- 空状态欢迎界面 -->
            <div class="flex h-full flex-col items-center justify-center px-4">
                <div class="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles class="h-8 w-8 text-primary" />
                </div>
                <h1 class="mb-2 text-2xl font-semibold text-foreground">
                    你好，有什么可以帮你？
                </h1>
                <p class="mb-8 max-w-md text-center text-muted-foreground">
                    我是你的 AI 助手，可以帮你回答问题、写作、编程等各种任务。
                </p>

                <!-- 快捷提示 -->
                <div class="flex flex-wrap justify-center gap-2">
                    {#each quickPrompts as { icon: Icon, text, prompt }}
                        <button
                            onclick={() => useQuickPrompt(prompt)}
                            disabled={!isOnline}
                            class="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Icon class="h-4 w-4" />
                            {text}
                        </button>
                    {/each}
                </div>
            </div>
        {:else}
            <!-- 消息列表 -->
            <div class="mx-auto max-w-3xl px-4 py-6">
                {#each chat.messages as message, i}
                    {@const isLastAssistantMessage = message.role === "assistant" && i === chat.messages.length - 1}
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
                            <!-- 思考过程（reasoning parts）-->
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

                            <!-- 图片附件（file parts）-->
                            {#if message.parts.some(p => isImageFile(p))}
                                <div class={cn(
                                    "flex flex-wrap gap-2",
                                    message.role === "user" ? "justify-end" : "justify-start"
                                )}>
                                    {#each message.parts as part}
                                        {#if part.type === "file" && isImageFile(part)}
                                            <a
                                                href={part.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="group/img relative block overflow-hidden rounded-xl border border-border/60"
                                            >
                                                <img
                                                    src={part.url}
                                                    alt={part.filename || "图片"}
                                                    class="max-h-64 max-w-full object-contain transition-opacity group-hover/img:opacity-90"
                                                    loading="lazy"
                                                />
                                            </a>
                                        {/if}
                                    {/each}
                                </div>
                            {/if}

                            <!-- 正文内容（text parts）-->
                            {#if message.role === "user"}
                                {#if message.parts.some(p => p.type === "text")}
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

                            <!-- 流式输出时显示停止按钮 -->
                            {#if showCursor}
                                <button
                                    onclick={stopGeneration}
                                    class="flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                    <Square class="h-3 w-3" />
                                    停止生成
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}

                <!-- 提交中状态：等待 AI 响应 -->
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
                                    onclick={retryLastMessage}
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
        {/if}
    </div>

    <!-- 滚动到底部按钮 -->
    {#if showScrollButton}
        <div class="absolute bottom-32 left-1/2 z-10 -translate-x-1/2">
            <Button
                variant="secondary"
                size="icon"
                class="h-8 w-8 rounded-full shadow-lg"
                onclick={() => scrollToBottom()}
            >
                <ArrowDown class="h-4 w-4" />
            </Button>
        </div>
    {/if}

    <!-- 输入区域 -->
    <div class="border-t bg-background px-4 py-4">
        <form
            class="mx-auto max-w-3xl"
            onsubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
        >
            <!-- 附件预览条 -->
            {#if pendingFiles.length > 0}
                <div class="mb-2 flex flex-wrap gap-2">
                    {#each pendingFiles as pf (pf.id)}
                        <div class="group/thumb relative">
                            <img
                                src={pf.previewUrl}
                                alt={pf.file.name}
                                class="h-16 w-16 rounded-lg border border-border object-cover"
                            />
                            <button
                                type="button"
                                onclick={() => removeFile(pf.id)}
                                class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 transition-opacity group-hover/thumb:opacity-100"
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}

            <div class={cn(
                "relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
                isDragging && "border-primary/50 ring-2 ring-primary/20"
            )}>
                <!-- 隐藏的文件选择器 -->
                <input
                    bind:this={fileInputRef}
                    type="file"
                    accept={CHAT_ATTACHMENTS.ALLOWED_TYPES.join(",")}
                    multiple
                    class="hidden"
                    onchange={handleFileInput}
                />

                <!-- 附件按钮 -->
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-10 w-10 flex-shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                    disabled={!isOnline || isSubmitting || isStreaming || pendingFiles.length >= CHAT_ATTACHMENTS.MAX_FILES}
                    onclick={openFilePicker}
                >
                    <Paperclip class="h-4 w-4" />
                </Button>

                <Textarea
                    bind:ref={textareaRef}
                    bind:value={input}
                    oninput={autoResize}
                    onkeydown={handleKeydown}
                    onpaste={handlePaste}
                    placeholder={isOnline ? "输入消息... (Enter 发送, Shift+Enter 换行)" : "网络已断开..."}
                    class="min-h-[44px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
                    rows={1}
                    disabled={!isOnline || isSubmitting || isStreaming}
                />

                <Button
                    type="submit"
                    size="icon"
                    class="h-10 w-10 flex-shrink-0 rounded-xl"
                    disabled={!canSend()}
                >
                    {#if isSubmitting && !isStreaming}
                        <Loader2 class="h-4 w-4 animate-spin" />
                    {:else}
                        <Send class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
            <p class="mt-2 text-center text-xs text-muted-foreground">
                AI 可能会产生错误信息，请核实重要内容
            </p>
        </form>
    </div>
</div>
