import type { Observable, ObservableParam } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";

import { GithubUser } from "@/components/GithubUser";
import { Select, SelectMultiple } from "@/components/Select";
import type { GitHubUser } from "@/sync/github";
import { repoAssignees$ } from "@/sync/StateGithub";
import type { RepoName } from "@/sync/syncedGithub";

interface GithubUserDropdownBaseProps {
    repoName: RepoName;
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
}

interface GithubUserDropdownProps extends GithubUserDropdownBaseProps {
    selected$?: ObservableParam<GitHubUser>;
    selected?: GitHubUser;
    onSelectItem?: (user: GitHubUser) => void;
}

interface GithubUserDropdownMultipleProps extends GithubUserDropdownBaseProps {
    selectedItems$: Observable<GitHubUser[]>;
    onSelectItem?: (user: GitHubUser, isRemove: boolean) => void;
}

const getItemKey = (user: GitHubUser) => user.login;
const renderUser = (user: GitHubUser) => {
    return <GithubUser user={user} />;
};
const renderUserText = (user: GitHubUser) => user.login;

// Shared logic
const useGithubUsers = (repoName: RepoName) => {
    return use$<GitHubUser[]>(repoAssignees$[repoName].assigneesArr);
};

export function GithubUserWithDropdown({ repoName, ...rest }: GithubUserDropdownProps) {
    const allUsers = useGithubUsers(repoName);

    return (
        <Select
            items={allUsers}
            getItemKey={getItemKey}
            renderItem={renderUser}
            renderItemText={renderUserText}
            {...rest}
        />
    );
}

export function GithubUserWithDropdownMultiple({ repoName, ...rest }: GithubUserDropdownMultipleProps) {
    const allUsers = useGithubUsers(repoName);

    return <SelectMultiple items={allUsers} getItemKey={getItemKey} renderItem={renderUser} {...rest} />;
}
