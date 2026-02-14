<script lang="ts">
    import SectionCards from "$lib/components/dashboard/SectionCards.svelte";
    import ChartInteractive from "$lib/components/dashboard/ChartInteractive.svelte";
    import CreditBalanceCard from "$lib/components/dashboard/CreditBalanceCard.svelte";

    let { data } = $props();
</script>

<section class="flex w-full flex-col items-start justify-start p-6">
    <div class="w-full">
        <div class="flex flex-col items-start justify-center gap-2">
            <h1 class="text-3xl font-semibold tracking-tight">
                概览
            </h1>
            <p class="text-muted-foreground">
                数据统计和交互图表
            </p>
        </div>
        <div class="@container/main flex flex-1 flex-col gap-2">
            <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <CreditBalanceCard />
                </div>
                <SectionCards />
                <ChartInteractive />
            </div>
        </div>
    </div>
</section>
