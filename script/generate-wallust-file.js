import path from "path";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = [...process.argv];
function getFlag(flag) {
	if (!flag.startsWith("--")) {
		throw new Error(`Flag "${flag}" doesn't start with --`);
	}
	for (let i = 0; i < args.length; i++) {
		if (args[i] == flag) {
			if (i == args.length - 1) {
				throw new Error(`Option not provided for "${flag}"`);
			}
			const value = args[i + 1];
			args.splice(i, 2);
			return value;
		}
	}

	return null;
}

function getBoolean(flag) {
	if (!flag.startsWith("--")) {
		throw new Error(`Flag "${flag}" doesn't start with --`);
	}
	return args.includes(flag);
}

if (getBoolean("--dummy")) {
	writeFileSync(
		path.join(__dirname, "..", "wallust.scss"),
		`
$wallust-background: #1C2023;
$wallust-foreground: #C7CCD1;
$wallust-cursor: #C7CCD1;

$wallust-color0: #1C2023;
$wallust-color1: #C7AE95;
$wallust-color2: #95C7AE;
$wallust-color3: #AEC795;
$wallust-color4: #AE95C7;
$wallust-color5: #C795AE;
$wallust-color6: #95AEC7;
$wallust-color7: #C7CCD1;
$wallust-color8: #747C84;
$wallust-color9: #C7AE95;
$wallust-color10: #95C7AE;
$wallust-color11: #AEC795;
$wallust-color12: #AE95C7;
$wallust-color13: #C795AE;
$wallust-color14: #95AEC7;
$wallust-color15: #F3F4F5;
`,
	);
	process.exit(0);
}

const instanceId = getFlag("--instance");
if (!instanceId) {
	throw new Error("--instance is not defined");
}

const home = process.env.HOME;

const file = path.join(
	home,
	".cache",
	"ags",
	"instance",
	instanceId,
	"wallust.scss",
);
writeFileSync(
	path.join(__dirname, "..", "wallust.scss"),
	`@forward ${JSON.stringify(file.replace(/\\/g, "/"))};`,
);
