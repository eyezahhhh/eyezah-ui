import GdkPixbuf from "gi://GdkPixbuf";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

const MAX_CONCURRENT = 1;

const cache = new Map<
	string,
	{
		pixbuf: GdkPixbuf.Pixbuf;
		timeout: ReturnType<typeof setTimeout>;
	}
>();

type QueueEntry = {
	active: boolean;
	resolve?: () => void;
};

const queue: QueueEntry[] = [];

function getActiveLookups() {
	return queue.filter((entry) => entry.active).length;
}

export async function loadImageAsync(
	path: string,
	options: {
		dimensions?:
			| [number, number]
			| ((imageDimensions: [number, number]) => [number, number]);
		cancellable?: Gio.Cancellable;
	} = {},
) {
	let { dimensions, cancellable } = options;

	const entry: QueueEntry = {
		active: false,
	};

	const run = () =>
		new Promise<GdkPixbuf.Pixbuf>((resolve, reject) => {
			entry.active = true;

			const handlePixbuf = (pixbuf: GdkPixbuf.Pixbuf) => {
				if (dimensions) {
					if (typeof dimensions == "function") {
						dimensions = dimensions([pixbuf.width, pixbuf.height]);
					}
					resolve(
						pixbuf.scale_simple(...dimensions, GdkPixbuf.InterpType.BILINEAR)!,
					);
				} else {
					resolve(pixbuf);
				}
			};

			const existingPixbuf = cache.get(path);
			if (existingPixbuf) {
				handlePixbuf(existingPixbuf.pixbuf);
				clearTimeout(existingPixbuf.timeout);
				existingPixbuf.timeout = setTimeout(() => {
					const current = cache.get(path);
					if (current == existingPixbuf) {
						cache.delete(path);
					}
				}, 30_000);
			} else {
				const file = Gio.File.new_for_path(path);

				file.read_async(
					GLib.PRIORITY_LOW,
					cancellable || null,
					(_file, result) => {
						try {
							const stream = file.read_finish(result);
							GdkPixbuf.Pixbuf.new_from_stream_async(
								stream,
								cancellable || null,
								(_pixbuf, result) => {
									try {
										const pixbuf =
											GdkPixbuf.Pixbuf.new_from_stream_finish(result);
										cache.set(path, {
											pixbuf,
											timeout: setTimeout(() => {
												const current = cache.get(path);
												if (current == existingPixbuf) {
													cache.delete(path);
												}
											}, 30_000),
										});
										handlePixbuf(pixbuf);
									} catch (e) {
										reject(e);
									}
								},
							);
						} catch (e) {
							reject(e);
						}
					},
				);
			}
		}).finally(() => {
			const index = queue.indexOf(entry);
			if (index >= 0) {
				queue.splice(index, 1);
			}
			const nextEntry = queue.find((entry) => !entry.active && entry.resolve);
			if (nextEntry) {
				nextEntry.resolve!();
			}
		});

	const activeCount = getActiveLookups();
	if (activeCount >= MAX_CONCURRENT) {
		const delay = new Promise<void>((resolve) => {
			entry.resolve = resolve;
			queue.push(entry);
		});
		await delay;
		return await run();
	} else {
		queue.push(entry);
		return run();
	}
}

export function getMinimumCoverSize(
	imageWidth: number,
	imageHeight: number,
	containerWidth: number,
	containerHeight: number,
): [number, number] {
	const scale = Math.max(
		containerWidth / imageWidth,
		containerHeight / imageHeight,
	);
	return [imageWidth * scale, imageHeight * scale];
}
