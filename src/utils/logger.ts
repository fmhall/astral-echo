import pino from "pino";

export const createLogger = (name?: string) => {
  return pino({
    name,
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
              messageFormat: "{msg}",
              hideObject: false,
            },
          }
        : undefined,
  });
};

export const logger = createLogger("astral-echo");
