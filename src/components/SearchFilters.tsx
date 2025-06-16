import type { Observable } from "@legendapp/state";
import { View } from "react-native";

import { StyledInput } from "@/components/StyledInput";
import { cn } from "@/utils/cn";

export interface SearchFiltersProps {
    searchQuery$: Observable<string>;
    containerClassName?: string;
    searchContainerClassName?: string;
}

export const SearchFilters = ({
    searchQuery$,
    containerClassName = "",
    searchContainerClassName = "",
}: SearchFiltersProps) => {
    return (
        <View className={cn(containerClassName)}>
            <View className={cn(searchContainerClassName)}>
                <StyledInput value$={searchQuery$} placeholder="Search issues" />
            </View>
        </View>
    );
};
