<script lang="ts">
	import { UserPlus, MousePointerClick, Wand2 } from "lucide-svelte";

	const steps = [
		{
			icon: UserPlus,
			step: "01",
			title: "注册账号",
			description: "邮箱注册或 Google 一键登录，30 秒完成账号创建。",
		},
		{
			icon: MousePointerClick,
			step: "02",
			title: "选择功能",
			description: "AI 图片生成或 AI 智能对话，选择你需要的创作工具。",
		},
		{
			icon: Wand2,
			step: "03",
			title: "开始创作",
			description: "输入描述生成图片，或与 AI 智能对话，释放创造力。",
		},
	];
</script>

<section class="py-20 lg:py-28">
	<div class="mx-auto max-w-6xl px-6">
		<!-- Section header -->
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				三步开始你的 AI 创作
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				简单几步，即可体验 AI 创作的无限可能
			</p>
		</div>

		<!-- Steps -->
		<div class="mt-14 grid gap-8 sm:grid-cols-3">
			{#each steps as step, index}
				<div class="relative text-center">
					<!-- Connector line (desktop only) -->
					{#if index < steps.length - 1}
						<div class="absolute left-[calc(50%+40px)] top-10 hidden h-px w-[calc(100%-80px)] bg-border sm:block"></div>
					{/if}

					<!-- Icon -->
					<div class="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/5">
						<step.icon class="h-8 w-8 text-primary" />
						<span class="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
							{step.step}
						</span>
					</div>

					<!-- Text -->
					<h3 class="text-lg font-semibold">{step.title}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{step.description}
					</p>
				</div>
			{/each}
		</div>
	</div>
</section>
