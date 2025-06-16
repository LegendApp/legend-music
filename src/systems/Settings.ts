import { observable, syncState, when } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";

import type { DisplayOptionsState } from "@/components/DisplayOptions";
import type { FilterState } from "@/components/Filters";
import type { Repository } from "@/components/RepositoryDropdown";
import { generateId } from "@/sync/generateId";
import type { RepoName } from "@/sync/syncedGithub";
import { createJSONManager } from "@/utils/JSONManager";

export type ViewMode = "List" | "Board";

export interface SavedTab {
    id: string;
    name: string;
    search: string;
    filters: FilterState;
    viewMode: ViewMode;
    displayOptions: DisplayOptionsState;
}

export interface AppSettings {
    repositories: Repository[];
    state: {
        sidebarWidth: number;
        isSidebarOpen: boolean;
        issueDetailWidth: number;
        isIssueDetailOpen: boolean;
        panels: Record<string, number>;
    };
    tabs: Record<string, SavedTab>;
    selectedTabId: string;
    commentDrafts: Record<string, string>;
    uniqueId: string;
    isAuthed: boolean;
}

export const settings$ = createJSONManager<AppSettings>({
    filename: "settings",
    initialValue: {
        repositories: [],
        // State
        state: {
            sidebarWidth: 140,
            isSidebarOpen: true,
            issueDetailWidth: 600,
            isIssueDetailOpen: false,
            panels: {},
        },
        // Tabs
        tabs: {},
        selectedTabId: "default",
        commentDrafts: {},
        uniqueId: "",
        isAuthed: false,
    },
});

export function addTabForRepo(repoName: RepoName) {
    const name = repoName.split("/")[1];

    const newTab: SavedTab = {
        id: generateId(),
        name,
        search: "",
        filters: {
            repos: {
                [repoName]: true,
            },
            state: {
                Open: true,
            },
            status: {},
            label: {},
            assigned: {},
        },
        viewMode: "List",
        displayOptions: {
            grouping: "status",
            ordering: "updated_at",
            orderDirection: "desc",
        },
    };
    settings$.tabs[newTab.id].set(newTab);
}

export const isSettingsLoaded$ = observable(() => !!syncState(settings$).isPersistLoaded.get());

when(isSettingsLoaded$, () => {
    if (!settings$.uniqueId.get()) {
        settings$.uniqueId.set(generateId());
    }
});

// Helper functions for working with saved tabs
export const getSelectedTab$ = () => {
    const selectedTabId = settings$.selectedTabId.get();
    if (!selectedTabId) {
        console.error("NO selected tab");
    }
    return settings$.tabs[selectedTabId];
};
export const useSelectedTab = (): SavedTab => {
    return use$(getSelectedTab$);
};

export const createTab = (
    name: string,
    filters: FilterState,
    viewMode: ViewMode,
    displayOptions: DisplayOptionsState,
): string => {
    const id = generateId();
    const newTab: SavedTab = {
        id,
        name,
        search: "",
        filters,
        viewMode,
        displayOptions,
    };

    settings$.tabs[id].set(newTab);
    return id;
};

export const deleteTab = (id: string) => {
    if (id === "default") return; // Don't allow deleting the default tab

    // If the deleted tab is selected, switch to default
    if (settings$.selectedTabId.get() === id) {
        settings$.selectedTabId.set("default");
    }

    // Delete the tab using delete operator
    const tabs = settings$.tabs.get();
    const newTabs = { ...tabs };
    delete newTabs[id];
    settings$.tabs.set(newTabs);
};

export const selectTab = (id: string) => {
    if (settings$.tabs[id].get()) {
        settings$.selectedTabId.set(id);
    }
};

// observe(() => {
//     console.log('settings', settings$.selectedTabId.get());
// });
