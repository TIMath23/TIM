import {IController, IHttpResponse, IScope} from "angular";
import moment, {Duration, Moment} from "moment";
import {timApp} from "tim/app";
import * as focusMe from "tim/ui/focusMe";
import {Binding, capitalizeFirstLetter, dateFormat, getGroupDesc, markAsUsed, Result, to} from "tim/util/utils";
import {showMessageDialog} from "../ui/dialog";
import {durationTypes} from "../ui/durationPicker";
import {IGroup} from "../user/IUser";
import {genericglobals, itemglobals} from "../util/globals";
import {$http, $timeout} from "../util/ngimport";
import {IItem} from "./IItem";

markAsUsed(focusMe);

export interface IRight {
    type: number;
    duration_to: Moment | null;
    duration_from: Moment | null;
    duration: null | Duration;
    accessible_to: Moment;
    accessible_from: Moment;
    usergroup: IGroup;
    require_confirm?: boolean;
}

export interface IAccessType {
    id: number;
    name: string;
}

interface IItemWithRights extends IItem {
    grouprights: IRight[];
}

enum ActionOption {
    Add = "add",
    Confirm = "confirm",
    Expire = "expire",
    Remove = "remove",
}

interface IPermissionEditResponse {
    not_exist: string[];
}

function isVelpGroupItem(i: IItemWithRights) {
    return i.path.indexOf("/velp-groups/") >= 0 || i.path.endsWith("/velp-groups");
}

class RightsEditorController implements IController {
    static $inject = ["$scope", "$element"];
    private durOpt: {
        durationType: moment.unitOfTime.Base,
        durationAmount: number,
    };
    private timeOpt: {
        type: string,
        duration?: moment.Duration,
        to?: moment.Moment,
        from?: moment.Moment,
        durationTo?: moment.Moment,
        durationFrom?: moment.Moment,
    };
    private grouprights?: IRight[];
    private showActiveOnly: boolean;
    private selectedRight: IRight | null;
    private datePickerOptionsFrom: EonasdanBootstrapDatetimepicker.SetOptions;
    private datePickerOptionsTo: EonasdanBootstrapDatetimepicker.SetOptions;
    private datePickerOptionsDurationFrom: EonasdanBootstrapDatetimepicker.SetOptions;
    private datePickerOptionsDurationTo: EonasdanBootstrapDatetimepicker.SetOptions;
    private accessTypes!: IAccessType[];
    private massMode: Binding<boolean | undefined, "<">;
    private accessType: IAccessType | undefined;
    private addingRight: boolean = false;
    private focusEditor: boolean = false;
    private itemId: Binding<number | undefined, "<">;
    private listMode: boolean = false;
    private groupName: string | undefined;
    private gridOptions?: uiGrid.IGridOptionsOf<IItemWithRights>;
    private action?: ActionOption;
    private actionOption = ActionOption.Add;
    private grid?: uiGrid.IGridApiOf<IItemWithRights>;
    private gridReady = false;
    private errMsg?: string;
    private successMsg?: string;
    private loading = false;
    private orgs?: IGroup[];
    private selectedOrg?: IGroup;
    private requireConfirm = false;
    private defaultItem?: string;
    private barcodeMode?: boolean;
    private restrictRights?: string[];
    private hideRemove?: boolean;
    private forceDuration?: number;
    private forceDurationStart?: string;
    private forceDurationEnd?: string;
    private forceConfirm?: boolean;
    private hideEdit?: boolean;
    private hideExpire?: boolean;
    private lastEdited?: IRight;
    private confirmingRight?: IRight;
    private expiringRight?: IRight;
    private removingRight?: IRight;
    private confirmExpire?: boolean;

    constructor(private scope: IScope, private element: JQLite) {
        this.timeOpt = {type: "always"};
        this.durOpt = {durationType: "hours", durationAmount: 4};
        this.selectedRight = null;
        this.showActiveOnly = true;
        this.datePickerOptionsFrom = {
            format: dateFormat,
            defaultDate: moment(),
            showTodayButton: true,
        };
        this.datePickerOptionsTo = {
            format: dateFormat,
            defaultDate: moment(),
            showTodayButton: true,
        };
        this.datePickerOptionsDurationFrom = {
            format: dateFormat,
            showTodayButton: true,
        };
        this.datePickerOptionsDurationTo = {
            format: dateFormat,
            showTodayButton: true,
        };
    }

    relPath(item: IItemWithRights) {
        return item.path.slice(itemglobals().curr_item.path.length + 1);
    }

