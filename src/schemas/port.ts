import { z } from "zod";

export const PortPrice = z.object({
	resource: z.string(),
	buyPrice: z.number(),
	sellPrice: z.number(),
	supply: z.number(),
	demand: z.number(),
});

export const Port = z.object({
	id: z.string(),
	systemId: z.string(),
	bodyId: z.string(),
	name: z.string(),
	prices: z.array(PortPrice),
});
export type Port = z.infer<typeof Port>;

export const TradeRequest = z.object({
	agentId: z.string(),
	shipId: z.string(),
	resource: z.enum(["energy", "metal", "silicon", "hydrogen", "rare_elements"]),
	side: z.enum(["buy", "sell"]),
	quantity: z.number().positive(),
});

export const TradeResult = z.object({
	ok: z.literal(true),
	resource: z.string(),
	side: z.string(),
	quantity: z.number(),
	pricePerUnit: z.number(),
	total: z.number(),
	agentCreditsAfter: z.number(),
});
