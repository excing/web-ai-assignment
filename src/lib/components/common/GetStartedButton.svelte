<script lang="ts">
    import { Button } from "$lib/components/ui/button";
	    import {
	        getAuthLoaded,
	        getCurrentUser,
	        ensureCurrentUserLoaded,
	    } from "$lib/stores/auth.svelte";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";

    let {
        href = undefined,
        onclick = undefined,
        children,
        class: className = undefined,
        ...rest
    } = $props<{
        href?: string;
        onclick?: (e: MouseEvent) => void;
        children?: Snippet;
        class?: string;
        [key: string]: any;
    }>();

	    let isAuthenticated = $derived(getAuthLoaded() ? !!getCurrentUser() : null);

	    async function handleClick(e: MouseEvent) {
	        if (!getAuthLoaded()) {
	            await ensureCurrentUserLoaded();
	        }

	        if (!getCurrentUser()) {
            e.preventDefault();
            goto("/sign-in");
            return;
        }

        if (onclick) {
            onclick(e);
        }
    }
</script>

<Button
    {...rest}
    class={className}
    href={isAuthenticated === false ? "/sign-in" : href}
    onclick={handleClick}
>
    {#if isAuthenticated === false}
        Sign In to Get Started
    {:else}
        {@render children?.()}
    {/if}
</Button>
