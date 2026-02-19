<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { LayoutTemplate, Plus, Pencil, Trash2, Pin, Image as ImageIcon, EllipsisVertical, Power, PowerOff, ChevronUp, ChevronDown, Loader2 } from "lucide-svelte";
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

    // 行级操作加载状态
    let operatingIds = $state(new Set<string>());

    function isOperating(id: string) {
        return operatingIds.has(id);
    }

    function startOp(id: string) {
        operatingIds = new Set([...operatingIds, id]);
    }

    function endOp(id: string) {
        const next = new Set(operatingIds);
        next.delete(id);
        operatingIds = next;
    }

    /** 本地排序，与服务端保持一致: isPinned DESC, sortOrder DESC, createdAt DESC */
    function sortTemplates(list: ImageGenTemplate[]): ImageGenTemplate[] {
        return [...list].sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    /** 根据 assignmentId 解析关联的名称和 featureKey */
    function resolveAssignment(assignmentId: string | null) {
        if (!assignmentId) return { assignmentName: undefined, featureKey: undefined };
        const a = assignments.find(x => x.id === assignmentId);
        return { assignmentName: a?.name, featureKey: a?.featureKey };
    }

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
                const editId = editing.id;
                const res = await fetch(`/api/admin/templates/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const result = await res.json();
                if (!res.ok) {
                    toast.error(result.error || "更新失败");
                    return;
                }
                // 请求成功后本地更新
                const resolved = resolveAssignment(data.assignmentId);
                templates = sortTemplates(
                    templates.map(t => t.id === editId ? { ...t, ...data, ...resolved } : t)
                );
                dialogOpen = false;
                toast.success("模板已更新");
            } else {
                // 创建：等待服务端返回后本地插入
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
                const resolved = resolveAssignment(data.assignmentId);
                const newTpl: ImageGenTemplate = { ...result.template, ...resolved };
                templates = sortTemplates([newTpl, ...templates]);
                total++;
                // 新分类加入补全列表
                if (data.category && !categories.includes(data.category)) {
                    categories = [...categories, data.category].sort();
                }
                dialogOpen = false;
                toast.success("模板已创建");
            }
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            submitting = false;
        }
    }

    async function deleteTemplate(id: string) {
        if (!confirm("确定要删除这个模板吗？")) return;
        // 乐观更新
        const prev = templates;
        const prevTotal = total;
        templates = templates.filter(t => t.id !== id);
        total--;
        startOp(id);
        try {
            const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
            if (!res.ok) {
                templates = prev;
                total = prevTotal;
                const data = await res.json();
                toast.error(data.error || "删除失败");
            } else {
                toast.success("模板已删除");
            }
        } catch {
            templates = prev;
            total = prevTotal;
            toast.error("网络错误，请重试");
        } finally {
            endOp(id);
        }
    }

    async function toggleField(tpl: ImageGenTemplate, field: "isActive" | "isPinned") {
        const newValue = !tpl[field];
        // 乐观更新 + 重新排序
        const prev = templates;
        templates = sortTemplates(
            templates.map(t => t.id === tpl.id ? { ...t, [field]: newValue } : t)
        );
        startOp(tpl.id);
        try {
            const res = await fetch(`/api/admin/templates/${tpl.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: newValue }),
            });
            if (!res.ok) {
                templates = prev;
                const data = await res.json();
                toast.error(data.error || "操作失败");
            }
        } catch {
            templates = prev;
            toast.error("网络错误，请重试");
        } finally {
            endOp(tpl.id);
        }
    }

    async function moveSortOrder(tpl: ImageGenTemplate, delta: number) {
        const newOrder = tpl.sortOrder + delta;
        // 乐观更新 + 重新排序
        const prev = templates;
        templates = sortTemplates(
            templates.map(t => t.id === tpl.id ? { ...t, sortOrder: newOrder } : t)
        );
        startOp(tpl.id);
        try {
            const res = await fetch(`/api/admin/templates/${tpl.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sortOrder: newOrder }),
            });
            if (!res.ok) {
                templates = prev;
                const data = await res.json();
                toast.error(data.error || "操作失败");
            }
        } catch {
            templates = prev;
            toast.error("网络错误，请重试");
        } finally {
            endOp(tpl.id);
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
                            {@const busy = isOperating(tpl.id)}
                            <Table.Row class="{tpl.isActive ? '' : 'opacity-60'} {busy ? 'opacity-50' : ''}">
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
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => moveSortOrder(tpl, 1)} title="上升" disabled={busy}>
                                            <ChevronUp class="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => moveSortOrder(tpl, -1)} title="下降" disabled={busy}>
                                            <ChevronDown class="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => toggleField(tpl, "isPinned")} title={tpl.isPinned ? "取消置顶" : "置顶"} disabled={busy}>
                                            <Pin class="h-3 w-3 {tpl.isPinned ? 'text-orange-500' : ''}" />
                                        </Button>
                                        <DropdownMenu.Root>
                                            <DropdownMenu.Trigger>
                                                {#snippet child({ props })}
                                                    <Button variant="ghost" size="sm" class="h-7 w-7 p-0" {...props} disabled={busy}>
                                                        {#if busy}
                                                            <Loader2 class="h-4 w-4 animate-spin" />
                                                        {:else}
                                                            <EllipsisVertical class="h-4 w-4" />
                                                        {/if}
                                                    </Button>
                                                {/snippet}
                                            </DropdownMenu.Trigger>
                                            <DropdownMenu.Content align="end">
                                                <DropdownMenu.Item onclick={() => openEditDialog(tpl)}>
                                                    <Pencil class="mr-2 h-4 w-4" />
                                                    编辑
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item onclick={() => toggleField(tpl, "isActive")}>
                                                    {#if tpl.isActive}
                                                        <PowerOff class="mr-2 h-4 w-4" />
                                                        停用
                                                    {:else}
                                                        <Power class="mr-2 h-4 w-4" />
                                                        启用
                                                    {/if}
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Separator />
                                                <DropdownMenu.Item class="text-destructive" onclick={() => deleteTemplate(tpl.id)}>
                                                    <Trash2 class="mr-2 h-4 w-4" />
                                                    删除
                                                </DropdownMenu.Item>
                                            </DropdownMenu.Content>
                                        </DropdownMenu.Root>
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
