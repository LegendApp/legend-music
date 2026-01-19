import { NativeModules } from "react-native";

export type AIToolId = "claude" | "codex";

export type AICommandAvailability = {
    claude: boolean;
    codex: boolean;
    preferredTool: AIToolId | null;
};

export type AICommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
};

export type AICommandParams = {
    command: string;
    args?: string[];
    input?: string;
    timeoutMs?: number;
};

type AICommandRunnerNative = {
    getAvailability: () => Promise<AICommandAvailability>;
    runCommand: (params: AICommandParams) => Promise<AICommandResult>;
};

const nativeModule = NativeModules.AICommandRunner as AICommandRunnerNative | undefined;

const unavailableError = new Error("AICommandRunner native module is not available");

export const aiCommandRunner = {
    getAvailability: async (): Promise<AICommandAvailability> => {
        if (!nativeModule) {
            return { claude: false, codex: false, preferredTool: null };
        }
        return nativeModule.getAvailability();
    },
    runCommand: async (params: AICommandParams): Promise<AICommandResult> => {
        if (!nativeModule) {
            throw unavailableError;
        }
        return nativeModule.runCommand(params);
    },
};

export const isAIToolAvailable = async (): Promise<boolean> => {
    const availability = await aiCommandRunner.getAvailability();
    return availability.claude || availability.codex;
};

export const getPreferredAITool = async (): Promise<AIToolId | null> => {
    const availability = await aiCommandRunner.getAvailability();
    return availability.preferredTool;
};
