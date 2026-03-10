import { createPoll } from "ags/time";
import GLib from "gi://GLib?version=2.0";
import styles from "./clock.bar-widget.style";
import { createCursorPointer } from "@util/ags";

interface Props {
	seconds?: boolean;
	onClicked?: () => void;
}

export function ClockBarWidget({ seconds, onClicked }: Props) {
	const time = createPoll("", 1000, () => {
		return GLib.DateTime.new_now_local().format(`%R${seconds ? ":%S" : ""}`)!;
	});

	return (
		<button onClicked={onClicked} cssClasses={[styles.button]} cursor={createCursorPointer()}>
			<label label={time} />
		</button>
	);
}
