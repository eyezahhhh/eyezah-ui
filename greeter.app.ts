import { CACHE_DIRECTORY } from "@const/cache-directory";
import { CLASS } from "@const/class";
import { DISABLED_MONITOR_IDS } from "@const/disabled-monitor-ids";
import { ENABLED_MONITOR_IDS } from "@const/enabled-monitor-ids";
import { IS_DEV } from "@const/is-dev";
import { MONITOR_SCALE } from "@const/monitor-scale";
import { ROOT } from "@const/root";
import { WALLUST_FILE } from "@const/wallust-file";
import AppRequest from "@service/app-request";
import { generateStyles, generateStylesSync } from "@util/app";
import { createCommandProcess } from "@util/cli";
import { makeDirectoryRecursiveSync } from "@util/file";
import { createDebouncer } from "@util/time";
import { monitorFile } from "ags/file";
import app from "ags/gtk4/app";
import { exec } from "ags/process";
import { CURSOR_THEME_ID } from "constants/cursor-theme-id";
import Gio from "gi://Gio";
import { GreeterWindow } from "greeter/greeter.window";

const reloadStyles = createDebouncer(() => {
	app.reset_css();
	app.apply_css(`${CACHE_DIRECTORY}/style.css`);
	console.log("Reloaded CSS.");
}, 100);

app.start({
	css: `${CACHE_DIRECTORY}/style.css`,
	instanceName: `${CLASS}_greeter`,
	iconTheme: "Papirus",
	cursorTheme: CURSOR_THEME_ID || undefined,
	main: () => {
		makeDirectoryRecursiveSync(Gio.File.new_for_path(CACHE_DIRECTORY));
		generateStylesSync(IS_DEV);

		const wlrCommand = ["wlr-randr"];
		if (DISABLED_MONITOR_IDS) {
			for (const id of DISABLED_MONITOR_IDS) {
				wlrCommand.push("--output", id, "--off");
			}
		}
		if (ENABLED_MONITOR_IDS) {
			for (const id of ENABLED_MONITOR_IDS) {
				wlrCommand.push("--output", id, "--on");
				if (MONITOR_SCALE) {
					wlrCommand.push("--scale", MONITOR_SCALE.toString());
				}
			}
		}

		if (wlrCommand.length > 1) {
			exec(wlrCommand);
		}

		const monitors = app.get_monitors();
		GreeterWindow(monitors[monitors.length - 1]);

		monitorFile(`${CACHE_DIRECTORY}/style.css`, () => reloadStyles());
		monitorFile(WALLUST_FILE, () => {
			console.log(`Wallust file changed (${WALLUST_FILE})`);
			generateStyles().catch(console.error);
		});

		if (IS_DEV) {
			console.log("Launched in DEV mode, watching .scss files");
			createCommandProcess(
				[
					"node",
					`${ROOT}/script/generate-styles.js`,
					"--output-file",
					`${CACHE_DIRECTORY}/style.css`,
					"--wallust-file",
					WALLUST_FILE,
					"--wallust-cache-file",
					`${CACHE_DIRECTORY}/wallust.scss`,
					"--root",
					ROOT,
					"--watch",
				],
				{
					onStdout: (stdout) => {
						console.log("[SCSS MONITOR]:", stdout);
					},
					onStderr: (stderr) => {
						console.error("[SCSS MONITOR]:", stderr);
					},
				},
			);
		}
	},
	requestHandler: (...options) => AppRequest.get_default().invoke(...options),
});
