<script lang="ts">
    import { Sparkles, Lightbulb, Zap, MessageSquare } from "lucide-svelte";

    let { isOnline, onSelectPrompt }: {
        isOnline: boolean;
        onSelectPrompt: (prompt: string) => void;
    } = $props();

    const quickPrompts = [
        { icon: Lightbulb, text: "给我一些创意灵感", prompt: "请给我一些有创意的想法或灵感" },
        { icon: Zap, text: "帮我写一段代码", prompt: "请帮我写一段代码" },
        { icon: MessageSquare, text: "解释一个概念", prompt: "请用简单的语言解释" },
    ];
</script>

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

    <div class="flex flex-wrap justify-center gap-2">
        {#each quickPrompts as { icon: Icon, text, prompt }}
            <button
                onclick={() => onSelectPrompt(prompt)}
                disabled={!isOnline}
                class="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Icon class="h-4 w-4" />
                {text}
            </button>
        {/each}
    </div>
</div>
