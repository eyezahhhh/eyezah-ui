import { NetworkOverviewIcon } from "@icon/network-overview";
import styles from "./network.bar-widget.style";
import { createCursorPointer } from "@util/ags";

interface Props {
	onClicked?: () => void;
}

export function NetworkBarWidget({ onClicked }: Props) {
	return (
		<button cssClasses={[styles.button]} onClicked={onClicked} cursor={createCursorPointer()}>
			<NetworkOverviewIcon />
		</button>
	);
}
