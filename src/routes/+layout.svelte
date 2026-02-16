<script lang="ts">
	import "../app.css";
	import { Toaster } from "$lib/components/ui/sonner";
	import { ModeWatcher } from "mode-watcher";
	import { untrack } from "svelte";
	import { initAuthFromLayout } from "$lib/stores/auth.svelte";

	let { data, children } = $props();

	$effect(() => {
		const session = data?.session;
		untrack(() => initAuthFromLayout(session));
	});
</script>

<svelte:head>
	<title>BingWu AI - AI 智能创作平台</title>
	<meta name="theme-color" content="#0f172a" />
</svelte:head>

<ModeWatcher defaultMode="light" />
{@render children()}
<Toaster />
