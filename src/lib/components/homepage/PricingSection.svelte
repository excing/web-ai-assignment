<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import GetStartedButton from "$lib/components/common/GetStartedButton.svelte";
	import { defaultRoute } from "$lib/config/navigation";
</script>

<section id="pricing" class="border-t bg-muted/30 py-20 lg:py-28">
	<div class="mx-auto max-w-6xl px-6">
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				跃马扬鞭，即刻出发
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				试运营期间通过兑换码充值积分，即可体验全部 AI 功能
			</p>
			<div class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
				<GetStartedButton href={defaultRoute} variant="default" size="lg">
					<span class="text-nowrap">立即注册，开始体验</span>
				</GetStartedButton>
				<Button href="/pricing" variant="outline" size="lg">
					<span class="text-nowrap">查看定价</span>
				</Button>
			</div>
		</div>
	</div>
</section>
