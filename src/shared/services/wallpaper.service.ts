import { HOME } from "@const/home";
import { WALLPAPER_DIRECTORY } from "@const/wallpaper-directory";
import { CommandPromise } from "@interface/command-promise";
import { CommandTerminationError } from "@interface/command-termination-error";
import { createCommandProcess } from "@util/cli";
import { scanDirectory } from "@util/file";
import app from "ags/gtk4/app";
import Gio from "gi://Gio?version=2.0";
import GObject, { getter, register } from "gnim/gobject";

const DEFAULT_THEME = "ashes-dark";
const MUTABLE_WALLPAPER_DIR = `${HOME}/nix/assets/wallpapers`;

export namespace Wallpaper {
	@register()
	export class WallpaperFile extends GObject.Object {
		private _dimensions: [number, number] | null = null;

		constructor(private readonly info: Gio.FileInfo) {
			super();
			this.name = info.get_name();
		}

		public readonly name: string;

		getFileInfo() {
			return this.info;
		}

		getPath() {
			return `${WALLPAPER_DIRECTORY}/${this.name}`;
		}

		getMutablePath() {
			return `${MUTABLE_WALLPAPER_DIR}/${this.name}`;
		}

		async getDimensions() {
			if (this._dimensions) {
				return [...this._dimensions] as [number, number];
			}

			const response = await createCommandProcess([
				"identify",
				"-format",
				"%w,%h",
				this.getPath(),
			]);
			const dimensions = response.split(",").map((n) => parseInt(n)) as [
				number,
				number,
			];
			if (dimensions.length != 2 || dimensions.find((d) => d <= 0)) {
				throw new Error(`Invalid dimensions ${dimensions.join(", ")}`);
			}

			this._dimensions = dimensions;
			return dimensions;
		}
	}

	@register()
	export class WallpaperService extends GObject.Object {
		private _files: WallpaperFile[] = [];
		private _wallpaperChangeInterval = 60 * 20;
		private wallpaperChangeTimeout: ReturnType<typeof setTimeout> | null = null;
		private _current: WallpaperFile | null = null;
		private minDimensions: [number, number] = [0, 0];
		private commandInstance: CommandPromise<any> | null = null;

		constructor() {
			super();

			this.loadWallpaperList()
				.then(() => this.setRandomWallpaper())
				.catch(console.error);
		}

		@getter(Object)
		public get files() {
			return this._files;
		}

		private async loadWallpaperList() {
			const files = await scanDirectory(
				Gio.File.new_for_path(WALLPAPER_DIRECTORY),
			);

			const paths = files.filter(
				(file) =>
					file.get_file_type() == Gio.FileType.REGULAR ||
					file.get_file_type() == Gio.FileType.SYMBOLIC_LINK,
			);

			paths.sort((a, b) => a.get_name().localeCompare(b.get_name()));

			const newFiles = [...this._files];
			const realNames: string[] = [];
			let changed = false;
			for (let path of paths) {
				const name = path.get_name();
				realNames.push(name);
				const existingFile = newFiles.find((file) => file.name == name);
				if (!existingFile) {
					newFiles.push(new WallpaperFile(path));
					changed = true;
				}
			}

			for (const file of newFiles) {
				if (!realNames.includes(file.name)) {
					const index = newFiles.indexOf(file);
					if (index >= 0) {
						newFiles.splice(index, 1);
						changed = true;
					}
				}
			}

			if (changed) {
				this._files = newFiles;
				this.notify("files");
			}
		}

		public getRandomWallpaper() {
			const wallpaper =
				this._files[Math.floor(Math.random() * this._files.length)];
			return wallpaper;
		}

		@getter(Number)
		get wallpaper_change_interval() {
			return this._wallpaperChangeInterval;
		}

		set wallpaper_change_interval(seconds: number) {
			if (seconds == this._wallpaperChangeInterval) {
				return;
			}
			this._wallpaperChangeInterval = seconds;
			this.notify("wallpaper_change_interval");
			this.createWallpaperChangeTimeout();
		}

		private createWallpaperChangeTimeout() {
			if (this.wallpaperChangeTimeout) {
				clearTimeout(this.wallpaperChangeTimeout);
				this.wallpaperChangeTimeout = null;
			}
			if (!this._wallpaperChangeInterval) {
				return;
			}
			this.wallpaperChangeTimeout = setTimeout(async () => {
				try {
					await this.setRandomWallpaper();
				} finally {
					this.createWallpaperChangeTimeout();
				}
			}, this._wallpaperChangeInterval * 1000);
		}

		public async setRandomWallpaper() {
			if (!this._files.length) {
				throw new Error("No wallpapers loaded");
			}

			if (this.wallpaperChangeTimeout) {
				clearTimeout(this.wallpaperChangeTimeout);
				this.wallpaperChangeTimeout = null;
			}
			while (true) {
				try {
					const wallpaper = this.getRandomWallpaper();
					const [width, height] = await wallpaper.getDimensions();
					const [minWidth, minHeight] = this.minDimensions;
					if (width < minWidth || height < minHeight) {
						console.log(
							`Rejected wallpaper "${wallpaper.getPath()}" because its resolution was too small.`,
						);
						continue;
					}
					this.current = wallpaper;
					break;
				} catch (e) {
					console.error(e);
				} finally {
					this.createWallpaperChangeTimeout();
				}
			}
		}

		public updateMonitorDimensions() {
			let maxWidth = 0;
			let maxHeight = 0;

			for (let monitor of app.get_monitors()) {
				const geometry = monitor.get_geometry();
				const scale = monitor.get_scale();

				const width = geometry.width * scale;
				const height = geometry.height * scale;

				maxWidth = Math.max(width, maxWidth);
				maxHeight = Math.max(height, maxHeight);
			}

			this.minDimensions = [maxWidth, maxHeight];
		}

		public resetMonitorDimensions() {
			this.minDimensions = [0, 0];
		}

		@getter(Boolean)
		get is_current_set() {
			return !!this._current;
		}

		@getter(WallpaperFile)
		get current() {
			if (!this._current) {
				throw new Error("Wallpaper is not set");
			}
			return this._current;
		}

		@getter(Boolean)
		get is_loading_colors() {
			return !!this.commandInstance;
		}

		set current(wallpaper: WallpaperFile) {
			if (this._current == wallpaper) {
				return;
			}

			const oldCurrent = this._current;
			this._current = wallpaper;
			this.notify("current");
			if (!oldCurrent) {
				this.notify("is_current_set");
			}

			this.commandInstance?.kill();

			console.log(`wallust run ${wallpaper.getPath()} --skip-sequences`);

			const promise = createCommandProcess([
				"wallust",
				"run",
				wallpaper.getPath(),
				"--skip-sequences",
			]);
			this.commandInstance = promise;
			this.notify("is_loading_colors");

			promise
				.then(() => {
					if (this.commandInstance == promise) {
						this.commandInstance = null;
						this.notify("is_loading_colors");
					}
				})
				.catch((e) => {
					if (e instanceof CommandTerminationError) {
						return;
					}
					console.error(
						`Failed to generate wallust palette for file "${wallpaper.getPath()}", using fallback theme.`,
					);
					const promise = createCommandProcess([
						"wallust",
						"theme",
						DEFAULT_THEME,
						"--skip-sequences",
					]);
					this.commandInstance = promise;
					promise.finally(() => {
						if (this.commandInstance == promise) {
							this.commandInstance = null;
							this.notify("is_loading_colors");
						}
					});
				});
		}
	}

	let instance: WallpaperService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new WallpaperService();
		}
		return instance;
	}
}

export default Wallpaper;
