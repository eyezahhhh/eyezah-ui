import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import AstalBattery from "gi://AstalBattery?version=0.1";
import { Accessor, createBinding, With } from "gnim";
import { formatTime } from "@util/string";
import { Gtk } from "ags/gtk4";
import styles from "./power.menu-handler.style";
import AstalPowerProfiles from "gi://AstalPowerProfiles?version=0.1";

export class PowerMenuHandler extends MenuHandler {
	constructor() {
		super("power");
	}

	public getContent(
		_window: GObject.Object,
		_data: string | number | null,
	): GObject.Object {
		const battery = AstalBattery.get_default();
		const powerProfiles = AstalPowerProfiles.get_default();

		return (
			<box widthRequest={250}>
				<With
					value={
						createBinding(battery, "device_type") as Accessor<AstalBattery.Type>
					}
				>
					{(deviceType) =>
						deviceType == AstalBattery.Type.BATTERY && (
							<box>
								<box orientation={Gtk.Orientation.VERTICAL} hexpand>
									<box>
										<image
											iconName={createBinding(battery, "icon_name")}
											iconSize={Gtk.IconSize.LARGE}
										/>
										<label
											cssClasses={[styles.percentLabel]}
											label={createBinding(battery, "percentage").as(
												(percent) => `${percent * 100}%`,
											)}
										/>
									</box>

									<label
										halign={Gtk.Align.START}
										label={createBinding(battery, "energy_rate").as(
											(energy) => `${energy}W`,
										)}
									/>
									{/* <label
										halign={Gtk.Align.START}
										label={createComputed(
											[
												createBinding(battery, "charging"),
												createBinding(battery, "time_to_empty"),
												createBinding(battery, "time_to_full"),
											],
											(charging, timeToEmpty, timeToFull) =>
												charging
													? `Charged in ${formatTime(timeToFull)}`
													: `Empty in ${formatTime(timeToEmpty)}`,
										)}
									/> */}
								</box>
							</box>
						)
					}
				</With>
			</box>
		);
	}
}
