import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import { createPoll } from "ags/time";
import GLib from "gi://GLib?version=2.0";
import { With } from "gnim";
import { Gtk } from "ags/gtk4";
import styles from "./time.menu-handler.style";

interface Date {
	day: string;
	date: number;
	dateSuffix: string;
	month: string;
	year: number;
}

export class TimeMenuHandler extends MenuHandler {
	constructor() {
		super("time");
	}

	private getDate() {
		const now = GLib.DateTime.new_now_local();

		const date: Partial<Date> = {};

		date.day = ["MON", "TUE", "WED", "THURS", "FRI", "SAT", "SUN"][
			now.get_day_of_week() - 1
		];
		date.date = now.get_day_of_month();
		const suffixes = ["st", "nd", "rd", "th"];
		date.dateSuffix = suffixes[Math.min(date.date - 1, suffixes.length - 1)];
		date.month = [
			"January",
			"Februrary",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		][now.get_month() - 1];
		date.year = now.get_year();

		return date as Date;
	}

	public getContent(
		_window: GObject.Object,
		_data: string | number | null,
	): GObject.Object {
		const datePoll = createPoll(this.getDate(), 1_000, () => this.getDate());

		return (
			<box orientation={Gtk.Orientation.VERTICAL}>
				<box>
					<With value={datePoll}>
						{(date) => (
							<box cssClasses={[styles.date]}>
								<label
									cssClasses={[styles.main]}
									label={`${date.day}${date.date}`}
								/>
								<box
									orientation={Gtk.Orientation.VERTICAL}
									cssClasses={[styles.aux]}
									valign={Gtk.Align.CENTER}
								>
									<box hexpand>
										<label
											cssClasses={[styles.suffix]}
											label={date.dateSuffix}
										/>
										<label cssClasses={[]} label={date.year.toString()} />
									</box>
									<label
										halign={Gtk.Align.START}
										cssClasses={[styles.month]}
										label={date.month}
									/>
								</box>
							</box>
						)}
					</With>
				</box>

				<Gtk.Calendar cssClasses={[styles.calendar]} />
			</box>
		);
	}
}
