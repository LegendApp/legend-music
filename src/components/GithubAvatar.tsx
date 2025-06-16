import { Image } from "react-native";

import type { GitHubUser } from "@/sync/github";
import { cn } from "@/utils/cn";

export interface GithubAvatarProps {
    user: GitHubUser;
    size: `size-${number}`;
    className?: string;
}

export function GithubAvatar({ user, size, className }: GithubAvatarProps) {
    return <Image source={{ uri: user.avatar_url }} className={cn("rounded-full", size, className)} />;
}
