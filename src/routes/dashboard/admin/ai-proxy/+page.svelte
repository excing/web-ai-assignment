<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Plus,
		Edit,
		Trash2,
		Loader2,
		Server,
		Link,
		RefreshCw,
		Eye,
		EyeOff,
		Copy,
		Check,
		EllipsisVertical,
		Download,
		Upload,
	} from '@lucide/svelte';
	import { aiProxyProxiesStore, aiProxyAssignmentsStore, aiProxyKeyManagementStore } from '$lib/stores/ai-proxy';
	import { AiProxyDialogs } from '$lib/components/admin';
	import PasswordConfirmDialog from '$lib/components/admin/PasswordConfirmDialog.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';

	let activeTab = $state<'proxies' | 'assignments'>('proxies');
	let importFileInput = $state<HTMLInputElement | null>(null);

	onMount(() => {
		Promise.all([
			aiProxyProxiesStore.loadProxies(),
			aiProxyAssignmentsStore.loadAssignments()
		]);
	});

	function providerLabel(p: string): string {
		const map: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };
		return map[p] || p;
	}

	function healthVariant(status: string): 'default' | 'destructive' {
		return status === 'healthy' ? 'default' : 'destructive';
	}

	function handleTabChange(value: string) {
		activeTab = value as 'proxies' | 'assignments';
	}

	function triggerImportFile() {
		importFileInput?.click();
	}

	function onImportFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';
		aiProxyKeyManagementStore.handleImport(file);
	}
