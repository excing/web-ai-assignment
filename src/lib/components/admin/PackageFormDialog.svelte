<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Loader2 } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { CreditPackage } from "$lib/types/credits";

    export interface PackageFormData {
        name: string;
        credits: number;
        price: number;
        description: string | null;
        isVisible: boolean;
    }

    let {
        mode,
        open = $bindable(false),
        initialData = null,
        submitting = $bindable(false),
        onSubmit,
    }: {
        mode: "create" | "edit";
        open: boolean;
        initialData?: Partial<CreditPackage> | null;
        submitting: boolean;
        onSubmit: (data: PackageFormData) => Promise<void>;
    } = $props();

    const isEdit = $derived(mode === "edit");

    let formName = $state("");
    let formCredits = $state("");
    let formPrice = $state("");
    let formDescription = $state("");
    let formIsVisible = $state(true);

    // 当 open 变化时重置表单
    $effect(() => {
        if (open) {
            if (isEdit && initialData) {
                formName = initialData.name ?? "";
                formCredits = String(initialData.credits ?? "");
                formPrice = String(initialData.price ?? "");
                formDescription = initialData.description ?? "";
                formIsVisible = initialData.isVisible ?? true;
            } else {
                formName = "";
                formCredits = "";
                formPrice = "";
                formDescription = "";
                formIsVisible = true;
            }
        }
    });

    async function handleSubmit() {
        if (!formName.trim()) {
            toast.error("套餐名称不能为空");
            return;
        }
        const credits = parseInt(formCredits, 10);
        if (!credits || credits <= 0) {
            toast.error("积分数量必须为正整数");
            return;
        }
        const price = parseInt(formPrice, 10);
        if (isNaN(price) || price < 0) {
            toast.error("价格必须为非负整数（单位：分）");
            return;
        }

        await onSubmit({
            name: formName.trim(),
            credits,
            price,
            description: formDescription.trim() || null,
            isVisible: formIsVisible,
        });
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>{isEdit ? "编辑套餐" : "创建套餐"}</Dialog.Title>
            <Dialog.Description>
                {isEdit ? "修改套餐信息" : "填写以下信息创建新的积分套餐"}
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
            <div class="space-y-2">
                <Label for="pkg-name">套餐名称</Label>
                <Input
                    id="pkg-name"
                    bind:value={formName}
                    placeholder="例如：基础套餐"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="pkg-credits">积分数量</Label>
                <Input
                    id="pkg-credits"
                    type="number"
                    bind:value={formCredits}
                    placeholder="例如：100"
                    min="1"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="pkg-price">价格（分）</Label>
                <Input
                    id="pkg-price"
                    type="number"
                    bind:value={formPrice}
                    placeholder="例如：990 表示 ¥9.90"
                    min="0"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="pkg-desc">描述（可选）</Label>
                <Textarea
                    id="pkg-desc"
                    bind:value={formDescription}
                    placeholder="套餐描述"
                    disabled={submitting}
                />
            </div>
            <div class="flex items-center gap-2">
                <Checkbox
                    id="pkg-visible"
                    checked={formIsVisible}
                    onCheckedChange={(v) => { formIsVisible = v === true; }}
                    disabled={submitting}
                />
                <Label for="pkg-visible" class="text-sm font-normal">对用户可见</Label>
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (open = false)} disabled={submitting}>
                    取消
                </Button>
                <Button type="submit" disabled={submitting}>
                    {#if submitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        提交中...
                    {:else}
                        {isEdit ? "保存" : "创建"}
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
