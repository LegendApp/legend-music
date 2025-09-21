import type { ComponentType } from "react";

import type { WindowOptions } from "@/native-modules/WindowManager";

export type WindowConfigEntry<P = Record<string, unknown>> = {
    component: ComponentType<P>;
    identifier?: string;
    options?: Omit<WindowOptions, "identifier" | "moduleName">;
};

export type WindowsConfig = Record<string, WindowConfigEntry>;
