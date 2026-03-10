import styles from "./volume.bar-widget.style";
import AstalWp from "gi://AstalWp?version=0.1";
import { createBinding, createComputed, createState, With } from "gnim";
import { getVolumeIcon } from "@util/icon";
import { timeout, Timer } from "ags/time";
import { Gtk } from "ags/gtk4";
import { createCursorPointer } from "@util/ags";

interface Props {
	onClicked?: () => void;
}

export function VolumeBarWidget({ onClicked }: Props) {
	const wp = AstalWp.get_default();

	const [revealerVisible, setRevealerVisible] = createState(false);
	let lastVolume = 0;
	let revealTimer: Timer | null = null;

	const speakerBind = createBinding(wp, "default_speaker");

	return (
		<With value={speakerBind}>
			{(speaker) => {
				const computed = createComputed(
					[createBinding(speaker, "volume"), createBinding(speaker, "mute")],
					(volume, muted) => [volume, muted] as [number, boolean],
				);

				return (
					<button
						onClicked={onClicked}
						cssClasses={[styles.button]}
						cursor={createCursorPointer()}
					>
						<box>
							<Gtk.EventControllerScroll
								flags={Gtk.EventControllerScrollFlags.VERTICAL}
								onScroll={(_event, _x, y) =>
									wp.defaultSpeaker.set_volume(
										Math.min(wp.defaultSpeaker.volume - y / 200, 1),
									)
								}
							/>
							<image iconName={computed.as((args) => getVolumeIcon(...args))} />
							<revealer
								revealChild={revealerVisible}
								transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
								transitionDuration={250}
							>
								<label
									label={computed.as(([volume]) => {
										if (volume != lastVolume) {
											lastVolume = volume;
											revealTimer?.cancel();
											setRevealerVisible(true);
											revealTimer = timeout(1_500, () =>
												setRevealerVisible(false),
											);
										}
										return `${Math.round(volume * 100)}%`;
									})}
									cssClasses={[styles.label]}
								/>
							</revealer>
						</box>
					</button>
				);
			}}
		</With>
	);
}
