<script lang="ts">
    import Sidebar from "$lib/components/dashboard/Sidebar.svelte";
    import Navbar from "$lib/components/dashboard/Navbar.svelte";
    import { setCreditBalance } from "$lib/stores/credits.svelte";
    import { setIsAdmin } from "$lib/stores/admin.svelte";

    let { data, children } = $props();

    $effect(() => {
        setCreditBalance(data.creditBalance);
        setIsAdmin(data.isAdmin);
    });
</script>

<div class="flex h-screen w-full overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-y-auto">
        <Navbar>
            {@render children()}
        </Navbar>
    </main>
</div>