    async $onInit() {
        this.actionOption = this.action || ActionOption.Add;
        if (!this.accessTypes || !this.massMode) {
            await this.getPermissions();
        }
        if (this.forceDuration) {
            this.timeOpt.type = "duration";
            this.durOpt.durationAmount = this.forceDuration;
            this.durOpt.durationType = "hours";
            if (this.forceDurationStart) {
                this.timeOpt.durationFrom = moment(this.forceDurationStart);
            }
            if (this.forceDurationEnd) {
                this.timeOpt.durationTo = moment(this.forceDurationEnd);
            }
        }
        if (this.forceConfirm != null) {
            this.requireConfirm = this.forceConfirm;
        }
        this.accessType = this.accessTypes[0];
        if (!this.orgs) {
            const r = await to($http.get<IGroup[]>("/groups/getOrgs"));
            if (r.ok) {
                this.orgs = r.result.data;
            }
        }
        if (this.orgs) {
            this.selectedOrg = this.orgs.find((o) => o.name === genericglobals().homeOrganization + " users");
        }

        if (this.massMode) {
            this.addingRight = true;
            const data = await this.getItemsAndPreprocess();
            this.gridOptions = {
                onRegisterApi: (gridApi) => {
                    this.grid = gridApi;
                },
                data: data,
                enableSorting: true,
                enableFiltering: true,
                enableFullRowSelection: true,
                minRowsToShow: Math.min(data.length, 20),
                enableGridMenu: true,
                enableHorizontalScrollbar: false,
                isRowSelectable: (row) => {
                    const i = (row as unknown as uiGrid.IGridRowOf<IItemWithRights>).entity;
                    return i.rights.manage;
                },
                columnDefs: [
                    {
                        field: "title",
                        name: "Title",
                        allowCellFocus: false,
                    },
                    {
                        name: "Relative path",
                        allowCellFocus: false,
                        field: "relPath",
                        sort: {direction: "asc"},
                        cellTemplate: `<div class="ui-grid-cell-contents"
                                            title="TOOLTIP">
                                            <i ng-if="row.entity.isFolder" class="glyphicon glyphicon-folder-open"></i>
                                            <a href="/manage/{{grid.appScope.$ctrl.manageLink(row)}}">
                                                {{row.entity.relPath}}
                                            </a>
                                       </div>`,
                    },
                    {
                        field: "rightsStr",
                        name: "Rights",
                        allowCellFocus: false,
                        cellTooltip: true,
                    },
                ],
            };
            this.gridReady = true;
        }

        this.scope.$watchGroup([() => this.durOpt.durationAmount, () => this.durOpt.durationType], (newValues, oldValues, scope) => {
            this.timeOpt.duration = moment.duration(this.durOpt.durationAmount, this.durOpt.durationType);
        });
    }

    private async getItemsAndPreprocess() {
        return (await this.getItems()).map((i) => ({
            ...i,
            relPath: this.relPath(i),
            rightsStr: this.formatRights(i),
        }));
    }

    manageLink(row: uiGrid.IGridRowOf<IItemWithRights>) {
        return row.entity.path;
    }

    showAddRightFn(type: IAccessType, e: Event) {
        this.accessType = type;
        this.selectedRight = null;
        this.addingRight = true;
        this.focusEditor = true;
        e.preventDefault();
    }

    async removeConfirm(group: IRight) {
        if (window.confirm(`Remove ${(this.getConfirmDesc(group))}?`)) {
            this.removingRight = group;
            await this.removeRight(group);
            this.removingRight = undefined;
        }
    }

    private getConfirmDesc(group: IRight) {
        return `${this.findAccessTypeById(group.type)!.name} right from ${getGroupDesc(group.usergroup)}`;
    }

    get urlRootGet() {
        if (this.defaultItem) {
            return `defaultPermissions/${this.defaultItem}`;
        }
        return "permissions";
    }

    get urlRootModify() {
        if (this.defaultItem) {
            return `defaultPermissions`;
        }
        return "permissions";
    }

    async getPermissions() {
        if (!this.itemId) {
            return;
        }
        this.loading = true;
        const r = await to($http.get<{grouprights: IRight[], accesstypes: IAccessType[]}>(`/${this.urlRootGet}/get/${this.itemId}`));
        this.loading = false;
        if (r.ok) {
            const data = r.result.data;
            this.grouprights = data.grouprights;
            if (data.accesstypes) {
                this.accessTypes = data.accesstypes;
                if (this.restrictRights) {
                    this.accessTypes = this.accessTypes.filter((a) => this.restrictRights!.includes(a.name));
                }
                if (!this.accessType) {
                    this.accessType = this.accessTypes[0];
                }
            }
        } else {
            this.reportError("Could not fetch permissions.");
        }
    }

