import { isFunction, observe } from "@legendapp/state";
import { combineTransforms, type SyncTransform } from "@legendapp/state/sync";
import { syncedCrud } from "@legendapp/state/sync-plugins/crud";

import { githubAccessToken$ } from "@/keel/keelAPIClient";
import { createGitHubApiUrl, fetchJSON } from "@/sync/github";
import { ax } from "@/utils/ax";
import { observablePersistExpoFS } from "@/utils/ExpoFSPersistPlugin";
import { pickPaths } from "@/utils/pickPaths";

interface GithubPluginOptions<TRemote extends object, TLocal extends object> {
    fieldId?: string;
    type: "list" | "get";
    requireAuth?: boolean; // Default is true
    url: `/${string}`;
    params?: Record<string, any> | (() => Record<string, any>);
    transform?: SyncTransform<TLocal, TRemote> | undefined;
    pickFields?: string[];
    pagination?: {
        page?: () => number;
        perPage?: number;
    };
}

function getCacheKey(url: string) {
    return url
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/^_+/, "")
        .toLowerCase();
}
const DO_SYNC = !__DEV__ || false;

export type RepoName = `${string}/${string}`;

export function syncedGithub<TRemote extends object, TLocal extends object = TRemote>({
    type,
    requireAuth = true,
    url,
    params,
    transform,
    fieldId,
    pickFields = [],
    pagination,
}: GithubPluginOptions<TRemote, TLocal>) {
    let didRunOnce = false;
    const cacheKey = getCacheKey(url);

    // Merge pagination parameters with existing params
    const mergedParams = () => {
        const baseParams = typeof params === "function" ? params() : params || {};

        if (pagination) {
            return {
                ...baseParams,
                per_page: pagination.perPage || 30,
                page: pagination.page?.(),
            };
        }

        return baseParams;
    };

    // Create default transform if requested
    const finalTransform = combineTransforms(
        ...ax(
            pickFields.length > 0 && {
                load: (data: any) => {
                    const picked = pickPaths(data, pickFields);
                    return picked as TLocal;
                },
            },
            transform,
        ),
    );

    return syncedCrud<TRemote, TLocal>({
        waitFor: requireAuth ? githubAccessToken$ : undefined,
        [type]: async () => {
            const paramsValue = mergedParams();
            const fetchUrl = createGitHubApiUrl(url, paramsValue);
            didRunOnce = true;
            if (!DO_SYNC) {
                return [];
            }

            return fetchJSON<TRemote[]>(fetchUrl, {
                authToken: githubAccessToken$.get(),
            });
        },
        mode: type === "list" ? "assign" : "set",
        persist: {
            plugin: observablePersistExpoFS({ format: "msgpack" }),
            name: cacheKey,
        },
        subscribe: ({ refresh }) => {
            // Temporary workaround because list is not reactive?
            if (isFunction(params) || pagination) {
                const observeTarget = isFunction(params) ? params : pagination?.page;
                if (observeTarget) {
                    observe(observeTarget, () => {
                        if (didRunOnce) {
                            console.log("REFRESHING");
                            refresh();
                        }
                    });
                }
            }
        },
        transform: finalTransform,
        fieldId,
    });
}

export function sortObject<T>(obj: Record<string, T>, key: keyof T): T[] {
    return Object.values(obj || {}).sort((a, b) => (a[key] as string).localeCompare(b[key] as string));
}
