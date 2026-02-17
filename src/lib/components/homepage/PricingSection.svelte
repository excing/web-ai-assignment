<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import GetStartedButton from "$lib/components/common/GetStartedButton.svelte";
	import { defaultRoute } from "$lib/config/navigation";
	import { ImageIcon, MessageCircle, Check } from "lucide-svelte";

	const pricingItems = [
		{
			icon: MessageCircle,
			name: "AI 智能对话",
			price: "按量计费",
			detail: "按实际使用的 token 数量计费",
			minimum: "多轮对话，实时流式响应",
		},
		{
			icon: ImageIcon,
			name: "AI 图片生成",
			price: "按次计费",
			detail: "每次生成消耗固定积分",
			minimum: "支持文生图和图生图",
		},
	];

	const benefits = [
		"注册即可体验",
		"无月费，无订阅",
		"积分永不过期",
		"透明定价，无隐藏费用",
		"兑换码充值，灵活便捷",
		"余额不足自动提醒",
	];
</script>

<section id="pricing" class="border-t bg-muted/30 py-20 lg:py-28">
	<div class="mx-auto max-w-6xl px-6">
		<!-- Section header -->
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				简单透明的定价
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				按需付费，用多少扣多少，不用不花钱
			</p>
		</div>

		<div class="mt-14 grid gap-8 lg:grid-cols-2">
			<!-- Pricing cards -->
			<div class="space-y-4">
				{#each pricingItems as item}
					<div class="rounded-2xl border bg-card p-6">
						<div class="flex items-start gap-4">
							<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
								<item.icon class="h-6 w-6 text-primary" />
							</div>
							<div class="flex-1">
								<div class="flex items-baseline justify-between">
									<h3 class="text-lg font-semibold">{item.name}</h3>
									<span class="text-sm font-medium text-primary">{item.price}</span>
								</div>
								<p class="mt-1 text-sm text-muted-foreground">{item.detail}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">{item.minimum}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Benefits card -->
			<div class="rounded-2xl border bg-card p-8">
				<h3 class="text-lg font-semibold">为什么选择积分制？</h3>
				<ul class="mt-6 space-y-4">
					{#each benefits as benefit}
						<li class="flex items-center gap-3">
							<div class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
								<Check class="h-3 w-3 text-primary" />
							</div>
							<span class="text-sm text-muted-foreground">{benefit}</span>
						</li>
					{/each}
				</ul>
				<div class="mt-8">
					<GetStartedButton href={defaultRoute} variant="default" size="default" class="w-full">
						<span class="text-nowrap">立即注册，开始体验</span>
					</GetStartedButton>
				</div>
			</div>
		</div>
	</div>
</section>
