import { Gdk, Gtk } from "ags/gtk4";
import AstalApps from "gi://AstalApps?version=0.1";
import AstalNetwork from "gi://AstalNetwork?version=0.1";
import { createState } from "gnim";
import { Destroyer } from "./destroyer.util";
import NM from "gi://NM?version=1.0";
import { interval } from "ags/time";

// todo: make this controllable from nixos
const ICON_ALIASES: Record<string, string> = {
	"^Minecraft*": "minecraft",
} as const;

export function getIconTheme() {
	return Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!);
}

export function getWindowIcon(windowClass: string) {
	const theme = getIconTheme();
	const apps = new AstalApps.Apps();

	for (let [regex, icon] of Object.entries(ICON_ALIASES)) {
		if (windowClass.match(regex) && theme.has_icon(icon)) {
			return icon;
		}
	}

	if (theme.has_icon(windowClass)) {
		return windowClass;
	}

	const appList = apps.get_list();
	for (let app of appList) {
		const executable = app.executable.split(" ")[0];
		if (
			(app.wmClass && app.wmClass == windowClass) ||
			executable == windowClass
		) {
			return app.iconName;
		}
	}

	return null;
}

export function getNetworkOverviewIcon() {
	const network = AstalNetwork.get_default();

	const [icon, setIcon] = createState("");
	const destroyer = new Destroyer();

	const update = () => {
		if (network.primary == AstalNetwork.Primary.UNKNOWN) {
			setIcon("network-wired-no-route-symbolic");
		} else if (network.primary == AstalNetwork.Primary.WIRED) {
			setIcon(network.wired.iconName);
		} else {
			if (network.wifi.enabled) {
				setIcon(network.wifi.iconName);
			} else {
				setIcon("network-wireless-offline-symbolic");
			}
		}
	};

	let wiredCleanup: (() => void) | null = null;
	const createWiredListener = () => {
		wiredCleanup?.();
		if (network.wired) {
			const connectionId = network.wired.connect("notify", update);
			wiredCleanup = () => network.wired.disconnect(connectionId);
		}
	};
	destroyer.addDisconnect(
		network,
		network.connect("notify::wired", createWiredListener),
	);
	createWiredListener();

	let wifiCleanup: (() => void) | null = null;
	const createWifiListener = () => {
		wifiCleanup?.();
		if (network.wifi) {
			const connectionId = network.wifi.connect("notify", update);
			wifiCleanup = () => network.wifi.disconnect(connectionId);
		}
	};
	destroyer.addDisconnect(
		network,
		network.connect("notify::wifi", createWifiListener),
	);
	createWifiListener();

	update();

	return {
		icon,
		cleanup: () => {
			destroyer.destroy();
			wiredCleanup?.();
			wifiCleanup?.();
		},
	};
}

export function getVolumeIcon(volume: number, muted?: boolean) {
	const icons: Record<number, string> = {
		101: "overamplified",
		67: "high",
		34: "medium",
		1: "low",
		0: "muted",
	};
	const icon = muted
		? 0
		: [101, 67, 34, 1, 0].find((threshold) => threshold <= volume * 100)!;

	return `audio-volume-${icons[icon]}-symbolic`;
}

export function getValidIcon(
	icon: string | null | undefined,
	...fallback: (string | null | undefined)[]
) {
	const iconTheme = getIconTheme();

	for (let name of [icon, ...fallback]) {
		if (name && iconTheme.has_icon(name)) {
			return name;
		}
	}

	return null;
}
