import Gio from "gi://Gio?version=2.0";
import { getIconTheme } from "./icon.util";

interface CacheEntry {
	icons: string[];
	timeout: ReturnType<typeof setTimeout>;
}

const cache = new Map<string, CacheEntry>();
const promises = new Map<
	string,
	((icons: string[] | null, error: any) => void)[]
>();

Gio._promisify(Gio.File.prototype, "query_info_async", "query_info_finish");

async function getIconsForFile(path: string) {
	const iconTheme = getIconTheme();

	const file = Gio.file_new_for_path(path);
	const fileInfo = await file.query_info_async(
		"standard::icon",
		Gio.FileQueryInfoFlags.NONE,
		1,
		null,
	);
	const gioIcon = fileInfo.get_icon();
	if (!gioIcon) {
		return [];
	}
	const iconNames: string[] = (gioIcon as any).names;
	return iconNames.filter((n) => iconTheme.has_icon(n));
}

export async function getIcons(path: string) {
	const existingValue = cache.get(path);
	if (existingValue) {
		return existingValue.icons;
	}
	let existingPromises = promises.get(path);
	if (!existingPromises) {
		existingPromises = [];
		promises.set(path, existingPromises);

		getIconsForFile(path)
			.then((icons) => {
				const existingCache = cache.get(path);
				if (existingCache) {
					clearTimeout(existingCache.timeout);
				}
				cache.set(path, {
					icons,
					timeout: setTimeout(() => {
						cache.delete(path);
					}, 600_000), // 10 minutes
				});
				for (let callback of existingPromises!) {
					callback(icons, null);
				}
			})
			.catch((error) => {
				for (let callback of existingPromises!) {
					callback(null, error);
				}
			})
			.finally(() => {
				promises.delete(path);
			});
	}

	return new Promise<string[]>((resolve, reject) => {
		existingPromises.push((icons, error) => {
			if (icons) {
				resolve(icons);
			} else {
				reject(error);
			}
		});
	});
}

export async function bulkGetIcons(paths: string[]) {
	const icons: (string[] | null)[] = Array(paths.length).fill(null);

	const promises = paths.map((path, index) =>
		getIcons(path).then((list) => {
			icons[index] = list;
		}),
	);

	await Promise.allSettled(promises);
	return icons;
}
