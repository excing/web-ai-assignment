<script lang="ts">
	import { ChevronDown } from "lucide-svelte";

	const faqs = [
		{
			question: "BingWu AI 可以做什么？",
			answer: "BingWu AI 提供两大核心功能：AI 图片生成和 AI 智能对话。你可以通过文字描述生成图片，也可以上传参考图片进行图生图创作。智能对话支持多轮交互、图片附件和代码高亮显示。",
		},
		{
			question: "如何开始使用？",
			answer: "注册账号后即可体验所有 AI 功能。支持邮箱注册和 Google 一键登录，30 秒即可完成。",
		},
		{
			question: "支持哪些图片格式？",
			answer: "支持 JPEG、PNG、GIF 和 WebP 格式。上传参考图片时，单张不超过 5MB，最多可同时上传 4 张参考图。",
		},
		{
			question: "我的数据安全吗？",
			answer: "我们采用企业级安全措施，包括数据传输加密、邮箱验证、会话管理和接口限流保护。你的对话记录和生成内容仅你本人可见。",
		},
	];

	let openIndex = $state<number | null>(null);

	function toggle(index: number) {
		openIndex = openIndex === index ? null : index;
	}
</script>

<section id="faq" class="py-20 lg:py-28">
	<div class="mx-auto max-w-3xl px-6">
		<!-- Section header -->
		<div class="text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				常见问题
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				关于 BingWu AI 的常见疑问解答
			</p>
		</div>

		<!-- FAQ List -->
		<div class="mt-14 space-y-3">
			{#each faqs as faq, index}
				<div class="rounded-xl border bg-card transition-colors hover:bg-accent/50">
					<button
						class="flex w-full items-center justify-between px-6 py-5 text-left"
						onclick={() => toggle(index)}
						aria-expanded={openIndex === index}
					>
						<span class="pr-4 font-medium">{faq.question}</span>
						<ChevronDown
							class="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 {openIndex === index ? 'rotate-180' : ''}"
						/>
					</button>
					{#if openIndex === index}
						<div class="px-6 pb-5">
							<p class="text-sm leading-relaxed text-muted-foreground">
								{faq.answer}
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>
