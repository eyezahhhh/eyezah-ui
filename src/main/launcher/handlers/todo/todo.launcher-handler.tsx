import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import { HOME } from "@const/home";
import { monitorFile, readFileAsync, writeFileAsync } from "ags/file";
import { sendNotification } from "@util/notification";
import Pango from "gi://Pango?version=1.0";

const PATH = `${HOME}/Notes/todo.txt`;

export class TodoLauncherHandler extends LauncherHandler {
	private entries: string[] = [];
	private hasPrefix = false;
	private query = "";

	constructor(setQuery: (query: string) => void) {
		super("Todo List", setQuery, false);

		monitorFile(PATH, () => {
			this.readFile().catch(console.error);
		});

		this.readFile(true).catch(console.error);
	}

	private async readFile(noNotifications?: boolean) {
		const contents = await readFileAsync(PATH);
		const lines = contents
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		let updated = this.entries.length != lines.length;
		if (!updated) {
			for (let i = 0; i < lines.length; i++) {
				if (lines[i] != this.entries[i]) {
					updated = true;
					break;
				}
			}
		}
		if (updated && !noNotifications) {
			sendNotification("Todo list was updated", {
				appName: "Todo",
				expireMs: 10_000,
			});
		}
		this.entries = lines;
		this.setEnabled(true);
		this.triggerUpdate(null);
	}

	public update(query: string): void {
		this.hasPrefix =
			query.toLowerCase() == "todo" || query.toLowerCase().startsWith("todo ");
		this.query = query.substring(5);
		this.triggerUpdate(null);
	}

	private async createTask(task: string) {
		console.log("Creating task", task);
		this.entries.push(task);
		return this.save();
	}

	private async save() {
		writeFileAsync(PATH, this.entries.join("\n"));
	}

	public getContent(
		entryId: string,
		window: Astal.Window,
	): GObject.Object | null {
		if (entryId == "all") {
			return (
				<box orientation={Gtk.Orientation.VERTICAL}>
					{this.entries.map((entry, i) => (
						<button
							hexpand
							cssName="list-entry"
							onClicked={() => {
								this.setQuery(`todo ${i + 1}`);
							}}
						>
							<label
								halign={Gtk.Align.START}
								hexpand
								wrap
								wrapMode={Pango.WrapMode.WORD_CHAR}
								label={entry}
							/>
						</button>
					))}
				</box>
			);
		}

		if (entryId.startsWith("index-")) {
			const index = Number(entryId.substring("index-".length));
			const entry = this.entries[index];

			return (
				<box
					cssClasses={["entryOverview"]}
					hexpand
					valign={Gtk.Align.CENTER}
					orientation={Gtk.Orientation.VERTICAL}
				>
					<label
						hexpand
						cssClasses={["entry"]}
						justify={Gtk.Justification.CENTER}
						wrap
						wrapMode={Pango.WrapMode.WORD_CHAR}
						label={entry}
					/>
					<box cssClasses={["buttons"]} halign={Gtk.Align.CENTER}>
						<button
							onClicked={() => {
								const index = this.entries.indexOf(entry);
								if (index >= 0) {
									this.entries.splice(index, 1);
									this.save()
										.then(() => this.setQuery("todo"))
										.catch(console.error);
								}
							}}
						>
							<label label="Complete" />
						</button>
					</box>
				</box>
			);
		}

		return (
			<box
				orientation={Gtk.Orientation.VERTICAL}
				cssClasses={["create"]}
				hexpand
				valign={Gtk.Align.CENTER}
			>
				<label cssClasses={["title"]} label="Add new task" />
				<label
					cssClasses={["newEntry"]}
					wrap
					wrapMode={Pango.WrapMode.WORD_CHAR}
					justify={Gtk.Justification.CENTER}
					hexpand
					label={this.query}
				/>
				<box cssClasses={["buttons"]} halign={Gtk.Align.CENTER}>
					<button
						onClicked={() => {
							this.createTask(this.query).catch(console.error);
							window.visible = false;
						}}
					>
						<label label="Create" />
					</button>
				</box>
			</box>
		);
	}

	public getEntries(): LauncherEntry[] {
		if (!this.hasPrefix) {
			return [];
		}

		if (!this.query.trim()) {
			return [
				{
					id: "all",
					name: "All Tasks",
					icon: null,
				},
			];
		}

		const number = Number(this.query);

		if (
			!isNaN(number) &&
			Math.round(number) == number &&
			number > 0 &&
			number <= this.entries.length
		) {
			const entry = this.entries[number - 1];
			return [
				{
					id: `index-${number - 1}`,
					name: entry,
					icon: null,
				},
			];
		}

		return [
			{
				id: "create",
				name: "Add new task",
				icon: null,
			},
		];
	}

	public getIcon(): string {
		return "dictionary-symbolic";
	}
}