    async removeRight(right: IRight, refresh = true) {
        const r = await to($http.put(`/${this.urlRootModify}/remove`, {
            group: right.usergroup.id,
            id: this.itemId,
            item_type: this.defaultItem,
            type: this.accessTypeEnumName(right),
        }));
        return await this.handleResult(r, refresh);
    }

    private accessTypeEnumName(right: IRight) {
        return this.findAccessTypeById(right.type)!.name.replace(" ", "_");
    }

    private async handleResult(r: Result<IHttpResponse<unknown>, {data: {error: string}}>, refresh: boolean) {
        if (r.ok) {
            if (refresh) {
                await this.getPermissions();
            }
            return true;
        } else {
            this.reportError(r.result.data.error);
            return false;
        }
    }

    cancel() {
        this.addingRight = false;
        this.selectedRight = null;
    }

    editingRight() {
        return this.selectedRight != null;
    }

    actionText(): string {
        switch (this.actionOption) {
            case ActionOption.Add:
                return "Add";
            case ActionOption.Confirm:
                return "Confirm";
            case ActionOption.Expire:
                return "Expire";
            case ActionOption.Remove:
                return "Remove";
        }
    }

    addDisabled() {
        return this.loading || (this.massMode && this.grid && this.grid.selection.getSelectedRows().length === 0);
    }

