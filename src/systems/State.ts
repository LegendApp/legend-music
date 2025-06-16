import { observable } from "@legendapp/state";

import type { SettingsPage } from "@/settings/SettingsContainer";
import { issues$ } from "@/sync/StateGithub";
import type { RepoName } from "@/sync/syncedGithub";

export const state$ = observable({
    isDropdownOpen: false,
    activeSubmenuId: null as string | null,
    lastNavStart: 0,
    lastNavTime: 0,
    showSettings: false,
    showSettingsPage: undefined as SettingsPage | undefined,
    selectedIssue: {
        id: null as number | null,
        repo: null as RepoName | null,
        issue: () => {
            const repo = state$.selectedIssue.repo.get();
            const id = state$.selectedIssue.id.get();
            return repo && id ? issues$[repo].issues[id] : null;
        },
    },
});
