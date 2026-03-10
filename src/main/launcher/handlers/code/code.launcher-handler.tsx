import { CACHE_DIRECTORY } from "@const/cache-directory";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import { doesCommandExist } from "@util/cli";
import { HOME } from "@const/home";
import {
	getFileInfo,
	getFileType,
	scanDirectory,
	writeFileOrSymlink,
} from "@util/file";
import Gio from "gi://Gio?version=2.0";
import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { bulkGetIcons, getIcons } from "@util/file-icon";
import Pango from "gi://Pango?version=1.0";
import { readFileAsync } from "ags/file";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import styles from "./code.launcher-handler.style";
import { compareString } from "@util/string";

const CACHE_LOCATION = `${CACHE_DIRECTORY}/code-recent.txt`;
const PREFIX = "code";

const COMMAND = "codium";

interface CachedLocation {
	path: string;
	frequency: number;
	icon: string | null;
}

interface FileEntry {
	path: string;
	name: string;
	icon: string | null;
}

type FileLocation = {
	path: string;
	icon: string | null;
} & (
	| {
			type: Exclude<Gio.FileType, Gio.FileType.DIRECTORY>;
	  }
	| {
			type: Gio.FileType.DIRECTORY;
			contents: DirectoryLocationChild[];
	  }
);

type DirectoryLocationChild = {
	file: Gio.FileInfo;
	icon: string | null;
};

export class CodeLauncherHandler extends LauncherHandler {
	private currentPromise: Promise<any> | null = null;
	private locationInfo: FileLocation | null | "frequents" = null;
	private readonly cache: CachedLocation[] = [];

	constructor(setQuery: (query: string) => void) {
		super("Code", setQuery, false);
		this.reloadCacheLocations();

		doesCommandExist(COMMAND, "--version")
			.then((enabled) => this.setEnabled(enabled))
			.catch(console.error);
	}

	private clear(query: string, showFrequents?: boolean) {
		if (showFrequents) {
			this.locationInfo = "frequents";
		} else {
			this.locationInfo = null;
		}
		this.triggerUpdate(query);
	}

	public update(query: string): void {
		const originalQuery = query;
		if (!query.toLowerCase().startsWith(PREFIX)) {
			return this.clear(originalQuery);
		}
		if (query.length - PREFIX.length < 2) {
			return this.clear(originalQuery, true);
		}
		query = query.substring(PREFIX.length + 1);

		if (query.startsWith("~")) {
			query = HOME + query.substring(1);
		} else if (!query.startsWith("/")) {
			query = `${HOME}/${query}`;
		}

		const file = Gio.File.new_for_path(query);

		this.setLoading(true);
		const promise = getFileInfo(file)
			.then(async (info) => {
				if (this.currentPromise != promise) {
					return;
				}
				const type = info.get_file_type();

				if (type == Gio.FileType.DIRECTORY) {
					console.log("Is directory");
					try {
						const contents = await scanDirectory(file);
						if (this.currentPromise != promise) {
							return;
						}

						contents.sort((a, b) => compareString(a.get_name(), b.get_name()));

						const path = file.get_path()!;
						const icons = (
							await bulkGetIcons(
								contents.map((file) => `${path}/${file.get_name()}`),
							)
						).map((icons) => icons?.[0] || null);

						this.locationInfo = {
							path: file.get_path()!,
							type,
							contents: contents.map((file, index) => ({
								file,
								icon: icons[index],
							})),
							icon: null,
						};
						this.setLoading(false);
						this.triggerUpdate(originalQuery);
					} catch {
						if (this.currentPromise == promise) {
							this.setLoading(false);
							this.currentPromise = null;
						}
					}
				} else {
					const path = file.get_path()!;
					this.locationInfo = {
						path: path,
						type,
						icon: (await getIcons(path))[0] || null,
					};
					this.setLoading(false);
					this.triggerUpdate(originalQuery);
				}
			})
			.catch(() => {
				if (this.currentPromise == promise) {
					this.setLoading(false);
					this.currentPromise = null;
				}
			});

		this.currentPromise = promise;
	}

	private clickEntry(path: string, window: Astal.Window) {
		getFileType(Gio.File.new_for_path(path)).then((type) => {
			if (type == Gio.FileType.DIRECTORY) {
				this.setQuery(`${PREFIX} ${path}`);
			} else {
				this.open(path, window);
			}
		});
	}

