import { observable } from "@legendapp/state";

import type { GitHubIssue, GitHubLabel, GitHubUser, GitHubUserDetails } from "@/sync/github";
import { type RepoName, sortObject, syncedGithub } from "@/sync/syncedGithub";

export const myProfile$ = observable(syncedGithub<GitHubUserDetails>({ type: "get", url: "/user" }));

export const issues$ = observable((ownerRepo: RepoName) => ({
    issues: syncedGithub<GitHubIssue>({
        type: "list",
        url: `/repos/${ownerRepo}/issues`,
        pagination: {
            page: (): number => issues$[ownerRepo].page.get(),
        },
        requireAuth: false,
        pickFields: [
            "id",
            "number",
            "title",
            "state",
            "created_at",
            "updated_at",
            "body",
            "user.login",
            "user.avatar_url",
            "comments",
            "labels.name",
            "labels.color",
            "assignees.login",
            "assignees.avatar_url",
        ],
        transform: {
            load(value) {
                value.repo = ownerRepo;
                return value;
            },
        },
    }),
    page: 1,
}));

export const labels$ = observable((ownerRepo: RepoName) => ({
    labels: syncedGithub<GitHubLabel>({
        type: "list",
        url: `/repos/${ownerRepo}/labels`,
        pagination: {
            page: (): number => labels$[ownerRepo].page.get(),
        },
        requireAuth: false,
        pickFields: ["color", "name"],
        fieldId: "name",
    }),
    labelsArr: () => sortObject(labels$[ownerRepo].labels.get(), "name"),
    page: 1,
}));

export const repoAssignees$ = observable((ownerRepo: RepoName) => ({
    assignees: syncedGithub<GitHubUser>({
        type: "list",
        url: `/repos/${ownerRepo}/assignees`,
        pagination: {
            page: (): number => repoAssignees$[ownerRepo].page.get(),
        },
        requireAuth: false,
        pickFields: ["login", "avatar_url"],
        fieldId: "login",
    }),
    assigneesArr: () => sortObject(repoAssignees$[ownerRepo].assignees.get(), "login"),
    page: 1,
}));
