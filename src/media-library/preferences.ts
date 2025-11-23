import { createJSONManager } from "@/utils/JSONManager";

type MediaLibraryWindowPreferences = {
    width: number;
    height: number;
};

export type MediaLibraryPreferences = {
    window: MediaLibraryWindowPreferences;
};

export const mediaLibraryPreferences$ = createJSONManager<MediaLibraryPreferences>({
    filename: "mediaLibraryPreferences",
    initialValue: {
        window: {
            width: 0,
            height: 0,
        },
    },
});