	public getContent(_: string, window: Astal.Window): GObject.Object | null {
		if (!this.locationInfo) {
			return null;
		}

		const entries: FileEntry[] = [];

		if (this.locationInfo == "frequents") {
			entries.push(
				...this.getSortedCache().map((entry) => ({
					path: entry.path,
					name: entry.path,
					icon: entry.icon,
				})),
			);
		} else {
			let parentPath = this.locationInfo.path;
			if (parentPath && !parentPath.endsWith("/")) {
				parentPath += "/";
			}

			if (this.locationInfo.type == Gio.FileType.DIRECTORY) {
				entries.push(
					...this.locationInfo.contents.map((contents) => ({
						path: parentPath + contents.file.get_name(),
						name: contents.file.get_name(),
						icon: contents.icon,
					})),
				);
			} else {
				// todo: custom page for standalone files
				return (
					<box>
						<label label="File!" />
					</box>
				);
			}
		}

		return (
			<box orientation={Gtk.Orientation.VERTICAL} cssClasses={["code"]}>
				{entries.map((entry) => (
					<button
						onClicked={() => this.clickEntry(entry.path, window)}
						hexpand
						cssClasses={[styles.entry]}
					>
						<box>
							{!!entry.icon && <image iconName={entry.icon} pixelSize={16} />}
							<label
								ellipsize={Pango.EllipsizeMode.MIDDLE}
								label={entry.name}
							/>
						</box>
					</button>
				))}
			</box>
		);
	}

	public getEntries(): LauncherEntry[] {
		if (this.locationInfo == "frequents") {
			return [
				{
					id: "code",
					icon: "vscodium",
					name: "Open file or directory",
				},
			];
		}
		if (!this.locationInfo) {
			return [];
		}

		return [
			{
				id: "code",
				icon: "vscodium",
				name: this.locationInfo.path,
			},
		];
	}

	public onEnter(_: string, window: Astal.Window): void {
		if (this.locationInfo && this.locationInfo != "frequents") {
			this.open(this.locationInfo.path, window);
		}
	}

	private async reloadCacheLocations() {
		let contents: string;
		try {
			contents = await readFileAsync(CACHE_LOCATION);
		} catch (e) {
			console.error(e);
			try {
				contents = "";
				await writeFileOrSymlink(CACHE_LOCATION, "\n");
			} catch (e) {
				console.error("Failed to create file");
				return;
			}
		}
		const lines = contents
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);

		const validEntries: [string, number][] = [];
		for (let line of lines) {
			const split = line.split(" ");
			if (split.length < 2) {
				continue;
			}
			const frequency = parseInt(split[0]);
			if (isNaN(frequency) || frequency <= 0) {
				continue;
			}

			const path = line.substring(frequency.toString().length + 1);

			validEntries.push([path, frequency]);
		}

		const icons = (
			await bulkGetIcons(validEntries.map((entry) => entry[0]))
		).map((icons) => icons?.[0] || null);

		const locations: CachedLocation[] = validEntries.map(
			([path, frequency], index) => ({
				path,
				frequency,
				icon: icons[index],
			}),
		);

		this.cache.splice(0, this.cache.length, ...locations);
	}

	private getSortedCache() {
		return [...this.cache].sort((a, b) => b.frequency - a.frequency);
	}

	private async open(path: string, window: Astal.Window) {
		window.visible = false;

		const hyprland = AstalHyprland.get_default();
		hyprland.message(`dispatch exec ${COMMAND} "${path}"`);

		try {
			const icons = await getIcons(path);
			let entry = this.cache.find((e) => e.path == path);
			if (entry) {
				entry.frequency++;
				entry.icon = icons?.[0] || null;
				const index = this.cache.indexOf(entry);
				this.cache.splice(index, 1);
			} else {
				entry = {
					frequency: 1,
					path,
					icon: icons?.[0] || null,
				};
			}
			this.cache.unshift(entry);
			while (this.cache.length > 20) {
				this.cache.pop();
			}

			const contents =
				this.cache.map((e) => `${e.frequency} ${e.path}`).join("\n") + "\n";

			await writeFileOrSymlink(CACHE_LOCATION, contents);
		} catch (e) {
			console.error("Failed to update code cache", e);
		}
	}

	public getIcon(): string {
		return "vscodium-symbolic";
	}
}
