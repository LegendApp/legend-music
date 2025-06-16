import type { GitHubIssue, GitHubLabel } from "@/sync/github";
import { ax } from "@/utils/ax";

export function getGithubLabels(issue: GitHubIssue) {
    const issueLabels = issue.labels;
    const additionalLabels: GitHubLabel[] = ax([]);
    return [...(issueLabels || []), ...(additionalLabels || [])];
}

// && { name: 'pri:none', color: '555555' }
