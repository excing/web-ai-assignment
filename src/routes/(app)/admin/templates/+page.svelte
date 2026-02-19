<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { LayoutTemplate, Plus, Pencil, Trash2, Pin, Image as ImageIcon } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { PAGINATION } from "$lib/config/constants";
    import Pagination from "$lib/components/common/Pagination.svelte";
    import TemplateFormDialog from "$lib/components/admin/TemplateFormDialog.svelte";
    import type { TemplateSubmitData } from "$lib/components/admin/TemplateFormDialog.svelte";
    import type { ImageGenTemplate, AiProxyAssignment } from "$lib/types/admin";

    let templates = $state<ImageGenTemplate[]>([]);
    let loading = $state(true);
    let total = $state(0);
    let page = $state(1);
    const limit = PAGINATION.DEFAULT_LIMIT;
    let categories = $state<string[]>([]);
    let assignments = $state<Array<Pick<AiProxyAssignment, 'id' | 'name' | 'featureKey'>>>([]);

    // Dialog state
    let dialogOpen = $state(false);
    let dialogMode = $state<"create" | "edit">("create");
    let editing = $state<ImageGenTemplate | null>(null);
    let submitting = $state(false);

    let assignmentsLoaded = false;

    async function loadTemplates() {
        loading = true;
        try {
            const offset = (page - 1) * limit;
            const res = await fetch(`/api/admin/templates?limit=${limit}&offset=${offset}`);
            if (res.ok) {
                const data = await res.json();
                templates = data.templates;
                total = data.total;
                categories = data.categories || [];
            }
        } catch {
            toast.error("加载模板列表失败");
        } finally {
            loading = false;
        }
    }

    async function loadAssignments() {
        try {
            const res = await fetch('/api/admin/ai-proxy/assignments?limit=100');
            if (res.ok) {
                const data = await res.json();
                assignments = data.assignments.map((a: AiProxyAssignment) => ({
                    id: a.id,
                    name: a.name,
                    featureKey: a.featureKey,
                }));
            }
        } catch {
            // 静默失败
        }
    }

    function openCreateDialog() {
        editing = null;
        dialogMode = "create";
        dialogOpen = true;
    }

    function openEditDialog(tpl: ImageGenTemplate) {
        editing = tpl;
        dialogMode = "edit";
        dialogOpen = true;
    }

    async function handleFormSubmit(data: TemplateSubmitData) {
        submitting = true;
        try {
            if (editing) {
                const res = await fetch(`/api/admin/templates/${editing.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const result = await res.json();
                if (!res.ok) {
                    toast.error(result.error || "更新失败");
                    return;
                }
                // 静默重新加载以获取关联信息
                await loadTemplates();
                toast.success("模板已更新");
            } else {
                const res = await fetch("/api/admin/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const result = await res.json();
                if (!res.ok) {
                    toast.error(result.error || "创建失败");
                    return;
                }
                if (page === 1) {
                    await loadTemplates();
                } else {
                    page = 1;
                }
                toast.success("模板已创建");
            }
            dialogOpen = false;
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            submitting = false;
        }
    }

    async function deleteTemplate(id: string) {
        if (!confirm("确定要删除这个模板吗？")) return;
        try {
            const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
            if (res.ok) {
                templates = templates.filter(t => t.id !== id);
                total--;
                toast.success("模板已删除");
            } else {
                const data = await res.json();
                toast.error(data.error || "删除失败");
            }
        } catch {
            toast.error("网络错误，请重试");
        }
    }

    async function toggleField(tpl: ImageGenTemplate, field: "isActive" | "isPinned") {
        const newValue = !tpl[field];
        try {
            const res = await fetch(`/api/admin/templates/${tpl.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: newValue }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "操作失败");
                return;
            }
            templates = templates.map(t => t.id === tpl.id ? { ...t, [field]: newValue } : t);
            if (field === "isActive") {
                toast.success(newValue ? "模板已启用" : "模板已停用");
            } else {
                toast.success(newValue ? "模板已置顶" : "模板已取消置顶");
            }
        } catch {
            toast.error("网络错误，请重试");
        }
    }

    function formatImageCount(min: number, max: number): string {
        if (min === 0 && max === 0) return "不限";
        if (min === max) return `${min} 张`;
        if (min > 0 && max === 0) return `≥${min} 张`;
        if (min === 0 && max > 0) return `≤${max} 张`;
        return `${min}-${max} 张`;
    }

    $effect(() => {
        page;
        loadTemplates();
        if (!assignmentsLoaded) {
            assignmentsLoaded = true;
            loadAssignments();
        }
    });
</script>

