import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";

export type LauncherEntry = {
	id: string;
	name: string;
	icon: string | null;
};

export abstract class LauncherHandler {
	private readonly listeners = new Set<(query: string | null) => void>();
	private readonly loadingListeners = new Set<() => void>();
	private enabled = false;
	private loading = false;
	private loadingDebounce: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly name: string,
		protected readonly setQuery: (query: string) => void,
		enabled: boolean,
	) {
		if (enabled !== undefined) {
			this.setEnabled(enabled);
		}
	}

	public getName() {
		return this.name;
	}

	public isEnabled() {
		return this.enabled;
	}

	protected setEnabled(enabled: boolean) {
		if (this.enabled != enabled) {
			this.enabled = enabled;
			this.triggerUpdate(null);
			console.log(
				`Manager "${this.getName()}" is ${this.enabled ? "enabled" : "disabled"}.`,
			);
		}
	}

	public addListener(listener: (query: string | null) => void) {
		this.listeners.add(listener);
		return () => this.removeListener(listener);
	}

	public removeListener(listener: (query: string | null) => void) {
		const wasListening = this.listeners.has(listener);
		if (wasListening) {
			this.listeners.delete(listener);
		}
		return wasListening;
	}

	protected triggerUpdate(query: string | null) {
		for (let listener of this.listeners) {
			listener(query);
		}
	}

	public abstract update(query: string): void;

	public abstract getContent(
		entryId: string,
		window: Astal.Window,
	): GObject.Object | null;

	public abstract getEntries(): LauncherEntry[];

	public onEnter(entryId: string, window: Astal.Window) {}

	public onLauncherOpen() {}

	public isLoading() {
		return this.loading;
	}

	protected setLoading(loading: boolean) {
		if (this.loadingDebounce) {
			clearTimeout(this.loadingDebounce);
		}
		if (this.loading != loading) {
			if (loading) {
				this.loadingDebounce = setTimeout(() => {
					this.loadingDebounce = null;
					this.loading = true;
					for (const listener of this.loadingListeners) {
						listener();
					}
				}, 250);
			} else {
				this.loadingDebounce = null;
				this.loading = false;
				for (const listener of this.loadingListeners) {
					listener();
				}
			}
		}
	}

	public addLoadingListener(listener: () => void) {
		this.loadingListeners.add(listener);
		return () => this.removeLoadingListener(listener);
	}

	public removeLoadingListener(listener: () => void) {
		const wasListening = this.loadingListeners.has(listener);
		if (wasListening) {
			this.loadingListeners.delete(listener);
		}
		return wasListening;
	}

	public abstract getIcon(): string;
}
