import AstalBluetooth from "gi://AstalBluetooth?version=0.1";
import styles from "./bluetooth.bar-widget.style";
import { createBinding } from "gnim";

interface Props {
	onClicked?: () => void;
}

export function BluetoothBarWidget({ onClicked }: Props) {
	const bluetooth = AstalBluetooth.get_default();

	return (
		<button cssClasses={[styles.button]} onClicked={onClicked}>
			<image
				iconName={createBinding(bluetooth.adapter, "powered").as((powered) =>
					powered ? "bluetooth-active-symbolic" : "bluetooth-disabled-symbolic",
				)}
			/>
		</button>
	);
}
