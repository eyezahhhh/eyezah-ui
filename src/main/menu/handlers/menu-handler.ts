import GObject from "gnim/gobject";

export abstract class MenuHandler {
	constructor(public readonly id: string) {}

	public abstract getContent(
		window: GObject.Object,
		data: string | number | null,
	): GObject.Object;
}
