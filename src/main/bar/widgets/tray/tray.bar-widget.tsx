import AstalTray from "gi://AstalTray?version=0.1";
import { Accessor, createBinding, For } from "gnim";
import { setMenu, toggleMenu } from "main/menu/menu.manager";
import styles from "./tray.bar-widget.style";
import { createCursorPointer } from "@util/ags";

interface Props {
	// onClicked?: () => void;
}

export function TrayBarWidget({}: Props) {
	const tray = AstalTray.get_default();

	return (
		<box>
			<For
				each={createBinding(tray, "items") as Accessor<AstalTray.TrayItem[]>}
			>
				{(item) => (
					<menubutton
						cssClasses={[styles.button]}
						menuModel={item.menuModel}
						onMap={(self) =>
							self.insert_action_group("debusmenu", item.actionGroup)
						}
						cursor={createCursorPointer()}
					>
						<box>
							<image gicon={createBinding(item, "gicon")} />
						</box>
					</menubutton>
				)}
			</For>
		</box>
	);
}
