import { when } from "@legendapp/state";
import * as FileSystemNext from "expo-file-system/next";
import { githubAccessToken$ } from "@/keel/keelAPIClient";
import type { RepoName } from "@/sync/syncedGithub";
import { ax } from "../utils/ax";

const GITHUB_API_BASE_URL = "https://api.github.com";
export const GITHUB_APP_NAME = "legendapp-hub";
const CACHE_DIR = new FileSystemNext.Directory(FileSystemNext.Paths.cache, "LegendMusic");
const CACHE_ENABLED = true; // Set to false to disable caching

console.log("CACHE_DIR", CACHE_DIR);

export async function fetchJSON<T>(
    url: string,
    options: {
        method?: "GET" | "POST";
        body?: string | undefined;
        skipCache?: boolean;
        authToken?: string;
        headers?: Record<string, any>;
    } = {},
): Promise<T> {
    console.log("fetch", url, options);
    const { method = "GET", body, skipCache = false, authToken, headers } = options;

    // Only add cache-busting headers if skipCache is true
    const requestOptions: RequestInit = {
        method,
        body,
        headers: {
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(authToken ? { Authorization: `token ${authToken}` } : {}),
            ...(skipCache
                ? { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache", Expires: "0" }
                : {}),
            ...(headers || {}),
        },
    };

    console.log("requestOptions", requestOptions);

    const response = await fetch(url, requestOptions);
    if (response.ok) {
        return response.json();
    }

    const text = await response.text();

    console.error(response.status, response.statusText, text);
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
}

/**
 * Fetch with caching for GitHub API calls
 */
async function cacheFetch<T>(
    url: string,
    options?: { method?: "GET" | "POST"; body?: string | undefined; skipCache?: boolean; authToken?: string },
    skipCache?: boolean,
): Promise<T> {
    const optionsWithSkipCache = { ...options, skipCache } as any; // Going to remove this eventually anyway
    if (!CACHE_ENABLED || skipCache) {
        return fetchJSON<T>(url, optionsWithSkipCache);
    }

    try {
        // Create cache directory if it doesn't exist
        if (!CACHE_DIR.exists) {
            CACHE_DIR.create();
        }

        // Create a cache key from the URL
        const cacheKey = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();

        const file = new FileSystemNext.File(CACHE_DIR, `${cacheKey}.json`);
        if (file.exists) {
            const cachedData = file.text();
            return JSON.parse(cachedData);
        }

        // If not in cache, fetch from network
        console.log(`Fetching from network: ${url}`);
        const data = await fetchJSON<T>(url, optionsWithSkipCache);

        // Save to cache
        await file.write(JSON.stringify(data));

        // Return the data
        return data;
    } catch (error) {
        console.error("Cache fetch error:", error);
        // Fall back to regular fetch if caching fails
        return fetchJSON<T>(url, optionsWithSkipCache);
    }
}

/**
 * Creates a properly formatted GitHub API URL
 */
export function createGitHubApiUrl(path: string, params: Record<string, string | undefined> = {}): string {
    // Ensure path starts with a slash and doesn't have trailing slash
    const formattedPath = path.startsWith("/") ? path : `/${path}`;
    const normalizedPath = formattedPath.endsWith("/") ? formattedPath.slice(0, -1) : formattedPath;

    // Create the URL
    let url = `${GITHUB_API_BASE_URL}${normalizedPath}`;

    // Add query parameters
    ax(Object.entries(params)).forEach(([key, value], i) => {
        url += i === 0 ? "?" : "&";
        if (value !== undefined && value !== null) {
            url += `${key}=${value}`;
        }
    });

    return url;
}

/**
 * Format a date to ISO 8601 format for GitHub API
 */
function formatDateForGitHub(date: Date | undefined): string | undefined {
    return date ? `"${date.toISOString()}"` : undefined;
}

export interface GitHubCommit {
    sha: string;
    commit: {
        author: {
            name: string;
            email: string;
            date: string;
        };
        message: string;
    };
    author: GitHubUser | null;
}

export interface GitHubLabel {
    name: string;
    color: string;
}

export interface GitHubUser {
    login: string;
    avatar_url: string;
}

export interface GitHubUserDetails {
    avatar_url: string;
    bio: string;
    blog: string;
    company: string;
    created_at: string;
    email: string;
    events_url: string;
    followers: number;
    followers_url: string;
    following: number;
    following_url: string;
    gists_url: string;
    gravatar_id: string;
    hireable: boolean | null;
    html_url: string;
    id: number;
    location: string;
    login: string;
    name: string;
    node_id: string;
    notification_email: string;
    organizations_url: string;
    public_gists: number;
    public_repos: number;
    received_events_url: string;
    repos_url: string;
    site_admin: boolean;
    starred_url: string;
    subscriptions_url: string;
    twitter_username: string;
    type: string;
    updated_at: string;
    url: string;
    user_view_type: string;
}

export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    state: string;
    created_at: string;
    updated_at: string;
    body: string;
    user: GitHubUser;
    comments: number;
    labels: GitHubLabel[];
    assignees?: Array<GitHubUser>;
    // Added by local state
    repo: RepoName;
}

