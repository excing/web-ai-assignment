<script lang="ts">
	import { ChevronDown } from "lucide-svelte";

	const faqs = [
		{
			question: "BingWu AI 可以做什么？",
			answer: "BingWu AI 提供两大核心功能：AI 图片生成和 AI 智能对话。你可以通过文字描述生成图片，也可以上传参考图片进行图生图创作。智能对话支持多轮交互、图片附件和代码高亮显示。",
		},
		{
			question: "积分如何获取？",
			answer: "目前可通过兑换码充值积分。兑换码格式为 XXXX-XXXX-XXXX，在个人中心的积分页面输入即可充值。积分充值后永不过期。",
		},
		{
			question: "图片生成和对话分别消耗多少积分？",
			answer: "AI 图片生成每次固定消耗 5 积分。AI 对话按实际使用的 token 数量计费：输入 1 积分/千 tokens，输出 2 积分/千 tokens，单次对话最低消耗 1 积分。",
		},
		{
			question: "支持哪些图片格式？",
			answer: "支持 JPEG、PNG、GIF 和 WebP 格式。上传参考图片时，单张不超过 5MB，最多可同时上传 4 张参考图。",
		},
		{
			question: "我的数据安全吗？",
			answer: "我们采用企业级安全措施，包括数据传输加密、邮箱验证、会话管理和接口限流保护。你的对话记录和生成内容仅你本人可见。",
		},
		{
			question: "积分不足会怎样？",
			answer: "当积分余额不足时，系统会提前提醒。不足以支付当前操作费用时，操作会被暂停，不会产生欠费。你可以随时充值积分继续使用。",
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
