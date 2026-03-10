import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import { readFileAsync } from "ags/file";
import { ROOT } from "@const/root";
import { CommandPromise } from "@interface/command-promise";
import { createCommandProcess } from "@util/cli";
import { CommandTerminationError } from "@interface/command-termination-error";
import styles from "./bible.launcher-handler.style";

interface Verse {
	type: "verse";
	content: string;
	reference: string;
	version: string;
}

interface Chapter {
	type: "chapter";
	verses: {
		content: string;
		reference: string;
	}[];
	version: string;
	reference: string;
	audioBibleUrl: string;
	copyright: string;
}

export class BibleLauncherHandler extends LauncherHandler {
	private request: CommandPromise<string> | null = null;
	private data: Chapter | Verse | null = null;

	constructor(setQuery: (query: string) => void) {
		super("Bible", setQuery, false);

		readFileAsync(`${ROOT}/node_modules/bible-query/package.json`)
			.then((contents) => {
				try {
					const json = JSON.parse(contents);
					const version = json.version;
					console.log(`Using bible-query v${version}`);
					this.setEnabled(true);
				} catch (e) {
					console.error("Failed to enable Bible module", e);
				}
			})
			.catch(() => {
				console.log(
					"Bible support is disabled. Install 'bible-query' npm package.",
				);
			});
	}

	public update(query: string): void {
		if (this.data) {
			this.data = null;
			this.triggerUpdate(query);
		}
		if (!query) {
			return;
		}

		if (this.request) {
			this.request.kill();
		}

		const command = createCommandProcess([
			"npx",
			"bible-query",
			"verse",
			"-j",
			...query.split(" "),
		]);

		command
			.then((response) => {
				if (this.request != command) {
					return;
				}
				try {
					const verse = JSON.parse(response) as Verse | Chapter;
					this.data = verse;
					this.triggerUpdate(query);
				} catch (e) {
					console.error("bible parse error", e);
				}
			})
			.catch((e) => {
				if (e instanceof CommandTerminationError) {
					return;
				}
				console.error("Bible query:", e);
			})
			.finally(() => {
				if (this.request == command) {
					this.request = null;
				}
			});

		this.request = command;
	}
	public getContent(
		_entryId: string,
		_window: Astal.Window,
	): GObject.Object | null {
		if (!this.data) {
			return null;
		}
		if (this.data.type == "verse") {
			return (
				<box orientation={Gtk.Orientation.VERTICAL} hexpand>
					<label cssClasses={[styles.content]} wrap label={this.data.content} />
				</box>
			);
		} else {
			return (
				<box orientation={Gtk.Orientation.VERTICAL} hexpand>
					<label
						cssClasses={[styles.content]}
						wrap
						label={this.data.verses
							.map((v, i) => `(${i + 1}) ${v.content}`)
							.join(" ")}
					/>
				</box>
			);
		}
	}
	public getEntries(): LauncherEntry[] {
		if (!this.data) {
			return [];
		}
		return [
			{
				id: "bible",
				icon: null,
				name: this.data.reference,
			},
		];
	}
	public getIcon(): string {
		return "emoji-body-symbolic";
	}
}
