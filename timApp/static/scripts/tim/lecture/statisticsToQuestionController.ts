import moment from "moment";
import * as chart from "tim/lecture/showChartDirective";
import {markAsUsed, to} from "tim/util/utils";
import {DialogController} from "tim/ui/dialogController";
import {registerDialogComponent, showDialog} from "../ui/dialog";
import {$http, $timeout} from "../util/ngimport";
import {IAskedQuestion, IQuestionAnswerPlain} from "./lecturetypes";

markAsUsed(chart);

export type IStatisticsParams = IAskedQuestion;

export interface IStatisticsResult {
}

function getQuestionEndTime(q: IAskedQuestion) {
    return q.asked_time.clone().add(moment.duration(q.json.json.timeLimit ?? 999999, "seconds"));
}

export class StatisticsToQuestionController extends DialogController<{params: IStatisticsParams}, IStatisticsResult> {
    static component = "timQuestionStatistics";
    static $inject = ["$element", "$scope"] as const;
    private answers: IQuestionAnswerPlain[] = [];
    private ended = false;
    private lastFetch = moment({year: 1900});

    public getTitle() {
        return `Question ${this.resolve.params.json.json.questionTitle} statistics`;
    }

    $onInit() {
        super.$onInit();
        void this.getLectureAnswers();
    }

    /**
     * Gets answers from the current lecture to current question.
     */
    private async getLectureAnswers() {
        while (!this.closed) {
            const now = moment();
            const r = await to($http.get<IQuestionAnswerPlain[]>("/getLectureAnswers", {
                params: {
                    after: this.lastFetch.toISOString(),
                    asked_id: this.resolve.params.asked_id,
                    buster: new Date().getTime(),
                },
            }));
            if (r.ok) {
                const data = r.result.data;
                for (const ans of data) {
                    this.answers.push(ans);
                }
                if (this.answers.length > 0) {
                    this.lastFetch = this.answers[this.answers.length - 1].answered_on.clone().add(1, "ms");
                }
                if (getQuestionEndTime(this.resolve.params) < now) {
                    this.ended = true;
                    return;
                }
            } else {
                this.ended = true;
                return;
            }
            await $timeout(1000);
        }
    }
}

registerDialogComponent(StatisticsToQuestionController,
    {
        template: `
<tim-dialog>
    <dialog-body>
        <div class="flex" style="height: 100%; flex-direction: column">
            <show-chart-directive
                    question="$ctrl.resolve.params"
                    answers="$ctrl.answers"></show-chart-directive>
            <p>Question <span ng-if="$ctrl.ended">has ended</span><span ng-if="!$ctrl.ended">is running</span>.</p>
        </div>
    </dialog-body>
    <dialog-footer>
        <button class="timButton" ng-click="$ctrl.close()">Close</button>
    </dialog-footer>
</tim-dialog>
`,
    });

export async function showStatisticsDialog(p: IStatisticsParams) {
    return await showDialog(StatisticsToQuestionController, {params: () => p}).result;
}
