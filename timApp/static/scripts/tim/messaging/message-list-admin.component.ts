import {HttpClient} from "@angular/common/http";
import {Component, NgModule, OnInit} from "@angular/core";
import {CommonModule} from "@angular/common";
import {to2} from "tim/util/utils";
import {FormsModule} from "@angular/forms";
import {
    archivePolicyNames,
    ArchiveType,
    CreateListOptions,
    MemberInfo,
} from "tim/messaging/listOptionTypes";
import {documentglobals} from "tim/util/globals";
import {Users} from "../user/userService";

@Component({
    selector: "tim-message-list-admin",
    template: `
        <form name="form-horizontal">
            <h1>Message list management</h1>
            <div class="form-group">
                <label for="list-name" class="list-name control-label col-sm-2">List name: </label>
                <div class="col-sm-9">
                <input type="text" class="form-control" name="list-name" id="list-name"
                       [(ngModel)]="listname"/><span>@</span>
                <select id="domain-select" name="domain-select" [(ngModel)]="domain">
                    <option [disabled]="domains.length < 2" *ngFor="let domain of domains">{{domain}}</option>
                </select>
            </div>
            </div>
            <div>
                <!-- TODO: Add owners here? Should we at least display owner information and give a way to change 
                      owners, or should that be done by directly changing the owner of the document? -->
                <!--
                <label for="owner-address">List owner's adress</label>
                <input type="text" name="owner-address" id="owner-adress" [(ngModel)]="ownerEmail"/>
                -->
            </div>
            <div class="form-group">
                <label for="list-description" class="short-description control-label col-sm-2">Short description: </label>
                <div class="col-sm-9">
                <input type="text" class="form-control" name="list-description" id="list-description" [(ngModel)]="listDescription"/>
            </div>
                </div>
            <div class="form-group">
                <label for="list-info" class="long-description control-label col-sm-2">Long description: </label>
                <div class="col-sm-9">
                <textarea name="list-info" class="list-info form-control" 
                          [(ngModel)]="listInfo">A more detailed information thingy for this list.</textarea>
            </div>
                </div>
            <div>
            </div>
            <div>
                <p class="list-archive-policy-header">List archive policy:</p>
                <ul style="list-style-type: none">
                    <li *ngFor="let option of archiveOptions">
                        <input
                                name="items-radio"
                                type="radio"
                                id="archive-{{option.archiveType}}"
                                [value]="option.archiveType"
                                [(ngModel)]="archive"
                        />
                        <label for="archive-{{option}}">{{option.policyName}}</label>
                    </li>
                </ul>
            </div>
            <div>
                <input type="checkbox" name="notify-owner-on-list-change" id="notify-owner-on-list-change"
                       [(ngModel)]="notifyOwnerOnListChange"/>
                <label for="notify-owner-on-list-change">Notify me on list changes (e.g. user subscribes)</label>
            </div>
            <div>
                <label for="add-multiple-members">Add members</label> <br/>
                <textarea id="add-multiple-members" name="add-multiple-members"
                          [(ngModel)]="membersTextField"></textarea>
                <button (click)="addNewListMember()">Add new members</button>
            </div>
            <div>
                <p>List members</p>
                <ul>
                    <li *ngFor="let member of membersList">
                        <!-- TODO: Clean up representation. -->
                        <span>{{member.name}}</span>
                        <span>{{member.email}}</span>
                        <span>send</span>
                        <span>delivery</span>
                    </li>
                </ul>
            </div>
            <div *ngIf="emailAdminURL">
                <a [href]="emailAdminURL">Advanced email list settings</a>
            </div>
            <div>
                <button (click)="deleteList()">Delete List</button>
            </div>
        </form>
    `,
    styleUrls: ["message-list-admin.component.scss"],
})
export class MessageListAdminComponent implements OnInit {
    listname: string = "";

    // List has a private members only archive by default.
    archive: ArchiveType = ArchiveType.GROUPONLY;

    domain: string = "";
    domains: string[] = [];

    membersTextField?: string;
    membersList: MemberInfo[] = [];

    urlPrefix: string = "/messagelist";

    ownerEmail: string = "";

    archiveOptions = archivePolicyNames;

    notifyOwnerOnListChange: boolean = false;

    listInfo: string = "";
    listDescription: string = "";

    emailAdminURL?: string;

