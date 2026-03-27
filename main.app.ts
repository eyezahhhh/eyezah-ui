import app from "ags/gtk4/app";
import { monitorFile } from "ags/file";
import { createDebouncer } from "@util/time";
import { BarWindow } from "./src/main/bar/bar.window";
import { MenuWindow } from "./src/main/menu/menu.window";
import WireGuard from "@service/wireguard";
import { LauncherWindow } from "./src/main/launcher/launcher.window";
import { CLASS } from "@const/class";
import { ROOT } from "@const/root";
import { Gdk, Gtk } from "ags/gtk4";
import { WallpaperWindow } from "@window/wallpaper/wallpaper";
import { SliderWindow } from "@window/slider/slider";
import { createBinding } from "gnim";
import { IS_DEV } from "@const/is-dev";
import { CACHE_DIRECTORY } from "@const/cache-directory";
import { generateStyles, generateStylesSync, watchStyles } from "@util/app";
import { makeDirectoryRecursiveSync } from "@util/file";
import Gio from "gi://Gio?version=2.0";
import { WorkspacesWindow } from "main/workspaces/workspaces.window";
import AppRequest from "@service/app-request";
import { StatsWindow } from "main/stats/stats.window";
import Config from "@util/config";
import { DockWindow } from "main/dock/dock.window";

const WALLUST_FILE = Config.getString("theme.wallustThemeFile");

console.log(`ROOT:`, ROOT);

const reloadStyles = createDebouncer(() => {
	app.reset_css();
	app.apply_css(`${CACHE_DIRECTORY}/style.css`);
	console.log("Reloaded CSS.");
}, 100);

app.start({
	css: `${CACHE_DIRECTORY}/style.css`,
	instanceName: `${CLASS}_main`,
	iconTheme: "Papirus",
	main: () => {
		makeDirectoryRecursiveSync(Gio.File.new_for_path(CACHE_DIRECTORY));
		generateStylesSync(IS_DEV);

		const monitorWindows = new Map<Gdk.Monitor, Gtk.Window[]>();

		const activateMonitors = () => {
			const monitors = app.get_monitors();
			console.log("Monitors list changed!", monitors.length);
			for (const monitor of monitors) {
				if (monitorWindows.has(monitor)) {
					continue;
				}
				const windows: Gtk.Window[] = [
					BarWindow(monitor),
					WallpaperWindow(monitor),
					StatsWindow({ gdkMonitor: monitor }),
					DockWindow({ gdkMonitor: monitor }),
				];
				monitorWindows.set(monitor, windows);
			}

			setTimeout(() => {
				for (const [monitor, windows] of monitorWindows.entries()) {
					if (!monitors.includes(monitor)) {
						console.log("MONITOR REMOVED!");
						for (const window of windows) {
							window.destroy();
						}
						// monitorWindows.delete(monitor); // TODO: fix
					}
				}
			}, 1_000);
		};

		createBinding(app, "monitors").subscribe(activateMonitors);
		activateMonitors();

		MenuWindow();
		LauncherWindow();
		SliderWindow();
		WorkspacesWindow();

		monitorFile(`${CACHE_DIRECTORY}/style.css`, () => reloadStyles());
		monitorFile(WALLUST_FILE, () => {
			console.log(`Wallust file changed (${WALLUST_FILE})`);
			generateStyles().catch(console.error);
		});

		WireGuard.get_default(); // load WireGuard before it's visually needed

		if (IS_DEV) {
			console.log("Launched in DEV mode, watching .scss files");
			watchStyles({
				onStdout: (stdout) => {
					console.log("[SCSS MONITOR]:", stdout);
				},
				onStderr: (stderr) => {
					console.error("[SCSS MONITOR]:", stderr);
				},
			});
		}
	},
	requestHandler: (...options) => AppRequest.get_default().invoke(...options),
});
