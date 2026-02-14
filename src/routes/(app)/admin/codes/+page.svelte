<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import {
        Ticket, Plus, Copy, Check, Loader2, Eye, Ban,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { PAGINATION } from "$lib/config/constants";
    import Pagination from "$lib/components/common/Pagination.svelte";
    import CodeGenerateDialog from "$lib/components/admin/CodeGenerateDialog.svelte";
    import CodeRedemptionsDialog from "$lib/components/admin/CodeRedemptionsDialog.svelte";
    import type { CodeGenerateFormData } from "$lib/components/admin/CodeGenerateDialog.svelte";
    import type {
        CreditPackage,
        RedemptionCode,
    } from "$lib/types/credits";

    // List state
    let codes = $state<RedemptionCode[]>([]);
    let packages = $state<CreditPackage[]>([]);
    let loading = $state(true);
    let total = $state(0);
    let page = $state(1);
    const limit = PAGINATION.DEFAULT_LIMIT;

    // Filters
    let filterPackageId = $state<string>("");
    let filterStatus = $state<string>("valid");

    // Generate dialog state
    let generateOpen = $state(false);
    let generating = $state(false);

    // Redemptions dialog state
    let redemptionsOpen = $state(false);
    let redemptionsCode = $state<RedemptionCode | null>(null);

    // Clipboard state
    let copiedId = $state<string | null>(null);
    let deactivating = $state<string | null>(null);

    async function loadPackages() {
        try {
            const res = await fetch("/api/admin/packages");
            if (res.ok) {
                const data = await res.json();
                packages = data.packages;
            }
        } catch {
            // silent
        }
    }

    async function loadCodes() {
        loading = true;
        try {
            const offset = (page - 1) * limit;
            const params = new URLSearchParams();
            params.set("limit", String(limit));
            params.set("offset", String(offset));
            if (filterPackageId) params.set("packageId", filterPackageId);
            if (filterStatus) params.set("status", filterStatus);
            const res = await fetch(`/api/admin/codes?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                codes = data.codes;
                total = data.total;
            }
        } catch {
            toast.error("加载兑换码列表失败");
        } finally {
            loading = false;
        }
    }

    async function handleGenerate(data: CodeGenerateFormData) {
        generating = true;
        try {
            const body: Record<string, unknown> = {
                packageId: data.packageId,
                count: data.count,
            };
            if (data.expiresAt) body.expiresAt = data.expiresAt;
            if (data.maxRedemptions) body.maxRedemptions = data.maxRedemptions;

            const res = await fetch("/api/admin/codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const result = await res.json();
            if (!res.ok) {
                toast.error(result.error || "生成失败");
                return;
            }
            const newCount = result.codes.length;
            if (page === 1) {
                await loadCodes();
            } else {
                page = 1;
            }
            toast.success(`成功生成 ${newCount} 个兑换码`);
            generateOpen = false;
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            generating = false;
        }
    }

    async function copyCode(code: string, id: string) {
        try {
            await navigator.clipboard.writeText(code);
            copiedId = id;
            toast.success("已复制到剪贴板");
            setTimeout(() => { copiedId = null; }, 2000);
        } catch {
            toast.error("复制失败");
        }
    }

    function openRedemptions(code: RedemptionCode) {
        redemptionsCode = code;
        redemptionsOpen = true;
    }

    async function handleRefund(transactionId: string) {
        const res = await fetch("/api/admin/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId }),
        });
        const data = await res.json();
        if (!res.ok) {
            toast.error(data.error || "退款失败");
            throw new Error(data.error);
        }
        // 更新 codes 列表中的使用次数
        if (redemptionsCode) {
            codes = codes.map(c =>
                c.id === redemptionsCode!.id
                    ? { ...c, currentRedemptions: Math.max(0, c.currentRedemptions - 1) }
                    : c
            );
        }
        toast.success(`退款成功，扣除 ${data.creditsDeducted} 积分`);
    }

    async function handleDeactivateCode(code: RedemptionCode) {
        deactivating = code.id;
        try {
            const res = await fetch(`/api/admin/codes/${code.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "停用失败");
                return;
            }
            codes = codes.map(c => c.id === code.id ? { ...c, isActive: false } : c);
            toast.success("兑换码已停用");
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            deactivating = null;
        }
    }

    function formatDateShort(dateStr: string): string {
        return new Date(dateStr).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }

    function isExpired(expiresAt: string | null): boolean {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    }

    function getCodeStatus(code: RedemptionCode): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
        if (!code.isActive) return { label: "停用", variant: "secondary" };
        if (isExpired(code.expiresAt)) return { label: "已过期", variant: "destructive" };
        if (code.maxRedemptions !== null && code.currentRedemptions >= code.maxRedemptions) {
            return { label: "已用完", variant: "outline" };
        }
        return { label: "有效", variant: "default" };
    }

    $effect(() => {
        loadPackages();
    });

    // Re-load codes when page or filters change
    $effect(() => {
        page;
        filterPackageId;
        filterStatus;
        loadCodes();
    });
</script>

