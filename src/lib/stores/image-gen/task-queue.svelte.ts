/**
 * Image Gen Task Queue — 并发调度
 *
 * 管理任务执行的并发数限制，触发任务执行回调。
 * 不持有任务数据本身，仅负责调度逻辑。
 */

export interface QueueCallbacks {
	getPendingTaskIds(): string[];
	onTaskStart(id: string): void;
	onTaskComplete(id: string): void;
}

export function createTaskQueue(maxConcurrent: number = 3) {
	let runningCount = 0;
	let callbacks: QueueCallbacks | null = null;

	function bind(cbs: QueueCallbacks) {
		callbacks = cbs;
	}

	function processQueue() {
		if (!callbacks) return;

		const pendingIds = callbacks.getPendingTaskIds();
		while (runningCount < maxConcurrent && pendingIds.length > 0) {
			const id = pendingIds.shift()!;
			runningCount++;
			callbacks.onTaskStart(id);
		}
	}

	function taskFinished(id: string) {
		runningCount--;
		callbacks?.onTaskComplete(id);
		processQueue();
	}

	function kick() {
		processQueue();
	}

	return { bind, kick, taskFinished };
}
