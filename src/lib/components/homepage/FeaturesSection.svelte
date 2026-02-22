<script lang="ts">
	import { ImageIcon, MessageCircle, Coins, Zap, Shield, Layers, HardDrive, Globe } from "lucide-svelte";

	const features = [
		{
			icon: Shield,
			title: "数据本地存储",
			description: "聊天记录和生成的图片全部保存在你的设备本地，不上传到云端服务器，从源头保护你的隐私。",
		},
		{
			icon: Globe,
			title: "多平台多模型",
			description: "对接 OpenAI、Google、Anthropic 等多个主流平台，支持 GPT、Claude、Gemini 等多种大模型，自由选择最适合的 AI。",
		},
		{
			icon: ImageIcon,
			title: "AI 图片生成",
			description: "输入文字描述，AI 即刻生成高质量图片。支持上传参考图进行图生图创作，多任务并发处理。",
		},
		{
			icon: MessageCircle,
			title: "AI 智能对话",
			description: "与 AI 进行多轮对话，实时流式响应。支持发送图片附件，代码高亮显示，助力你的工作与创作。",
		},
		{
			icon: Coins,
			title: "积分制计费",
			description: "灵活的按需付费模式，用多少扣多少。通过兑换码充值积分，定价透明，无隐藏费用。",
		},
		{
			icon: Zap,
			title: "极速响应",
			description: "流式输出技术让 AI 回复实时呈现。图片生成支持并发队列，高效不卡顿。",
		},
	];
</script>

<section id="features" class="border-t bg-muted/30 py-20 lg:py-28">
	<div class="mx-auto max-w-6xl px-6">
		<!-- Section header -->
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				隐私优先，多模型驱动
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				数据存在本地不泄漏，多个 AI 平台任你选
			</p>
		</div>

		<!-- Feature grid -->
		<div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<article class="group rounded-2xl border bg-card p-6 transition-all hover:border-primary/20 hover:shadow-md">
					<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
						<feature.icon class="h-6 w-6 text-primary" />
					</div>
					<h3 class="text-lg font-semibold">{feature.title}</h3>
					<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
						{feature.description}
					</p>
				</article>
			{/each}
		</div>
	</div>
</section>
