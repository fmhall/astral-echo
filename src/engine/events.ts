import type { WorldEvent, WorldEventKind } from "../types/index.js"
import { newId } from "../utils/id.js"

type Listener = (event: WorldEvent) => void

const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
	listeners.add(fn)
	return () => {
		listeners.delete(fn)
	}
}

export function emit(kind: WorldEventKind, data: Record<string, unknown>): WorldEvent {
	const event: WorldEvent = {
		id: newId(),
		kind,
		data,
		timestamp: Date.now(),
	}
	for (const fn of listeners) {
		try {
			fn(event)
		} catch {
			// listener errors must not crash the engine
		}
	}
	return event
}
