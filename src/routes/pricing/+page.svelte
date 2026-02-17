<script lang="ts">
	import GetStartedButton from "$lib/components/common/GetStartedButton.svelte";
	import { defaultRoute } from "$lib/config/navigation";
	import { Hourglass, Flame, Zap, Ticket } from "lucide-svelte";
</script>

<svelte:head>
	<title>定价 - BingWu AI</title>
</svelte:head>

<div class="flex min-h-screen w-full flex-col items-center px-6 py-16">
	<div class="w-full max-w-3xl">
		<div class="text-center">
			<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
				<Hourglass class="h-8 w-8 text-primary" />
			</div>
			<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">马蹄声近，定价将至</h1>
			<p class="mt-4 text-lg text-muted-foreground">
				BingWu AI 正处于试运营阶段，正式定价方案正在精心打磨中。
			</p>
		</div>

		<div class="mt-12 grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border bg-card p-6 text-center">
				<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
					<Ticket class="h-5 w-5 text-primary" />
				</div>
				<h3 class="font-semibold">兑换码体验</h3>
				<p class="mt-1 text-sm text-muted-foreground">通过兑换码充值积分，即可使用全部功能</p>
			</div>
			<div class="rounded-2xl border bg-card p-6 text-center">
				<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
					<Flame class="h-5 w-5 text-primary" />
				</div>
				<h3 class="font-semibold">积分制计费</h3>
				<p class="mt-1 text-sm text-muted-foreground">正式上线后将采用灵活的积分制</p>
			</div>
			<div class="rounded-2xl border bg-card p-6 text-center">
				<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
					<Zap class="h-5 w-5 text-primary" />
				</div>
				<h3 class="font-semibold">按需付费</h3>
				<p class="mt-1 text-sm text-muted-foreground">用多少扣多少，无月费无订阅</p>
			</div>
		</div>

		<div class="mt-12 rounded-2xl border bg-card p-8 text-center">
			<p class="text-muted-foreground">
				试运营期间，请联系管理员获取或购买兑换码。<br />
				兑换码充值后即可体验全部 AI 功能。
			</p>
			<div class="mt-6">
				<GetStartedButton href={defaultRoute} variant="default" size="lg">
					<span class="text-nowrap">立即注册</span>
				</GetStartedButton>
			</div>
		</div>
	</div>
</div>
