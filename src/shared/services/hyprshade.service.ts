import GObject, { getter, register, setter } from "gnim/gobject";
import "ags/file";
import { execAsync } from "ags/process";
import { compareString } from "@util/string";
import { doesCommandExist } from "@util/cli";
import { KillablePromise } from "@interface/killable-promise";
import { timeout } from "ags/time";

namespace Hyprshade {
	@register()
	export class Shader extends GObject.Object {
		private readonly _id: string;
		private _active: boolean;

		@getter(String)
		get id() {
			return this._id;
		}

		@getter(Boolean)
		get active() {
			return this._active;
		}

		@setter(Boolean)
		set active(active: boolean) {
			this.onChange(this, active);
		}

		constructor(
			id: string,
			active: boolean,
			createActiveListener: (
				self: Shader,
				callback: (active: boolean) => void,
			) => void,
			private readonly onChange: (self: Shader, active: boolean) => void,
		) {
			super();
			this._id = id;
			this._active = active;

			createActiveListener(this, (active) => {
				this._active = active;
				this.notify("active");
			});
		}
	}

	@register()
	class HyprshadeService extends GObject.Object {
		private readonly _shaders = new Map<
			string,
			{ shader: Shader; callback: (active: boolean) => void }
		>();
		private scanLoop: KillablePromise<void> | null = null;

		constructor() {
			super();

			doesCommandExist("hyprshade", "--version").then(async (enabled) => {
				if (!enabled) {
					console.log("Hyprshade support is disabled. Install Hyprshade.");
					return;
				}
				console.log("Hyprshade support is enabled.");

				this.startScanLoop();
			});
		}

		private async startScanLoop() {
			this.scanLoop?.kill();

			let isKilled = false;
			this.scanLoop = {
				...new Promise<void>(async (resolve) => {
					while (!isKilled) {
						try {
							await this._scan(() => isKilled);
							await new Promise<void>((r) => timeout(3_000, r));
						} catch (e) {
							console.error(e);
						}
					}
					resolve();
				}),
				kill: () => {
					isKilled = true;
				},
			};
		}

		private async _scan(isKilled: () => boolean) {
			const listOutput = await execAsync(["hyprshade", "ls"]);
			if (isKilled()) {
				return;
			}

			const shaderIds = listOutput.split("\n").map((file) => {
				const active = file.startsWith("* ");
				if (active || file.startsWith("  ")) {
					file = file.substring(2);
				}
				return {
					active,
					id: file,
				};
			});
			let updated = false;

			for (const [shaderId, { shader, callback }] of this._shaders.entries()) {
				const entry = shaderIds.find((shader) => shader.id == shaderId);

				if (entry) {
					shaderIds.splice(shaderIds.indexOf(entry), 1);
					if (entry.active != shader.active) {
						callback(entry.active);
					}
				} else {
					this._shaders.delete(shaderId);
					updated = true;
				}
			}

			for (const { id, active } of shaderIds) {
				new Shader(
					id,
					active,
					(shader, callback) => {
						this._shaders.set(id, {
							shader,
							callback,
						});
					},
					(self, active) => {
						this.scanLoop?.kill();
						for (const { shader, callback } of this._shaders.values()) {
							if (self == shader) {
								if (shader.active != active) {
									callback?.(active);
								}
							} else if (shader.active) {
								callback(false);
							}
						}
						if (active) {
							execAsync(["hyprshade", "on", self.id]).catch(console.error);
						} else {
							execAsync(["hyprshade", "off"]).catch(console.error);
						}
						this.startScanLoop();
					},
				);

				updated = true;
			}

			if (updated) {
				this.notify("shaders");
			}
		}

		@getter(Object)
		get shaders() {
			return Array.from(this._shaders.values())
				.map((obj) => obj.shader)
				.sort((a, b) => compareString(a.id, b.id));
		}
	}

	let instance: HyprshadeService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new HyprshadeService();
		}
		return instance;
	}
}

export default Hyprshade;