export interface GitHubPullRequest {
    number: number;
    title: string;
    state: string;
    created_at: string;
    updated_at: string;
    body: string;
    user: GitHubUser;
    comments: number;
    merged_at: string | null;
}

export interface GitHubComment {
    id: number;
    body: string;
    user: GitHubUser;
    created_at: string;
    updated_at: string;
}

export interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    updated_at: string;
    owner?: {
        avatar_url?: string;
        login?: string;
    };
    permissions?: {
        admin?: boolean;
        maintain?: boolean;
        push?: boolean;
        triage?: boolean;
        pull?: boolean;
    };
}

/**
 * Fetches the most recent commits from a repository since a specified date
 */
export async function fetchRecentCommits(
    owner: string,
    repo: string,
    num = 10,
    since: Date = new Date(0),
): Promise<GitHubCommit[]> {
    try {
        const url = createGitHubApiUrl(`/repos/${owner}/${repo}/commits`, {
            since: formatDateForGitHub(since),
            per_page: num.toString(),
        });

        return await cacheFetch(url);
    } catch (error) {
        console.error("Error fetching recent commits:", error);
        return [];
    }
}

/**
 * Fetches the most recent pull requests from a repository since a specified date
 */
export async function fetchRecentPullRequests(
    owner: string,
    repo: string,
    num = 10,
    since: Date = new Date(0),
): Promise<GitHubPullRequest[]> {
    try {
        const url = createGitHubApiUrl(`/repos/${owner}/${repo}/pulls`, {
            since: formatDateForGitHub(since),
            per_page: num.toString(),
            state: "all",
        });

        return await cacheFetch<GitHubPullRequest[]>(url);
    } catch (error) {
        console.error("Error fetching recent pull requests:", error);
        return [];
    }
}

/**
 * Fetches details and all comments for a specific issue
 */
export async function fetchIssueDetails(
    owner: string,
    repo: string,
    issueNumber: number,
): Promise<{
    issue: GitHubIssue | null;
    comments: GitHubComment[];
}> {
    try {
        // Fetch issue details
        const issueUrl = createGitHubApiUrl(`/repos/${owner}/${repo}/issues/${issueNumber}`);
        const issue = await cacheFetch<GitHubIssue>(issueUrl);

        // Fetch comments on the issue
        const commentsUrl = createGitHubApiUrl(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
        const comments = await cacheFetch<GitHubComment[]>(commentsUrl);

        return {
            issue,
            comments,
        };
    } catch (error) {
        console.error("Error fetching issue details:", error);
        return {
            issue: null,
            comments: [],
        };
    }
}

/**
 * Fetches details and all comments for a specific pull request
 */
export async function fetchPullRequestDetails(
    owner: string,
    repo: string,
    prNumber: number,
): Promise<{
    pullRequest: GitHubPullRequest | null;
    comments: GitHubComment[];
    reviewComments: GitHubComment[];
}> {
    try {
        // Fetch PR details
        const prUrl = createGitHubApiUrl(`/repos/${owner}/${repo}/pulls/${prNumber}`);
        const pullRequest = await cacheFetch<GitHubPullRequest>(prUrl);

        // Fetch issue comments (PRs share the issues comment system)
        const commentsUrl = createGitHubApiUrl(`/repos/${owner}/${repo}/issues/${prNumber}/comments`);
        const comments = await cacheFetch<GitHubComment[]>(commentsUrl);

        // Fetch PR review comments (specific to PRs, on code lines)
        const reviewCommentsUrl = createGitHubApiUrl(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`);
        const reviewComments = await cacheFetch<GitHubComment[]>(reviewCommentsUrl);

        return {
            pullRequest,
            comments,
            reviewComments,
        };
    } catch (error) {
        console.error("Error fetching pull request details:", error);
        return {
            pullRequest: null,
            comments: [],
            reviewComments: [],
        };
    }
}

/**
 * Clears the GitHub API cache
 */
// export async function clearGitHubCache(): Promise<boolean> {
//     if (!CACHE_ENABLED || !CACHE_DIR) {
//         return false;
//     }

//     try {
//         if (await fs.exists(CACHE_DIR)) {
//             // Get all files in the cache directory
//             const files = await fs.readDir(CACHE_DIR);

//             // Delete each JSON file
//             for (const file of files) {
//                 if (file.name.endsWith('.json')) {
//                     await fs.unlink(`${CACHE_DIR}/${file.name}`);
//                 }
//             }
//             console.log('GitHub cache cleared successfully');
//             return true;
//         }
//         return false;
//     } catch (error) {
//         console.error('Error clearing GitHub cache:', error);
//         return false;
//     }
// }

// Fetch repositories from GitHub API
export async function fetchRepositories(skipCache?: boolean) {
    try {
        const accessToken = await when(githubAccessToken$);

        const reposUrl = createGitHubApiUrl("/user/repos", {
            sort: "updated",
            per_page: "100",
        });

        console.log({ accessToken });

        return cacheFetch<GitHubRepository[]>(
            reposUrl,
            {
                authToken: accessToken,
            },
            skipCache,
        );
    } catch (error) {
        console.error("Failed to fetch repositories:", error);
        // auth$.reposError.set(error instanceof Error ? error.message : 'Failed to fetch repositories');
    } finally {
        // auth$.reposLoading.set(false);
    }
}
