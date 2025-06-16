import type { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { settings$ } from "@/systems/Settings";
import { DropdownMenu } from "./DropdownMenu";

export type Repository = {
    name: string;
    owner: string;
    url: string;
    isStarred: boolean;
};

interface RepositoryDropdownProps {
    selectedRepository$: Observable<Repository | null>;
}

export function RepositoryDropdown({ selectedRepository$ }: RepositoryDropdownProps) {
    const repositories = use$(settings$.repositories);
    const selectedRepository = use$(selectedRepository$);

    const selectRepository = (repo: Repository) => {
        selectedRepository$.set(repo);
    };

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className="mb-6 bg-background-secondary hover:bg-background-tertiary rounded-md flex-row justify-between items-center overflow-hidden border border-border-primary px-3 py-2">
                <Text className="text-sm text-text-primary">{selectedRepository?.name || "Select Repository"}</Text>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
                {repositories.map((repo, index) => (
                    <DropdownMenu.Item key={index} onSelect={() => selectRepository(repo)}>
                        <View className="flex-row items-center">
                            <Text className="text-sm text-yellow-500 mr-2">{repo.isStarred ? "★" : "☆"}</Text>
                            <Text className="text-sm text-text-primary">{repo.name}</Text>
                        </View>
                    </DropdownMenu.Item>
                ))}
                <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger>
                        <Text className="text-sm text-text-primary">Repository Options</Text>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.SubContent>
                        <DropdownMenu.Item>
                            <Text className="text-sm text-text-primary">SubItem</Text>
                        </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
                <DropdownMenu.Item>
                    <Text className="text-sm text-accent-primary">Add Repository</Text>
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
