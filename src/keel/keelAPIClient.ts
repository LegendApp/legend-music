import { observable, when } from "@legendapp/state";
import { synced } from "@legendapp/state/sync";

import { settings$ } from "@/systems/Settings";
import { APIClient } from "./keelClient";

const keelBaseUrl = __DEV__ ? "http://localhost:8000" : "";

const client = new APIClient({
    baseUrl: `${keelBaseUrl}/hub`,
});

export const githubAccessToken$ = observable<string>(
    synced({
        get: async () => {
            await when([settings$.uniqueId, settings$.isAuthed]);
            const uniqueId = settings$.uniqueId.get();

            console.log("run query", uniqueId);

            const { data, error } = await client.api.queries.hubAuth({ uniqueId });
            if (error) {
                console.error(error);
                return null;
            }

            console.log({ accessToken: data?.accessToken });

            return data?.accessToken;
        },
        // retry: {

        // }
    }),
);
