import { hatchet } from "@/hatchet.client";
import { generateText, Message, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";

export const DEFAULT_MODEL = openai.responses("gpt-4.1-mini");

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

type PromptInput = Prompt & {
  /**
    The language model to use.
    */
  modelId?: string;
};

type PromptOutput = {
  text: string;
};

export const generateObject = hatchet.task({
  name: "generate-object",
  executionTimeout: "5m",
  fn: async (input: PromptInput): Promise<PromptOutput> => {
    const result = await generateText({
      ...input,
      model: input.modelId ? openai.responses(input.modelId) : DEFAULT_MODEL,
    });

    return {
      text: result.text,
    };
  },
});
