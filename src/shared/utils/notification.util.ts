import { execAsync } from "ags/process";

export function escapeForCommand(input: string) {
	// todo
	return `'${input.replace(/'/g, "'\\''")}'`;
}

export async function sendNotification(
	summary: string,
	options: {
		body?: string;
		urgency?: "low" | "normal" | "critical";
		expireMs?: number;
		appName?: string;
		icon?: string;
		transient?: boolean;
		replaceId?: number;
	} = {},
) {
	let command = `bash -c \"notify-send -p ${escapeForCommand(summary)}`;

	if (options.body) {
		command += ` ${escapeForCommand(options.body)}`;
	}

	if (options.urgency) {
		command += ` --urgency=${options.urgency}`;
	}

	if (options.expireMs) {
		command += ` --expire-time=${options.expireMs}`;
	}

	if (options.appName) {
		command += ` --app-name=${escapeForCommand(options.appName)}`;
	}

	if (options.icon) {
		command += ` --icon=${escapeForCommand(options.icon)}`;
	}

	if (options.replaceId) {
		command += ` --replace-id=${options.replaceId}`;
	}

	if (options.transient) {
		command += ` --transient`;
	}

	command += `\"`;

	try {
		const response = await execAsync(command);
		return Number(response);
	} catch (error) {
		console.error("Failed to send notification", command, error);
		throw error;
	}
}
