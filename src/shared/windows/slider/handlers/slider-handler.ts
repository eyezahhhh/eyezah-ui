import { Destroyer } from "@util/destroyer";

export abstract class SliderHandler {
	private percent: number;
	private readonly updateListeners = new Set<(percent: number) => void>();
	protected readonly destroyer = new Destroyer();

	constructor(percent: number) {
		this.percent = Math.max(Math.min(percent, 100), 0);
	}

	protected update(percent: number) {
		percent = Math.max(Math.min(percent, 100), 0);
		if (percent != this.percent) {
			this.percent = percent;
			this.emit();
		}
	}

	public abstract setPercent(percent: number): void;

	private emit() {
		for (const listener of this.updateListeners) {
			listener(this.percent);
		}
	}

	public getPercent() {
		return this.percent;
	}

	public addListener(listener: (percent: number) => void) {
		this.updateListeners.add(listener);
	}

	public removeListener(listener: (percent: number) => void) {
		this.updateListeners.delete(listener);
	}

	public abstract getIcon(): string;

	public destroy() {
		this.destroyer.destroy();
	}

	public isDestroyed() {
		return this.destroyer.isDestroyed();
	}
}
