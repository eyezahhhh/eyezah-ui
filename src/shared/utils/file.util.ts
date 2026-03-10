import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

export function getFileInfo(file: Gio.File) {
	return new Promise<Gio.FileInfo>((resolve, reject) => {
		file.query_info_async(
			"standard::type",
			Gio.FileQueryInfoFlags.NONE,
			GLib.PRIORITY_DEFAULT_IDLE,
			null,
			(_file, result) => {
				try {
					resolve(file.query_info_finish(result));
				} catch (e) {
					reject(e);
				}
			},
		);
	});
}

export function getFileInfoSync(file: Gio.File) {
	return file.query_info("standard::type", Gio.FileQueryInfoFlags.NONE, null);
}

export async function getFileType(file: Gio.File) {
	const info = await getFileInfo(file);
	return info.get_file_type();
}

export function getFileTypeSync(file: Gio.File) {
	const info = getFileInfoSync(file);
	return info.get_file_type();
}

export function makeDirectory(file: Gio.File) {
	return new Promise<void>((resolve, reject) => {
		file.make_directory_async(
			GLib.PRIORITY_DEFAULT_IDLE,
			null,
			(_file, result) => {
				try {
					const success = file.make_directory_finish(result);
					if (!success) {
						throw new Error("Failed to create directory");
					}
					resolve();
				} catch (e) {
					reject(e);
				}
			},
		);
	});
}

export function makeDirectorySync(file: Gio.File) {
	file.make_directory(null);
}

export async function makeDirectoryRecursive(file: Gio.File) {
	try {
		await makeDirectory(file);
	} catch (e) {
		if (e instanceof GLib.Error) {
			if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
				const type = await getFileType(file);
				if (type == Gio.FileType.DIRECTORY) {
					return;
				}
			}

			if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
				const parent = file.get_parent();
				if (!parent) {
					throw new Error("Root doesn't exist? What the fuck.");
				}
				await makeDirectoryRecursive(parent);
				await makeDirectory(file);
				return;
			}
		}
		throw e;
	}
}

export function makeDirectoryRecursiveSync(file: Gio.File) {
	try {
		makeDirectorySync(file);
	} catch (e) {
		if (e instanceof GLib.Error) {
			if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
				const type = getFileTypeSync(file);
				if (type == Gio.FileType.DIRECTORY) {
					return;
				}
			}

			if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
				const parent = file.get_parent();
				if (!parent) {
					throw new Error("Root doesn't exist? What the fuck.");
				}
				makeDirectoryRecursiveSync(parent);
				makeDirectorySync(file);
				return;
			}
		}
		throw e;
	}
}

export async function scanDirectory(file: Gio.File) {
	const type = await getFileType(file);
	if (type != Gio.FileType.DIRECTORY) {
		throw new Error("Path is not a directory");
	}

	return new Promise<Gio.FileInfo[]>((resolve, reject) => {
		file.enumerate_children_async(
			"standard::*",
			null,
			GLib.PRIORITY_DEFAULT_IDLE,
			null,
			async (_file, result) => {
				try {
					const enumerator = file.enumerate_children_finish(result);
					const files: Gio.FileInfo[] = [];

					const next = () =>
						new Promise<Gio.FileInfo[]>((resolve, reject) => {
							enumerator.next_files_async(
								10,
								GLib.PRIORITY_DEFAULT_IDLE,
								null,
								(_enumerator, result) => {
									try {
										resolve(enumerator.next_files_finish(result));
									} catch (e) {
										reject(e);
									}
								},
							);
						});

					while (true) {
						try {
							const filesChunk = await next();
							if (filesChunk.length) {
								files.push(...filesChunk);
							} else {
								resolve(files);
								break;
							}
						} catch (e) {
							reject(e);
							break;
						}
					}
				} catch (e) {
					reject(e);
				}
			},
		);
	});
}

export function writeFileOrSymlink(
	file: string | Gio.File,
	content: string,
): Promise<Gio.File> {
	return new Promise((resolve, reject) => {
		const gfile = typeof file === "string" ? Gio.File.new_for_path(file) : file;
		const path = typeof file === "string" ? file : gfile.get_path();

		if (!path) return reject(Error("path is null"));

		const dir = GLib.path_get_dirname(path);
		if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) {
			Gio.File.new_for_path(dir).make_directory_with_parents(null);
		}

		gfile.replace_contents_bytes_async(
			new GLib.Bytes(new TextEncoder().encode(content)),
			null,
			false,
			0,
			null,
			(_, res) => {
				try {
					gfile.replace_contents_finish(res);
					resolve(gfile);
				} catch (error) {
					reject(error);
				}
			},
		);
	});
}
