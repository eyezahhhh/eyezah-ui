export function filter<T extends Object>(
	...elements: (T | null | undefined | false)[]
): T[] {
	return elements.filter((e) => e !== null && e !== undefined && e !== false);
}

export function unduplicate<T>(list: T[], predicate: (entry: T) => string) {
	const existing: string[] = [];

	const out: T[] = [];
	for (let entry of list) {
		const key = predicate(entry);
		if (!existing.includes(key)) {
			existing.push(key);
			out.push(entry);
		}
	}

	return out;
}

export function split<T>(array: T[], rowSize: number) {
	const rows: T[][] = [];

	for (let i = 0; i < array.length; i++) {
		const index = i % rowSize;
		if (index) {
			rows[rows.length - 1].push(array[i]);
		} else {
			rows.push([array[i]]);
		}
	}

	return rows;
}
