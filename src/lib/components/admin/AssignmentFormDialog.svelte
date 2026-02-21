<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Loader2 } from '@lucide/svelte';
	import { aiProxyProxiesStore, aiProxyAssignmentsStore } from '$lib/stores/ai-proxy';

	let { mode, open = $bindable() }: { mode: 'create' | 'edit'; open: boolean } = $props();

	const isEdit = $derived(mode === 'edit');
	let enableBackup = $state(false);

	$effect(() => {
		if (open) {
			enableBackup = !!aiProxyAssignmentsStore.assignmentForm.backupProxyId;
		}
	});

	function providerLabel(p: string): string {
		const map: Record<string, string> = {
			openai: 'OpenAI',
			anthropic: 'Anthropic',
			google: 'Google'
		};
		return map[p] || p;
	}

	function proxyLabel(proxyId: string, fallback: string): string {
		const proxy = aiProxyProxiesStore.proxies.items.find((p) => p.id === proxyId);
		return proxy ? `${proxy.name} (${providerLabel(proxy.provider)})` : fallback;
	}

	function handleSubmit() {
		if (isEdit) {
			aiProxyAssignmentsStore.updateAssignment();
		} else {
			aiProxyAssignmentsStore.createAssignment();
		}
	}

	function toggleBackup(checked: boolean) {
		enableBackup = checked;
		if (!checked) {
			aiProxyAssignmentsStore.assignmentForm.backupProxyId = '';
			aiProxyAssignmentsStore.assignmentForm.backupModel = '';
		}
	}
</script>

