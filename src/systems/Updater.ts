import { AutoUpdaterModule } from "@/native-modules/AutoUpdater";

const DAY_IN_SECONDS = 24 * 60 * 60;

export function initializeUpdater() {
    if (__DEV__) {
        return;
    }

    const configure = async () => {
        try {
            await AutoUpdaterModule.setAutomaticallyChecksForUpdates(true);
            await AutoUpdaterModule.setUpdateCheckInterval(DAY_IN_SECONDS);
            await AutoUpdaterModule.checkForUpdatesInBackground();
        } catch (error) {
            console.error("Failed to initialize auto-updater:", error);
        }
    };

    void configure();
}
