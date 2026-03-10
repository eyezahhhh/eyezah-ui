import { createCommandProcess } from "@util/cli";
import { Destroyer } from "@util/destroyer";
import { UnixSocket } from "@util/socket";
import Manette from "gi://Manette?version=0.2";
import GObject, { getter, register } from "gnim/gobject";

interface SerializedGamepadButton {
	pressed: boolean;
	touched: boolean;
	value: number;
}

// type SerializedGamepad = {
// 	id: string;
// 	index: number;
// } & (
// 	| {
// 			connected: false;
// 	  }
// 	| {
// 			connected: true;
// 			buttons: SerializedGamepadButton[];
// 			axes: number[];
// 	  }
// );

namespace Gamepad {
	export enum GamepadDirection {
		NONE = "none",
		UP = "up",
		DOWN = "down",
		LEFT = "left",
		RIGHT = "right",
	}

	export enum ButtonId {
		SOUTH = 304,
		EAST = 305,
		WEST = 308,
		NORTH = 307,
		DPAD_DOWN = 545,
		DPAD_RIGHT = 547,
		DPAD_LEFT = 546,
		DPAD_UP = 544,
		LEFT_STICK = 317,
		RIGHT_STICK = 318,
		LEFT_BUMPER = 310,
		RIGHT_BUMPER = 311,
		LEFT_TRIGGER = 312,
		RIGHT_TRIGGER = 313,
		SELECT = 314,
		START = 315,
		GUIDE = 316,
	}

	@register()
	export class GamepadButton extends GObject.Object {
		private _pressed = false;
		private _touched = false;
		private _value = 0;

		constructor(
			private readonly _id: ButtonId,
			initial: SerializedGamepadButton,
		) {
			super();

			if (initial) {
				this._pressed = initial.pressed;
				this._touched = initial.touched;
				this._value = initial.value;
			}
		}

		update(json: SerializedGamepadButton) {
			if (this._pressed !== json.pressed) {
				this._pressed = json.pressed;
				this.notify("is_pressed");
			}

			if (this._touched !== json.touched) {
				this._touched = json.touched;
				this.notify("is_touched");
			}

			if (this._value !== json.value) {
				this._value = json.value;
				this.notify("value");
			}
		}

		@getter(Boolean)
		get is_pressed() {
			return this._pressed;
		}

		@getter(Boolean)
		get is_touched() {
			return this._touched;
		}

		@getter(Number)
		get value() {
			return this._value;
		}

		@getter(Number)
		get button_id() {
			return this._id;
		}
	}

	@register()
	export class Gamepad extends GObject.Object {
		private _axes: number[] = [];
		private _connected = true;
		private _direction = GamepadDirection.NONE;
		private readonly _buttons = new Map<ButtonId, GamepadButton>();

		private _id: string;

		constructor(
			private readonly _index: number,
			private readonly _device: Manette.Device,
		) {
			super();

			this._id = _device.get_guid();

			// --- DEVICE DISCONNECT ---
			this._device.connect("disconnected", () => {
				this._connected = false;
				this._buttons.clear();
				this._axes = [];
				this.notify("is_connected");
				this.notify("buttons");
				this.notify("axes");
			});

			for (const [name, index] of Object.entries(ButtonId)) {
				if (typeof index != "number") {
					continue;
				}

				this.ensureButtonIndex(index);
				if (this._device.has_input(1, index)) {
					console.log("Gamepad has button", name);
				} else {
					console.log("Gamepad doesn't have button", name);
				}
			}

			const DIRECTIONAL_BUTTONS: Partial<Record<ButtonId, GamepadDirection>> = {
				[ButtonId.DPAD_DOWN]: GamepadDirection.DOWN,
				[ButtonId.DPAD_UP]: GamepadDirection.UP,
				[ButtonId.DPAD_LEFT]: GamepadDirection.UP,
				[ButtonId.DPAD_RIGHT]: GamepadDirection.RIGHT,
			};

			// --- BUTTON PRESS ---
			this._device.connect("button-press-event", (_device, event) => {
				const [ok, buttonIndex] = event.get_button();
				if (!ok) return;

				console.log("BUTTON INDEX", buttonIndex);

				this.ensureButtonIndex(buttonIndex);
				this._buttons.get(buttonIndex)?.update({
					pressed: true,
					touched: true,
					value: 1,
				});

				const direction = DIRECTIONAL_BUTTONS[buttonIndex as ButtonId];
				if (direction && this._direction !== direction) {
					this._direction = direction;
					this.notify("direction");
				}
			});

			// --- BUTTON RELEASE ---
			this._device.connect("button-release-event", (_device, event) => {
				const [ok, buttonIndex] = event.get_button();
				if (!ok) return;

				this.ensureButtonIndex(buttonIndex);
				this._buttons.get(buttonIndex)?.update({
					pressed: false,
					touched: false,
					value: 0,
				});

				const direction = DIRECTIONAL_BUTTONS[buttonIndex as ButtonId];
				if (direction && direction == this._direction) {
					this._direction = GamepadDirection.NONE;
					this.notify("direction");
				}
			});

			this._device.connect("absolute-axis-event", (_device, event) => {
				const [ok, axisIndex, value] = event.get_absolute();
				if (!ok) return;

				this.ensureAxisIndex(axisIndex);

				if (this._axes[axisIndex] !== value) {
					this._axes[axisIndex] = value;
					this.notify("axes");
				}
			});

			this.setupDirectionTracking();
		}

