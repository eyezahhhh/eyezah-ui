import { Group } from "../group/group.component";
import styles from "./power-button-group.component.style";

export function PowerButtonGroup() {
	return (
		<Group
			selectedIndex={0}
			itemCssClasses={[styles.button]}
			onClicked={(index) => {
				if (index == 0) {
					console.log("Shut down!"); // todo: shutdown
				}
				if (index == 1) {
					console.log("Reboot"); //todo: reboot
				}
			}}
		>
			<image iconName="system-shutdown-symbolic" pixelSize={32} />
			<image iconName="system-reboot-symbolic" pixelSize={32} />
		</Group>
	);
}
