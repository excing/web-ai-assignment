<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Loader2 } from "lucide-svelte";

    let {
        open = $bindable(false),
        title = "身份验证",
        description = "请输入账号密码以继续操作",
        onConfirm,
    }: {
        open: boolean;
        title?: string;
        description?: string;
        onConfirm: (password: string) => Promise<void>;
    } = $props();

    let password = $state("");
    let submitting = $state(false);

    $effect(() => {
        if (open) {
            password = "";
        }
    });

    async function handleSubmit() {
        if (!password) return;
        submitting = true;
        try {
            await onConfirm(password);
        } finally {
            submitting = false;
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-[400px]">
        <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
        </Dialog.Header>
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
            <div class="space-y-2">
                <Label for="confirm-password">密码</Label>
                <Input
                    id="confirm-password"
                    type="password"
                    bind:value={password}
                    placeholder="请输入账号密码"
                    disabled={submitting}
                    autofocus
                />
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (open = false)} disabled={submitting}>
                    取消
                </Button>
                <Button type="submit" disabled={submitting || !password}>
                    {#if submitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        验证中...
                    {:else}
                        确认
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
