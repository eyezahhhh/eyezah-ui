import A from "gi://AccountsService?version=1.0";
import GObject, { getter, register } from "gnim/gobject";

namespace Accounts {
	@register()
	export class AccountsService extends GObject.Object {
		private _users: A.User[];

		constructor() {
			super();
			const manager = A.UserManager.get_default();
			if (manager.isLoaded) {
				console.log("ACCOUNTS MANAGER LOADED");
				this._users = manager.list_users();
			} else {
				this._users = [];
				manager.connect("notify::is-loaded", () => {
					if (manager.isLoaded) {
						this._users = manager.list_users();
						this.notify("users");
					}
				});
			}

			manager.connect("user-added", (_manager, user) => {
				this._users = [...this._users, user];
				this.notify("users");
			});

			manager.connect("user-removed", (_manager, user) => {
				const length = this._users.length;
				this._users = this._users.filter(
					(existingUser) => existingUser.uid !== user.uid,
				);
				if (length != this._users.length) {
					this.notify("users");
				}
			});
		}

		@getter(Object)
		get users() {
			return [...this._users];
		}
	}

	let instance: AccountsService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new AccountsService();
		}
		return instance;
	}
}

export default Accounts;
