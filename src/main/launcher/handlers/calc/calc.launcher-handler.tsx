import { createCommandProcess, doesCommandExist } from "@util/cli";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import { CommandPromise } from "@interface/command-promise";
import GObject from "gnim/gobject";
import { Gtk } from "ags/gtk4";
import styles from "./calc.launcher-handler.style";
import { CommandTerminationError } from "@interface/command-termination-error";

export class CalcLauncherHandler extends LauncherHandler {
	private commandPromise: CommandPromise<string> | null = null;
	private response = "";
	private answer = "";
	private warning = "";

	constructor(setQuery: (query: string) => void) {
		super("Calculator", setQuery, false);

		doesCommandExist("qalc", "--help")
			.then((enabled) => this.setEnabled(enabled))
			.catch(console.error);
	}

	public update(query: string): void {
		if (this.response) {
			this.response = "";
			this.answer = "";
			this.triggerUpdate(query);
		}

		this.commandPromise?.kill();

		const commandPromise = createCommandProcess(["qalc", query]);
		this.commandPromise = commandPromise;

		this.setLoading(true);
		commandPromise
			.then((response) => {
				if (response.startsWith(">")) {
					response = response.substring(1).trim();
				}
				const split = response.split("\n");
				let warning = "";
				if (split.length > 1) {
					[warning, response] = split;
				}
				if (this.response == response) {
					this.setLoading(false);
					return;
				}
				const answerCommandPromise = createCommandProcess([
					"qalc",
					"-t",
					query,
				]);
				this.commandPromise = answerCommandPromise;
				answerCommandPromise
					.then((answer) => {
						this.commandPromise = null;
						this.response = response;
						this.answer = answer;
						this.warning = warning;
						this.setLoading(false);
						this.triggerUpdate(query);
					})
					.catch((e) => {
						if (!(e instanceof CommandTerminationError)) {
							this.setLoading(false);
						}
					});
			})
			.catch((e) => {
				if (!(e instanceof CommandTerminationError)) {
					this.setLoading(false);
				}
			});
	}

	private getLeftSide() {
		let leftSide = this.response.substring(
			0,
			this.response.length - this.answer.length,
		);
		for (let separator of ["=", "≈"]) {
			if (leftSide.endsWith(` ${separator} `)) {
				leftSide = leftSide.substring(0, leftSide.length - 3);
			}
		}
		return leftSide;
	}

	private getSeparator() {
		return this.response.substring(this.getLeftSide().length).trim()[0];
	}

	public getEntries(): LauncherEntry[] {
		if (!this.response) {
			return [];
		}

		return [
			{
				id: "calc",
				name: this.getLeftSide(),
				icon: null,
			},
		];
	}

	public getContent(): GObject.Object | null {
		return (
			<box
				cssClasses={[styles.container]}
				orientation={Gtk.Orientation.VERTICAL}
				hexpand
			>
				{!!this.warning && (
					<label halign={Gtk.Align.START} wrap label={this.warning} />
				)}
				<label
					cssClasses={[styles.leftSide]}
					halign={Gtk.Align.START}
					wrap
					label={this.getLeftSide()}
				/>
				<label
					cssClasses={[styles.rightSide]}
					halign={Gtk.Align.START}
					wrap
					label={`${this.getSeparator()} ${this.answer}`}
				/>
			</box>
		);
	}

	public getIcon(): string {
		return "accessories-calculator-symbolic";
	}
}
