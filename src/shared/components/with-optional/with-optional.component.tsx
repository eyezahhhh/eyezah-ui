import { Accessor, Fragment, With } from "gnim";

interface Props<T, E> {
	value: T | Accessor<T>;
	children: (value: T) => E;
}

export function WithOptional<T, E extends JSX.Element>({
	value,
	children,
}: Props<T, E>) {
	if (value instanceof Accessor) {
		return <With value={value}>{children}</With>;
	}
	return children(value);
}
