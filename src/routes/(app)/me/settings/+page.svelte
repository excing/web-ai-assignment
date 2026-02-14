<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { authClient } from "$lib/auth-client";
    import { toast } from "svelte-sonner";
    import {
        getAuthLoaded,
        getCurrentUser,
        patchCurrentUser,
    } from "$lib/stores/auth.svelte";

    let user = $derived(getCurrentUser());
    let loading = $derived(!getAuthLoaded());
    let name = $state("");
    let email = $state("");
    let didInitForm = $state(false);

    let imagePreview = $state<string | null>(null);
    let uploadingImage = $state(false);

    $effect(() => {
        if (!getAuthLoaded() || didInitForm) return;
        const currentUser = getCurrentUser();
        if (currentUser) {
            name = currentUser.name || "";
            email = currentUser.email || "";
            didInitForm = true;
        }
    });

    async function handleUpdateProfile() {
        try {
            await authClient.updateUser({ name });
            patchCurrentUser({ name });
            toast.success("资料已更新");
        } catch {
            toast.error("更新失败，请重试");
        }
    }
</script>

<section class="flex w-full flex-col items-center px-4 py-6">
    <div class="w-full max-w-lg space-y-6">
        {#if loading}
            <Card.Root>
                <Card.Content class="space-y-6 p-6">
                    <div class="flex items-center gap-4">
                        <Skeleton class="h-20 w-20 rounded-full" />
                        <div class="space-y-2">
                            <Skeleton class="h-8 w-24" />
                            <Skeleton class="h-4 w-36" />
                        </div>
                    </div>
                    <Skeleton class="h-16 w-full" />
                    <Skeleton class="h-16 w-full" />
                </Card.Content>
            </Card.Root>
        {:else}
            <!-- 头像 -->
            <Card.Root>
                <Card.Content class="flex items-center gap-4 p-4">
                    <Avatar.Root class="h-16 w-16">
                        {#if imagePreview || user?.image}
                            <Avatar.Image src={imagePreview || user?.image || ""} />
                        {:else}
                            <Avatar.Fallback class="text-lg">
                                {name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                            </Avatar.Fallback>
                        {/if}
                    </Avatar.Root>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium truncate">{name || "用户"}</p>
                        <p class="text-muted-foreground text-sm truncate">{email}</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                    >
                        {uploadingImage ? "上传中..." : "更换头像"}
                    </Button>
                </Card.Content>
            </Card.Root>

            <!-- 个人信息 -->
            <Card.Root>
                <Card.Header>
                    <Card.Title>个人信息</Card.Title>
                    <Card.Description>修改你的个人资料</Card.Description>
                </Card.Header>
                <Card.Content class="space-y-4">
                    <div class="space-y-2">
                        <Label for="name">姓名</Label>
                        <Input
                            id="name"
                            bind:value={name}
                            placeholder="输入你的姓名"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label for="email">邮箱</Label>
                        <Input
                            id="email"
                            type="email"
                            bind:value={email}
                            disabled
                        />
                        <p class="text-muted-foreground text-xs">邮箱地址不可修改</p>
                    </div>
                    <Button onclick={handleUpdateProfile} class="w-full">保存修改</Button>
                </Card.Content>
            </Card.Root>
        {/if}
    </div>
</section>
