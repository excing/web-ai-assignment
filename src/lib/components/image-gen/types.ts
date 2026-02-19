export interface ApiTemplate {
	id: string;
	name: string;
	category: string;
	prompt: string;
	previewImageUrl: string | null;
	description: string | null;
	imageCountMin: number;
	imageCountMax: number;
	assignmentId: string | null;
	featureKey: string | null;
	sortOrder: number;
	isPinned: boolean;
}

/**
 * Extract placeholder names from a template prompt string.
 * E.g. "A {color} {animal}" => ["color", "animal"]
 */
export function extractPlaceholders(prompt: string): string[] {
	return [...prompt.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

/**
 * Replace placeholders in a prompt with user-supplied values.
 */
export function resolvePrompt(prompt: string, values: Record<string, string>): string {
	let result = prompt;
	for (const [key, val] of Object.entries(values)) {
		if (val?.trim()) {
			result = result.replaceAll(`{${key}}`, val.trim());
		}
	}
	return result;
}

/**
 * Format a human-readable hint for image count constraints.
 */
export function formatImageCountHint(min: number, max: number): string {
	if (min === 0 && max === 0) return '';
	if (min === max) return `需要 ${min} 张参考图`;
	if (min > 0 && max === 0) return `至少需要 ${min} 张参考图`;
	if (min === 0 && max > 0) return `最多 ${max} 张参考图`;
	return `需要 ${min}-${max} 张参考图`;
}
