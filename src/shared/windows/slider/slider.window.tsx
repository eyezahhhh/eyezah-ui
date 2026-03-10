import { CLASS } from "@const/class";
import { SliderHandler } from "./handlers/slider-handler";
import { VolumeSliderHandler } from "./handlers/volume.slider-handler";
import { Astal, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import { Destroyer } from "@util/destroyer";
import { createState, onCleanup, With } from "gnim";
import styles from "./slider.window.style";
import { createCursorPointer } from "@util/ags";
import { DisplayBrightnessSliderHandler } from "./handlers/display-brightness.slider-handler";

export function SliderWindow() {
	const handlers: SliderHandler[] = [
		new VolumeSliderHandler(),
		new DisplayBrightnessSliderHandler(),
	];
	const [activeHandler, setActiveHandler] = createState<{
		handler: SliderHandler;
		percent: number;
		icon: string;
		visible: boolean;
	} | null>(null);
	let timeout: ReturnType<typeof setTimeout> | null = null;

	const destroyer = new Destroyer();

	for (const handler of handlers) {
		const callback = (percent: number) => {
			if (timeout) {
				clearTimeout(timeout);
			}

			const state = {
				handler,
				percent,
				icon: handler.getIcon(),
				visible: true,
			};

			setActiveHandler(state);
			timeout = setTimeout(() => {
				setActiveHandler({
					...state,
					visible: false,
				});
			}, 3_000);
		};
		handler.addListener(callback);
		destroyer.add(() => handler.removeListener(callback));
	}

	onCleanup(() => {
		destroyer.destroy();
		if (timeout) {
			clearTimeout(timeout);
		}
	});

	return (
		<window
			name="slider"
			namespace={`${CLASS}_slider`}
			anchor={Astal.WindowAnchor.BOTTOM}
			application={app}
			class={CLASS}
			marginBottom={200}
			cssClasses={[styles.window]}
			layer={Astal.Layer.OVERLAY}
			visible={activeHandler.as((handler) => !!handler?.visible)}
		>
			<Gtk.Overlay
				$={(self) => {
					self.add_overlay(
						(
							<box
								halign={Gtk.Align.END}
								cssClasses={[styles.overlayContainer]}
								canTarget={false}
							>
								<With value={activeHandler.as((exists) => !!exists)}>
									{(exists) =>
										exists ? (
											<image
												iconName={activeHandler.as((handler) => handler!.icon)}
											/>
										) : null
									}
								</With>
							</box>
						) as Gtk.Widget,
					);
				}}
			>
				<slider
					cssClasses={[styles.slider]}
					min={0}
					max={100}
					step={0.1}
					value={activeHandler.as((handler) => handler?.percent ?? 0)}
					onChangeValue={(_slider, _scrollType, value) => {
						activeHandler.peek()?.handler.setPercent(value);
					}}
					cursor={createCursorPointer()}
				></slider>
			</Gtk.Overlay>
		</window>
	);
}
