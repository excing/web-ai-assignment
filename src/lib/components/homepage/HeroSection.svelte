<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import GetStartedButton from "$lib/components/common/GetStartedButton.svelte";
	import { defaultRoute } from "$lib/config/navigation";
	import { ImageIcon, MessageCircle, Flame } from "lucide-svelte";
</script>

<section class="hero-section relative overflow-hidden">
	<!-- Warm atmospheric background -->
	<div class="pointer-events-none absolute inset-0 -z-10">
		<!-- Top-left warm glow -->
		<div class="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-[0.07] blur-[100px]"
			style="background: radial-gradient(circle, #EF6632 0%, #EC5132 50%, transparent 70%);">
		</div>
		<!-- Bottom-right amber glow -->
		<div class="absolute -bottom-24 -right-32 h-[450px] w-[450px] rounded-full opacity-[0.06] blur-[100px]"
			style="background: radial-gradient(circle, #F27F34 0%, #F06D32 50%, transparent 70%);">
		</div>
		<!-- Center subtle warmth -->
		<div class="absolute left-1/2 top-1/4 h-[350px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[120px]"
			style="background: radial-gradient(ellipse, #EF6632 0%, transparent 70%);">
		</div>
		<!-- Subtle grain texture overlay -->
		<div class="absolute inset-0 opacity-[0.015]"
			style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');">
		</div>
	</div>

	<div class="mx-auto max-w-6xl px-6 pb-20 pt-20 lg:pb-28 lg:pt-28">
		<div class="text-center">
			<!-- Logo + Badge cluster -->
			<div class="mb-8 flex flex-col items-center gap-4">
				<div class="hero-logo relative">
					<img
						src="/favicon.svg"
						alt="BingWu AI"
						class="h-20 w-20 drop-shadow-lg sm:h-24 sm:w-24"
					/>
					<!-- Subtle glow behind logo -->
					<div class="absolute inset-0 -z-10 scale-150 rounded-full opacity-20 blur-2xl"
						style="background: radial-gradient(circle, #EF6632, transparent 70%);">
					</div>
				</div>
				<div class="inline-flex items-center gap-2 rounded-full border border-[#EF6632]/15 bg-[#EF6632]/5 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
					<Flame class="h-3.5 w-3.5 text-[#EF6632]" />
					<span>数据本地存储 · 多平台多模型</span>
				</div>
			</div>

			<!-- Headline -->
			<h1 class="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
				用 AI 释放你的
				<span class="bg-clip-text text-transparent" style="background-image: linear-gradient(135deg, #EF6632 0%, #EC5132 40%, #EB4C32 70%, #F27F34 100%);">创造力</span>
			</h1>

			<!-- Subheadline -->
			<p class="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
				丙午以马，灵感如火、一日千里。文字生图、智能对话，一站式 AI 创作平台。
			</p>

			<!-- CTA Buttons -->
			<div class="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
				<GetStartedButton
					href={defaultRoute}
					variant="default"
					size="lg"
					class="hero-cta-primary w-full sm:w-auto"
				>
					<span class="text-nowrap">马上开始创作</span>
				</GetStartedButton>
				<Button href="#features" variant="outline" size="lg" class="w-full sm:w-auto">
					<span class="text-nowrap">了解更多</span>
				</Button>
			</div>
		</div>

		<!-- Product preview cards -->
		<div class="mt-16 grid gap-4 sm:grid-cols-2 lg:mt-20">
			<!-- Image generation preview -->
			<div class="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#EF6632]/20">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EF6632]/10 transition-colors group-hover:bg-[#EF6632]/15">
						<ImageIcon class="h-5 w-5 text-[#EF6632]" />
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
					<img src="https://gallery.bingwuai.com/hero-1_compressed.jpg" alt="AI 生成的水彩猫咪画作" class="aspect-square rounded-lg object-cover" loading="lazy" />
					<img src="https://gallery.bingwuai.com/hero-2_compressed.jpg" alt="AI 生成的水彩猫咪画作" class="aspect-square rounded-lg object-cover" loading="lazy" />
					<img src="https://gallery.bingwuai.com/hero-3_compressed.jpg" alt="AI 生成的水彩猫咪画作" class="aspect-square rounded-lg object-cover" loading="lazy" />
				</div>
			</div>

			<!-- Chat preview -->
			<div class="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#EF6632]/20">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EF6632]/10 transition-colors group-hover:bg-[#EF6632]/15">
						<MessageCircle class="h-5 w-5 text-[#EF6632]" />
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

<style>
	/* Logo entrance animation */
	.hero-logo {
		animation: logo-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes logo-rise {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.92);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Staggered fade-in for hero content */
	.hero-section h1 {
		animation: fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
	}
	.hero-section h1 + p {
		animation: fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
	}

	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
