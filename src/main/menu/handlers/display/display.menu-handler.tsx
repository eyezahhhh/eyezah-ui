import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import Hyprshade from "@service/hyprshade";
import { Accessor, createBinding, For, With } from "gnim";
import { Gtk } from "ags/gtk4";
import { ClickableListEntry } from "@components/clickable-list-entry/clickable-list-entry";
import Brightness from "@service/brightness";
import { createCursorPointer } from "@util/ags";
import styles from "./display.menu-handler.style";
import sliderStyles from "@styles/slider";

export class DisplayMenuHandler extends MenuHandler {
	constructor() {
		super("display");
	}

	public getContent(
		_window: GObject.Object,
		_data: string | number | null,
	): GObject.Object {
		const hyprshade = Hyprshade.get_default();
		const brightness = Brightness.get_default();

		return (
			<box widthRequest={250} orientation={Gtk.Orientation.VERTICAL}>
				<box>
					<With
						value={
							createBinding(
								brightness,
								"primary",
							) as Accessor<Brightness.Device | null>
						}
					>
						{(device) =>
							device?.type == "backlight" && (
								<box cssClasses={[styles.sliderSection]}>
									<slider
										hexpand
										min={0}
										max={createBinding(device, "max_brightness")}
										value={createBinding(device, "brightness")}
										step={0.1}
										onChangeValue={(_slider, _scrollType, value) => {
											device.brightness = value;
										}}
										cssClasses={[sliderStyles.slider]}
										cursor={createCursorPointer()}
									/>
								</box>
							)
						}
					</With>
				</box>
				<box orientation={Gtk.Orientation.VERTICAL}>
					<For
						each={
							createBinding(hyprshade, "shaders") as Accessor<
								Hyprshade.Shader[]
							>
						}
					>
						{(shader) => (
							<ClickableListEntry
								label={createBinding(shader, "id")}
								subLabel={createBinding(shader, "active").as((active) =>
									active ? "Active" : null,
								)}
								onClicked={() => (shader.active = !shader.active)}
								cursor={createCursorPointer()}
							/>
						)}
					</For>
				</box>
			</box>
		);
	}
}
