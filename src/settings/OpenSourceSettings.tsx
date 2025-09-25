import { Text, View, ScrollView, Linking } from "react-native";
import { Button } from "@/components/Button";

interface Library {
    name: string;
    description: string;
    url: string;
}

const libraries: Library[] = [
    {
        name: "React Native macOS",
        description: "Native macOS app development framework",
        url: "https://github.com/microsoft/react-native-macos"
    },
    {
        name: "Legend State",
        description: "Fast and powerful state management",
        url: "https://github.com/LegendApp/legend-state"
    },
    {
        name: "Legend List",
        description: "High-performance virtualized list component",
        url: "https://github.com/LegendApp/legend-list"
    },
    {
        name: "Expo",
        description: "Platform for universal React applications",
        url: "https://github.com/expo/expo"
    },
    {
        name: "NativeWind",
        description: "Tailwind CSS for React Native",
        url: "https://github.com/nativewind/nativewind"
    },
    {
        name: "Tailwind CSS",
        description: "Utility-first CSS framework",
        url: "https://github.com/tailwindlabs/tailwindcss"
    },
    {
        name: "id3js",
        description: "JavaScript library for reading ID3 tags",
        url: "https://github.com/43081j/id3"
    },
    {
        name: "Gorhom Portal",
        description: "React Native portal implementation",
        url: "https://github.com/gorhom/react-native-portal"
    },
    {
        name: "Biome",
        description: "Fast formatter and linter for web projects",
        url: "https://github.com/biomejs/biome"
    }
];

export function OpenSourceSettings() {
    const handleOpenLink = (url: string) => {
        Linking.openURL(url);
    };

    const handleOpenLegendMusicSource = () => {
        // TODO: Add actual repository URL when available
        console.log("Open Legend Music repository");
    };

    return (
        <View className="flex-1 bg-background-primary">
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 32 }}>
                <View className="max-w-4xl mx-auto">
                    <Text className="text-3xl font-bold text-white mb-8">
                        Open Source
                    </Text>
                    
                    <View className="mb-10 p-6 bg-white/5 rounded-xl border border-white/10">
                        <Text className="text-xl font-semibold text-white mb-4">
                            Legend Music is Open Source
                        </Text>
                        <Text className="text-white/80 text-base leading-relaxed mb-6">
                            Legend Music is completely free and open source. You can view the source code, 
                            contribute to its development, and even create your own version. We believe in 
                            transparency and community-driven development.
                        </Text>
                        <Button 
                            onClick={handleOpenLegendMusicSource}
                            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg self-start shadow-lg"
                        >
                            <Text className="text-white font-semibold">
                                View Source Code
                            </Text>
                        </Button>
                    </View>

                <View className="mb-8 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-400/20">
                    <Text className="text-lg font-semibold text-white mb-2">
                        🚀 Legend Kit
                    </Text>
                    <Text className="text-white/80 text-sm leading-relaxed mb-3">
                        A comprehensive suite of tools built on Legend State/List/Motion with premium apps and development tools.
                    </Text>
                    <Button 
                        onClick={() => handleOpenLink("https://legendapp.com/kit")}
                        className="bg-blue-600/80 hover:bg-blue-600 px-3 py-1.5 rounded self-start"
                    >
                        <Text className="text-white font-medium text-sm">
                            Learn More
                        </Text>
                    </Button>
                </View>

                <View>
                    <Text className="text-xl font-semibold text-white mb-6">
                        Built With Amazing Open Source Libraries
                    </Text>
                    <Text className="text-white/80 text-base leading-relaxed mb-8">
                        Legend Music is built on top of these fantastic open source projects:
                    </Text>
                    
                    <View className="space-y-3 mb-10">
                        {libraries.map((library, index) => (
                            <View key={index} className="flex-row items-center justify-between p-5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                                <View className="flex-1 mr-6">
                                    <Text className="text-white font-semibold text-base mb-2">
                                        {library.name}
                                    </Text>
                                    <Text className="text-white/70 text-sm leading-relaxed">
                                        {library.description}
                                    </Text>
                                </View>
                                <Button 
                                    onClick={() => handleOpenLink(library.url)}
                                    className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/20 shadow-sm"
                                >
                                    <Text className="text-white/90 text-sm font-medium">
                                        GitHub
                                    </Text>
                                </Button>
                            </View>
                        ))}
                    </View>
                </View>

                <View className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <Text className="text-white/80 text-base leading-relaxed text-center">
                        We're grateful to all the maintainers and contributors of these projects. 
                        Open source software makes amazing applications like Legend Music possible.
                    </Text>
                </View>
                </View>
            </ScrollView>
        </View>
    );
}
