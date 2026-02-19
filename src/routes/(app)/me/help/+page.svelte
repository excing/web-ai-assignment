<script lang="ts">
    import * as Accordion from "$lib/components/ui/accordion";
    import { Separator } from "$lib/components/ui/separator";
    import { HelpCircle } from "lucide-svelte";

    interface FaqCategory {
        title: string;
        items: { q: string; a: string }[];
    }

    const faqCategories: FaqCategory[] = [
        {
            title: "积分相关",
            items: [
                {
                    q: "如何获取积分？",
                    a: "你可以通过兑换码兑换积分。获取兑换码后，前往「我的 → 积分」页面输入兑换码即可到账。",
                },
                {
                    q: "积分有有效期吗？",
                    a: "积分没有有效期，充值后永久有效，可随时使用。",
                },
                {
                    q: "使用 AI 功能如何扣费？",
                    a: "每次调用 AI 功能（聊天、图片生成等）会根据模型和用量自动扣除相应积分，扣费明细可在「交易记录」中查看。",
                },
            ],
        },
        {
            title: "图片生成",
            items: [
                {
                    q: "支持哪些图片格式上传？",
                    a: "支持 JPEG、PNG、GIF、WebP 格式。上传的图片如果超过 5MB 会自动压缩。",
                },
                {
                    q: "什么是图生图？",
                    a: "图生图是指上传一张参考图片，AI 会根据你的文字描述和参考图片来生成新的图片。在输入框左侧点击附件按钮即可上传参考图。",
                },
                {
                    q: "图片生成失败怎么办？",
                    a: "生成失败时可以点击任务卡片上的重试按钮。如果反复失败，可能是提示词包含不合规内容，请尝试调整描述后重试。",
                },
            ],
        },
        {
            title: "AI 聊天",
            items: [
                {
                    q: "聊天记录会保存吗？",
                    a: "会。聊天记录保存在浏览器本地存储中，你可以在聊天页面左上角的「历史」菜单中查看和管理历史对话。",
                },
                {
                    q: "可以发送图片给 AI 吗？",
                    a: "可以。在聊天输入框中点击附件按钮或直接粘贴图片，AI 会识别图片内容并作出回应。",
                },
                {
                    q: "为什么 AI 回复中断了？",
                    a: "可能是网络不稳定导致连接中断。页面会显示错误提示，你可以点击「重试」按钮重新发送。",
                },
            ],
        },
        {
            title: "账号与安全",
            items: [
                {
                    q: "如何修改个人信息？",
                    a: "前往「我的 → 账号设置」页面，可以修改你的头像和昵称。",
                },
                {
                    q: "忘记密码怎么办？",
                    a: "在登录页面点击「忘记密码」，输入注册邮箱后会收到重置密码的邮件，按邮件提示操作即可。",
                },
            ],
        },
    ];
</script>

<section class="flex w-full flex-col items-center px-4 py-6">
    <div class="w-full max-w-lg">
        <!-- Header -->
        <div class="flex flex-col items-center gap-2 py-4">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <HelpCircle class="h-7 w-7 text-primary" />
            </div>
            <h1 class="text-xl font-semibold">帮助与反馈</h1>
            <p class="text-sm text-muted-foreground">常见问题解答</p>
        </div>

        <!-- FAQ Sections -->
        {#each faqCategories as category, ci}
            <div class="mt-6">
                <h2 class="mb-2 px-1 text-sm font-medium text-muted-foreground">{category.title}</h2>
                <Accordion.Root type="multiple">
                    {#each category.items as item, i}
                        <Accordion.Item value="{ci}-{i}">
                            <Accordion.Trigger class="text-left text-sm">{item.q}</Accordion.Trigger>
                            <Accordion.Content>
                                <p class="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                            </Accordion.Content>
                        </Accordion.Item>
                    {/each}
                </Accordion.Root>
            </div>

            {#if ci < faqCategories.length - 1}
                <Separator class="mt-6" />
            {/if}
        {/each}
    </div>
</section>
