import app from "ags/gtk4/app";
import GObject, { register } from "gnim/gobject";

namespace AppRequest {
	interface Listener {
		predicate: (args: string[]) => boolean;
		respond: (args: string[]) => string | Promise<string>;
	}

	@register()
	export class AppRequestService extends GObject.Object {
		constructor() {
			super();

			this.addListener("window-query", (args) => {
				if (!args.length) {
					return "No window name specified";
				}
				const windowName = args[0];

				const window = app.get_window(windowName);
				if (window) {
					if (window.visible) {
						return "visible";
					}
					return "hidden";
				}
				return "unknown";
			});
		}
		private readonly listeners: Listener[] = [];

		public async invoke(args: string[], respond: (response: any) => void) {
			const requests = args.map((arg) => arg.split(":"));

			for (const request of requests) {
				for (const listener of this.listeners) {
					if (listener.predicate(request)) {
						try {
							const response = await listener.respond(request);
							respond(response);
						} catch (e) {
							console.error(
								`Failed to respond to app CLI request (${request.join(":")}):`,
								e,
							);
							respond("ERROR");
						}
						return;
					}
				}
			}
		}

		public addListener(
			prefix: string,
			respond: Listener["respond"],
		): () => void;
		public addListener(
			predicate: Listener["predicate"],
			respond: Listener["respond"],
		): () => void;
		public addListener(
			predicate: string | Listener["predicate"],
			respond: Listener["respond"],
		) {
			const isPrefix = typeof predicate == "string";
			if (typeof predicate == "string") {
				const prefix = predicate;
				predicate = (args) => args[0] === prefix;
			}

			const listener: Listener = {
				predicate,
				respond: (args: string[]) => respond(args.slice(isPrefix ? 1 : 0)),
			};

			this.listeners.push(listener);

			return () => {
				const index = this.listeners.indexOf(listener);
				if (index >= 0) {
					this.listeners.splice(index, 1);
				}
			};
		}
	}

	let instance: AppRequestService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new AppRequestService();
		}
		return instance;
	}
}

export default AppRequest;
