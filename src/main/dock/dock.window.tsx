import { CLASS } from "@const/class";
import { HOME } from "@const/home";
import { createCursorPointer } from "@util/ags";
import Config from "@util/config";
import { Destroyer } from "@util/destroyer";
import { parseDesktopFile, scanDirectory } from "@util/file";
import { bulkGetIcons } from "@util/file-icon";
import { readFileAsync } from "ags/file";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import Gio from "gi://Gio?version=2.0";
import { createState, For, onCleanup } from "gnim";
import styles from "./dock.window.style";
import { compareString } from "@util/string";

interface Props {
	gdkMonitor: Gdk.Monitor;
}

const DOCK_DIRECTORY = Config.get("dock.directory", true) || `${HOME}/Desktop`;

type DockEntry = {
	file: Gio.FileInfo;
	icon: string;
	displayName: string;
	onClick: () => void;
} & (
	| {
			type: "desktop";
	  }
	| {}
);

export function DockWindow({ gdkMonitor }: Props) {
	const { BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor;
	const [entries, setEntries] = createState<DockEntry[]>([]);
	const hyprland = AstalHyprland.get_default();
	const [visible, setVisible] = createState(false);

	const destroyer = new Destroyer();

	let hyprlandDestroyer: Destroyer | null;
	const connectHyprlandWorkspace = () => {
		hyprlandDestroyer?.destroy();
		hyprlandDestroyer = new Destroyer();

		const workspace = hyprland.focusedWorkspace;

		const clientsChange = () => {
			setVisible(!workspace.clients.length);
		};

		hyprlandDestroyer.addDisconnect(
			workspace,
			workspace.connect("notify::clients", clientsChange),
		);
		clientsChange();
	};

	destroyer.add(() => hyprlandDestroyer?.destroy());
	destroyer.addDisconnect(
		hyprland,
		hyprland.connect("notify::focused-workspace", connectHyprlandWorkspace),
	);
	connectHyprlandWorkspace();

	const scanDesktop = () => {
		const directory = Gio.File.new_for_path(DOCK_DIRECTORY);

		scanDirectory(directory)
			.then(async (files) => {
				const entries: DockEntry[] = [];

				const iconLookups: [string, number][] = [];

				for (const file of files) {
					const path = `${DOCK_DIRECTORY}/${file.get_name()}`;
					try {
						let extension: string | null = null;
						const dotParts = file.get_name().split(".");
						if (dotParts.length > 1) {
							extension = dotParts[dotParts.length - 1].toLowerCase();
						}

						if (extension == "desktop") {
							const contents = await readFileAsync(path);
							const data = parseDesktopFile(contents);

							if (!("Icon" in data && "Exec" in data)) {
								throw new Error(".desktop file missing critical components");
							}

							entries.push({
								file,
								displayName: file.get_name(),
								icon: data.Icon || "gtk-file",
								type: "desktop",
								onClick: () => {
									const executable = data.Exec.split("");
									for (let i = executable.length - 2; i >= 0; i--) {
										// remove cli variables like urls
										if (executable[i] == "%") {
											executable.splice(i, 2);
										}
									}

									const hyprland = AstalHyprland.get_default();
									hyprland.message(
										`dispatch exec ${executable.join("").trim()}`,
									);
								},
							});

							continue;
						}
					} catch (e) {
						console.error(`Failed to handle dock file ${file.get_name()}:`, e);
					}

					entries.push({
						file,
						displayName: file.get_name(),
						icon: "gtk-file",
						onClick: () => {
							const child = directory.get_child(file.get_name());
							Gio.AppInfo.launch_default_for_uri(child.get_uri(), null);
						},
					});
					iconLookups.push([path, entries.length - 1]);
				}

				const icons = await bulkGetIcons(iconLookups.map((entry) => entry[0]));
				for (let i = 0; i < iconLookups.length; i++) {
					const icon = icons[i];
					if (icon?.length) {
						const entryIndex = iconLookups[i][1];
						entries[entryIndex].icon = icon[0];
					}
				}

				entries.sort((a, b) =>
					compareString(
						a.displayName.toLowerCase(),
						b.displayName.toLowerCase(),
					),
				);

				setEntries(entries);
			})
			.catch((e) => {
				console.error(`Failed to scan desktop:`, e);
			});
	};

	scanDesktop();

	onCleanup(() => {
		destroyer.destroy();
	});

	return (
		<window
			visible={visible}
			name="dock"
			namespace={`${CLASS}_dock`}
			gdkmonitor={gdkMonitor}
			anchor={BOTTOM}
			application={app}
			class={CLASS}
			layer={Astal.Layer.BOTTOM}
			cssClasses={[styles.window]}
			marginBottom={10}
		>
			<box cssClasses={[styles.container]}>
				<For each={entries}>
					{(entry) => (
						<button
							cursor={createCursorPointer()}
							onClicked={entry.onClick}
							cssClasses={[styles.entryButton]}
						>
							<box orientation={Gtk.Orientation.VERTICAL}>
								<image
									iconName={entry.icon}
									iconSize={Gtk.IconSize.LARGE}
									pixelSize={48}
								/>
								{/* <label label={entry.displayName} /> */}
							</box>
						</button>
					)}
				</For>
			</box>
		</window>
	) as Gtk.Window;
}