</script>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<!-- 页面标题 -->
	<div class="flex items-center justify-between gap-3">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold flex items-center gap-2 sm:text-3xl sm:gap-3">
				<Server class="h-6 w-6 shrink-0 sm:h-8 sm:w-8" />
				<span class="hidden sm:inline truncate">AI Proxy 管理</span>
			</h1>
			<p class="text-muted-foreground mt-1 text-sm sm:text-base truncate hidden sm:block">管理 AI 代理配置和功能绑定</p>
		</div>
		<div class="flex gap-2 shrink-0">
			<Button
				variant="outline"
				size="sm"
				class="sm:size-default"
				onclick={() => { aiProxyAssignmentsStore.resetAssignmentForm(); aiProxyAssignmentsStore.createAssignmentDialogOpen = true; }}
			>
				<Link class="mr-1.5 h-4 w-4 sm:mr-2" />
				添加绑定
			</Button>
			<Button
				size="sm"
				class="sm:size-default"
				onclick={() => { aiProxyProxiesStore.resetProxyForm(); aiProxyProxiesStore.createProxyDialogOpen = true; }}
			>
				<Plus class="mr-1.5 h-4 w-4 sm:mr-2" />
				添加 Proxy
			</Button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="outline" size="sm" class="sm:size-default" {...props}>
							{#if aiProxyKeyManagementStore.exporting || aiProxyKeyManagementStore.importing}
								<Loader2 class="h-4 w-4 animate-spin" />
							{:else}
								<EllipsisVertical class="h-4 w-4" />
							{/if}
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={() => aiProxyKeyManagementStore.handleExport()} disabled={aiProxyKeyManagementStore.exporting || aiProxyKeyManagementStore.importing}>
						<Download class="mr-2 h-4 w-4" />
						导出配置
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={triggerImportFile} disabled={aiProxyKeyManagementStore.exporting || aiProxyKeyManagementStore.importing}>
						<Upload class="mr-2 h-4 w-4" />
						导入配置
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<!-- 统计卡片 -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Proxy 节点</Card.Title>
				<Server class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				{#if aiProxyProxiesStore.proxies.loading}
					<Skeleton class="h-8 w-16 mb-1" />
					<Skeleton class="h-3 w-24" />
				{:else}
					<div class="text-2xl font-bold">{aiProxyProxiesStore.proxies.total}</div>
					<p class="text-xs text-muted-foreground">已配置的代理节点数量</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">功能绑定</Card.Title>
				<Link class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				{#if aiProxyAssignmentsStore.assignments.loading}
					<Skeleton class="h-8 w-16 mb-1" />
					<Skeleton class="h-3 w-20" />
				{:else}
					<div class="text-2xl font-bold">{aiProxyAssignmentsStore.assignments.total}</div>
					<p class="text-xs text-muted-foreground">功能与 Proxy 的绑定关系</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 主内容区 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Proxy 配置与功能绑定</Card.Title>
			<Card.Description>管理 AI 代理节点和功能分配</Card.Description>
		</Card.Header>
		<Card.Content>
			<Tabs.Root value={activeTab} onValueChange={handleTabChange}>
				<Tabs.List class="grid w-full grid-cols-2">
					<Tabs.Trigger value="proxies">
						<Server class="mr-2 h-4 w-4" />
						Proxy 配置
					</Tabs.Trigger>
					<Tabs.Trigger value="assignments">
						<Link class="mr-2 h-4 w-4" />
						功能绑定
					</Tabs.Trigger>
				</Tabs.List>

				<!-- Proxy 列表 Tab -->
				<Tabs.Content value="proxies" class="mt-4">
					{#if aiProxyProxiesStore.proxies.loading}
						<div class="space-y-2">
							<Skeleton class="h-16 w-full" />
							<Skeleton class="h-16 w-full" />
							<Skeleton class="h-16 w-full" />
						</div>
					{:else if aiProxyProxiesStore.proxies.items.length === 0}
						<div class="text-center py-12">
							<Server class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
							<h3 class="text-lg font-medium mb-2">暂无 Proxy 配置</h3>
							<p class="text-muted-foreground mb-4">点击上方按钮添加 AI 代理节点</p>
							<Button onclick={() => { aiProxyProxiesStore.resetProxyForm(); aiProxyProxiesStore.createProxyDialogOpen = true; }}>
								<Plus class="mr-2 h-4 w-4" />
								添加 Proxy
							</Button>
						</div>
					{:else}
						<div class="space-y-4">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>名称</Table.Head>
										<Table.Head>Provider</Table.Head>
										<Table.Head>Base URL</Table.Head>
										<Table.Head>API Key</Table.Head>
										<Table.Head>模型数</Table.Head>
										<Table.Head>优先级</Table.Head>
										<Table.Head>健康状态</Table.Head>
										<Table.Head>状态</Table.Head>
										<Table.Head class="text-right">操作</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each aiProxyProxiesStore.proxies.items as proxy (proxy.id)}
										{@const operating = aiProxyProxiesStore.isOperating(proxy.id)}
										<Table.Row class={operating ? 'opacity-50' : ''}>
											<Table.Cell class="font-medium">{proxy.name}</Table.Cell>
											<Table.Cell>
												<Badge variant="outline">{providerLabel(proxy.provider)}</Badge>
											</Table.Cell>
											<Table.Cell class="max-w-[200px] truncate text-xs text-muted-foreground" title={proxy.baseUrl}>
												{proxy.baseUrl}
											</Table.Cell>
											<Table.Cell>
												<div class="flex items-center gap-1">
													{#if aiProxyKeyManagementStore.revealedKeys.has(proxy.id)}
														<code class="text-xs font-mono max-w-[140px] truncate inline-block align-middle" title={aiProxyKeyManagementStore.revealedKeys.get(proxy.id)}>
															{aiProxyKeyManagementStore.revealedKeys.get(proxy.id)}
														</code>
														<button
															onclick={() => aiProxyKeyManagementStore.copyKey(proxy.id)}
															class="text-muted-foreground hover:text-foreground shrink-0"
															title="复制"
														>
															{#if aiProxyKeyManagementStore.copiedKeyId === proxy.id}
																<Check class="h-3 w-3 text-green-500" />
															{:else}
																<Copy class="h-3 w-3" />
															{/if}
														</button>
														<button
															onclick={() => aiProxyKeyManagementStore.revealApiKey(proxy.id)}
															class="text-muted-foreground hover:text-foreground shrink-0"
															title="隐藏"
														>
															<EyeOff class="h-3 w-3" />
														</button>
													{:else}
														<span class="text-xs text-muted-foreground">••••••••</span>
														<button
															onclick={() => aiProxyKeyManagementStore.revealApiKey(proxy.id)}
															disabled={aiProxyKeyManagementStore.revealingKeyId === proxy.id}
															class="text-muted-foreground hover:text-foreground shrink-0"
															title="查看 API Key"
														>
															{#if aiProxyKeyManagementStore.revealingKeyId === proxy.id}
																<Loader2 class="h-3 w-3 animate-spin" />
															{:else}
																<Eye class="h-3 w-3" />
															{/if}
														</button>
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell>
												<Badge variant="secondary">{proxy.models.length}</Badge>
											</Table.Cell>
											<Table.Cell>{proxy.priority}</Table.Cell>
											<Table.Cell>
												<div class="flex items-center gap-1.5">
													<Badge variant={healthVariant(proxy.healthStatus)}>
														{proxy.healthStatus === 'healthy' ? '健康' : '异常'}
													</Badge>
													{#if proxy.healthStatus === 'unhealthy'}
														<button
															onclick={() => aiProxyProxiesStore.resetHealth(proxy.id)}
															disabled={operating}
															class="text-muted-foreground hover:text-foreground"
															title="重置健康状态"
														>
															<RefreshCw class="h-3.5 w-3.5" />
														</button>
													{/if}
												</div>
												{#if proxy.lastError}
													<p class="mt-1 max-w-[200px] truncate text-xs text-destructive" title={proxy.lastError}>
														{proxy.lastError}
													</p>
												{/if}
											</Table.Cell>
											<Table.Cell>
												<Badge variant={proxy.isActive ? 'default' : 'secondary'}>
													{proxy.isActive ? '启用' : '停用'}
												</Badge>
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex justify-end gap-2">
													<Button size="sm" variant="outline" onclick={() => aiProxyProxiesStore.openEditProxyDialog(proxy)} disabled={operating}>
														<Edit class="h-3 w-3" />
													</Button>
													<Button size="sm" variant="outline" onclick={() => aiProxyProxiesStore.deleteProxy(proxy.id)} disabled={operating}>
														{#if operating}
															<Loader2 class="h-3 w-3 animate-spin" />
														{:else}
															<Trash2 class="h-3 w-3" />
														{/if}
													</Button>
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>

							{#if aiProxyProxiesStore.proxies.total > aiProxyProxiesStore.proxies.limit}
								<Pagination
									count={aiProxyProxiesStore.proxies.total}
									perPage={aiProxyProxiesStore.proxies.limit}
									bind:page={aiProxyProxiesStore.proxies.page}
									onPageChange={() => aiProxyProxiesStore.loadProxies()}
								/>
							{/if}
						</div>
					{/if}
				</Tabs.Content>

				<!-- Assignment 列表 Tab -->
				<Tabs.Content value="assignments" class="mt-4">
					{#if aiProxyAssignmentsStore.assignments.loading}
						<div class="space-y-2">
							<Skeleton class="h-16 w-full" />
							<Skeleton class="h-16 w-full" />
							<Skeleton class="h-16 w-full" />
						</div>
					{:else if aiProxyAssignmentsStore.assignments.items.length === 0}
						<div class="text-center py-12">
							<Link class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
							<h3 class="text-lg font-medium mb-2">暂无功能绑定</h3>
							<p class="text-muted-foreground mb-4">请先添加 Proxy 配置，然后创建功能绑定</p>
							{#if aiProxyProxiesStore.proxies.items.length > 0}
								<Button onclick={() => { aiProxyAssignmentsStore.resetAssignmentForm(); aiProxyAssignmentsStore.createAssignmentDialogOpen = true; }}>
									<Plus class="mr-2 h-4 w-4" />
									添加绑定
								</Button>
							{/if}
						</div>
					{:else}
						<div class="space-y-4">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>名称</Table.Head>
										<Table.Head>功能标识</Table.Head>
										<Table.Head>Proxy</Table.Head>
										<Table.Head>默认模型</Table.Head>
										<Table.Head>可用模型</Table.Head>
										<Table.Head>Proxy 状态</Table.Head>
										<Table.Head>状态</Table.Head>
										<Table.Head class="text-right">操作</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each aiProxyAssignmentsStore.assignments.items as assignment (assignment.id)}
										{@const operating = aiProxyProxiesStore.isOperating(assignment.id)}
										<Table.Row class={operating ? 'opacity-50' : ''}>
											<Table.Cell>
												<div class="text-sm">
													<div class="font-medium">{assignment.name}</div>
													{#if assignment.description}
														<div class="text-muted-foreground text-xs">{assignment.description}</div>
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell>
												<Badge variant="outline">{assignment.featureKey}</Badge>
											</Table.Cell>
											<Table.Cell>
												<div class="text-sm">
													<div class="font-medium">{assignment.proxyName}</div>
													<div class="text-muted-foreground text-xs">{providerLabel(assignment.proxyProvider)}</div>
												</div>
											</Table.Cell>
											<Table.Cell>
												{#if assignment.defaultModel}
													<span class="text-xs">{assignment.defaultModel}</span>
												{:else}
													<span class="text-xs text-muted-foreground">-</span>
												{/if}
											</Table.Cell>
											<Table.Cell class="max-w-[150px]">
												{#if assignment.models && assignment.models.length > 0}
													<span class="text-xs text-muted-foreground">{assignment.models.length}</span>
												{:else}
													<span class="text-xs text-muted-foreground">全部</span>
												{/if}
											</Table.Cell>
											<Table.Cell>
												<Badge variant={healthVariant(assignment.proxyHealthStatus)}>
													{assignment.proxyHealthStatus === 'healthy' ? '健康' : '异常'}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												<Badge variant={assignment.isActive ? 'default' : 'secondary'}>
													{assignment.isActive ? '启用' : '停用'}
												</Badge>
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex justify-end gap-2">
													<Button size="sm" variant="outline" onclick={() => aiProxyAssignmentsStore.openEditAssignmentDialog(assignment)} disabled={operating}>
														<Edit class="h-3 w-3" />
													</Button>
													<Button size="sm" variant="outline" onclick={() => aiProxyAssignmentsStore.deleteAssignment(assignment.id)} disabled={operating}>
														{#if operating}
															<Loader2 class="h-3 w-3 animate-spin" />
														{:else}
															<Trash2 class="h-3 w-3" />
														{/if}
													</Button>
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>

							{#if aiProxyAssignmentsStore.assignments.total > aiProxyAssignmentsStore.assignments.limit}
								<Pagination
									count={aiProxyAssignmentsStore.assignments.total}
									perPage={aiProxyAssignmentsStore.assignments.limit}
									bind:page={aiProxyAssignmentsStore.assignments.page}
									onPageChange={() => aiProxyAssignmentsStore.loadAssignments()}
								/>
							{/if}
						</div>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		</Card.Content>
	</Card.Root>

	<!-- 使用说明 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>使用说明</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<div class="grid gap-4 md:grid-cols-2">
				<div class="p-4 rounded-lg bg-muted/50">
					<p class="font-medium mb-2">Proxy 配置</p>
					<ul class="text-muted-foreground space-y-1">
						<li>添加 AI 服务代理节点（OpenAI、Anthropic、Google）</li>
						<li>设置优先级，数值越大越优先使用</li>
						<li>连续 3 次请求失败自动标记为异常</li>
						<li>API Key 使用 AES-256 加密存储</li>
					</ul>
				</div>
				<div class="p-4 rounded-lg bg-muted/50">
					<p class="font-medium mb-2">功能绑定</p>
					<ul class="text-muted-foreground space-y-1">
						<li>为功能（如 chat）绑定指定的 Proxy</li>
						<li>可指定可用模型范围（留空表示全部）</li>
						<li>设置默认模型，用于功能的默认调用</li>
						<li>未配置绑定时自动回退到环境变量</li>
					</ul>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- 对话框 -->
<AiProxyDialogs />
<PasswordConfirmDialog bind:open={aiProxyKeyManagementStore.passwordDialogOpen} onConfirm={(pw) => aiProxyKeyManagementStore.handlePasswordConfirm(pw)} />

<!-- 隐藏的文件导入 input -->
<input
	type="file"
	accept=".json"
	class="hidden"
	bind:this={importFileInput}
	onchange={onImportFileChange}
/>
