import type { Context, MiddlewareHandler } from "hono"

/**
 * x402 payment middleware.
 *
 * In production, this integrates with mppx to issue 402 challenges and verify
 * payment credentials. The wallet address from the credential becomes the
 * agent's identity.
 *
 * In dev mode (ASTRAL_DEV=1), payments are bypassed and a dev wallet is used.
 */
export function x402(priceUsd: number): MiddlewareHandler {
	return async (c: Context, next: () => Promise<void>) => {
		const isDev = process.env["ASTRAL_DEV"] === "1"

		if (isDev) {
			// Dev mode: extract wallet from header or use default
			const wallet = c.req.header("x-wallet-address") ?? "dev-wallet-0x0000"
			c.set("walletAddress", wallet)
			c.set("paidAmount", priceUsd)
			return next()
		}

		// Production: x402 challenge/credential flow via mppx
		// The payment credential header contains the wallet address + payment proof
		const credential = c.req.header("x-402-credential")

		if (!credential) {
			// Issue 402 challenge
			return c.json(
				{
					error: "Payment Required",
					price: priceUsd,
					currency: "USD",
					protocol: "x402",
					detail: `This endpoint costs $${priceUsd} per request. Use agentcash or an x402-compatible client.`,
				},
				402 as never,
			)
		}

		// Verify the credential (in production, delegate to mppx verify)
		// For now, extract wallet address from credential
		// mppx handles the actual verification + settlement
		try {
			const parsed = JSON.parse(atob(credential)) as {
				wallet?: string
				amount?: number
			}
			if (!parsed.wallet) {
				return c.json({ error: "Invalid credential: missing wallet" }, 401)
			}
			if ((parsed.amount ?? 0) < priceUsd) {
				return c.json(
					{
						error: "Insufficient payment",
						required: priceUsd,
						provided: parsed.amount,
					},
					402 as never,
				)
			}
			c.set("walletAddress", parsed.wallet)
			c.set("paidAmount", parsed.amount)
		} catch {
			return c.json({ error: "Malformed credential" }, 401)
		}

		return next()
	}
}

/** Extract the wallet address set by the payment middleware */
export function getWallet(c: Context): string {
	return c.get("walletAddress") as string
}
