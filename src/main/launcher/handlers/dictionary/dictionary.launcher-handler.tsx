import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import { fetch } from "@util/http";
import Gio from "gi://Gio?version=2.0";
import { unduplicate } from "@util/array";
import styles from "./dictionary.launcher-handler.style";

interface DictionaryResponse {
	word: string;
	phonetic: string;
	phonetics: {
		text: string;
		audio?: string;
	}[];
	origin: string;
	meanings: {
		partOfSpeech: string;
		definitions: {
			definition: string;
			example: string;
			synonyms: string[];
			antonyms: string[];
		}[];
	}[];
}

export class DictionaryLauncherHandler extends LauncherHandler {
	private cancellable: Gio.Cancellable | null = null;
	private words: DictionaryResponse[] = [];

	constructor(setQuery: (query: string) => void) {
		super("Dictionary", setQuery, true);
	}

	public update(query: string): void {
		this.cancellable?.cancel();
		this.words = [];
		this.triggerUpdate(query);

		if (!query.trim()) {
			return;
		}

		const cancellable = new Gio.Cancellable();
		this.cancellable = cancellable;
		this.setLoading(true);

		fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${query}`, {
			cancellable,
		})
			.then((response) => response.json())
			.then((json) => {
				if (!Array.isArray(json)) {
					return;
				}
				this.words = json;
				this.triggerUpdate(query);
			})
			.catch((e) => {
				if (cancellable.is_cancelled()) {
					return;
				}
				console.error(`Error fetching dictionary for query "${query}":`, e);
			})
			.finally(() => {
				if (this.cancellable == cancellable) {
					this.cancellable = null;

					if (!cancellable.is_cancelled()) {
						this.setLoading(false);
					}
				}
			});
	}

	public getContent(
		entryId: string,
		_window: Astal.Window,
	): GObject.Object | null {
		const words = this.words.filter((section) => section.word == entryId);
		if (!words.length) {
			return null;
		}

		return (
			<box orientation={Gtk.Orientation.VERTICAL}>
				{words.map((word) => (
					<box
						orientation={Gtk.Orientation.VERTICAL}
						cssClasses={[styles.container]}
					>
						<box cssClasses={[styles.top]}>
							<label cssClasses={[styles.word]} wrap label={word.word} />
							<label valign={Gtk.Align.CENTER} wrap label={word.phonetic} />
						</box>
						<box orientation={Gtk.Orientation.VERTICAL}>
							{word.meanings.map((meaning) => (
								<box orientation={Gtk.Orientation.VERTICAL}>
									<label
										cssClasses={[styles.partOfSpeech]}
										halign={Gtk.Align.START}
										wrap
										label={meaning.partOfSpeech}
									/>
									{meaning.definitions.map((definition) => (
										<box orientation={Gtk.Orientation.VERTICAL}>
											<label
												cssClasses={[styles.definition]}
												halign={Gtk.Align.START}
												widthRequest={100}
												xalign={0}
												wrap
												label={definition.definition}
											/>
											{!!definition.example && (
												<label
													cssClasses={[styles.example]}
													halign={Gtk.Align.START}
													widthRequest={100}
													xalign={0}
													wrap
													label={definition.example}
												/>
											)}
										</box>
									))}
								</box>
							))}
						</box>
					</box>
				))}
			</box>
		);
	}

	public getEntries(): LauncherEntry[] {
		if (!this.words.length) {
			return [];
		}
		return unduplicate(this.words, (word) => word.word).map((word) => ({
			id: word.word,
			name: word.word,
			icon: null,
		}));
	}

	public getIcon(): string {
		return "accessories-dictionary-symbolic";
	}
}
