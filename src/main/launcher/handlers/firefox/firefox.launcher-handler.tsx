import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import { doesCommandExist } from "@util/cli";
import { monitorFile, readFileAsync } from "ags/file";
import { HOME } from "@const/home";
import { execAsync } from "ags/process";
import { CACHE_DIRECTORY } from "@const/cache-directory";
import { WORKING_DIRECTORY } from "@const/working-directory";
import { toSearchParams } from "@util/string";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import styles from "./firefox.launcher-handler.style";

const MOZLZ4_FILE = `${HOME}/.mozilla/firefox/default/search.json.mozlz4`;

type DefaultSearchEngineName =
	| "Google"
	| "Bing"
	| "DuckDuckGo"
	| "Yahoo"
	| "Amazon"
	| "Wikipedia"
	| "eBay";

type FirefoxSearchEngine =
	| {
			_isAppProvided: true;
			_metaData: {
				alias?: string; // starts with @
				order?: number;
				hidden?: boolean;
				hideOneOffButton?: boolean;
			};
			_name: DefaultSearchEngineName;
	  }
	| {
			_isAppProvided: false;
			_definedAliases: string[];
			_loadPath: string;
			_metadata: {};
			_name: string;
			_updateInterval: number; // ms
			_urls: [
				{
					template: string;
					params?: {
						name: string;
						value: string;
					}[];
					rels: any[]; // unknown, I don't use it
				},
			];
			iconUpdateUrl: string;
	  };

type FirefoxSearchJson = {
	engines: FirefoxSearchEngine[];
};

type Engine = {
	name: string;
	aliases: string[];
	url: string;
	engine: FirefoxSearchEngine;
	image: string | null;
};

const DEFAULT_SEARCH_ENGINE_TEMPLATES: Record<DefaultSearchEngineName, string> =
	{
		Google: "https://www.google.com/search?q={searchTerms}",
		Bing: "https://www.bing.com/search?q={searchTerms}",
		DuckDuckGo: "https://duckduckgo.com/?q={searchTerms}",
		Yahoo: "https://search.yahoo.com/search?p={searchTerms}",
		Amazon: "https://www.amazon.com/s?k={searchTerms}",
		Wikipedia:
			"https://en.wikipedia.org/wiki/Special:Search?search={searchTerms}",
		eBay: "https://www.ebay.com/sch/i.html?_nkw={searchTerms}",
	};

export class FirefoxLauncherHandler extends LauncherHandler {
	private query = "";
	private engines: Engine[] = [];
	private activeEngines: Engine[] = [];

	constructor(setQuery: (query: string) => void) {
		super("Firefox", setQuery, false);

		doesCommandExist("mozlz4a")
			.then((enabled) => {
				this.setEnabled(enabled);
				if (enabled) {
					this.updateSearchEngines().catch(console.error);
					monitorFile(MOZLZ4_FILE, () => {
						this.updateSearchEngines().catch(console.error);
					});
				}
			})
			.catch(console.error);
	}

	private async updateSearchEngines() {
		if (!this.isEnabled()) {
			return;
		}

		await execAsync([
			"mozlz4a",
			"-d",
			MOZLZ4_FILE,
			`${CACHE_DIRECTORY}/firefox.json`,
		]);
		const json: FirefoxSearchJson = JSON.parse(
			await readFileAsync(`${CACHE_DIRECTORY}/firefox.json`),
		);
		this.engines = [];

		for (let engine of json.engines) {
			if (engine._isAppProvided) {
				const url = DEFAULT_SEARCH_ENGINE_TEMPLATES[engine._name];

				if (!url || engine._metaData.hidden) {
					continue;
				}

				this.engines.push({
					name: engine._name,
					aliases: [engine._metaData.alias || ""].filter(Boolean),
					url,
					engine,
					image: `${WORKING_DIRECTORY}/assets/firefox-search-engines/builtin/${engine._name}.png`,
				});
			} else if (engine._urls.length) {
				let url = engine._urls[0].template;

				if (engine._urls[0].params?.length) {
					const searchParams: Record<string, string> = {};
					for (let param of engine._urls[0].params) {
						const valueParts = param.value.split("{searchTerms}");
						searchParams[param.name] = valueParts
							.map(encodeURIComponent)
							.join("{searchTerms}");
					}

					const queryString = toSearchParams(searchParams, false);
					if (url.includes("?")) {
						url += `&${queryString}`;
					} else {
						url += `?${queryString}`;
					}
				}

				this.engines.push({
					name: engine._name,
					aliases: engine._definedAliases.filter(Boolean),
					url,
					engine,
					image: `${WORKING_DIRECTORY}/assets/firefox-search-engines/custom/${engine._name}.png`,
				});
			}
		}
		console.log("Updated Firefox search engines.");
	}

	private removeQueryPrefix(query: string, engine: Engine) {
		for (let alias of engine.aliases) {
			if (query.toLowerCase().startsWith(alias.toLowerCase())) {
				query = query.substring(alias.length);
				if (query.startsWith(" ")) {
					query = query.substring(1);
				}
				break;
			}
		}
		return query;
	}

	public update(query: string): void {
		this.query = query;
		this.activeEngines = this.engines.filter(
			(engine) =>
				engine.aliases.filter(
					(alias) =>
						query.toLowerCase() == alias.toLowerCase() ||
						query.toLowerCase().startsWith(alias.toLowerCase() + " "),
				).length,
		);
		this.triggerUpdate(null);
	}

	public getContent(
		entryId: string,
		_window: Astal.Window,
	): GObject.Object | null {
		const engine = this.engines.find((engine) =>
			engine.aliases.includes(entryId),
		);

		if (!engine) {
			return null;
		}

		const query = this.removeQueryPrefix(this.query, engine);

		return (
			<box
				orientation={Gtk.Orientation.VERTICAL}
				hexpand
				valign={Gtk.Align.CENTER}
			>
				{engine.image && <image file={engine.image} pixelSize={64} />}
				<label cssClasses={[styles.engineName]} wrap label={engine.name} />
				<label cssClasses={[styles.query]} wrap label={query} />
			</box>
		);
	}

	public getEntries(): LauncherEntry[] {
		return this.activeEngines.map((engine) => ({
			id: engine.aliases[0],
			name: engine.name,
			icon: null,
		}));
	}

	public getIcon(): string {
		return "firefox-symbolic";
	}

	private open(engine: Engine, query: string, window: Astal.Window) {
		const url = engine.url
			.split("{searchTerms}")
			.join(encodeURIComponent(query));

		const hyprland = AstalHyprland.get_default();
		hyprland.message(
			`dispatch exec firefox ${url}`, // todo: sanitize
		);
		window.visible = false;
	}

	public onEnter(entryId: string, window: Astal.Window): void {
		const engine = this.engines.find((engine) =>
			engine.aliases.includes(entryId),
		);

		if (!engine) {
			return;
		}

		this.open(engine, this.removeQueryPrefix(this.query, engine), window);
	}
}
