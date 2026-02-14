<script lang="ts">
	import ProxyFormDialog from './ProxyFormDialog.svelte';
	import AssignmentFormDialog from './AssignmentFormDialog.svelte';
	import { aiProxyProxiesStore, aiProxyAssignmentsStore } from '$lib/stores/ai-proxy';
</script>

<ProxyFormDialog mode="create" bind:open={aiProxyProxiesStore.createProxyDialogOpen} />
<ProxyFormDialog mode="edit" bind:open={aiProxyProxiesStore.editProxyDialogOpen} />

<AssignmentFormDialog mode="create" bind:open={aiProxyAssignmentsStore.createAssignmentDialogOpen} />
<AssignmentFormDialog mode="edit" bind:open={aiProxyAssignmentsStore.editAssignmentDialogOpen} />
