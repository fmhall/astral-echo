import { z } from "zod";

export const WorldState = z.object({
	tick: z.number(),
	status: z.enum(["running", "paused"]),
	tickIntervalMs: z.number(),
	lastTickAt: z.number().nullable(),
	systemCount: z.number(),
	agentCount: z.number(),
	shipCount: z.number(),
});
export type WorldState = z.infer<typeof WorldState>;

export const AdminTickRequest = z.object({
	ticks: z.number().int().positive().default(1),
});

export const AdminSetStatusRequest = z.object({
	status: z.enum(["running", "paused"]),
});

export const AdminSetTickIntervalRequest = z.object({
	tickIntervalMs: z.number().int().positive().min(1000),
});
