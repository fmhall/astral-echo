import { hatchet } from "@/hatchet.client";
import { generateObject as aiGenerateObject, Message, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const DEFAULT_OBJECT_MODEL = openai("gpt-4o-mini");

/**
Prompt part of the AI function options.
It contains a system message, a simple text prompt, or a list of messages.
 */
type Prompt = {
  /**
     System message to include in the prompt. Can be used with `prompt` or `messages`.
    */
  system?: string;
  /**
     A simple text prompt. You can either use `prompt` or `messages` but not both.
    */
  prompt?: string;
  /**
     A list of messages. You can either use `prompt` or `messages` but not both.
    */
  messages?: Array<CoreMessage> | Array<Omit<Message, "id">>;
};

type PromptInputData = Prompt & {
  /**
    The language model to use.
    */
  modelId?: string;
  /**
    The schema for the structured output (as JSON schema).
    */
  schema: Record<string, unknown>;
};

type PromptOutput = {
  object: string;
};

export const generateObject = hatchet.task({
  name: "generate-object",
  executionTimeout: "5m",
  fn: async (input: Record<string, unknown>): Promise<PromptOutput> => {
    const typedInput = input as PromptInputData;
    const { schema, modelId, ...promptInput } = typedInput;
    const result = await aiGenerateObject({
      ...promptInput,
      model: modelId ? openai(modelId) : DEFAULT_OBJECT_MODEL,
      schema: z.object(schema as Record<string, z.ZodType>),
    });

    return {
      object: JSON.stringify(result.object),
    };
  },
});
