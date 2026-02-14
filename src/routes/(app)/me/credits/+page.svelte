<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Coins, Send, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { getCreditBalance, setCreditBalance } from "$lib/stores/credits.svelte";
    import type { CreditTransaction } from "$lib/types/credits";

    let balance = $derived(getCreditBalance());
    let codeInput = $state("");
    let redeeming = $state(false);
    let transactions = $state<CreditTransaction[]>([]);
    let loadingTx = $state(true);

    async function loadTransactions() {
        loadingTx = true;
        try {
            const res = await fetch("/api/credits/transactions");
            if (res.ok) {
                const data = await res.json();
                transactions = data.transactions;
            }
        } catch {
            toast.error("加载交易记录失败");
        } finally {
            loadingTx = false;
        }
    }

    async function handleRedeem() {
        const code = codeInput.trim();
        if (!code) {
            toast.error("请输入兑换码");
            return;
        }
        redeeming = true;
        try {
            const res = await fetch("/api/credits/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "兑换失败");
                return;
            }
            toast.success(`${data.message}，获得 ${data.creditsAdded} 积分`);
            setCreditBalance(data.newBalance);
            codeInput = "";
            await loadTransactions();
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            redeeming = false;
        }
    }

    function getTypeBadge(type: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
        switch (type) {
            case "redemption": return { label: "兑换", variant: "default" };
            case "refund": return { label: "退款", variant: "destructive" };
            case "usage":
            case "consumption": return { label: "消费", variant: "secondary" };
            case "admin_grant": return { label: "管理员赠送", variant: "outline" };
            case "adjustment": return { label: "调整", variant: "outline" };
            default: return { label: type, variant: "secondary" };
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    $effect(() => {
        loadTransactions();
    });
</script>

<section class="flex w-full flex-col items-center px-4 py-6">
    <div class="w-full max-w-lg space-y-6">
        <!-- 余额卡片 -->
        <Card.Root>
            <button class="w-full" disabled>
                <Card.Content class="flex items-center gap-4 p-4">
                    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <Coins class="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div class="text-left">
                        <p class="text-muted-foreground text-sm">当前余额</p>
                        <p class="text-2xl font-bold">{balance.toLocaleString()}</p>
                    </div>
                    <p class="text-muted-foreground ml-auto hidden text-xs sm:block">永不过期</p>
                </Card.Content>
            </button>
        </Card.Root>

        <!-- 兑换码兑换 -->
        <Card.Root>
            <Card.Header>
                <Card.Title>兑换码兑换</Card.Title>
                <Card.Description>输入兑换码获取积分</Card.Description>
            </Card.Header>
            <Card.Content>
                <form
                    class="flex gap-3"
                    onsubmit={(e) => { e.preventDefault(); handleRedeem(); }}
                >
                    <Input
                        bind:value={codeInput}
                        placeholder="XXXX-XXXX-XXXX"
                        class="flex-1 font-mono uppercase"
                        disabled={redeeming}
                    />
                    <Button type="submit" disabled={redeeming || !codeInput.trim()}>
                        {#if redeeming}
                            <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                            兑换中
                        {:else}
                            <Send class="mr-2 h-4 w-4" />
                            兑换
                        {/if}
                    </Button>
                </form>
            </Card.Content>
        </Card.Root>

        <!-- 交易记录 -->
        <div>
            <h2 class="mb-3 text-sm font-medium text-muted-foreground">交易记录</h2>
            {#if loadingTx}
                <div class="space-y-2">
                    <Skeleton class="h-14 w-full rounded-lg" />
                    <Skeleton class="h-14 w-full rounded-lg" />
                    <Skeleton class="h-14 w-full rounded-lg" />
                </div>
            {:else if transactions.length === 0}
                <div class="py-8 text-center">
                    <Coins class="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                    <p class="text-muted-foreground text-sm">暂无交易记录</p>
                </div>
            {:else}
                <div class="space-y-2">
                    {#each transactions as tx (tx.id)}
                        {@const badge = getTypeBadge(tx.type)}
                        <div class="flex items-center gap-3 rounded-lg border p-3">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <Badge variant={badge.variant} class="text-xs">{badge.label}</Badge>
                                    <span class="text-muted-foreground truncate text-xs">{tx.description ?? ""}</span>
                                </div>
                                <p class="text-muted-foreground mt-1 text-xs">{formatDate(tx.createdAt)}</p>
                            </div>
                            <span class="flex-shrink-0 font-medium {tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                                {#if tx.amount > 0}
                                    +{tx.amount.toLocaleString()}
                                {:else}
                                    {tx.amount.toLocaleString()}
                                {/if}
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</section>