<!-- 可复用片段：Proxy 下拉 + 模型输入 + 模型快捷按钮 -->
{#snippet proxyModelSelector(
	proxyId: string,
	modelValue: string,
	onProxyChange: (id: string) => void,
	onModelChange: (model: string) => void,
	proxyLabel_: string,
	modelLabel: string,
	modelId: string,
	modelPlaceholder: string,
)}
	<div class="grid gap-2">
		<Label>{proxyLabel_}</Label>
		<Select.Root type="single" value={proxyId} onValueChange={onProxyChange}>
			<Select.Trigger class="w-full">
				{#if proxyId}
					{proxyLabel(proxyId, '请选择 Proxy')}
				{:else}
					请选择 Proxy
				{/if}
			</Select.Trigger>
			<Select.Content>
				{#each aiProxyProxiesStore.proxies.items as proxy}
					<Select.Item
						value={proxy.id}
						label="{proxy.name} ({providerLabel(proxy.provider)})"
					/>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
	<div class="grid gap-2">
		<Label for={modelId}>{modelLabel}</Label>
		<Input id={modelId} placeholder={modelPlaceholder} value={modelValue} oninput={(e) => onModelChange(e.currentTarget.value)} />
		{#if proxyId}
			{@const models = aiProxyProxiesStore.getProxyModels(proxyId)}
			{#if models.length > 0}
				<div class="rounded-md border p-2">
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-medium text-muted-foreground">
							已配置的模型（点击选择）
						</span>
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each models as model}
							<Button
								variant={modelValue === model ? 'default' : 'secondary'}
								size="sm"
								class="h-auto px-2 py-0.5 text-xs"
								onclick={() => onModelChange(model)}
							>
								{model}
							</Button>
						{/each}
					</div>
				</div>
			{:else}
				<p class="text-xs text-muted-foreground">
					该 Proxy 未配置模型列表，请先在 Proxy 配置中添加支持的模型
				</p>
			{/if}
		{/if}
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{isEdit ? '编辑功能绑定' : '添加功能绑定'}</Dialog.Title>
			<Dialog.Description
				>{isEdit ? '修改功能的 AI Proxy 和模型配置' : '为功能分配 AI Proxy 和模型'}</Dialog.Description
			>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="asgn-name">名称 *</Label>
				<Input
					id="asgn-name"
					placeholder="例如：聊天功能 - Kimi"
					bind:value={aiProxyAssignmentsStore.assignmentForm.name}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="asgn-desc">描述</Label>
				<Input
					id="asgn-desc"
					placeholder="可选描述说明"
					bind:value={aiProxyAssignmentsStore.assignmentForm.description}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="asgn-feature">功能标识 *</Label>
				<Input
					id="asgn-feature"
					placeholder="例如：chat, image_generation"
					bind:value={aiProxyAssignmentsStore.assignmentForm.featureKey}
				/>
			</div>

			<!-- 默认渠道 -->
			{@render proxyModelSelector(
				aiProxyAssignmentsStore.assignmentForm.proxyId,
				aiProxyAssignmentsStore.assignmentForm.defaultModel,
				(id) => { aiProxyAssignmentsStore.assignmentForm.proxyId = id; },
				(model) => { aiProxyAssignmentsStore.assignmentForm.defaultModel = model; },
				'Proxy *',
				'默认模型',
				'asgn-default-model',
				'gpt-4o',
			)}

			<div class="flex items-center gap-2">
				<label class="flex items-center gap-2 text-sm">
					<Checkbox bind:checked={aiProxyAssignmentsStore.assignmentForm.isActive} />
					启用
				</label>
			</div>

			<!-- 备份渠道 -->
			<div class="border-t pt-4 mt-2">
				<div class="flex items-center gap-2 mb-3">
					<label class="flex items-center gap-2 text-sm font-medium">
						<Checkbox checked={enableBackup} onCheckedChange={toggleBackup} />
						配置备份渠道
					</label>
				</div>
				{#if enableBackup}
					<div class="grid gap-3">
						{@render proxyModelSelector(
							aiProxyAssignmentsStore.assignmentForm.backupProxyId,
							aiProxyAssignmentsStore.assignmentForm.backupModel,
							(id) => { aiProxyAssignmentsStore.assignmentForm.backupProxyId = id; },
							(model) => { aiProxyAssignmentsStore.assignmentForm.backupModel = model; },
							'备份 Proxy',
							'备份模型',
							'asgn-backup-model',
							'gpt-4o-mini',
						)}
					</div>
				{/if}
			</div>

			<!-- 计费配置 -->
			<div class="border-t pt-4 mt-2">
				<h4 class="text-sm font-medium mb-3">计费配置</h4>
				<div class="grid gap-3">
					<div class="grid gap-2">
						<Label>计费模式</Label>
						<Select.Root type="single" bind:value={aiProxyAssignmentsStore.assignmentForm.billingMode}>
							<Select.Trigger class="w-full">
								{#if aiProxyAssignmentsStore.assignmentForm.billingMode === 'fixed'}
									固定计费
								{:else if aiProxyAssignmentsStore.assignmentForm.billingMode === 'dynamic'}
									动态计费（按 Token）
								{:else}
									不计费
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="" label="不计费" />
								<Select.Item value="fixed" label="固定计费" />
								<Select.Item value="dynamic" label="动态计费（按 Token）" />
							</Select.Content>
						</Select.Root>
					</div>

					{#if aiProxyAssignmentsStore.assignmentForm.billingMode === 'fixed'}
						<div class="grid gap-2">
							<Label for="asgn-minimum">固定扣费积分 *</Label>
							<Input
								id="asgn-minimum"
								type="number"
								min="1"
								step="1"
								placeholder="5"
								bind:value={aiProxyAssignmentsStore.assignmentForm.minimum}
							/>
							<p class="text-xs text-muted-foreground">每次调用固定扣除的积分数</p>
						</div>
					{:else if aiProxyAssignmentsStore.assignmentForm.billingMode === 'dynamic'}
						<div class="grid grid-cols-2 gap-3">
							<div class="grid gap-2">
								<Label for="asgn-input-per1k">输入积分/千tokens</Label>
								<Input
									id="asgn-input-per1k"
									type="number"
									min="0"
									step="1"
									placeholder="1"
									bind:value={aiProxyAssignmentsStore.assignmentForm.inputPer1k}
								/>
							</div>
							<div class="grid gap-2">
								<Label for="asgn-output-per1k">输出积分/千tokens</Label>
								<Input
									id="asgn-output-per1k"
									type="number"
									min="0"
									step="1"
									placeholder="2"
									bind:value={aiProxyAssignmentsStore.assignmentForm.outputPer1k}
								/>
							</div>
						</div>
						<div class="grid gap-2">
							<Label for="asgn-minimum-dynamic">最低消费积分</Label>
							<Input
								id="asgn-minimum-dynamic"
								type="number"
								min="1"
								step="1"
								placeholder="1"
								bind:value={aiProxyAssignmentsStore.assignmentForm.minimum}
							/>
							<p class="text-xs text-muted-foreground">动态计算后的费用低于此值时，按此值扣费</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>取消</Button>
			<Button onclick={handleSubmit} disabled={aiProxyAssignmentsStore.savingAssignment}>
				{#if aiProxyAssignmentsStore.savingAssignment}
					<Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
				{/if}
				{isEdit ? '保存' : '创建'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
