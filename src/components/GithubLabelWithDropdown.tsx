import type { Observable, ObservableParam } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";

import { GithubLabel } from "@/components/GithubLabel";
import { Select, SelectMultiple } from "@/components/Select";
import type { GitHubLabel } from "@/sync/github";
import { labels$ } from "@/sync/StateGithub";
import type { RepoName } from "@/sync/syncedGithub";

interface GithubLabelDropdownBaseProps {
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    unstyled?: boolean;
    allItems?: GitHubLabel[];
    repoName: RepoName;
}

interface GithubLabelDropdownProps extends GithubLabelDropdownBaseProps {
    selected$: ObservableParam<GitHubLabel>;
}

interface GithubLabelDropdownMultipleProps extends GithubLabelDropdownBaseProps {
    selectedItems$: Observable<GitHubLabel[]>;
}

const getItemKey = (label: GitHubLabel) => label.name;
const renderLabel = (label: GitHubLabel) => {
    return <GithubLabel name={label.name} color={label.color} />;
};
const renderLabelText = (label: GitHubLabel) => label.name;

// Shared logic
const useGithubLabels = (allItems?: GitHubLabel[], repoName?: RepoName) => {
    return allItems || use$(labels$[repoName!].labelsArr);
};

export function GithubLabelWithDropdown({ allItems, repoName, ...rest }: GithubLabelDropdownProps) {
    const items = useGithubLabels(allItems, repoName);

    return (
        <Select
            items={items}
            getItemKey={getItemKey}
            renderItem={renderLabel}
            renderItemText={renderLabelText}
            closeOnSelect={false}
            {...rest}
        />
    );
}

export function GithubLabelWithDropdownMultiple({ allItems, repoName, ...rest }: GithubLabelDropdownMultipleProps) {
    const items = useGithubLabels(allItems, repoName);

    return (
        <SelectMultiple
            items={items}
            getItemKey={getItemKey}
            renderItem={renderLabel}
            renderItemText={renderLabelText}
            closeOnSelect={false}
            {...rest}
        />
    );
}
