import { IconProps } from "@interface/icon-props";
import { getNetworkOverviewIcon } from "@util/icon";
import { onCleanup } from "gnim";

interface Props extends IconProps {}

export function NetworkOverviewIcon({ cssClasses, iconSize }: Props) {
	const { icon, cleanup } = getNetworkOverviewIcon();

	onCleanup(cleanup);

	return <image iconName={icon} cssClasses={cssClasses} iconSize={iconSize} />;
}
