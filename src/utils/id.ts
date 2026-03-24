/** Short 12-char hex ID */
export function newId(): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}
