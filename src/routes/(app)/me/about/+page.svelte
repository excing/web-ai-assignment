<script lang="ts">
    import { Separator } from "$lib/components/ui/separator";
    import { Sparkles, ImageIcon, MessageCircle, Zap } from "lucide-svelte";
    import { version } from "$app/environment";
</script>

<section class="flex w-full flex-col items-center px-4 py-6">
    <div class="w-full max-w-lg">
        <!-- App Branding -->
        <div class="flex flex-col items-center gap-3 py-6">
            <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                <Sparkles class="h-8 w-8 text-white" />
            </div>
            <div class="text-center">
                <h1 class="text-2xl font-bold">BingWu AI</h1>
                <p class="text-sm text-muted-foreground">AI 智能创作平台</p>
            </div>
            <span class="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
                版本 {version || "0.0.1"}
            </span>
        </div>

        <Separator />

        <!-- Features -->
        <div class="py-6">
            <h2 class="mb-4 text-sm font-medium text-muted-foreground">核心功能</h2>
            <div class="space-y-4">
                <div class="flex items-start gap-3">
                    <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <ImageIcon class="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p class="text-sm font-medium">AI 图片生成</p>
                        <p class="text-xs text-muted-foreground">文生图、图生图，支持多任务并发生成</p>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                        <MessageCircle class="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <p class="text-sm font-medium">AI 智能对话</p>
                        <p class="text-xs text-muted-foreground">多模态聊天，支持图片识别与上下文理解</p>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                        <Zap class="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p class="text-sm font-medium">积分计费</p>
                        <p class="text-xs text-muted-foreground">按量付费，用多少扣多少，透明可控</p>
                    </div>
                </div>
            </div>
        </div>

        <Separator />

        <!-- Footer Info -->
        <div class="space-y-2 py-6 text-center text-xs text-muted-foreground">
            <p>Powered by OpenAI · Anthropic · Google</p>
            <p>&copy; {new Date().getFullYear()} BingWu AI. All rights reserved.</p>
        </div>
    </div>
</section>
