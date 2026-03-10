import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import AstalWp from "gi://AstalWp?version=0.1";
import { createBinding, createComputed, For } from "gnim";
import { Gtk } from "ags/gtk4";
import styles from "./audio.menu-handler.style";
import { getValidIcon } from "@util/icon";
import sliderStyles from "@styles/slider";
import { ClickableListEntry } from "@components/clickable-list-entry/clickable-list-entry";
import { createCursorPointer } from "@util/ags";

export class AudioMenuHandler extends MenuHandler {
	constructor() {
		super("audio");
	}

	public getContent(
		_window: GObject.Object,
		_data: string | number | null,
	): GObject.Object {
		const wp = AstalWp.get_default();

		const devices = createComputed(
			[createBinding(wp.audio, "speakers"), createBinding(wp, "devices")],
			(wpEndpoints, wpDevices) =>
				wpEndpoints.map((wpEndpoint) => ({
					wpEndpoint,
					wpDevice:
						wpDevices.find((wpDevice) =>
							[wpEndpoint.name, wpEndpoint.description].includes(
								wpDevice.description,
							),
						) || null,
				})),
		);

		return (
			<box orientation={Gtk.Orientation.VERTICAL} widthRequest={250}>
				<box cssClasses={[styles.topContainer]} hexpand>
					<slider
						hexpand
						max={100}
						min={0}
						value={createBinding(wp.defaultSpeaker, "volume").as(
							(volume) => volume * 100,
						)}
						step={1}
						onChangeValue={(self) => {
							wp.defaultSpeaker.set_volume(self.value / 100);
						}}
						cssClasses={[sliderStyles.slider]}
						cursor={createCursorPointer()}
					/>
				</box>
				<box orientation={Gtk.Orientation.VERTICAL} hexpand>
					<For each={devices}>
						{({ wpEndpoint, wpDevice }) => (
							<ClickableListEntry
								label={createBinding(wpEndpoint, "description")}
								iconName={
									getValidIcon(wpEndpoint.icon, wpDevice?.icon) ||
									"audio-speakers-symbolic"
								}
								active={createBinding(wpEndpoint, "is_default")}
								onClicked={() => (wpEndpoint.isDefault = true)}
								cursor={createCursorPointer()}
							/>
						)}
					</For>
				</box>
			</box>
		);
	}
}
