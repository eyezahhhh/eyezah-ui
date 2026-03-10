import { Gtk } from "ags/gtk4";
import styles from "./expandable.component.style";
import GObject from "gnim/gobject";
import { createState } from "gnim";
import { createCursorPointer } from "@util/ags";

interface Props {
	children?: GObject.Object | GObject.Object[];
}

export function Expandable({ children }: Props) {
	const [show, setShow] = createState(false);

	return (
		<box orientation={Gtk.Orientation.VERTICAL}>
			<revealer
				revealChild={show}
				transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
			>
				<box orientation={Gtk.Orientation.VERTICAL}>{children}</box>
			</revealer>
			<button
				onClicked={() => setShow(!show.get())}
				cursor={createCursorPointer()}
				cssClasses={[styles.button]}
			>
				<image
					iconName={show.as((show) =>
						show ? "pan-up-symbolic" : "pan-down-symbolic",
					)}
				/>
			</button>
		</box>
	);
}
