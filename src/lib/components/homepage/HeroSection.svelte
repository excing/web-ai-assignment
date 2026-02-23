<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import GetStartedButton from "$lib/components/common/GetStartedButton.svelte";
	import { defaultRoute } from "$lib/config/navigation";
	import { ImageIcon, MessageCircle, Sparkles } from "lucide-svelte";
</script>

<section class="relative overflow-hidden">
	<!-- Background decoration -->
	<div class="pointer-events-none absolute inset-0 -z-10">
		<div class="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl"></div>
		<div class="absolute -bottom-20 -right-40 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl"></div>
		<div class="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-primary/3 blur-3xl"></div>
	</div>

	<div class="mx-auto max-w-6xl px-6 pb-20 pt-24 lg:pb-28 lg:pt-32">
		<div class="text-center">
			<!-- Badge -->
			<div class="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
				<Sparkles class="h-4 w-4 text-primary" />
				<span>数据本地存储 · 多平台多模型</span>
			</div>

			<!-- Headline -->
			<h1 class="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
				用 AI 释放你的
				<span class="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">创造力</span>
			</h1>

			<!-- Subheadline -->
			<p class="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
				BingWu AI — 丙午马年，灵感如火、一日千里。文字生图、智能对话，一站式 AI 创作平台。
			</p>

			<!-- CTA Buttons -->
			<div class="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
				<GetStartedButton href={defaultRoute} variant="default" size="lg" class="w-full sm:w-auto">
					<span class="text-nowrap">🐴 马上开始创作</span>
				</GetStartedButton>
				<Button href="#features" variant="outline" size="lg" class="w-full sm:w-auto">
					<span class="text-nowrap">了解更多</span>
				</Button>
			</div>
		</div>

		<!-- Product preview cards -->
		<div class="mt-16 grid gap-4 sm:grid-cols-2 lg:mt-20">
			<!-- Image generation preview -->
			<div class="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
						<ImageIcon class="h-5 w-5 text-primary" />
					</div>
					<div>
						<h3 class="font-semibold">AI 图片生成</h3>
						<p class="text-xs text-muted-foreground">文字描述，即刻出图</p>
					</div>
				</div>
				<!-- Mock prompt -->
				<div class="rounded-xl border bg-muted/50 p-4">
					<p class="text-sm text-muted-foreground">"一只可爱的猫咪在花园里玩耍，水彩画风格"</p>
				</div>
				<!-- Generated result grid -->
				<div class="mt-3 grid grid-cols-3 gap-2">
					<img src="https://gallery.bingwuai.com/hero-1.jpeg" alt="AI 生成的水彩猫咪画作" class="aspect-square rounded-lg object-cover" loading="lazy" />
					<img src="https://gallery.bingwuai.com/hero-2.jpeg" alt="AI 生成的水彩猫咪画作" class="aspect-square rounded-lg object-cover" loading="lazy" />
					<img src="https://gallery.bingwuai.com/hero-3.jpeg" alt="AI 生成的水彩猫咪画作" class="aspect-square rounded-lg object-cover" loading="lazy" />
				</div>
			</div>

			<!-- Chat preview -->
			<div class="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
						<MessageCircle class="h-5 w-5 text-primary" />
					</div>
					<div>
						<h3 class="font-semibold">AI 智能对话</h3>
						<p class="text-xs text-muted-foreground">实时流式响应</p>
					</div>
				</div>
				<!-- Mock chat -->
				<div class="space-y-3">
					<div class="flex justify-end">
						<div class="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
							帮我写一篇关于量子计算的科普文章
						</div>
					</div>
					<div class="flex justify-start">
						<div class="max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
							<p class="text-muted-foreground">量子计算是一种利用量子力学原理进行计算的技术。与传统计算机使用"比特"不同，量子计算机使用"量子比特"...</p>
						</div>
					</div>
					<div class="flex justify-end">
						<div class="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
							能否更通俗易懂一些？
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
