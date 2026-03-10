import { Destroyer } from "@util/destroyer";
import { compareString } from "@util/string";
import { createDebouncer } from "@util/time";
import { monitorFile } from "ags/file";
import { execAsync } from "ags/process";
import GObject, { getter, register, setter } from "gnim/gobject";

namespace Brightness {
	type DeviceUpdateCallback = (
		brightness: number,
		maxBrightness: number,
	) => void;

	@register()
	export class Device extends GObject.Object {
		private readonly _id: string;
		private readonly _type: string;
		private _brightness: number;
		private _maxBrightness: number;
		private _icon: string;
		private readonly destroyer = new Destroyer();

		@getter(String)
		get id() {
			return this._id;
		}

		@getter(String)
		get type() {
			return this._type;
		}

		@getter(Number)
		get brightness() {
			return this._brightness;
		}

		@setter(Number)
		set brightness(brightness: number) {
			if (brightness < 0) {
				throw new Error("Brightness cannot be less than 0");
			}
			if (brightness > this.max_brightness) {
				throw new Error("Brightness cannot be more than max brightness");
			}
			execAsync([
				"brightnessctl",
				"--device",
				this.id,
				"set",
				brightness.toString(),
				"--quiet",
			]).catch(console.error);
		}

		@getter(Number)
		get max_brightness() {
			return this._maxBrightness;
		}

		@getter(Number)
		get percent() {
			return (this.brightness / this.max_brightness) * 100;
		}

		@getter(String)
		get icon() {
			return this._icon;
		}

		private getIcon() {
			const percent = this.percent;

			let icon: string;
			if (percent < 30) {
				icon = "brightness-low-symbolic";
			} else if (percent < 70) {
				icon = "brightness-medium-symbolic";
			} else {
				icon = "brightness-high-symbolic";
			}

			return icon;
		}

		constructor(
			id: string,
			type: string,
			brightness: number,
			maxBrightness: number,
			addListener: (self: Device, callback: DeviceUpdateCallback) => void,
		) {
			super();
			this._id = id;
			this._type = type;
			this._brightness = brightness;
			this._maxBrightness = maxBrightness;

			const updateListener: DeviceUpdateCallback = (
				brightness,
				maxBrightness,
			) => {
				if (brightness != this._brightness) {
					this._brightness = brightness;
					this.notify("brightness");
				}
				if (maxBrightness != this._maxBrightness) {
					this._maxBrightness = maxBrightness;
					this.notify("max_brightness");
				}
			};

			addListener(this, updateListener);

			this.connect("notify::brightness", () => this.notify("percent"));
			this.connect("notify::max_brightness", () => this.notify("percent"));
			this._icon = this.getIcon();

			this.connect("notify::percent", () => {
				const icon = this.getIcon();
				if (icon != this._icon) {
					this._icon = icon;
					this.notify("icon");
				}
			});

			const path = `/sys/class/${this.type}/${this.id}/brightness`;
			const monitor = monitorFile(
				path,
				createDebouncer(() => get_default().scan().catch(console.error), 50),
			);
			this.destroyer.add(() => monitor.cancel());
		}

		destroy() {
			this.destroyer.destroy();
			this.run_dispose();
		}
	}

	@register()
	export class BrightnessService extends GObject.Object {
		private readonly _devices = new Map<
			string,
			{
				device: Device;
				update: (brightness: number, maxBrightness: number) => void;
			}
		>();
		private _primaryId: string | null = null;

		constructor() {
			super();
			this.scan().catch(console.error);
		}

		public async scan() {
			const result = await execAsync([
				"brightnessctl",
				"--list",
				"--machine-readable",
			]);

			const lines = result.split("\n");
			const ids: string[] = [];

			let updated = false;
			for (const line of lines) {
				const parts = line.split(",");
				if (parts.length != 5) {
					continue;
				}
				const [id, type, brightness, _percent, maxBrightness] = parts;
				ids.push(id);
				const device = this._devices.get(id);
				if (device) {
					device.update(parseInt(brightness), parseInt(maxBrightness));
				} else {
					new Device(
						id,
						type,
						parseInt(brightness),
						parseInt(maxBrightness),
						(device, update) => {
							this._devices.set(id, {
								device,
								update,
							});
						},
					);
					updated = true;
				}
			}

			for (const [id, { device }] of this._devices.entries()) {
				if (!ids.includes(id)) {
					this._devices.delete(id);
					device.destroy();
					updated = true;
					if (this._primaryId == id) {
						this._primaryId = null;
						this.notify("primary");
					}
				}
			}

			if (updated) {
				this.notify("devices");
			}

			const primaryId = ids.length ? ids[0] : null;
			if (primaryId != this._primaryId) {
				this._primaryId = primaryId;
				this.notify("primary");
			}
		}

		@getter(Object)
		get devices() {
			return Array.from(this._devices.values())
				.map(({ device }) => device)
				.sort((a, b) => compareString(b.id, a.id));
		}

		@getter<Object | null>(Object)
		get primary() {
			if (this._primaryId) {
				const primary = this._devices.get(this._primaryId);
				if (primary) {
					return primary.device;
				}
			}
			return null;
		}
	}

	let instance: BrightnessService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new BrightnessService();
		}
		return instance;
	}
}

export default Brightness;
