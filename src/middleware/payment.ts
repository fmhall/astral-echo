import type { Context, Next } from "hono";

/**
 * Payment middleware placeholder.
 *
 * In production, this wraps mppx to charge a micropayment per API call:
 *
 *   import { Mppx } from "mppx";
 *   import { tempo } from "mppx/methods";
 *   const mppx = Mppx.create({ secretKey: process.env.MPP_SECRET_KEY, methods: [tempo({...})] });
 *   export const charge = (amount: string) => mppx.charge({ amount });
 *
 * For local development, this is a pass-through.
 */
export function charge(_amount: string) {
	return async (_c: Context, next: Next) => {
		// TODO: wire up mppx when MPP_SECRET_KEY is set
		// if (process.env.MPP_SECRET_KEY) {
		//   return cachedMppx.charge({ amount })(c, next);
		// }
		await next();
	};
}
