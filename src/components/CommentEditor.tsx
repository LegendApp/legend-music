import { useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { MarkdownEditor } from "@/components/MarkdownEditor";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { ShadowSubtle } from "@/utils/styles";

type CommentEditorProps = {
    issueId: number;
    onSubmit?: (comment: string) => void;
    className?: string;
};

export const CommentEditor = ({ issueId, onSubmit, className }: CommentEditorProps) => {
    // Create an observable for the comment draft
    const commentDraft$ = useObservable("");

    // Load the draft when the component mounts or issueId changes
    useEffect(() => {
        const savedDraft = settings$.get().commentDrafts?.[issueId.toString()] || "";
        commentDraft$.set(savedDraft);
    }, [issueId, commentDraft$]);

    // Save the draft whenever it changes
    const handleChange = (content: string) => {
        // Save to local state
        commentDraft$.set(content);

        // Save to persistent storage
        const currentDrafts = settings$.get().commentDrafts || {};
        settings$.set({
            ...settings$.get(),
            commentDrafts: {
                ...currentDrafts,
                [issueId.toString()]: content,
            },
        });
    };

    const handleSubmit = () => {
        const comment = commentDraft$.get();
        if (comment.trim() && onSubmit) {
            onSubmit(comment);

            // Clear the draft after submission
            commentDraft$.set("");

            // Remove from persistent storage
            const currentDrafts = settings$.get().commentDrafts || {};
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [issueId.toString()]: _removed, ...restDrafts } = currentDrafts;
            settings$.set({
                ...settings$.get(),
                commentDrafts: restDrafts,
            });
        }
    };

    return (
        <View className={cn("mt-4", className)}>
            <View
                className="border border-border-primary rounded-md overflow-hidden bg-background-secondary"
                style={ShadowSubtle}
            >
                <MarkdownEditor
                    value$={commentDraft$}
                    onChange={handleChange}
                    className="min-h-[120px] bg-background-secondary"
                />

                <View className="p-2 flex-row justify-end border-t border-border-primary">
                    <TouchableOpacity onPress={handleSubmit} className="bg-accent-primary py-2 px-4 rounded-md">
                        <Text className="font-medium text-white">Comment</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
