import { CACHE_DIRECTORY } from "@const/cache-directory";
import { CLASS } from "@const/class";
import { IS_DEV } from "@const/is-dev";
import { ROOT } from "@const/root";
import AppRequest from "@service/app-request";
import { generateStyles, generateStylesSync } from "@util/app";
import { createCommandProcess } from "@util/cli";
import Config from "@util/config";
import { makeDirectoryRecursiveSync } from "@util/file";
import { createDebouncer } from "@util/time";
import { monitorFile } from "ags/file";
import app from "ags/gtk4/app";
import { exec } from "ags/process";
import Gio from "gi://Gio";
import { GreeterWindow } from "greeter/greeter.window";

const reloadStyles = createDebouncer(() => {
	app.reset_css();
	app.apply_css(`${CACHE_DIRECTORY}/style.css`);
	console.log("Reloaded CSS.");
}, 100);

const WALLUST_FILE = Config.getString("theme.wallustThemeFile");

app.start({
	css: `${CACHE_DIRECTORY}/style.css`,
	instanceName: `${CLASS}_greeter`,
	iconTheme: "Papirus",
	cursorTheme: Config.getString("greeter.cursorTheme"),
	main: () => {
		makeDirectoryRecursiveSync(Gio.File.new_for_path(CACHE_DIRECTORY));
		generateStylesSync(IS_DEV);

		const wlrCommand = ["wlr-randr"];

		const monitorSection = Config.getSection("greeter.monitors");
		const monitorIds = monitorSection.getKeys();
		for (const monitorId of monitorIds) {
			const info = monitorSection.getAsTemplate(
				monitorId,
				{
					enabled: "boolean",
					scale: "number",
				},
				true,
			);

			const flags = ["--output", monitorId];
			if (info.enabled !== undefined) {
				if (info.enabled) {
					flags.push("--on");
				} else {
					flags.push("--off");
				}
			}
			if (info.scale !== undefined) {
				flags.push("--scale", info.scale.toString());
			}

			if (flags.length > 2) {
				// some settings were actually specified
				wlrCommand.push(...flags);
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
