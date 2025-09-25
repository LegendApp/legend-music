import { use$, useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";

type VisibilityState = 'hidden' | 'subtle' | 'moderate' | 'prominent';

export function Unregistered() {
    const isRegistered = use$(settings$.registration.isRegistered);
    const startTime$ = useObservable(Date.now());
    const currentTime$ = useObservable(Date.now());
    
    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            currentTime$.set(Date.now());
        }, 60000);
        
        return () => clearInterval(interval);
    }, [currentTime$]);
    
    // Track visibility state based on time elapsed
    const getVisibilityState = (): VisibilityState => {
        const elapsed = currentTime$.get() - startTime$.get();
        const tenMinutes = 10 * 60 * 1000;
        const thirtyMinutes = 30 * 60 * 1000;
        const sixtyMinutes = 60 * 60 * 1000;
        
        if (elapsed < tenMinutes) return 'hidden';
        if (elapsed < thirtyMinutes) return 'subtle';
        if (elapsed < sixtyMinutes) return 'moderate';
        return 'prominent';
    };
    
    const visibilityState = getVisibilityState();
    
    // Don't show if registered or still in hidden period
    if (isRegistered || visibilityState === 'hidden') {
        return null;
    }
    
    const handleRegister = () => {
        // TODO: Implement registration flow
        console.log("Register button clicked");
    };
    
    const handleOpenLegendKit = () => {
        // TODO: Open Legend Kit page
        console.log("Legend Kit button clicked");
    };
    
    return (
        <View className={cn(
            "border-t border-white/10 bg-white/5 backdrop-blur-sm",
            visibilityState === 'subtle' && "opacity-70",
            visibilityState === 'moderate' && "opacity-90 bg-white/10",
            visibilityState === 'prominent' && "opacity-100 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/30"
        )}>
            <View className="px-4 py-3">
                {visibilityState === 'subtle' && (
                    <Text className="text-white/70 text-xs text-center">
                        Enjoying Legend Music? Consider supporting development
                    </Text>
                )}
                
                {visibilityState === 'moderate' && (
                    <View className="items-center">
                        <Text className="text-white/80 text-sm font-medium text-center mb-2">
                            Support Legend Music Development
                        </Text>
                        <Text className="text-white/60 text-xs text-center">
                            This app is free and open source. Your support helps us improve it.
                        </Text>
                    </View>
                )}
                
                {visibilityState === 'prominent' && (
                    <View className="items-center">
                        <Text className="text-white text-base font-semibold text-center mb-2">
                            🎵 Support Legend Music
                        </Text>
                        <Text className="text-white/80 text-sm text-center mb-3">
                            This app is free and open source. Help us build amazing music tools!
                        </Text>
                        <View className="flex-row space-x-3">
                            <Button
                                onClick={handleOpenLegendKit}
                                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-white font-medium text-sm">
                                    Get Legend Kit
                                </Text>
                            </Button>
                            <Button
                                onClick={handleRegister}
                                className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-white font-medium text-sm">
                                    Register ($9)
                                </Text>
                            </Button>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
