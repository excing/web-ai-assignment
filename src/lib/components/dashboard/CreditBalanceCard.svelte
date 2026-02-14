<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { Coins } from "lucide-svelte";
    import { getCreditBalance } from "$lib/stores/credits.svelte";

    let balance = $derived(getCreditBalance());
</script>

<Card.Root>
    <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
        <Card.Title class="text-sm font-medium">积分余额</Card.Title>
        <Coins class="text-muted-foreground h-4 w-4" />
    </Card.Header>
    <Card.Content>
        <div class="text-2xl font-bold">{balance.toLocaleString()}</div>
        <p class="text-muted-foreground text-xs">积分永不过期</p>
    </Card.Content>
</Card.Root>
