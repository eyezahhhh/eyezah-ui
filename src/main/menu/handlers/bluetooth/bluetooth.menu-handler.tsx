import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import styles from "./bluetooth.menu-handler.style";

export class BluetoothMenuHandler extends MenuHandler {
	constructor() {
		super("bluetooth");
	}

	public getContent(
		window: GObject.Object,
		data: string | number | null,
	): GObject.Object {
		throw new Error("Method not implemented.");
	}
}
