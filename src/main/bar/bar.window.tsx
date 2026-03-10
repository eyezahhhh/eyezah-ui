import { Astal, Gdk, Gtk } from "ags/gtk4";
import { CLASS } from "constants/class.const";
import styles from "./bar.window.style";
import app from "ags/gtk4/app";
import { createBinding } from "gnim";
import { With } from "ags";
import { getWindowIcon } from "@util/icon";
import { getReleaseInfo } from "@util/release-info";
import GLib from "gi://GLib?version=2.0";
import { ClockBarWidget } from "main/bar/widgets/clock/clock.bar-widget";
import { VolumeBarWidget } from "main/bar/widgets/volume/volume.bar-widget";
import { BluetoothBarWidget } from "main/bar/widgets/bluetooth/bluetooth.bar-widget";
import { NetworkBarWidget } from "main/bar/widgets/network/network.bar-widget";
import { toggleMenu } from "main/menu/menu.manager";
import { AudioMenuHandler } from "main/menu/handlers/audio/audio.menu-handler";
import { NetworkMenuHandler } from "main/menu/handlers/network/network.menu-handler";
import { BluetoothMenuHandler } from "main/menu/handlers/bluetooth/bluetooth.menu-handler";
import { TimeMenuHandler } from "main/menu/handlers/time/time.menu-handler";
import { BatteryBarWidget } from "./widgets/battery/battery.bar-widget";
import { PowerMenuHandler } from "main/menu/handlers/power/power.menu-handler";
import Hyprshade from "@service/hyprshade";
import { BrightnessBarWidget } from "./widgets/brightness/brightness.bar-widget";
import { DisplayMenuHandler } from "main/menu/handlers/display/display.menu-handler";
import { TrayBarWidget } from "./widgets/tray/tray.bar-widget";
import AstalHyprland from "gi://AstalHyprland";

Hyprshade.get_default();

export function BarWindow(gdkMonitor: Gdk.Monitor) {
	const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

	const RIGHT_WIDGETS = [
		// <label label="❤️" />,
		() => <TrayBarWidget />,
		() => <VolumeBarWidget onClicked={() => toggleMenu(AudioMenuHandler)} />,
		// <BluetoothBarWidget onClicked={() => toggleMenu(BluetoothMenuHandler)} />,
		() => (
			<BrightnessBarWidget onClicked={() => toggleMenu(DisplayMenuHandler)} />
		),
		() => <NetworkBarWidget onClicked={() => toggleMenu(NetworkMenuHandler)} />,
		() => <BatteryBarWidget onClicked={() => toggleMenu(PowerMenuHandler)} />,
		() => <ClockBarWidget onClicked={() => toggleMenu(TimeMenuHandler)} />,
	] as const;

	const hyprland = AstalHyprland.get_default();
	const focusedClient = createBinding(hyprland, "focusedClient");

	return (
		<window
			visible
			name="bar"
			namespace={`${CLASS}_bar`}
			gdkmonitor={gdkMonitor}
			cssClasses={[styles.window]}
			exclusivity={Astal.Exclusivity.EXCLUSIVE}
			anchor={TOP | LEFT | RIGHT}
			application={app}
			class={CLASS}
		>
			<box cssClasses={[styles.container]}>
				<centerbox hexpand>
					<box $type="start" hexpand>
						<With value={focusedClient}>
							{(client: AstalHyprland.Client | null) => {
								if (!client) {
									return (
										<box cssClasses={[styles.currentApp]}>
											<image
												iconName={getReleaseInfo("LOGO")}
												cssClasses={[styles.appIcon]}
											/>
											<label
												label={`${GLib.get_host_name()} - ${getReleaseInfo(
													"PRETTY_NAME",
												)}`}
											/>
										</box>
									);
								}
								const icon = getWindowIcon(client.class);

								return (
									<box cssClasses={[styles.currentApp]}>
										{icon && (
											<image iconName={icon} cssClasses={[styles.appIcon]} />
										)}
										<label label={createBinding(client, "title")} />
									</box>
								);
							}}
						</With>
					</box>
					<box $type="end">
						{RIGHT_WIDGETS.map((widget) => (
							<box>{widget()}</box>
						))}
					</box>
				</centerbox>
			</box>
		</window>
	) as Gtk.Window;
}
