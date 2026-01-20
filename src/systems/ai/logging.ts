import { DEBUG_AI_LOGS } from "@/systems/constants";

type LogPayload = Record<string, unknown>;

export const shouldLogAi = (): boolean => __DEV__ || DEBUG_AI_LOGS;

const logWithPayload = (logger: (...args: unknown[]) => void, message: string, payload?: LogPayload): void => {
    if (!shouldLogAi()) {
        return;
    }

    if (payload && Object.keys(payload).length > 0) {
        logger(message, payload);
        return;
    }

    logger(message);
};

const formatError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};

export const logAiDebug = (message: string, payload?: LogPayload): void => {
    logWithPayload(console.log, message, payload);
};

export const warnAiDebug = (message: string, payload?: LogPayload): void => {
    logWithPayload(console.warn, message, payload);
};

export const errorAiDebug = (message: string, error: unknown, payload?: LogPayload): void => {
    logWithPayload(console.error, message, { ...payload, error: formatError(error) });
};