<div class="flex flex-col gap-6 p-4 sm:p-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
            <h1 class="text-2xl font-bold flex items-center gap-2 sm:text-3xl sm:gap-3">
                <Ticket class="h-6 w-6 shrink-0 sm:h-8 sm:w-8" />
                <span class="hidden sm:inline truncate">兑换码管理</span>
            </h1>
            <p class="text-muted-foreground mt-1 text-sm sm:text-base truncate hidden sm:block">生成和管理兑换码</p>
        </div>
        <div class="flex gap-2 shrink-0">
            <Button size="sm" class="sm:size-default" onclick={() => (generateOpen = true)}>
                <Plus class="mr-1.5 h-4 w-4 sm:mr-2" />
                生成兑换码
            </Button>
        </div>
    </div>

    <!-- 主内容区 -->
    <Card.Root>
        <Card.Header>
            <Card.Title>兑换码列表</Card.Title>
            <Card.Description>管理所有兑换码及其使用状态</Card.Description>
        </Card.Header>
        <Card.Content>
            <!-- 筛选器 -->
            <div class="mb-4 flex flex-wrap items-center justify-end gap-3">
                <Select.Root type="single" bind:value={filterPackageId} onValueChange={() => { page = 1; }}>
                    <Select.Trigger class="w-36 sm:w-48">
                        {filterPackageId
                            ? packages.find(p => p.id === filterPackageId)?.name ?? "全部套餐"
                            : "全部套餐"}
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="">全部套餐</Select.Item>
                        {#each packages as pkg (pkg.id)}
                            <Select.Item value={pkg.id}>{pkg.name}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
                <Select.Root type="single" bind:value={filterStatus} onValueChange={() => { page = 1; }}>
                    <Select.Trigger class="w-27 sm:w-36">
                        {filterStatus === "valid" ? "有效"
                            : filterStatus === "expired" ? "已过期"
                            : filterStatus === "used_up" ? "已用完"
                            : filterStatus === "inactive" ? "停用"
                            : "全部状态"}
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="">全部状态</Select.Item>
                        <Select.Item value="valid">有效</Select.Item>
                        <Select.Item value="expired">已过期</Select.Item>
                        <Select.Item value="used_up">已用完</Select.Item>
                        <Select.Item value="inactive">停用</Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>

            {#if loading}
                <div class="space-y-2">
                    <Skeleton class="h-16 w-full" />
                    <Skeleton class="h-16 w-full" />
                    <Skeleton class="h-16 w-full" />
                </div>
            {:else if codes.length === 0}
                <div class="text-center py-12">
                    <Ticket class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 class="text-lg font-medium mb-2">暂无兑换码</h3>
                    <p class="text-muted-foreground mb-4">点击上方按钮生成兑换码</p>
                    <Button onclick={() => (generateOpen = true)}>
                        <Plus class="mr-2 h-4 w-4" />
                        生成兑换码
                    </Button>
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <Table.Root>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>兑换码</Table.Head>
                                    <Table.Head>套餐</Table.Head>
                                    <Table.Head>积分</Table.Head>
                                    <Table.Head>使用情况</Table.Head>
                                    <Table.Head>状态</Table.Head>
                                    <Table.Head>过期时间</Table.Head>
                                    <Table.Head class="text-right">操作</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {#each codes as code (code.id)}
                                    {@const status = getCodeStatus(code)}
                                    <Table.Row>
                                        <Table.Cell>
                                            <div class="flex items-center gap-2">
                                                <code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                    {code.code}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    class="h-7 w-7 p-0"
                                                    onclick={() => copyCode(code.code, code.id)}
                                                >
                                                    {#if copiedId === code.id}
                                                        <Check class="h-3.5 w-3.5 text-green-500" />
                                                    {:else}
                                                        <Copy class="h-3.5 w-3.5" />
                                                    {/if}
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>{code.packageName ?? "-"}</Table.Cell>
                                        <Table.Cell>{code.packageCredits?.toLocaleString() ?? "-"}</Table.Cell>
                                        <Table.Cell>
                                            {code.currentRedemptions}{code.maxRedemptions !== null ? `/${code.maxRedemptions}` : "/∞"}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge variant={status.variant}>{status.label}</Badge>
                                        </Table.Cell>
                                        <Table.Cell class="text-muted-foreground text-sm">
                                            {code.expiresAt ? formatDateShort(code.expiresAt) : "永不过期"}
                                        </Table.Cell>
                                        <Table.Cell class="text-right">
                                            <div class="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onclick={() => openRedemptions(code)}
                                                >
                                                    <Eye class="mr-1 h-4 w-4" />
                                                    兑换记录
                                                </Button>
                                                {#if status.label === "有效"}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={deactivating === code.id}
                                                        onclick={() => handleDeactivateCode(code)}
                                                    >
                                                        {#if deactivating === code.id}
                                                            <Loader2 class="mr-1 h-4 w-4 animate-spin" />
                                                        {:else}
                                                            <Ban class="mr-1 h-4 w-4" />
                                                        {/if}
                                                        停用
                                                    </Button>
                                                {/if}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                {/each}
                            </Table.Body>
                        </Table.Root>
                    </div>
                {#if total > limit}
                    <Pagination
                        count={total}
                        perPage={limit}
                        bind:page
                        class="mt-4"
                    />
                {/if}
            {/if}
        </Card.Content>
    </Card.Root>
</div>

<CodeGenerateDialog
    bind:open={generateOpen}
    {packages}
    bind:submitting={generating}
    onSubmit={handleGenerate}
/>

<CodeRedemptionsDialog
    bind:open={redemptionsOpen}
    code={redemptionsCode}
    onRefund={handleRefund}
/>
