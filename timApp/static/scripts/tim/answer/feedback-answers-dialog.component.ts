import moment, {Moment} from "moment";
import {AngularDialogComponent} from "tim/ui/angulardialog/angular-dialog-component.directive";
import {Component, NgModule} from "@angular/core";
import {ngStorage} from "ngstorage";
import {DialogModule} from "tim/ui/angulardialog/dialog.module";
import {TimUtilityModule} from "tim/ui/tim-utility.module";
import {FormsModule} from "@angular/forms";
import {BrowserModule} from "@angular/platform-browser";
import {$httpParamSerializer, $localStorage} from "../util/ngimport";
import {IUser} from "../user/IUser";

interface IFBOptions<T> {
    period: "whenever" | "day" | "week" | "month";
    valid: string;
    name: string;
    periodFrom: T;
    periodTo: T;
    scope: string;
    answers: string;
    format: string;
    users: string;
    decimal: string;
}

export interface IFeedbackAnswersParams {
    identifier: string;
    users: IUser[];
    url: string;
    allTasks: boolean;
}

@Component({
    selector: "tim-feedback-answers-dialog",
    template: `
        <tim-dialog-frame>
            <ng-container header>
                {{ getTitle() }}
            </ng-container>
            <ng-container body>
                <form class="form-horizontal">
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline">Period</label>
                        </div>
                        <div class="col-sm-9">
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.period" name="period" value="whenever">
                                    Whenever
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.period" name="period" value="day">
                                    Past day
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.period" name="period" value="week">
                                    Past week
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.period" name="period" value="month">
                                    Past month
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline">Validity</label>
                        </div>
                        <div class="col-sm-9">
                            <label class="radio-inline">
                                <input type="radio" [(ngModel)]="options.valid" name="valid" value="1"> Valid
                            </label>
                            <label class="radio-inline">
                                <input type="radio" [(ngModel)]="options.valid" name="valid" value="0"> Invalid
                            </label>
                            <label class="radio-inline">
                                <input type="radio" [(ngModel)]="options.valid" name="valid" value="all"> All
                            </label>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline">Names</label>
                        </div>
                        <div class="col-sm-9">
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.name" name="name" value="both">
                                    Username and full name
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.name" name="name" value="username">
                                    Username only
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.name" name="name" value="anonymous">
                                    Anonymous username
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline"> Scope </label>
                        </div>
                        <div class="col-sm-9">
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.scope" name="scope" value="task">
                                    Only this task
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.scope" name="scope" value="test">
                                    The whole test
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline"> Answers from </label>
                        </div>
                        <div class="col-sm-9">
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.answers" name="answers" value="all">
                                    All users
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.answers" name="answers" value="visible">
                                    Only visible users
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.answers" name="answers" value="selected">
                                    Only selected user
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline"> Delimiter </label>
                        </div>
                        <div class="col-sm-9">
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.format" name="format" value="semicolon">
                                    Semicolon (;)
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.format" name="format" value="tab">
                                    Tab
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.format" name="format" value="bar">
                                    Vertical bar (|)
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.format" name="format" value="comma">
                                    Comma (,)
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-3">
                            <label class="radio-inline"> Decimal </label>
                        </div>
                        <div class="col-sm-9">
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.decimal" name="decimal" value="point">
                                    Decimal point (.)
                                </label>
                            </div>
                            <div class="radio">
                                <label>
                                    <input type="radio" [(ngModel)]="options.decimal" name="decimal" value="comma">
                                    Decimal comma (,)
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </ng-container>
            <ng-container footer>
                <button class="timButton" type="button" (click)="ok()">Get answers
                </button>
                <button class="btn btn-default" type="button" (click)="cancel()">Cancel</button>
            </ng-container>
        </tim-dialog-frame>`,
})
export class FeedbackAnswersDialogComponent extends AngularDialogComponent<
    IFeedbackAnswersParams,
    void
> {
    protected dialogName = "FeedbackAnswers";
    options!: IFBOptions<Moment>;
    private storage?: ngStorage.StorageService & {
        feedbackAnswersOptions: IFBOptions<number | null>;
    };
    private showSort: boolean = false;

    getTitle() {
        return "Export to csv";
    }

    ngOnInit() {
        const options = this.data;
        this.showSort = options.allTasks;
        const defs = {
            period: "whenever",
            valid: "1",
            name: "both",
            periodFrom: null,
            periodTo: null,
            scope: "task",
            answers: "all",
            format: "semicolon",
            users: "",
            decimal: "point",
        } as const;
        this.storage = $localStorage.$default({
            feedbackAnswersOptions: defs,
        });

        this.options = {
            ...this.storage.feedbackAnswersOptions,
            periodFrom: moment(
                this.storage.feedbackAnswersOptions.periodFrom ?? Date.now()
            ),
            periodTo: moment(
                this.storage.feedbackAnswersOptions.periodFrom ?? Date.now()
            ),
        };

        this.options.users = "";
        for (const user of options.users) {
            this.options.users += user.name + ",";
        }
    }

    ok() {
        if (!this.options || !this.storage) {
            return;
        }
        const toSerialize: IFBOptions<Date | null> = {
            ...this.options,
            periodFrom: this.options.periodFrom.toDate(),
            periodTo: this.options.periodTo.toDate(),
        };
        this.storage.feedbackAnswersOptions = {
            ...this.options,
            periodFrom: this.options.periodFrom.valueOf(),
            periodTo: this.options.periodTo.valueOf(),
        };
        window.open(
            this.data.url + "?" + $httpParamSerializer(toSerialize),
            "_blank"
        );
        this.close();
    }

    cancel() {
        this.dismiss();
    }
}

@NgModule({
    declarations: [FeedbackAnswersDialogComponent],
    imports: [BrowserModule, DialogModule, TimUtilityModule, FormsModule],
})
export class FeedbackAnswersDialogModule {}