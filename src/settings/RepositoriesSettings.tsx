import type { Observable } from "@legendapp/state";
import { observer, use$, useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { DropdownMenu } from "@/components/DropdownMenu";
import { StyledInput } from "@/components/StyledInput";
import { appState$ } from "@/observables/appState";
import { fetchRepositories, GITHUB_APP_NAME, type GitHubRepository } from "@/sync/github";
import { Icon } from "@/systems/Icon";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { openUrl } from "@/utils/openUrl";

// Section type for grouped repositories
type RepoGroup = {
    title: string;
    data: GitHubRepository[];
    avatarUrl?: string;
};

// Fetch repositories from GitHub API
const fetchRepos = async (
    auth$: Observable<{ repos: GitHubRepository[]; reposLoading: boolean; reposError: string | null }>,
) => {
    try {
        auth$.reposLoading.set(true);
        auth$.reposError.set(null);

        const data = await fetchRepositories(true);

        auth$.repos.set(data!);
    } catch (error) {
        console.error("Failed to fetch repositories:", error);
        auth$.reposError.set(error instanceof Error ? error.message : "Failed to fetch repositories");
    } finally {
        auth$.reposLoading.set(false);
    }
};

// Repository item component
const RepositoryItem = observer(function RepositoryItem({
    item,
    isSyncing,
    onToggleSync,
}: {
    item: GitHubRepository;
    isSyncing: boolean;
    onToggleSync: (checked: boolean) => void;
}) {
    const permissionLevel = getPermissionLevel(item);
    const isChecked$ = useObservable(isSyncing);

    return (
        <View className="flex-row items-center justify-between px-2">
            <View className="flex-row items-center">
                <Checkbox $checked={isChecked$} onChange={onToggleSync} className="mr-4" />
                <Text className="text-text-primary text-sm">{item.name}</Text>
            </View>
            <View className="flex-row gap-x-2">
                {item.private && <Icon name="lock.fill" size={16} />}
                {permissionLevel && (
                    <View className={cn(getPermissionColor(permissionLevel), "px-2 py-0.5 rounded-md mr-2")}>
                        <Text className="text-xs text-text-primary">{permissionLevel}</Text>
                    </View>
                )}
            </View>
        </View>
    );
});

// Organization section header component
const OrganizationHeader = ({ title, avatarUrl }: { title: string; avatarUrl?: string }) => {
    const githubLogoUri = "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png";
    const avatarUri = avatarUrl || githubLogoUri;

    return (
        <View className="flex-row items-center bg-background-tertiary py-3 px-2">
            <Image source={{ uri: avatarUri }} className="w-4 h-4 rounded-full mr-2" />
            <Text className="text-text-primary font-bold">{title}</Text>
        </View>
    );
};

// Section header component
const SectionHeader = ({ title, className }: { title: string; className?: string }) => {
    return (
        <View className={cn("pb-2 pt-4", className)}>
            <Text className="text-text-primary font-bold text-xl">{title}</Text>
        </View>
    );
};

export const RepositoriesSettings = observer(function RepositoriesSettings() {
    // Observable for tracking authentication state
    const auth$ = useObservable({
        repos: [] as GitHubRepository[],
        reposLoading: false,
        reposError: null as string | null,
    });

    // Observable for the repo URL dropdown
    const addRepoUrl$ = useObservable({
        isOpen: false,
        url: "",
    });
    const repos$ = auth$.repos;
    const reposLoading$ = auth$.reposLoading;
    const reposError$ = auth$.reposError;
    const syncedRepos$ = settings$.repositories;
    const isAppActive = use$(appState$.isActive);
    const repoUrlInput$ = addRepoUrl$.url;

    const repos = use$(repos$);
    const reposLoading = use$(reposLoading$);
    const reposError = use$(reposError$);
    const syncedRepos = use$(syncedRepos$);

    // Fetch repos when component mounts or app comes back into focus
    useEffect(() => {
        if (isAppActive || repos.length === 0) {
            fetchRepos(auth$);
        }
    }, [isAppActive]);

    const onAddRepository = () => {
        const url = addRepoUrl$.url.get();
        if (!url) {
            return;
        }

        // Extract owner and repo name from URL using a regex pattern
        // Matches GitHub URLs in formats like:
        // - https://github.com/owner/repo
        // - http://github.com/owner/repo
        // - github.com/owner/repo
        // - www.github.com/owner/repo
        // - https://github.com/owner/repo/tree/main/packages/
        const githubUrlRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/\s#?]+)(?:\/.*)?$/;
        const match = url.match(githubUrlRegex);

        if (match?.[1] && match[2]) {
            const ownerName = match[1];
            const repoName = match[2];

            // Add to synced repos
            const repoToAdd = {
                name: repoName,
                owner: ownerName,
                url: url,
                isStarred: false,
            };
            syncedRepos$.set([...syncedRepos$.get(), repoToAdd]);

            // Reset the URL input and close dropdown
            addRepoUrl$.url.set("");
            addRepoUrl$.isOpen.set(false);
        }
    };

    const onClickAuthRepo = () => {
        openUrl(`https://github.com/apps/${GITHUB_APP_NAME}/installations/new/`);
    };

    const toggleRepositorySync = (repo: GitHubRepository, isSyncing: boolean) => {
        if (isSyncing) {
            // If already syncing, remove from synced repos
            const updatedRepos = syncedRepos$.get().filter((r) => r.name !== repo.name);
            syncedRepos$.set(updatedRepos);
        } else {
            // If not syncing, add to synced repos
            const repoToAdd = {
                name: repo.name,
                owner: repo.owner?.login || "",
                url: repo.html_url,
                isStarred: false,
            };
            syncedRepos$.set([...syncedRepos$.get(), repoToAdd]);
        }
    };

    // Check if a repository is syncing
    const isRepositorySyncing = (repo: GitHubRepository) => {
        return syncedRepos.some((r) => r.name === repo.name);
    };

    // Repositories group component
    const RepositoriesGroup = observer(function RepositoriesGroup({
        groups,
        emptyMessage,
        onToggleSync,
    }: {
        groups: RepoGroup[];
        emptyMessage: string;
        onToggleSync: (repo: GitHubRepository, isSyncing: boolean) => void;
    }) {
        if (groups.length === 0) {
            return <Text className="text-text-secondary ml-2 mb-4">{emptyMessage}</Text>;
        }

        return groups.map((group, groupIndex) => (
            <View
                key={`group-${groupIndex}`}
                className="bg-background-secondary border border-border-primary rounded-lg pb-4 gap-y-4 mb-4"
            >
                <OrganizationHeader title={group.title} avatarUrl={group.avatarUrl} />
                {group.data.map((repo) => (
                    <RepositoryItem
                        key={repo.id}
                        item={repo}
                        isSyncing={isRepositorySyncing(repo)}
                        onToggleSync={(checked) => onToggleSync(repo, !checked)}
                    />
                ))}
            </View>
        ));
    });

    // Combine repos from the API and settings
    const getAllRepositories = (): GitHubRepository[] => {
        const apiRepos = [...repos];
        const settingsReposNotInAPI = syncedRepos
            .filter((settingsRepo) => !apiRepos.some((apiRepo) => apiRepo.name === settingsRepo.name))
            .map((settingsRepo) => {
                // Create a custom repo object that matches GitHubRepository interface
                const customRepo = {
                    id: Number.parseInt(`${Date.now()}${Math.floor(Math.random() * 1000)}`), // Generate a numeric id
                    name: settingsRepo.name,
                    full_name: `${settingsRepo.owner}/${settingsRepo.name}`,
                    description: null,
                    private: false,
                    html_url: `https://github.com/${settingsRepo.owner}/${settingsRepo.name}`,
                    updated_at: new Date().toISOString(),
                    owner: { login: settingsRepo.owner, avatar_url: undefined },
                    permissions: {
                        pull: true, // At minimum they should have read access
                    },
                };
                return customRepo as GitHubRepository;
            });

        return [...apiRepos, ...settingsReposNotInAPI];
    };

    const allRepositories = getAllRepositories();

    // Group repositories by organization and syncing status
    const syncingGroups: RepoGroup[] = [];
    const notSyncingGroups: RepoGroup[] = [];

    for (const repo of allRepositories) {
        const ownerName = repo.owner?.login || "Other";
        const isSyncing = isRepositorySyncing(repo);
        const groups = isSyncing ? syncingGroups : notSyncingGroups;

        const existingGroup = groups.find((group) => group.title === ownerName);

        if (existingGroup) {
            existingGroup.data.push(repo);
        } else {
            groups.push({
                title: ownerName,
                data: [repo],
                avatarUrl: repo.owner?.avatar_url,
            });
        }
    }

    // Sort repositories alphabetically within each group
    for (const group of syncingGroups) {
        group.data.sort((a, b) => a.name.localeCompare(b.name));
    }

    for (const group of notSyncingGroups) {
        group.data.sort((a, b) => a.name.localeCompare(b.name));
    }

    return (
        <View className="bg-background-primary h-full border border-border-primary">
            <View className="px-5 flex-row justify-between items-center py-3 border-b border-border-primary">
                <View>
                    <Text className="text-xl font-bold text-text-primary">Repositories</Text>
                    <Text className="text-xs text-text-secondary pt-1">Syncing {syncedRepos.length} repositories</Text>
                </View>
                <View className="flex-row gap-x-2">
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger className="bg-background-secondary hover:bg-background-tertiary rounded-md flex-row justify-between items-center overflow-hidden border border-border-primary px-4 py-2">
                            <Text className="text-text-primary">Add by URL</Text>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content offset={{ x: -40, y: 0 }}>
                            <AddRepositoryURL repoUrlInput$={repoUrlInput$} onAddRepository={onAddRepository} />
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                    <Button
                        variant="secondary"
                        size="medium"
                        className="flex-row gap-x-1"
                        onPress={onClickAuthRepo}
                        disabled={reposLoading}
                    >
                        <Icon name="lock.fill" size={16} marginTop={-6} />
                        <Text className="text-text-primary">Authorize Repos</Text>
                    </Button>
                </View>
            </View>

            {allRepositories.length > 0 && (repos.length > 0 || !reposLoading) ? (
                <ScrollView className="flex-1" contentContainerClassName="px-5" showsVerticalScrollIndicator={false}>
                    {/* Syncing Repositories */}
                    <SectionHeader title="Syncing" />
                    <RepositoriesGroup
                        groups={syncingGroups}
                        emptyMessage="No syncing repositories"
                        onToggleSync={toggleRepositorySync}
                    />

                    {/* Not Syncing Repositories */}
                    <SectionHeader title="Not Syncing" />
                    <RepositoriesGroup
                        groups={notSyncingGroups}
                        emptyMessage="No repositories found"
                        onToggleSync={toggleRepositorySync}
                    />
                </ScrollView>
            ) : reposLoading ? (
                <View className="items-center justify-center py-8">
                    <ActivityIndicator size="small" color="var(--accent-primary)" />
                    <Text className="text-text-secondary mt-3">Loading repositories...</Text>
                </View>
            ) : reposError ? (
                <View className="bg-background-destructive/20 p-4 rounded-lg mb-4">
                    <Text className="text-text-primary">{reposError}</Text>
                </View>
            ) : (
                <View className="items-center justify-center flex-1">
                    <Text className="text-text-secondary">No repositories found.</Text>
                </View>
            )}
        </View>
    );
});

interface AddRepositoryURLProps {
    repoUrlInput$: Observable<string>;
    onAddRepository: () => void;
}

function AddRepositoryURL({ repoUrlInput$, onAddRepository }: AddRepositoryURLProps) {
    return (
        <View className="flex-row items-center p-2 gap-x-2">
            <StyledInput value$={repoUrlInput$} placeholder="Enter repository URL" className="w-60" />
            <Button variant="accent" size="small" onPress={onAddRepository}>
                <Text className="text-white">Add</Text>
            </Button>
        </View>
    );
}

// Get color for permission badge
const getPermissionColor = (permissionLevel: string | null) => {
    if (!permissionLevel) {
        return "bg-background-tertiary";
    }
    switch (permissionLevel) {
        case "Admin":
            return "bg-purple-600";
        case "Maintain":
            return "bg-blue-600";
        case "Write":
            return "bg-green-600";
        case "Triage":
            return "bg-yellow-600";
        case "Read":
            return "bg-background-secondary";
        default:
            return "bg-background-secondary";
    }
};

// Get the highest permission level
const getPermissionLevel = (item: GitHubRepository) => {
    if (!item.permissions) {
        return null;
    }
    if (item.permissions.admin) {
        return "Admin";
    }
    if (item.permissions.maintain) {
        return "Maintain";
    }
    if (item.permissions.push) {
        return "Write";
    }
    if (item.permissions.triage) {
        return "Triage";
    }
    if (item.permissions.pull) {
        return "Read";
    }
    return null;
};