    async addOrEditPermission(groupname: string, type: IAccessType) {
        this.clearMessages();
        if (this.massMode) {
            if (!this.grid || !this.gridOptions) {
                console.error("grid not initialized");
                return;
            }
            const ids = this.grid.selection.getSelectedRows().map((i) => i.id);
            this.loading = true;
            const r = await to($http.put<IPermissionEditResponse>(`/permissions/edit`, {
                ids: ids,
                time: this.timeOpt,
                type: type.name,
                action: this.actionOption,
                groups: groupname.split(/[;\n]/),
                confirm: this.requireConfirm && this.durationSelected(),
            }));
            if (r.ok) {
                this.showNotExistWarning(r.result.data.not_exist);
                this.gridOptions.data = await this.getItemsAndPreprocess();
                this.successMsg = "Rights updated.";
            } else {
                this.errMsg = r.result.data.error;
            }
            this.loading = false;
        } else {
            let groups = groupname.split(/[\n;]/).map((n) => n.trim());
            if (groups.every((g) => g.toUpperCase() === g)) {
                groups = groups.map((g) => g.toLowerCase());
            }
            if (this.barcodeMode) {
                groups = groups.map((g) => g.replace(/^[# ]+/, ""));
                groups = groups.map((g) => g.replace(/#/g, "@"));
            }
            if (this.actionOption === ActionOption.Add) {
                this.loading = true;
                const r = await to($http.put<IPermissionEditResponse>(`/${this.urlRootModify}/add`,
                    {
                        time: this.timeOpt,
                        id: this.itemId,
                        groups: groups,
                        type: type.name.replace(" ", "_"),
                        confirm: this.requireConfirm && this.durationSelected(),
                        item_type: this.defaultItem,
                    },
                ));
                this.loading = false;
                if (r.ok) {
                    this.showNotExistWarning(r.result.data.not_exist);
                    await this.getPermissions();
                    if (this.barcodeMode) {
                        this.handleSuccessBarcode(type, groups, r.result.data.not_exist);
                    } else {
                        this.cancel();
                    }
                } else {
                    this.reportError(r.result.data.error);
                }
            } else {
                let func;
                switch (this.actionOption) {
                    case ActionOption.Confirm:
                        func = (right: IRight) => this.confirmRight(right, false);
                        break;
                    case ActionOption.Expire:
                        func = (right: IRight) => this.expireRight(right, false);
                        break;
                    case ActionOption.Remove:
                        func = (right: IRight) => this.removeRight(right, false);
                        break;
                    default:
                        throw Error("unreachable");
                }
                const notFound = [];
                const successes = [];
                for (const g of groups) {
                    const right = this.grouprights!.find((r) => r.usergroup.name === g && r.type === type.id);
                    if (right) {
                        const success = await func(right);
                        if (success) {
                            successes.push(g);
                        }
                    } else {
                        notFound.push(g);
                    }
                }
                if (notFound.length > 0) {
                    this.reportError(`Some usergroups were not in current ${type.name} rights list: ${notFound.join(", ")}`);
                }
                if (successes.length > 0) {
                    await this.getPermissions();
                    if (this.barcodeMode) {
                        this.handleSuccessBarcode(type, groups, notFound);
                    }
                }
            }
            if (!this.barcodeMode) {
                await $timeout();
                this.element.find(".rights-list a").first().focus();
            }
        }
    }

    private clearMessages() {
        this.errMsg = undefined;
        this.successMsg = undefined;
    }

    private handleSuccessBarcode(type: IAccessType, requestedGroups: string[], notFoundGroups: string[]) {
        this.groupName = "";
        const notExistSet = new Set(notFoundGroups);
        const groups = requestedGroups.filter((g) => !notExistSet.has(g));
        if (groups.length === 0) {
            return;
        }
        const imperative = capitalizeFirstLetter(this.actionOption + (this.actionOption.endsWith("e") ? "d" : "ed"));
        this.successMsg = `${imperative} ${type.name} right for: ${groups.join(", ")}`;
    }

    private showNotExistWarning(r: string[]) {
        if (r.length > 0) {
            this.reportError(`Some usergroups were not found: ${r.join(", ")}`);
        }
    }

    durationSelected() {
        return this.timeOpt.type == "duration";
    }

    getPlaceholder() {
        return "enter username(s)/group name(s) separated by semicolons" + (this.listMode ? " or newlines" : "");
    }

    getGroupDesc(group: IRight) {
        return getGroupDesc(group.usergroup);
    }

    shouldShowBeginTime(group: IRight) {
        // having -1 here (instead of 0) avoids "begins in a few seconds" right after adding a right
        return moment().diff(group.accessible_from, "seconds") < -1;
    }

    shouldShowEndTime(group: IRight) {
        return group.accessible_to != null && moment().diff(group.accessible_to) <= 0;
    }

    shouldShowEndedTime(group: IRight) {
        return group.accessible_to != null && moment().diff(group.accessible_to) > 0;
    }

    shouldShowDuration(group: IRight) {
        return group.duration != null && group.accessible_from == null;
    }

    shouldShowUnlockable(group: IRight) {
        return group.duration != null &&
            group.duration_from != null &&
            group.accessible_from == null &&
            moment().diff(group.duration_from) < 0;
    }

    shouldShowNotUnlockable(group: IRight) {
        return group.duration != null &&
            group.duration_to != null &&
            group.accessible_from == null &&
            moment().diff(group.duration_to) <= 0;
    }

    shouldShowNotUnlockableAnymore(group: IRight) {
        return group.duration != null &&
            group.duration_to != null &&
            group.accessible_from == null &&
            moment().diff(group.duration_to) > 0;
    }

    isObsolete(group: IRight) {
        return this.shouldShowEndedTime(group) || this.shouldShowNotUnlockableAnymore(group);
    }

    obsoleteFilterFn = (group: IRight) => {
        return !this.showActiveOnly || !this.isObsolete(group);
    }

    async expireRight(group: IRight, refresh = true) {
        if (!this.accessType) {
            this.reportError("Access type not selected.");
            return false;
        }
        if (this.shouldShowEndedTime(group)) {
            this.reportError(`${this.findAccessTypeById(group.type)!.name} right for ${group.usergroup.name} is already expired.`);
            return false;
        }
        if (refresh) {
            if (this.confirmExpire && !window.confirm(`Expire ${(this.getConfirmDesc(group))}?`)) {
                return;
            }
        }
        this.loading = true;
        this.expiringRight = group;
        const r = await to($http.put<IPermissionEditResponse>(`/${this.urlRootModify}/add`,
            {
                time: {
                    ...this.timeOpt,
                    to: moment(),
                    type: "range",
                },
                id: this.itemId,
                groups: [group.usergroup.name],
                type: this.accessTypeEnumName(group),
                confirm: false,
                item_type: this.defaultItem,
            },
        ));
        this.loading = false;
        this.expiringRight = undefined;
        return await this.handleResult(r, refresh);
    }

    async confirmRight(group: IRight, refresh = true) {
        this.confirmingRight = group;
        this.loading = true;
        const r = await to($http.put("/permissions/confirm", {
            group: group.usergroup.id,
            id: this.itemId,
            type: this.accessTypeEnumName(group),
        }));
        const result = await this.handleResult(r, refresh);
        this.loading = false;
        this.confirmingRight = undefined;
        return result;
    }

    findAccessTypeById(id: number) {
        if (!this.accessTypes) {
            return;
        }
        return this.accessTypes.find((a) => a.id === id);
    }

    async editRight(group: IRight) {
        this.setEditFields(group);
        const section = this.element.find(".rights-edit-area")[0];
        if (section) {
            await $timeout();
            section.scrollIntoView({block: "nearest"});
        }
    }

    private setEditFields(group: IRight) {
        this.groupName = group.usergroup.name;
        this.accessType = this.findAccessTypeById(group.type);
        this.addingRight = false;
        this.selectedRight = group;
        this.lastEdited = group;

        if (group.duration_from) {
            this.timeOpt.durationFrom = moment(group.duration_from);
        } else {
            this.timeOpt.durationFrom = undefined;
        }
        if (group.duration_to) {
            this.timeOpt.durationTo = moment(group.duration_to);
        } else {
            this.timeOpt.durationTo = undefined;
        }

        if (group.accessible_from) {
            this.timeOpt.from = moment(group.accessible_from);
        } else {
            this.timeOpt.from = undefined;
        }
        if (group.accessible_to) {
            this.timeOpt.to = moment(group.accessible_to);
        } else {
            this.timeOpt.to = undefined;
        }
        this.requireConfirm = group.require_confirm || false;

        if (group.duration && group.accessible_from == null) {
            const d = moment.duration(group.duration);
            this.timeOpt.type = "duration";
            for (let i = durationTypes.length - 1; i >= 0; --i) {
                const amount = d.as(durationTypes[i]);
                if (Math.floor(amount) === amount || i === 0) {
                    // preserve last duration type choice if the amount is zero
                    if (amount !== 0) {
                        this.durOpt.durationType = durationTypes[i];
                    }
                    this.durOpt.durationAmount = amount;
                    break;
                }
            }
        } else {
            this.timeOpt.type = "range";
        }
    }

    private async getItems() {
        const r = await $http.get<IItemWithRights[]>("/getItems", {
            params: {
                folder_id: this.itemId,
                recursive: true,
                include_rights: true,
            },
        });
        return r.data;
    }

    private formatRights(i: IItemWithRights) {
        if (!i.rights.manage) {
            return "(you don't have manage right)";
        }
        let str = "";
        let currentRight;
        let typeSep = "";
        for (const r of i.grouprights) {
            let groupSep = ", ";
            // Assuming the rights list is ordered by access type.
            if (r.type != currentRight) {
                str += `${typeSep}${this.findAccessTypeById(r.type)!.name[0]}: `;
                currentRight = r.type;
                groupSep = "";
                typeSep = " | ";
            }
            str += `${groupSep}${r.usergroup.name}`;
            if (this.isObsolete(r)) {
                str += " (e)"; // means "ended"
            } else if (this.shouldShowDuration(r)) {
                str += " (d)"; // means "duration"
            } else if (this.shouldShowEndTime(r)) {
                str += " (t)"; // means "timed"
            } else if (this.shouldShowBeginTime(r)) {
                str += " (f)"; // means "future"
            }
        }
        return str;
    }

    private reportError(s: string) {
        this.errMsg = s;
    }
}

timApp.component("timRightsEditor", {
    bindings: {
        accessTypes: "<?",
        action: "@?",
        allowSelectAction: "<?",
        barcodeMode: "<?",
        confirmExpire: "<?",
        defaultItem: "@?",
        forceConfirm: "<?",
        forceDuration: "<?",
        forceDurationEnd: "<?",
        forceDurationStart: "<?",
        hideEdit: "<?",
        hideExpire: "<?",
        hideRemove: "<?",
        itemId: "<?",
        massMode: "<?",
        orgs: "<?",
        restrictRights: "<?",
    },
    controller: RightsEditorController,
    templateUrl: "/static/templates/rightsEditor.html",
});

timApp.component("timSelfExpire", {
    bindings: {
        buttonText: "<?",
        confirm: "<?",
        itemId: "<",
    },
    controller: class {
        private confirm?: string;
        private buttonText?: string;
        private itemId!: number;

        $onInit() {
            if (!this.buttonText) {
                this.buttonText = "Remove your rights";
            }
        }

        async clicked() {
            if (!this.confirm || window.confirm(this.confirm)) {
                const r = await to($http.post<unknown>("/permissions/selfExpire", {id: this.itemId}));
                if (r.ok) {
                    location.reload();
                } else {
                    await showMessageDialog(`Error expiring right: ${r.result.data.error}`);
                }
            }
        }
    },
    template: `
<button class="timButton" ng-click="$ctrl.clicked()">{{ ::$ctrl.buttonText }}</button>
    `,
});
