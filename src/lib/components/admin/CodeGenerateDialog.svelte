<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Loader2 } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { CreditPackage } from "$lib/types/credits";

    export interface CodeGenerateFormData {
        packageId: string;
        count: number;
        expiresAt: string | null;
        maxRedemptions: number | null;
    }

    let {
        open = $bindable(false),
        packages,
        submitting = $bindable(false),
        onSubmit,
    }: {
        open: boolean;
        packages: CreditPackage[];
        submitting: boolean;
        onSubmit: (data: CodeGenerateFormData) => Promise<void>;
    } = $props();

    let genPackageId = $state("");
    let genCount = $state("1");
    let genExpiresAt = $state("");
    let genMaxRedemptions = $state("1");

    let activePackages = $derived(packages.filter(p => p.isActive));

    function getDefaultExpiresAt(): string {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // 打开时重置表单
    $effect(() => {
        if (open) {
            genPackageId = "";
            genCount = "1";
            genExpiresAt = getDefaultExpiresAt();
            genMaxRedemptions = "1";
        }
    });

    async function handleSubmit() {
        if (!genPackageId) {
            toast.error("请选择关联套餐");
            return;
        }
        const count = parseInt(genCount, 10);
        if (!count || count < 1 || count > 100) {
            toast.error("生成数量必须为1-100之间的整数");
            return;
        }

        let expiresAt: string | null = null;
        if (genExpiresAt) {
            expiresAt = new Date(genExpiresAt).toISOString();
        }

        let maxRedemptions: number | null = null;
        if (genMaxRedemptions) {
            const maxR = parseInt(genMaxRedemptions, 10);
            if (maxR > 0) maxRedemptions = maxR;
        }

        await onSubmit({
            packageId: genPackageId,
            count,
            expiresAt,
            maxRedemptions,
        });
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>生成兑换码</Dialog.Title>
            <Dialog.Description>选择套餐并设置兑换码参数</Dialog.Description>
        </Dialog.Header>
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
            <div class="space-y-2">
                <Label>关联套餐</Label>
                <Select.Root type="single" bind:value={genPackageId}>
                    <Select.Trigger class="w-full">
                        {genPackageId
                            ? activePackages.find(p => p.id === genPackageId)?.name ?? "请选择套餐"
                            : "请选择套餐"}
                    </Select.Trigger>
                    <Select.Content>
                        {#each activePackages as pkg (pkg.id)}
                            <Select.Item value={pkg.id}>
                                {pkg.name}（{pkg.credits} 积分）
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
            <div class="space-y-2">
                <Label for="gen-count">生成数量</Label>
                <Input
                    id="gen-count"
                    type="number"
                    bind:value={genCount}
                    placeholder="1-100"
                    min="1"
                    max="100"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="gen-expires">过期时间（留空表示永不过期，默认30天）</Label>
                <Input
                    id="gen-expires"
                    type="datetime-local"
                    bind:value={genExpiresAt}
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="gen-max">最大使用次数（留空表示不限，默认1次）</Label>
                <Input
                    id="gen-max"
                    type="number"
                    bind:value={genMaxRedemptions}
                    placeholder="不限"
                    min="1"
                    disabled={submitting}
                />
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (open = false)} disabled={submitting}>
                    取消
                </Button>
                <Button type="submit" disabled={submitting}>
                    {#if submitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                    {:else}
                        生成
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
