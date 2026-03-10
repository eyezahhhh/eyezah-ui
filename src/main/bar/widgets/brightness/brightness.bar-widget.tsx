import Hyprshade from "@service/hyprshade";
import styles from "./brightness.bar-widget.style";
import { Accessor, createBinding, createComputed, With } from "gnim";
import { createCursorPointer } from "@util/ags";
import Brightness from "@service/brightness";

interface Props {
	onClicked?: () => void;
}

export function BrightnessBarWidget({ onClicked }: Props) {
	const hyprshade = Hyprshade.get_default();
	const brightness = Brightness.get_default();

	const enabledBinding = createComputed(
		[createBinding(hyprshade, "shaders"), createBinding(brightness, "primary")],
		(shaders, brightnessDevice) => !!shaders.length || !!brightnessDevice,
	);

	return (
		<With value={enabledBinding}>
			{(enabled) =>
				enabled && (
					<box>
						<With
							value={
								createBinding(
									brightness,
									"primary",
								) as Accessor<Brightness.Device | null>
							}
						>
							{(device) => (
								<button
									cssClasses={[styles.button]}
									onClicked={onClicked}
									cursor={createCursorPointer()}
								>
									<image
										iconName={
											device?.type == "backlight"
												? createBinding(device, "icon")
												: "display-brightness-symbolic"
										}
									/>
								</button>
							)}
						</With>
					</box>
				)
			}
		</With>
	);
}
