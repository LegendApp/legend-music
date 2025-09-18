// import { AutoUpdaterModule } from '@/native-modules/AutoUpdater';
import { menuManager } from "@/native-modules/NativeMenuManager";
// import { settings$ } from '@/settings/SettingsFile';
import { state$, stateSaved$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function initializeMenuManager() {
    perfLog("MenuManager.initialize");
    menuManager.addListener("onMenuCommand", (e) => {
        perfCount("MenuManager.onMenuCommand");
        perfLog("MenuManager.onMenuCommand", e);
        console.log("onMenuCommand", e);
        switch (e.commandId) {
            case "settings":
                state$.showSettings.set(true);
                break;
            case "jump":
                console.log("jump");
                // state$.listeningForSearch.set(true);
                break;
            //   case 'checkForUpdates':
            //     AutoUpdaterModule.checkForUpdates();
            //     break;
            //   case 'showSidebar':
            //     settings$.state.isSidebarOpen.toggle();
            //     break;
            //   case 'showFilmstrip':
            //     settings$.state.showFilmstrip.toggle();
            //     break;
        }
    });
}
