<script lang="ts">
	import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
	import InfoIcon from "@lucide/svelte/icons/info";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { onMount } from "svelte";

	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import { mode } from "mode-watcher";

	let { ...restProps }: SonnerProps = $props();

	/**
	 * Workaround for svelte-sonner <=1.0.7 bug:
	 * Toast.svelte calls setPointerCapture() in handlePointerDown but never
	 * calls releasePointerCapture(), causing all pointer events to be locked
	 * to the toast <li> after a click — freezing the entire page.
	 *
	 * We listen in the capture phase and release pointer capture immediately
	 * after the library sets it, so the browser event flow stays normal.
	 */
	onMount(() => {
		function releaseOrphanedCapture(e: PointerEvent) {
			const t = e.target;
			if (t instanceof Element && t.closest('[data-sonner-toast]') && t.hasPointerCapture(e.pointerId)) {
				t.releasePointerCapture(e.pointerId);
			}
		}
		// Use capture phase so we run after svelte-sonner's handler has set capture
		document.addEventListener('pointerdown', releaseOrphanedCapture);
		return () => document.removeEventListener('pointerdown', releaseOrphanedCapture);
	});
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	{...restProps}
	>{#snippet loadingIcon()}
		<Loader2Icon class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4" />
	{/snippet}
</Sonner>
