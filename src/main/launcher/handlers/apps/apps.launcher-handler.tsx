import { Astal, Gtk } from "ags/gtk4";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import AstalApps from "gi://AstalApps?version=0.1";
import { getValidIcon } from "@util/icon";
import GObject from "gnim/gobject";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import styles from "./apps.launcher-handler.style";

export class AppsLauncherHandler extends LauncherHandler {
	private apps: AstalApps.Application[] = [];
	private readonly applications = new AstalApps.Apps();

	constructor(setQuery: (query: string) => void) {
		super("Apps", setQuery, true);
	}

	public update(query: string): void {
		if (!query.trim()) {
			this.apps = [];
		} else {
			this.apps = this.applications.fuzzy_query(query);
		}
		this.apps = this.apps.slice(0, 4);
		this.triggerUpdate(query);
	}

	public getEntries(): LauncherEntry[] {
		return this.apps.map((app) => ({
			id: app.entry,
			name: app.name,
			icon: getValidIcon(app.iconName),
		}));
	}

	public getContent(
		entryId: string,
		window: Astal.Window,
	): GObject.Object | null {
		const app = this.apps.find((app) => app.entry == entryId);
		if (!app) {
			return null;
		}

		return (
			<box
				orientation={Gtk.Orientation.VERTICAL}
				cssClasses={[styles.container]}
				vexpand
				hexpand
				valign={Gtk.Align.CENTER}
			>
				{getValidIcon(app.iconName) && (
					<image iconName={app.iconName} pixelSize={64} />
				)}
				<label
					cssClasses={[styles.name]}
					wrap
					justify={Gtk.Justification.CENTER}
					label={app.name}
				/>
				{app.description ? (
					<label
						cssClasses={[styles.description]}
						wrap
						justify={Gtk.Justification.CENTER}
						maxWidthChars={1}
						wrapMode={Gtk.WrapMode.CHAR}
						label={app.description}
					/>
				) : null}
				<button
					halign={Gtk.Align.CENTER}
					cssClasses={[styles.launch]}
					onClicked={() => this.open(app, window)}
				>
					<label label="Launch" />
				</button>
			</box>
		);
	}

	public onEnter(name: string, window: Astal.Window) {
		const app = this.applications.list.find((app) => app.entry == name);

		if (app) {
			this.open(app, window);
		}
	}

	public open(app: AstalApps.Application, window: Astal.Window) {
		window.visible = false;

		const executable = app.executable.split("");
		for (let i = executable.length - 2; i >= 0; i--) {
			// remove cli variables like urls
			if (executable[i] == "%") {
				executable.splice(i, 2);
			}
		}

		const hyprland = AstalHyprland.get_default();
		hyprland.message(`dispatch exec ${executable.join("").trim()}`);
	}

	public onLauncherOpen() {
		this.applications.reload();
	}

	public getIcon(): string {
		return "start-here-symbolic";
	}
}
