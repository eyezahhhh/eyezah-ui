import { IDesktopSession } from "@interface/desktop-session";
import { asAccessor } from "@util/ags";
import { Gtk } from "ags/gtk4";
import { Accessor } from "gnim";
import styles from "./session-selector.component.style";
import { Group } from "../group/group.component";

interface Props {
	sessions: (IDesktopSession[] | null) | Accessor<IDesktopSession[] | null>;
	selectedIndex: number | Accessor<number>;
	onChange?: (index: number) => void;
}

export function SessionSelector({ sessions, selectedIndex, onChange }: Props) {
	return (
		<Group
			selectedIndex={selectedIndex}
			orientation={Gtk.Orientation.VERTICAL}
			itemCssClasses={[styles.session]}
			itemCssFocusedClass={styles.focus}
			onClicked={onChange}
		>
			{asAccessor(sessions).as(
				(sessions) =>
					sessions?.map((session) => (
						<label label={session.name} halign={Gtk.Align.START} />
					)) || [<label label="Loading" />],
			)}
		</Group>
	);
}
