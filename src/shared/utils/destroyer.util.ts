interface Disconnectable {
	disconnect(id: number): void;
}

export class Destroyer {
	private readonly callbacks = new Set<() => void>();
	private destroyed = false;

	isDestroyed() {
		return this.destroyed;
	}

	add(callback: () => void) {
		if (this.isDestroyed()) {
			throw new Error("Destroyer is destroyed");
		}

		this.callbacks.add(callback);
		return () => this.remove(callback);
	}

	addDisconnect(object: Disconnectable, connectionId: number) {
		const callback = () => object.disconnect(connectionId);
		return this.add(callback);
	}

	remove(callback: () => void) {
		this.callbacks.delete(callback);
	}

	destroy() {
		if (this.isDestroyed()) {
			throw new Error("Destroyer is destroyed");
		}
		this.destroyed = true;
		for (let callback of this.callbacks) {
			callback();
		}
		this.callbacks.clear();
	}
}
