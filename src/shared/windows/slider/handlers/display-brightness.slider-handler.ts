import Brightness from "@service/brightness";
import { SliderHandler } from "./slider-handler";
import { Destroyer } from "@util/destroyer";

export class DisplayBrightnessSliderHandler extends SliderHandler {
	private device: Brightness.Device | null;

	constructor() {
		const brightness = Brightness.get_default();
		super(brightness.primary?.percent ?? 0);

		let hasntUpdated = true;

		let primaryDestroyer: Destroyer | null = null;
		this.destroyer.add(() => primaryDestroyer?.destroy());
		this.destroyer.addDisconnect(
			brightness,
			brightness.connect("notify::primary", () => {
				this.device = brightness.primary;
				primaryDestroyer?.destroy();
				if (this.device) {
					primaryDestroyer = new Destroyer();
					if (!hasntUpdated) {
						this.update(this.device.percent);
					}
					hasntUpdated = false;

					primaryDestroyer.addDisconnect(
						this.device,
						this.device.connect("notify::percent", () => {
							if (this.device) {
								this.update(this.device.percent);
							}
						}),
					);
				} else {
					primaryDestroyer = null;
				}
			}),
		);

		this.device = brightness.primary;
	}

	public setPercent(percent: number): void {
		if (this.device) {
			this.device.brightness = (percent / 100) * this.device.max_brightness;
		}
	}
	public getIcon(): string {
		return this.device?.icon ?? "display-brightness-symbolic";
	}
}