		// --- Helpers ---

		private ensureButtonIndex(index: ButtonId) {
			if (!this._buttons.has(index)) {
				this._buttons.set(
					index,
					new GamepadButton(index, {
						pressed: false,
						touched: false,
						value: 0,
					}),
				);
				this.notify("buttons");
			}
		}

		private ensureAxisIndex(index: number) {
			if (this._axes[index] === undefined) {
				this._axes[index] = 0;
				this.notify("axes");
			}
		}

		private setupDirectionTracking() {
			let joystickDirection = GamepadDirection.NONE;

			this.connect("notify::axes", () => {
				if (this._axes.length < 2) return;

				const x = Math.round(this._axes[0]);
				const y = Math.round(this._axes[1]);

				let direction = GamepadDirection.NONE;

				if (!y) {
					if (x === 1) direction = GamepadDirection.RIGHT;
					if (x === -1) direction = GamepadDirection.LEFT;
				}

				if (!x) {
					if (y === 1) direction = GamepadDirection.DOWN;
					if (y === -1) direction = GamepadDirection.UP;
				}

				if (joystickDirection !== direction) {
					joystickDirection = direction;
					if (this._direction !== direction) {
						this._direction = direction;
						this.notify("direction");
					}
				}
			});
		}

		// --- Getters ---

		@getter(Object)
		get device() {
			return this._device;
		}

		@getter(Object)
		get buttons() {
			return [...this._buttons.values()];
		}

		get_button(id: ButtonId) {
			return this._buttons.get(id) || null;
		}

		@getter(Object)
		get axes() {
			return [...this._axes];
		}

		@getter(String)
		get id() {
			return this._id;
		}

		@getter(Number)
		get index() {
			return this._index;
		}

		@getter(Boolean)
		get is_connected() {
			return this._connected;
		}

		@getter(String)
		get direction() {
			return this._direction;
		}
	}

	@register()
	export class GamepadService extends GObject.Object {
		private readonly _gamepads = new Map<number, Gamepad>();
		private _currentIndex = 0;

		constructor() {
			super();

			const newDevice = (device: Manette.Device) => {
				const index = this._currentIndex++;
				this._gamepads.set(index, new Gamepad(index, device));
			};

			const monitor = new Manette.Monitor();

			monitor.connect("device-connected", (_monitor, device) => {
				console.log("DEVICE CONNECTED", device.get_name());
				newDevice(device);
				this.notify("gamepads");
			});

			monitor.connect("device-disconnected", (_monitor, device) => {
				for (const [index, gamepad] of this._gamepads) {
					if (gamepad.device == device) {
						this._gamepads.delete(index);
						this.notify("gamepads");
					}
				}
			});

			const iter = monitor.iterate();
			let changed = false;
			while (true) {
				const [ok, device] = iter.next();
				if (!ok || !device) {
					break;
				}

				newDevice(device);
				changed = true;
			}
			if (changed) {
				this.notify("gamepads");
			}
		}

		@getter(Object)
		get gamepads() {
			return Array.from(this._gamepads.values())
				.map((gamepad) => gamepad)
				.sort((a, b) => a.index - b.index);
		}

		connectForAllGamepads(
			signal: string,
			callback: (gamepad: Gamepad.Gamepad) => void,
			sendOnListUpdate?: boolean,
		) {
			const destroyer = new Destroyer();
			let listDestroyer: Destroyer | null = null;
			const listUpdate = () => {
				listDestroyer?.destroy();
				listDestroyer = new Destroyer();
				const gamepads = this.gamepads;
				for (const gamepad of gamepads) {
					listDestroyer.addDisconnect(
						gamepad,
						gamepad.connect(signal, () => callback(gamepad)),
					);
					if (sendOnListUpdate) {
						callback(gamepad);
					}
				}
			};
			destroyer.addDisconnect(
				this,
				this.connect("notify::gamepads", listUpdate),
			);
			destroyer.add(() => listDestroyer?.destroy());
			listUpdate();

			return () => destroyer.destroy();
		}

		connectForAllGamepadButtons(
			signal: string,
			callback: (
				gamepad: Gamepad.Gamepad,
				button: Gamepad.GamepadButton,
			) => void,
		) {
			const destroyers = new Map<number, Destroyer>();
			const destroy = this.connectForAllGamepads(
				"notify::buttons",
				(gamepad) => {
					destroyers.get(gamepad.index)?.destroy();
					const destroyer = new Destroyer();
					destroyers.set(gamepad.index, destroyer);

					for (const button of gamepad.buttons) {
						destroyer.addDisconnect(
							button,
							button.connect(signal, () => callback(gamepad, button)),
						);
					}
				},
				true,
			);
			return () => {
				destroy();
				for (const destroyer of destroyers.values()) {
					destroyer.destroy();
				}
			};
		}
	}

	let instance: GamepadService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new GamepadService();
		}
		return instance;
	}
}

export default Gamepad;
