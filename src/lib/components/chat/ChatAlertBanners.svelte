<script lang="ts">
    import { WifiOff, AlertCircle } from "lucide-svelte";
    import { CREDITS } from "$lib/config/constants";

    let { isOnline, creditBalance }: { isOnline: boolean; creditBalance: number } = $props();
</script>

{#if !isOnline}
    <div class="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-900/20">
        <div class="mx-auto flex max-w-3xl items-center gap-2 text-sm">
            <WifiOff class="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <span class="text-red-800 dark:text-red-200">
                网络连接已断开，请检查网络设置
            </span>
        </div>
    </div>
{/if}

{#if isOnline && creditBalance < CREDITS.LOW_BALANCE_WARNING}
    <div class="border-b border-yellow-200 bg-yellow-50 px-4 py-2 dark:border-yellow-800 dark:bg-yellow-900/20">
        <div class="mx-auto flex max-w-3xl items-center gap-2 text-sm">
            <AlertCircle class="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
            <span class="text-yellow-800 dark:text-yellow-200">
                积分余额不足 ({creditBalance} 积分)
            </span>
            <a
                href="/me/credits"
                class="ml-auto font-medium text-yellow-700 underline hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
            >
                立即充值
            </a>
        </div>
    </div>
{/if}
