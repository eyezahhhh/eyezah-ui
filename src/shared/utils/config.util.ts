import { CONFIG_LOCATION } from "@const/config-location";
import { readFile } from "ags/file";
import Yaml from "yaml";

console.log(`[CONFIG] Reading config file from "${CONFIG_LOCATION}"`);
const configString = readFile(CONFIG_LOCATION);

const configObject = Yaml.parse(configString, {
	prettyErrors: true,
});

type PrimitiveMap = {
	string: string;
	number: number;
	boolean: boolean;
};

export type InferConfig<T> = {
	[K in keyof T]: T[K] extends keyof PrimitiveMap
		? PrimitiveMap[T[K]]
		: T[K] extends object
			? InferConfig<T[K]>
			: never;
};

type ConfigTemplateValue = ConfigTemplate | "string" | "boolean" | "number";
export type ConfigTemplate = {
	[K in string]: ConfigTemplateValue | [ConfigTemplateValue];
};

export class ConfigSection {
	constructor(
		private readonly key: string,
		private readonly object: any,
	) {}

	get(key: string, nullable?: boolean) {
		const parts = key.split(".");
		let object = this.object;
		for (let [index, part] of parts.entries()) {
			const path = parts.slice(0, index).join(".");

			if (!(part in object)) {
				if (nullable) {
					return null;
				}
				throw new Error(`Config part "${path}" does not exist`);
			}
			object = object[part];

			if (index < parts.length - 1 && typeof object != "object") {
				throw new Error(`Config part "${path}" is not type Object`);
			}
		}

		return object;
	}

	getKeys() {
		return Array.from(Object.keys(this.object));
	}

	private getEnsureType(
		key: string,
		type: "string",
		nullable?: boolean,
	): string | null;
	private getEnsureType(
		key: string,
		type: "boolean",
		nullable?: boolean,
	): boolean | null;
	private getEnsureType(
		key: string,
		type: "number",
		nullable?: boolean,
	): number | null;
	private getEnsureType(
		key: string,
		type: "object",
		nullable?: boolean,
	): object | null;

	private getEnsureType(key: string, type: string, nullable?: boolean) {
		const value = this.get(key, nullable);
		if (value === null) {
			return null;
		}

		if (typeof value != type) {
			throw new Error(`Config part "${key} is not type ${type}`);
		}

		return value;
	}

	getString(key: string, nullable?: false): string;
	getString(key: string, nullable: true): string | null;
	getString(key: string, nullable?: boolean) {
		try {
			if (key.endsWith("File")) {
				throw new Error("Key is always a file");
			}
			const filePath = this.getEnsureType(`${key}File`, "string")!;
			const contents = readFile(filePath); // todo: cache file contents for duplicate lookups
			console.log(
				`[CONFIG] Using file path for "${key}File" because it exists`,
			);
			return contents;
		} catch {
			return this.getEnsureType(key, "string", nullable);
		}
	}

	getBoolean(key: string, nullable?: false): boolean;
	getBoolean(key: string, nullable: true): boolean | null;
	getBoolean(key: string, nullable?: boolean) {
		return this.getEnsureType(key, "boolean", nullable);
	}

	getNumber(key: string, nullable?: false): number;
	getNumber(key: string, nullable: true): number | null;
	getNumber(key: string, nullable?: boolean) {
		return this.getEnsureType(key, "number", nullable);
	}

	getSection(key: string, nullable?: false): ConfigSection;
	getSection(key: string, nullable: true): ConfigSection | null;
	getSection(key: string, nullable?: boolean) {
		const object = this.getEnsureType(key, "object", nullable);
		if (object === null) {
			return null;
		}
		return new ConfigSection(key, object);
	}

	getAsTemplate<T extends ConfigTemplate>(
		key: string,
		template: T,
		partial?: false,
	): InferConfig<T>;
	getAsTemplate<T extends ConfigTemplate>(
		key: string,
		template: T,
		partial: true,
	): Partial<InferConfig<T>>;
	getAsTemplate<T extends ConfigTemplate>(
		key: string,
		template: T,
		partial?: boolean,
	) {
		const source = this.get(key);
		const output: Partial<T> = {};
		const paths: (string | number)[][] = [[]];

		const traverse = (object: any, path: (string | number)[]) => {
			for (const part of path) {
				if (typeof object != "object") {
					throw new Error("Template path traversal failed");
				}
				object = object[part];
			}
			return object;
		};

		for (const path of paths) {
			const templateSection = traverse(
				template,
				path.map((part) => (typeof part == "number" ? 0 : part)),
			) as ConfigTemplateValue | [ConfigTemplateValue];
			const sourceSection = traverse(source, path);
			const destSection = traverse(output, path);

			if (Array.isArray(templateSection)) {
				if (!Array.isArray(sourceSection)) {
					if (partial) {
						continue;
					}
					throw new Error(
						`Config template part "${path.join(".")}" is not an array`,
					);
				}

				const type = templateSection[0];

				for (let i = 0; i < sourceSection.length; i++) {
					const newPath = [...path, i];
					const value = sourceSection[i];

					if (typeof type == "object") {
						if (typeof value != "object") {
							if (partial) {
								continue;
							}
							throw new Error(
								`Config template part "${newPath.join(".")}" is not an object`,
							);
						}
						paths.push(newPath);
						if (Array.isArray(type)) {
							destSection[i] = [];
						} else {
							destSection[i] = {};
						}
					} else {
						if (typeof value != type) {
							if (partial) {
								continue;
							}
							throw new Error(
								`Config template part "${newPath.join(".")}" is not a ${type}`,
							);
						}

						destSection[i] = value;
					}
				}

				continue;
			}

			for (const [key, type] of Object.entries(templateSection) as [
				string,
				ConfigTemplateValue,
			][]) {
				const newPath = [...path, key];
				const value = sourceSection[key];
				if (value === undefined || value === null) {
					if (partial) {
						continue;
					}
					throw new Error(
						`Config template part "${newPath.join(".")}" is missing`,
					);
				}

				if (typeof type == "object") {
					if (typeof value != "object") {
						if (partial) {
							continue;
						}
						throw new Error(
							`Config template part "${newPath.join(".")}" is not an object`,
						);
					}
					paths.push(newPath);
					if (Array.isArray(type)) {
						destSection[key] = [];
					} else {
						destSection[key] = {};
					}
				} else {
					if (typeof value != type) {
						if (partial) {
							continue;
						}
						throw new Error(
							`Config template part "${newPath.join(".")}" is not a ${type}`,
						);
					}

					destSection[key] = value;
				}
			}
		}

		return output as InferConfig<T>;
	}
}

const Config = new ConfigSection("", configObject);
export default Config;
