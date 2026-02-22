<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import * as Select from "$lib/components/ui/select";
    import { Loader2, Sparkles } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { ImageGenTemplate, TemplateFormData } from "$lib/types/admin";
    import type { AiProxyAssignment } from "$lib/types/admin";

    export interface TemplateSubmitData {
        name: string;
        category: string;
        prompt: string;
        previewImageUrl: string | null;
        description: string | null;
        imageCountMin: number;
        imageCountMax: number;
        assignmentId: string | null;
        sortOrder: number;
        isPinned: boolean;
        isActive: boolean;
    }

    let {
        mode,
        open = $bindable(false),
        initialData = null,
        submitting = $bindable(false),
        categories = [],
        assignments = [],
        onSubmit,
    }: {
        mode: "create" | "edit";
        open: boolean;
        initialData?: Partial<ImageGenTemplate> | null;
        submitting: boolean;
        categories: string[];
        assignments: Array<Pick<AiProxyAssignment, 'id' | 'name' | 'featureKey'>>;
        onSubmit: (data: TemplateSubmitData) => Promise<void>;
    } = $props();

    const isEdit = $derived(mode === "edit");

    let formName = $state("");
    let formCategory = $state("");
    let formPrompt = $state("");
    let formPreviewImageUrl = $state("");
    let formDescription = $state("");
    let formImageCountMin = $state("0");
    let formImageCountMax = $state("0");
    let formAssignmentId = $state("");
    let formSortOrder = $state("0");
    let formIsPinned = $state(false);
    let formIsActive = $state(true);

    let generating = $state(false);

    // 当 open 变化时重置表单
    $effect(() => {
        if (open) {
            if (isEdit && initialData) {
                formName = initialData.name ?? "";
                formCategory = initialData.category ?? "";
                formPrompt = initialData.prompt ?? "";
                formPreviewImageUrl = initialData.previewImageUrl ?? "";
                formDescription = initialData.description ?? "";
                formImageCountMin = String(initialData.imageCountMin ?? 0);
                formImageCountMax = String(initialData.imageCountMax ?? 0);
                formAssignmentId = initialData.assignmentId ?? "";
                formSortOrder = String(initialData.sortOrder ?? 0);
                formIsPinned = initialData.isPinned ?? false;
                formIsActive = initialData.isActive ?? true;
            } else {
                formName = "";
                formCategory = "";
                formPrompt = "";
                formPreviewImageUrl = "";
                formDescription = "";
                formImageCountMin = "0";
                formImageCountMax = "0";
                formAssignmentId = "";
                formSortOrder = "0";
                formIsPinned = false;
                formIsActive = true;
            }
        }
    });

    async function handleSubmit() {
        if (!formName.trim()) {
            toast.error("模板名称不能为空");
            return;
        }
        if (!formCategory.trim()) {
            toast.error("分类不能为空");
            return;
        }
        if (!formPrompt.trim()) {
            toast.error("提示词不能为空");
            return;
        }

        await onSubmit({
            name: formName.trim(),
            category: formCategory.trim(),
            prompt: formPrompt.trim(),
            previewImageUrl: formPreviewImageUrl.trim() || null,
            description: formDescription.trim() || null,
            imageCountMin: parseInt(formImageCountMin, 10) || 0,
            imageCountMax: parseInt(formImageCountMax, 10) || 0,
            assignmentId: formAssignmentId || null,
            sortOrder: parseInt(formSortOrder, 10) || 0,
            isPinned: formIsPinned,
            isActive: formIsActive,
        });
    }

    async function handleGenerate() {
        const desc = formDescription.trim();
        if (!desc) {
            toast.error("请先填写使用说明");
            return;
        }

        generating = true;
        try {
            const res = await fetch("/api/admin/templates/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: desc,
                    assignments: assignments,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                toast.error(result.error || "AI 生成失败");
                return;
            }

            const data = result.data;
            formName = data.name || formName;
            formCategory = data.category || formCategory;
            formPrompt = data.prompt || formPrompt;
            formDescription = data.description || desc;
            formImageCountMin = String(data.imageCountMin ?? 0);
            formImageCountMax = String(data.imageCountMax ?? 0);
            if (data.assignmentId) {
                formAssignmentId = data.assignmentId;
            }
            toast.success("AI 已生成模板配置");
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            generating = false;
        }
    }

    // 提取并高亮占位符
    let placeholders = $derived(
        [...(formPrompt.matchAll(/\{([^}]+)\}/g))].map(m => m[1])
    );

    const isBusy = $derived(submitting || generating);
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-lg max-h-[85vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>{isEdit ? "编辑模板" : "创建模板"}</Dialog.Title>
            <Dialog.Description>
                {isEdit ? "修改图片生成模板" : "填写以下信息创建新的图片生成模板"}
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
            <!-- 使用说明（移至最上方，作为 AI 一键生成的入口） -->
            <div class="space-y-2">
                <Label for="tpl-desc">使用说明</Label>
                <div class="relative">
                    <Textarea
                        id="tpl-desc"
                        bind:value={formDescription}
                        placeholder="描述模板的用途和使用方式，填写后可点击右侧按钮一键生成模板配置"
                        rows={3}
                        class="pr-10"
                        disabled={isBusy}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="absolute right-1.5 top-1.5 h-7 w-7 p-0"
                        title="AI 一键生成"
                        onclick={handleGenerate}
                        disabled={isBusy || !formDescription.trim()}
                    >
                        {#if generating}
                            <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                        {:else}
                            <Sparkles class="h-4 w-4 text-amber-500" />
                        {/if}
                    </Button>
                </div>
                <p class="text-xs text-muted-foreground">
                    填写使用说明后，点击 <Sparkles class="inline h-3 w-3 text-amber-500" /> 可由 AI 自动生成以下字段
                </p>
            </div>

            <!-- 模板名称 -->
            <div class="space-y-2">
                <Label for="tpl-name">模板名称</Label>
                <Input
                    id="tpl-name"
                    bind:value={formName}
                    placeholder="例如：水彩猫咪"
                    disabled={isBusy}
                />
            </div>

            <!-- 分类 -->
            <div class="space-y-2">
                <Label for="tpl-category">分类</Label>
                <Input
                    id="tpl-category"
                    bind:value={formCategory}
                    placeholder="例如：风景、人物、创意"
                    list="category-list"
                    disabled={isBusy}
                />
                {#if categories.length > 0}
                    <datalist id="category-list">
                        {#each categories as cat}
                            <option value={cat}></option>
                        {/each}
                    </datalist>
                {/if}
            </div>

            <!-- 提示词 -->
            <div class="space-y-2">
                <Label for="tpl-prompt">提示词</Label>
                <Textarea
                    id="tpl-prompt"
                    bind:value={formPrompt}
                    placeholder="输入提示词，支持 {'{'} 占位符 {'}'} 语法"
                    rows={3}
                    disabled={isBusy}
                />
                {#if placeholders.length > 0}
                    <p class="text-xs text-muted-foreground">
                        占位符: {placeholders.map(p => `{${p}}`).join(', ')}
                    </p>
                {/if}
            </div>

            <!-- 效果图 URL -->
            <div class="space-y-2">
                <Label for="tpl-preview">效果图 URL</Label>
                <Input
                    id="tpl-preview"
                    bind:value={formPreviewImageUrl}
                    placeholder="https://example.com/preview.jpg"
                    disabled={isBusy}
                />
            </div>

            <!-- 参考图数量 -->
            <div class="space-y-2">
                <Label>参考图数量</Label>
                <div class="flex items-center gap-2">
                    <Input
                        type="number"
                        bind:value={formImageCountMin}
                        min="0"
                        class="w-24"
                        disabled={isBusy}
                    />
                    <span class="text-muted-foreground">~</span>
                    <Input
                        type="number"
                        bind:value={formImageCountMax}
                        min="0"
                        class="w-24"
                        disabled={isBusy}
                    />
                    <span class="text-xs text-muted-foreground">0-0 表示不限</span>
                </div>
            </div>

            <!-- AI Proxy Assignment -->
            <div class="space-y-2">
                <Label for="tpl-assignment">AI Proxy Assignment</Label>
                <Select.Root
                    type="single"
                    bind:value={formAssignmentId}
                >
                    <Select.Trigger id="tpl-assignment" disabled={isBusy}>
                        {#if formAssignmentId}
                            {@const selected = assignments.find(a => a.id === formAssignmentId)}
                            {selected ? `${selected.name} (${selected.featureKey})` : '选择 Assignment'}
                        {:else}
                            默认（使用系统 feature key）
                        {/if}
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="" label="默认（使用系统 feature key）" />
                        {#each assignments as assignment}
                            <Select.Item value={assignment.id} label="{assignment.name} ({assignment.featureKey})">
                                {assignment.name} ({assignment.featureKey})
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <!-- 排序 -->
            <div class="space-y-2">
                <Label for="tpl-sort">排序（数值越大越靠前）</Label>
                <Input
                    id="tpl-sort"
                    type="number"
                    bind:value={formSortOrder}
                    min="0"
                    disabled={isBusy}
                />
            </div>

            <!-- 复选框 -->
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <Checkbox
                        id="tpl-pinned"
                        checked={formIsPinned}
                        onCheckedChange={(v) => { formIsPinned = v === true; }}
                        disabled={isBusy}
                    />
                    <Label for="tpl-pinned" class="text-sm font-normal">置顶</Label>
                </div>
                <div class="flex items-center gap-2">
                    <Checkbox
                        id="tpl-active"
                        checked={formIsActive}
                        onCheckedChange={(v) => { formIsActive = v === true; }}
                        disabled={isBusy}
                    />
                    <Label for="tpl-active" class="text-sm font-normal">启用</Label>
                </div>
            </div>

            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (open = false)} disabled={isBusy}>
                    取消
                </Button>
                <Button type="submit" disabled={isBusy}>
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
