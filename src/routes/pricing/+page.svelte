<script lang="ts">
	import { goto } from "$app/navigation";
	import GetStartedButton from "$lib/components/common/GetStartedButton.svelte";
	import { defaultRoute } from "$lib/config/navigation";
	import { Construction } from "lucide-svelte";
</script>

<svelte:head>
	<title>定价 - BingWu AI</title>
</svelte:head>

<div class="flex min-h-screen w-full flex-col items-center justify-center px-6 py-16">
	<div class="w-full max-w-md text-center">
		<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
			<Construction class="h-8 w-8 text-primary" />
		</div>
		<h1 class="text-3xl font-bold tracking-tight">定价方案即将推出</h1>
		<p class="mt-4 text-muted-foreground">
			当前为试运行阶段，所有功能免费体验。<br />
			正式定价方案敬请期待。
		</p>
		<div class="mt-8">
			<GetStartedButton href={defaultRoute} variant="default" size="default">
				<span class="text-nowrap">免费体验</span>
			</GetStartedButton>
		</div>
	</div>
</div>
