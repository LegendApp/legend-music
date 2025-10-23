import { type RefObject, useCallback } from "react";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { TextInputSearch, type TextInputSearchRef } from "@/components/TextInputSearch";
import { libraryUI$ } from "@/systems/LibraryState";

interface MediaLibrarySearchBarProps {
    searchInputRef: RefObject<TextInputSearchRef>;
    query: string;
}

export function MediaLibrarySearchBar({ searchInputRef, query }: MediaLibrarySearchBarProps) {
    const handleClearSearch = useCallback(() => {
        libraryUI$.searchQuery.set("");
        searchInputRef.current?.focus();
    }, [searchInputRef]);

    return (
        <View className="px-3 pt-3 pb-2">
            <View className="relative">
                <View className="bg-background-tertiary border border-border-primary rounded-md px-3 py-1.5 pr-10">
                    <TextInputSearch
                        ref={searchInputRef}
                        value$={libraryUI$.searchQuery}
                        placeholder="Search library"
                        className="text-sm text-text-primary"
                    />
                </View>
                {query ? (
                    <View className="absolute inset-y-0 right-2 flex-row items-center">
                        <Button
                            icon="xmark.circle.fill"
                            variant="icon"
                            size="small"
                            accessibilityLabel="Clear search"
                            onClick={handleClearSearch}
                            className="bg-transparent hover:bg-white/10"
                        />
                    </View>
                ) : null}
            </View>
        </View>
    );
}
