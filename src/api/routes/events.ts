import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { PriceTier } from "../../types/index.js"
import { subscribe } from "../../engine/events.js"
import { x402 } from "../middleware/payment.js"

const app = new Hono()

/** SSE stream of world events */
app.get("/", x402(PriceTier.observe), (c) => {
	return streamSSE(c, async (stream) => {
		const unsub = subscribe((event) => {
			stream.writeSSE({
				id: event.id,
				event: event.kind,
				data: JSON.stringify(event.data),
			}).catch(() => {
				// stream closed
				unsub()
			})
		})

		// Keep alive with periodic comments
		const keepAlive = setInterval(() => {
			stream.writeSSE({ data: "", event: "ping" }).catch(() => {
				clearInterval(keepAlive)
				unsub()
			})
		}, 30_000)

		// Wait until the stream is closed
		stream.onAbort(() => {
			clearInterval(keepAlive)
			unsub()
		})

		// Block to keep the stream open
		await new Promise(() => {
			// intentionally never resolves — stream stays open until client disconnects
		})
	})
})

export default app
