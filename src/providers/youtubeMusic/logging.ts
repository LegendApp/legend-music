import { DEBUG_YOUTUBE_MUSIC_LOGS } from "@/systems/constants";

type LogPayload = Record<string, unknown>;

export const shouldLogYoutubeMusic = (): boolean => __DEV__ || DEBUG_YOUTUBE_MUSIC_LOGS;

const logWithPayload = (logger: (...args: unknown[]) => void, message: string, payload?: LogPayload): void => {
    if (!shouldLogYoutubeMusic()) {
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

export const logYoutubeMusicDebug = (message: string, payload?: LogPayload): void => {
    logWithPayload(console.log, message, payload);
};

export const warnYoutubeMusicDebug = (message: string, payload?: LogPayload): void => {
    logWithPayload(console.warn, message, payload);
};

export const errorYoutubeMusicDebug = (message: string, error: unknown, payload?: LogPayload): void => {
    logWithPayload(console.error, message, { ...payload, error: formatError(error) });
};
