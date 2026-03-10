export function cc(...classes: (string | null | false | undefined)[]) {
	return classes.filter((className) => !!className) as string[];
}

export function compareString(a: string, b: string) {
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
}

export function plural(string: string, number: number, plural?: string) {
	if (number == 1) {
		return string;
	}
	return plural || `${string}s`;
}

export function formatTime(seconds: number): string {
	let minutes = Math.floor(seconds / 60);
	seconds -= minutes * 60;
	let hours = Math.floor(minutes / 60);
	minutes -= hours * 60;
	let days = Math.floor(hours / 24);
	hours -= days * 24;

	const order: Record<string, number> = {
		day: days,
		hour: hours,
		minute: minutes,
		second: seconds,
	};

	const keys = Object.keys(order);

	for (let i = 0; i < keys.length; i++) {
		const mainKey = keys[i];
		const mainValue = order[mainKey];

		if (!mainValue) {
			continue;
		}

		if (keys.length > i + 1) {
			const secondKey = keys[i + 1];
			const secondValue = order[secondKey];

			if (secondValue) {
				return `${mainValue} ${plural(
					mainKey,
					mainValue,
				)}, ${secondValue} ${plural(secondKey, secondValue)}`;
			}
		}

		return `${mainValue} ${plural(mainKey, mainValue)}`;
	}

	throw new Error("End of time loop reached");
}

export function toSearchParams(
	params: Record<string, string>,
	shouldEncode: boolean,
) {
	const encode = shouldEncode ? encodeURIComponent : (value: string) => value;

	let string = "";
	for (let param of Object.keys(params)) {
		if (string) {
			string += "&";
		}
		string += `${encode(param)}=${encode(params[param])}`;
	}
	return string;
}
