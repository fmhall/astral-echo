import type { Context, MiddlewareHandler } from "hono"

/**
 * Admin auth middleware. Requires a bearer token matching ADMIN_TOKEN env var.
 */
export function adminAuth(): MiddlewareHandler {
	return async (c: Context, next: () => Promise<void>) => {
		const token = process.env["ADMIN_TOKEN"]
		if (!token) {
			return c.json({ error: "Admin API not configured" }, 503)
		}

		const header = c.req.header("authorization")
		if (!header?.startsWith("Bearer ")) {
			return c.json({ error: "Missing Authorization header" }, 401)
		}

		if (header.slice(7) !== token) {
			return c.json({ error: "Invalid admin token" }, 403)
		}

		return next()
	}
}
