<script lang="ts">
	import { ImageIcon, MessageCircle, Coins, Zap, Shield, Layers } from "lucide-svelte";

	const features = [
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
			description: "流式输出技术让你无需等待，AI 回复实时呈现。图片生成支持并发队列，高效不卡顿。",
		},
		{
			icon: Shield,
			title: "安全可靠",
			description: "企业级用户认证，数据传输全程加密。支持邮箱验证和多种登录方式，保障账户安全。",
		},
		{
			icon: Layers,
			title: "多模态支持",
			description: "文字、图片多模态输入输出。对话中可上传图片提问，图片生成支持参考图引导风格。",
		},
	];
</script>

<section id="features" class="border-t bg-muted/30 py-20 lg:py-28">
	<div class="mx-auto max-w-6xl px-6">
		<!-- Section header -->
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				强大的 AI 能力，简单的使用体验
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				BingWu AI 将前沿 AI 技术封装为简洁易用的工具，让每个人都能轻松创作
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