    ngOnInit(): void {
        if (Users.isLoggedIn()) {
            // Get domains.
            void this.getDomains();

            // Load message list options.
            const docId = documentglobals().curr_item.id;
            void this.loadValues(docId);

            // Load message list's members.
            if (!this.listname) {
                // getListmembers() might launch it's HTTP call before loadValues() finishes with setting listname,
                // so if this happens we schedule the call for list members. The time is a so called sleeve constant,
                // and it is not based on anything other than it seems to work on small scale testing.
                window.setTimeout(() => this.getListMembers(), 2 * 1000);
            } else {
                void this.getListMembers();
            }
        }
    }

    private async getDomains() {
        const result = await to2(
            this.http.get<string[]>(`${this.urlPrefix}/domains`).toPromise()
        );
        if (result.ok) {
            this.domains = result.result;
            if (!this.domains.length) {
                this.domain = this.domains[0];
            }
        } else {
            console.error(result.result.error.error);
        }
    }

    constructor(private http: HttpClient) {}

    /**
     * Compile email addresses separated by line breaks into a list
     * @private
     */
    private parseMembers(): string[] {
        if (!this.membersTextField) {
            return [];
        }
        return this.membersTextField.split("\n").filter((e) => e);
    }

    async addNewListMember() {
        const memberCandidates = this.parseMembers();
        if (memberCandidates.length == 0) {
            return;
        }
        const result = await to2(
            this.http
                .post(`${this.urlPrefix}/addmember`, {
                    memberCandidates: memberCandidates,
                    msgList: this.listname,
                })
                .toPromise()
        );
        if (result.ok) {
            // TODO: Sending succeeded.
            console.log("Sending members succeeded.");
        } else {
            // TODO: Sending failed.
            console.error(result.result.error.error);
        }
    }

    /**
     * Get all list members.
     */
    async getListMembers() {
        const result = await to2(
            this.http
                .get<MemberInfo[]>(
                    `${this.urlPrefix}/getmembers/${this.listname}`
                )
                /** .map(response => {
                const array = JSON.parse(response.json()) as any[];
                const memberinfos = array.map(data => new MemberInfo(data));
                return memberinfos;
            )
    }*/
                .toPromise()
        );
        if (result.ok) {
            console.log(result.result);
            this.membersList = result.result;
        } else {
            console.error(result.result.error.error);
        }
    }

    /**
     * Helper for list deletion.
     */
    async deleteList() {
        // TODO: Confirm with user if they are really sure they want to delete the entire message list. Technically it
        //  could be reversible, but such an hassle that not letting it happen by a single button press should be
        //  allowed.
        const result = await to2(
            this.http
                .delete(`/messagelist/deletelist`, {
                    params: {
                        listname: this.listname,
                        domain: this.domain,
                    },
                })
                .toPromise()
        );
        if (result.ok) {
            // TODO: Inform the user deletion was succesfull.
            console.log(result.result);
        } else {
            // TODO: Inform the user deletion was not succesfull.
            console.error(result.result);
        }
    }

    /**
     * Load values for message list.
     * @param docID List is defined by it's management document, so we get list's options and members with it.
     */
    async loadValues(docID: number) {
        const result = await to2(
            this.http
                .get<CreateListOptions>(`${this.urlPrefix}/getlist/${docID}`)
                .toPromise()
        );
        if (result.ok) {
            // TODO: After server side value loading is complete, remove the console logging and uncomment line below.
            this.setValues(result.result);
        } else {
            console.error(result.result.error.error);
            // TODO: Check what went wrong.
        }
    }

    /**
     * Helper for setting list values after loading.
     * @param listOptions
     */
    setValues(listOptions: CreateListOptions) {
        this.listname = listOptions.listname;
        this.archive = listOptions.archive;

        this.domain = listOptions.domain;

        this.ownerEmail = "";

        this.notifyOwnerOnListChange =
            listOptions.notifyOwnerOnListChange ?? false;

        this.listInfo = listOptions.listInfo;
        this.listDescription = listOptions.listDescription;

        this.emailAdminURL = listOptions.emailAdminURL;
    }
}

@NgModule({
    declarations: [MessageListAdminComponent],
    exports: [MessageListAdminComponent],
    imports: [CommonModule, FormsModule],
})
export class NewMsgListModule {}
