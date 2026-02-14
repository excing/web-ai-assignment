<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Table from "$lib/components/ui/table";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import { Loader2, Undo2 } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { RedemptionCode, RedemptionDetail } from "$lib/types/credits";

    let {
        open = $bindable(false),
        code = null,
        onRefund,
    }: {
        open: boolean;
        code: RedemptionCode | null;
        onRefund: (transactionId: string) => Promise<void>;
    } = $props();

    let redemptions = $state<RedemptionDetail[]>([]);
    let loading = $state(false);
    let refunding = $state<string | null>(null);

    // 当 open + code 变化时加载数据
    $effect(() => {
        if (open && code) {
            loadRedemptions(code.code);
        }
    });

    async function loadRedemptions(codeStr: string) {
        redemptions = [];
        loading = true;
        try {
            const res = await fetch(`/api/admin/codes/${encodeURIComponent(codeStr)}/redemptions`);
            if (res.ok) {
                const data = await res.json();
                redemptions = data.redemptions;
            } else {
                toast.error("加载兑换记录失败");
            }
        } catch {
            toast.error("网络错误");
        } finally {
            loading = false;
        }
    }

    async function handleRefund(transactionId: string) {
        refunding = transactionId;
        try {
            await onRefund(transactionId);
            // 成功后更新本地退款状态
            redemptions = redemptions.map(r =>
                r.id === transactionId ? { ...r, refunded: true } : r
            );
        } finally {
            refunding = null;
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
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>兑换记录</Dialog.Title>
            <Dialog.Description>
                {#if code}
                    兑换码：<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{code.code}</code>
                    &nbsp;|&nbsp;套餐：{code.packageName ?? "-"}
                    &nbsp;|&nbsp;积分：{code.packageCredits?.toLocaleString() ?? "-"}
                {/if}
            </Dialog.Description>
        </Dialog.Header>
        <Separator />
        <div class="max-h-96 overflow-y-auto">
            {#if loading}
                <div class="py-8 text-center">
                    <Loader2 class="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
                    <p class="text-muted-foreground mt-2 text-sm">加载中...</p>
                </div>
            {:else if redemptions.length === 0}
                <div class="py-8 text-center">
                    <p class="text-muted-foreground text-sm">暂无兑换记录</p>
                </div>
            {:else}
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>用户</Table.Head>
                            <Table.Head>积分</Table.Head>
                            <Table.Head>时间</Table.Head>
                            <Table.Head class="text-right">操作</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each redemptions as r (r.id)}
                            <Table.Row>
                                <Table.Cell>
                                    <div>
                                        <p class="text-sm font-medium">{r.userName ?? "未知用户"}</p>
                                        <p class="text-muted-foreground text-xs">{r.userEmail ?? "-"}</p>
                                    </div>
                                </Table.Cell>
                                <Table.Cell class="font-medium">
                                    +{r.amount.toLocaleString()}
                                </Table.Cell>
                                <Table.Cell class="text-muted-foreground text-sm">
                                    {formatDate(r.createdAt)}
                                </Table.Cell>
                                <Table.Cell class="text-right">
                                    {#if r.refunded}
                                        <Badge variant="secondary">已退款</Badge>
                                    {:else}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={refunding === r.id}
                                            onclick={() => handleRefund(r.id)}
                                        >
                                            {#if refunding === r.id}
                                                <Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />
                                                退款中...
                                            {:else}
                                                <Undo2 class="mr-1 h-3.5 w-3.5" />
                                                退款
                                            {/if}
                                        </Button>
                                    {/if}
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
