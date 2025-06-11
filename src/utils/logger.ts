import pino from "pino";

export const createLogger = (name?: string) => {
  const baseConfig: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || "info",
  };

  if (name) {
    baseConfig.name = name;
  }

  if (process.env.NODE_ENV !== "production") {
    baseConfig.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
        hideObject: false,
      },
    };
  }

  return pino(baseConfig);
};

export const logger = createLogger("astral-echo");
