import { when } from "@legendapp/state";
import { useMountOnce, useObservable } from "@legendapp/state/react";
import { Image, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { database } from "@/systems/firebase";
import { settings$ } from "@/systems/Settings";
import { openUrl } from "@/utils/openUrl";
import { ShadowGlass } from "@/utils/styles";

export function Login() {
    const firebaseValue$ = useObservable<number | null | undefined>(undefined);
    const ClientId = "Iv23liAiPx8x1Htz5CBt";

    // Hooks
    useMountOnce(() => {
        const uniqueId = settings$.uniqueId.get();

        const unsubscribe = database.onValue(`keelRealtime/hubGithubAuthRedirect/${uniqueId}`, (snapshot) => {
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

    const onPressSignin = async () => {
        const uniqueId = settings$.uniqueId.get();

        await when(() => firebaseValue$.get() !== undefined);

        const githubOAuthUrl = "https://github.com/login/oauth/authorize";
        const redirectUri = __DEV__
            ? "http://localhost:8000/hub/githubAuthRedirect"
            : "https://production-legend-backend-w1C7WN.keelapps.xyz/hub/githubAuthRedirect";
        const params: string[] = [
            `client_id=${ClientId}`,
            `redirect_uri=${encodeURIComponent(redirectUri)}`,
            `scope=${encodeURIComponent("user:email read:user")}`,
            `state=legendmusicstate-${uniqueId}`,
        ];

        const url = `${githubOAuthUrl}?${params.join("&")}`;

        await openUrl(url);

        // The auth flow would continue from here after the user authenticates
        // and your redirect handler captures the response
    };

    return (
        <View className="flex-1 items-center justify-center bg-background-primary">
            <View
                className="p-8 rounded-lg border border-border-primary items-center justify-center bg-background-secondary gap-y-8"
                style={ShadowGlass}
            >
                <Image source={require("../../assets/256-mac.png")} className="size-24 -mb-3" />
                <Text className="text-2xl font-bold text-center text-white">Sign in to Legend Hub</Text>
                <Button
                    variant="accent"
                    className="px-4 py-2 bg-background-inverse flex-row gap-x-2 items-center"
                    onPress={onPressSignin}
                >
                    <Image source={require("../../assets/github-mark.png")} className="size-6" />
                    <Text className="text-black">Sign in with GitHub</Text>
                </Button>
            </View>
        </View>
    );
}
