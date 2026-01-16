export type YoutubeSearchResponse = {
    items?: YoutubeSearchItem[];
};

export type YoutubeSearchItem = {
    id?: {
        videoId?: string;
    };
    snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
            default?: { url?: string };
            medium?: { url?: string };
            high?: { url?: string };
            maxres?: { url?: string };
        };
    };
};

export type YoutubeVideoResponse = {
    items?: YoutubeVideoItem[];
};

export type YoutubeVideoItem = {
    id?: string;
    contentDetails?: {
        duration?: string;
    };
};
