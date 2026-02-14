<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
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

<section class="flex w-full flex-col items-start justify-start p-6">
    <div class="w-full max-w-4xl">
        <div class="flex flex-col items-start justify-center gap-2">
            <h1 class="text-3xl font-semibold tracking-tight">积分</h1>
            <p class="text-muted-foreground">查看积分余额、兑换码兑换和交易记录</p>
        </div>

        <div class="mt-6 flex flex-col gap-6">
            <!-- Balance Card -->
            <Card.Root>
                <Card.Content class="flex items-center gap-4 pt-6">
                    <div class="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-full">
                        <Coins class="text-primary h-7 w-7" />
                    </div>
                    <div>
                        <p class="text-muted-foreground text-sm">当前余额</p>
                        <p class="text-4xl font-bold">{balance.toLocaleString()}</p>
                    </div>
                    <p class="text-muted-foreground ml-auto text-sm">积分永不过期</p>
                </Card.Content>
            </Card.Root>

            <!-- Redeem Card -->
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
                            placeholder="请输入兑换码，例如 XXXX-XXXX-XXXX"
                            class="flex-1 font-mono uppercase"
                            disabled={redeeming}
                        />
                        <Button type="submit" disabled={redeeming || !codeInput.trim()}>
                            {#if redeeming}
                                <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                                兑换中...
                            {:else}
                                <Send class="mr-2 h-4 w-4" />
                                兑换
                            {/if}
                        </Button>
                    </form>
                </Card.Content>
            </Card.Root>

            <Separator />

            <!-- Transaction History -->
            <div>
                <h2 class="mb-4 text-xl font-semibold">交易记录</h2>
                {#if loadingTx}
                    <Card.Root>
                        <Card.Content class="py-8 text-center">
                            <RefreshCw class="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
                            <p class="text-muted-foreground mt-2 text-sm">加载中...</p>
                        </Card.Content>
                    </Card.Root>
                {:else if transactions.length === 0}
                    <Card.Root>
                        <Card.Content class="py-8 text-center">
                            <Coins class="text-muted-foreground mx-auto h-8 w-8" />
                            <p class="text-muted-foreground mt-2 text-sm">暂无交易记录</p>
                        </Card.Content>
                    </Card.Root>
                {:else}
                    <Card.Root>
                        <Table.Root>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>类型</Table.Head>
                                    <Table.Head>金额</Table.Head>
                                    <Table.Head class="hidden sm:table-cell">描述</Table.Head>
                                    <Table.Head class="text-right">时间</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {#each transactions as tx (tx.id)}
                                    {@const badge = getTypeBadge(tx.type)}
                                    <Table.Row>
                                        <Table.Cell>
                                            <Badge variant={badge.variant}>{badge.label}</Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span class="flex items-center gap-1 font-medium {tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                                                {#if tx.amount > 0}
                                                    <ArrowUpCircle class="h-4 w-4" />
                                                    +{tx.amount.toLocaleString()}
                                                {:else}
                                                    <ArrowDownCircle class="h-4 w-4" />
                                                    {tx.amount.toLocaleString()}
                                                {/if}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell class="text-muted-foreground hidden sm:table-cell">
                                            {tx.description ?? "-"}
                                        </Table.Cell>
                                        <Table.Cell class="text-muted-foreground text-right text-sm">
                                            {formatDate(tx.createdAt)}
                                        </Table.Cell>
                                    </Table.Row>
                                {/each}
                            </Table.Body>
                        </Table.Root>
                    </Card.Root>
                {/if}
            </div>
        </div>
    </div>
</section>
