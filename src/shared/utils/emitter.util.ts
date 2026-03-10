export class Emitter<T extends Record<string, any[]>> {
	private readonly listeners = new Map<
		string | number | symbol,
		Set<(...args: any[]) => void>
	>();

	addEventListener = <K extends keyof T>(
		event: K,
		callback: (...args: T[K]) => void,
	) => {
		const listeners = this.listeners.get(event);
		if (listeners) {
			listeners.add(callback);
		} else {
			this.listeners.set(event, new Set([callback]));
		}
		return () => this.removeEventListener(event, callback);
	};

	removeEventListener = <K extends keyof T>(
		event: K,
		callback: (...args: T[K]) => void,
	) => {
		const listeners = this.listeners.get(event);
		if (listeners) {
			listeners.delete(callback);
			if (!listeners.size) {
				this.listeners.delete(event);
			}
		}
	};

	protected emit<K extends keyof T>(event: K, ...response: T[K]) {
		const listeners = this.listeners.get(event);
		if (listeners) {
			for (let callback of listeners) {
				callback(...response);
			}
		}
	}

	protected removeAllListeners() {
		this.listeners.clear();
	}
}

export class StandaloneEmitter<
	T extends Record<string, any[]>,
> extends Emitter<T> {
	public emit<K extends keyof T>(event: K, ...response: T[K]) {
		super.emit(event, ...response);
	}
	public removeAllListeners(): void {
		super.removeAllListeners();
	}
}