<div class="flex flex-col gap-6 p-4 sm:p-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
            <h1 class="text-2xl font-bold flex items-center gap-2 sm:text-3xl sm:gap-3">
                <LayoutTemplate class="h-6 w-6 shrink-0 sm:h-8 sm:w-8" />
                <span class="hidden sm:inline truncate">模板管理</span>
            </h1>
            <p class="text-muted-foreground mt-1 text-sm sm:text-base truncate hidden sm:block">创建和管理图片生成模板</p>
        </div>
        <div class="flex gap-2 shrink-0">
            <Button size="sm" class="sm:size-default" onclick={openCreateDialog}>
                <Plus class="mr-1.5 h-4 w-4 sm:mr-2" />
                创建模板
            </Button>
        </div>
    </div>

    <!-- 主内容区 -->
    <Card.Root>
        <Card.Header>
            <Card.Title>模板列表</Card.Title>
            <Card.Description>管理所有图片生成模板</Card.Description>
        </Card.Header>
        <Card.Content>
            {#if loading}
                <div class="space-y-2">
                    <Skeleton class="h-16 w-full" />
                    <Skeleton class="h-16 w-full" />
                    <Skeleton class="h-16 w-full" />
                </div>
            {:else if templates.length === 0}
                <div class="text-center py-12">
                    <LayoutTemplate class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 class="text-lg font-medium mb-2">暂无模板</h3>
                    <p class="text-muted-foreground mb-4">点击上方按钮创建图片生成模板</p>
                    <Button onclick={openCreateDialog}>
                        <Plus class="mr-2 h-4 w-4" />
                        创建模板
                    </Button>
                </div>
            {:else}
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>效果图</Table.Head>
                            <Table.Head>名称</Table.Head>
                            <Table.Head>分类</Table.Head>
                            <Table.Head class="hidden lg:table-cell">提示词</Table.Head>
                            <Table.Head>图片数</Table.Head>
                            <Table.Head class="hidden md:table-cell">Assignment</Table.Head>
                            <Table.Head>排序</Table.Head>
                            <Table.Head>状态</Table.Head>
                            <Table.Head class="text-right">操作</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each templates as tpl (tpl.id)}
                            <Table.Row class={tpl.isActive ? "" : "opacity-60"}>
                                <Table.Cell>
                                    {#if tpl.previewImageUrl}
                                        <img
                                            src={tpl.previewImageUrl}
                                            alt={tpl.name}
                                            class="h-10 w-10 rounded-md object-cover border"
                                        />
                                    {:else}
                                        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                                            <ImageIcon class="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    {/if}
                                </Table.Cell>
                                <Table.Cell>
                                    <div class="text-sm">
                                        <div class="font-medium flex items-center gap-1">
                                            {tpl.name}
                                            {#if tpl.isPinned}
                                                <Pin class="h-3 w-3 text-orange-500" />
                                            {/if}
                                        </div>
                                        {#if tpl.description}
                                            <div class="text-muted-foreground text-xs truncate max-w-[150px]">{tpl.description}</div>
                                        {/if}
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <Badge variant="outline">{tpl.category}</Badge>
                                </Table.Cell>
                                <Table.Cell class="hidden lg:table-cell max-w-[200px]">
                                    <p class="text-xs text-muted-foreground truncate">{tpl.prompt}</p>
                                </Table.Cell>
                                <Table.Cell>
                                    <span class="text-xs">{formatImageCount(tpl.imageCountMin, tpl.imageCountMax)}</span>
                                </Table.Cell>
                                <Table.Cell class="hidden md:table-cell">
                                    {#if tpl.assignmentName}
                                        <span class="text-xs">{tpl.assignmentName}</span>
                                    {:else}
                                        <span class="text-xs text-muted-foreground">默认</span>
                                    {/if}
                                </Table.Cell>
                                <Table.Cell>{tpl.sortOrder}</Table.Cell>
                                <Table.Cell>
                                    <div class="flex items-center gap-1">
                                        <Badge variant={tpl.isActive ? "default" : "secondary"}>
                                            {tpl.isActive ? "启用" : "停用"}
                                        </Badge>
                                    </div>
                                </Table.Cell>
                                <Table.Cell class="text-right">
                                    <div class="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => toggleField(tpl, "isPinned")} title={tpl.isPinned ? "取消置顶" : "置顶"}>
                                            <Pin class="h-3 w-3 {tpl.isPinned ? 'text-orange-500' : ''}" />
                                        </Button>
                                        <Button variant="outline" size="sm" onclick={() => openEditDialog(tpl)}>
                                            <Pencil class="h-3 w-3" />
                                        </Button>
                                        <Button variant="outline" size="sm" onclick={() => toggleField(tpl, "isActive")}>
                                            {tpl.isActive ? "停用" : "启用"}
                                        </Button>
                                        <Button variant="outline" size="sm" onclick={() => deleteTemplate(tpl.id)}>
                                            <Trash2 class="h-3 w-3" />
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
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

<TemplateFormDialog
    mode={dialogMode}
    bind:open={dialogOpen}
    initialData={editing}
    bind:submitting
    {categories}
    {assignments}
    onSubmit={handleFormSubmit}
/>
