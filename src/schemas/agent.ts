import { z } from "zod";

export const Agent = z.object({
	id: z.string(),
	name: z.string(),
	walletAddress: z.string(),
	credits: z.number(),
	createdAt: z.number(),
});
export type Agent = z.infer<typeof Agent>;

export const RegisterAgentRequest = z.object({
	name: z.string().min(1).max(64),
	walletAddress: z.string().min(1),
});

export const AgentWithShips = Agent.extend({
	ships: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			status: z.string(),
			systemId: z.string(),
		}),
	),
});
