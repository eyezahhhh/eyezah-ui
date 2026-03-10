import AstalWp from "gi://AstalWp?version=0.1";
import { SliderHandler } from "./slider-handler";
import { getVolumeIcon } from "@util/icon";
import { Destroyer } from "@util/destroyer";

export class VolumeSliderHandler extends SliderHandler {
	private readonly wp: AstalWp.Wp;

	constructor() {
		const wp = AstalWp.get_default();
		super(wp.defaultSpeaker.volume * 100);
		this.wp = wp;

		let hasntUpdated = true;

		let speakerDestroyer: Destroyer | null = null;
		const connectSpeaker = () => {
			speakerDestroyer?.destroy();
			speakerDestroyer = new Destroyer();
			if (!hasntUpdated) {
				this.update(wp.defaultSpeaker.volume * 100);
			}
			hasntUpdated = false;

			speakerDestroyer.addDisconnect(
				wp,
				wp.defaultSpeaker.connect("notify::volume", () => {
					this.update(wp.defaultSpeaker.volume * 100);
				}),
			);
		};

		this.destroyer.addDisconnect(
			wp,
			wp.connect("notify::default-speaker", connectSpeaker),
		);
		connectSpeaker();
	}

	public setPercent(percent: number) {
		this.wp.defaultSpeaker.volume = percent / 100;
		this.update(percent);
	}

	public getIcon(): string {
		return getVolumeIcon(this.wp.defaultSpeaker.volume);
	}
}
