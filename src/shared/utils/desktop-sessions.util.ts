import Gio from "gi://Gio?version=2.0";
import { scanDirectory } from "./file.util";
import { readFileAsync } from "ags/file";
import { IDesktopSession } from "@interface/desktop-session";

export function parseDesktopSessionFile(content: string): IDesktopSession {
	const lines = content.split(/\r?\n/);
	let foundHeader = false;
	let firstValidLine = true;
	const result: Record<string, string> = {};

	for (let line of lines) {
		line = line.trim();

		if (!line || line.startsWith("#")) {
			continue;
		}

		if (firstValidLine) {
			if (line !== "[Desktop Entry]") {
				throw new Error(
					"Invalid .desktop file: Missing or incorrect [Desktop Entry] header.",
				);
			}
			foundHeader = true;
			firstValidLine = false;
			continue;
		}

		if (line.startsWith("[") && line.endsWith("]")) {
			break;
		}

		const equalSignIndex = line.indexOf("=");
		if (equalSignIndex > 0) {
			const key = line.substring(0, equalSignIndex).trim();
			const value = line.substring(equalSignIndex + 1).trim();
			result[key] = value;
		}
	}

	if (!foundHeader) {
		throw new Error("Invalid .desktop file: File is empty or malformed.");
	}

	if (!result.Name) {
		throw new Error(`Invalid .desktop file: File doesn't contain name`);
	}
	if (!result.Exec) {
		throw new Error(`Invalid .desktop file: File doesn't contain exec`);
	}

	return {
		name: result.Name,
		exec: result.Exec,
	};
}

export async function getDesktopSessions(paths: string[]) {
	const sessions: IDesktopSession[] = [];

	for (let path of paths) {
		try {
			const files = await scanDirectory(Gio.File.new_for_path(path));
			for (let file of files) {
				const name = file.get_name();
				if (name.toLowerCase().endsWith(".desktop")) {
					try {
						const contents = await readFileAsync(`${path}/${name}`);
						const desktopSession = parseDesktopSessionFile(contents);
						sessions.push(desktopSession);
					} catch (e) {
						console.log(`Failed to create .desktop file for ${path}/${name}`);
					}
				}
			}
		} catch (e) {
			console.log(`Failed to scan for .desktop files in ${path}`);
		}
	}

	return sessions;
}
