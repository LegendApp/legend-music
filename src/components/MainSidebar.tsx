import { use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { DropdownMenu } from "@/components/DropdownMenu";
import { Sidebar } from "@/components/Sidebar";
import { SidebarButton } from "@/components/SidebarButton";
import type { RepoName } from "@/sync/syncedGithub";
import { Icon } from "@/systems/Icon";
import { addTabForRepo, settings$ } from "@/systems/Settings";
import { state$ } from "@/systems/State";

export const MainSidebar = () => {
    const selectedTabId$ = settings$.selectedTabId;
    const tabs = Object.values(use$(settings$.tabs));
    const repositories = use$(settings$.repositories);

    const onSelectRepo = (value: string) => {
        console.log("onSelectRepo", value);
        addTabForRepo(value as RepoName);
    };

    return (
        <Sidebar items={tabs} selectedItem$={selectedTabId$} className="pt-10">
            <View>
                {tabs.map((tab) => (
                    <SidebarButton key={tab.id} text={tab.name} value={tab.id} selectedItem$={selectedTabId$} />
                ))}

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger className="mt-4 mx-1 rounded-md justify-center items-center hover:bg-white/20 bg-transparent py-2">
                        <Icon name="plus" size={16} />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content offset={{ x: 80, y: -20 }}>
                        {repositories.map((repo) => (
                            <DropdownMenu.Item
                                key={`${repo.owner}/${repo.name}`}
                                onSelect={() => onSelectRepo(`${repo.owner}/${repo.name}`)}
                            >
                                <Text className="text-text-primary">{repo.name}</Text>
                            </DropdownMenu.Item>
                        ))}
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                            onSelect={() => {
                                state$.assign({
                                    showSettings: true,
                                    showSettingsPage: "repositories",
                                });
                            }}
                        >
                            <Text className="text-text-primary">Add Repo</Text>
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </View>
        </Sidebar>
    );
};
