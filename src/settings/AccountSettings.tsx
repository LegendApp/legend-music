import { observer, use$, useMountOnce, useObservable } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { GithubAvatar } from "@/components/GithubAvatar";
import { myProfile$ } from "@/sync/StateGithub";
import { database } from "@/systems/firebase";
import { settings$ } from "@/systems/Settings";

export const UserAccount = observer(function UserAccount() {
    const user$ = useObservable(myProfile$);
    const firebaseValue$ = useObservable<number | null | undefined>(undefined);
    const user = use$(user$);

    console.log("user", user);

    // Hooks
    useMountOnce(() => {
        const uniqueId = settings$.uniqueId.get();

        const unsubscribe = database.onValue(`keelRealtime/hubGithubRedirect/${uniqueId}`, (snapshot) => {
            const value = snapshot.val();
            const prevValue = firebaseValue$.get();
            if (prevValue === undefined) {
                firebaseValue$.set(value);
            } else if (value !== prevValue) {
                console.log("value", value);
                unsubscribe();

                console.log("Signed in");
                settings$.isAuthed.set(true);
            }
        });

        return () => unsubscribe();
    });

    // Handlers

    const onClickSignout = () => {
        settings$.isAuthed.set(false);
    };

    return (
        <View className="p-4 bg-background-secondary border border-border-primary rounded-md">
            <View className="items-start gap-y-2">
                {user && (
                    <View className="flex-row items-center mb-4 gap-x-3">
                        <GithubAvatar user={user!} size="size-10" />
                        <View>
                            <Text className="text-white text-base font-medium">{user?.login}</Text>
                            <Text className="text-gray-400">{user?.email}</Text>
                        </View>
                    </View>
                )}

                <Button variant="destructive" size="medium" onPress={onClickSignout}>
                    <Text className="text-white font-medium">Sign Out</Text>
                </Button>
            </View>
        </View>
    );
});

export const AccountSettings = observer(function AccountSettings() {
    return (
        <View className="p-4">
            <Text className="text-2xl font-bold text-white mb-5">Account Settings</Text>
            <UserAccount />
        </View>
    );
});
