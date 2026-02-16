<script lang="ts">
	const productLinks = [
		{ title: "AI 图片生成", href: "/image-generation" },
		{ title: "AI 智能对话", href: "/chat" },
		{ title: "积分中心", href: "/me/credits" },
	];

	const legalLinks = [
		{ title: "隐私政策", href: "/privacy-policy" },
		{ title: "服务条款", href: "/terms-of-service" },
	];
</script>

<footer class="border-t bg-background py-12">
	<div class="mx-auto max-w-6xl px-6">
		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Brand -->
			<div class="sm:col-span-2 lg:col-span-1">
				<span class="text-lg font-bold">BingWu AI</span>
				<p class="mt-2 text-sm text-muted-foreground">
					AI 智能创作平台，让创造更简单。
				</p>
			</div>

			<!-- Product links -->
			<div>
				<h4 class="text-sm font-semibold">产品</h4>
				<ul class="mt-3 space-y-2">
					{#each productLinks as link}
						<li>
							<a
								href={link.href}
								class="text-sm text-muted-foreground transition-colors hover:text-foreground"
							>
								{link.title}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Legal links -->
			<div>
				<h4 class="text-sm font-semibold">法律</h4>
				<ul class="mt-3 space-y-2">
					{#each legalLinks as link}
						<li>
							<a
								href={link.href}
								class="text-sm text-muted-foreground transition-colors hover:text-foreground"
							>
								{link.title}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Support -->
			<div>
				<h4 class="text-sm font-semibold">支持</h4>
				<ul class="mt-3 space-y-2">
					<li>
						<a
							href="#faq"
							class="text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							常见问题
						</a>
					</li>
					<li>
						<a
							href="mailto:support@bingwu.ai"
							class="text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							联系我们
						</a>
					</li>
				</ul>
			</div>
		</div>

		<!-- Bottom bar -->
		<div class="mt-10 border-t pt-6">
			<p class="text-center text-sm text-muted-foreground">
				&copy; {new Date().getFullYear()} BingWu AI. All rights reserved.
			</p>
		</div>
	</div>
</footer>
