import $ from "jquery";
import {timApp} from "tim/app";
import {timLogTime} from "tim/timTiming";
import {dereferencePar, getParId} from "../controllers/view/parhelpers";
import {Users} from "../services/userService";
import {ParCompiler} from "../services/parCompiler";
import {$compile, $filter, $http, $timeout, $uibModal, $window} from "../ngimport";
import {IScope, IRootElementService, IController} from "angular";
import {ViewCtrl} from "../controllers/view/viewctrl";
import {IUser} from "../IUser";
import {IAnswer} from "../IAnswer";
import {ReviewController} from "../controllers/reviewController";

timLogTime("answerbrowser3 load", "answ");

const LAZYWORD = "lazylazylazy";
const LAZYSTART = "<!--lazy ";
const LAZYEND = " lazy-->";
const RLAZYSTART = new RegExp(LAZYSTART, "g");
const RLAZYEND = new RegExp(LAZYEND, "g");

function makeNotLazy(html) {
    "use strict";
    let s = html.replace(RLAZYSTART, "");
    const i = s.lastIndexOf(LAZYEND);
    if (i >= 0) s = s.substring(0, i);
    s = s.replace(RLAZYEND, "");
    s = s.replace(/-LAZY->/g, "-->");
    s = s.replace(/<!-LAZY-/g, "<!--");
    return s;
}

function loadPlugin(html: string, $par: JQuery, scope: IScope) {
    const newhtml = makeNotLazy(html);
    const plugin = $par.find(".parContent");

    // Set explicit height for the plugin temporarily.
    // Without this fix, if the plugin is at the bottom of the screen,
    // the browser's scroll position would jump inconveniently because
    // the plugin's height goes to zero until Angular has finished compiling it.
    const height = plugin.height();
    plugin.height(height);
    plugin.empty().append($compile(newhtml)(scope));
    plugin.css("opacity", "1.0");
    ParCompiler.processAllMathDelayed(plugin);
    $timeout(() => {
        plugin.css("height", "");
    }, 500);
}

class AnswerBrowserLazyController implements IController {
    private static $inject = ["$element", "$scope"];
    private compiled: boolean;
    private element: angular.IRootElementService;
    private viewctrl: ViewCtrl;
    private taskId: string;
    private scope: angular.IScope;

    constructor($element: IRootElementService, scope: IScope) {
        this.element = $element;
        this.scope = scope;
        timLogTime("answerbrowserlazy ctrl function", "answ", 1);
        this.compiled = false;
    }

    $onInit() {
    }

    $postLink() {
        this.element.parent().on("mouseenter touchstart", () => this.loadAnswerBrowser());
    }

    /**
     * Returns whether the given task id is valid.
     * A valid task id is of the form '1.taskname'.
     * @param taskId {string} The task id to validate.
     * @returns {boolean} True if the task id is valid, false otherwise.
     */
    isValidTaskId(taskId) {
        return taskId.slice(-1) !== ".";
    }

    loadAnswerBrowser() {
        if (this.compiled) {
            return;
        }
        const par: JQuery = this.element.parents(".par");
        let plugin = par.find(".parContent");
        this.compiled = true;
        if (!this.viewctrl.noBrowser && this.isValidTaskId(this.taskId)) {
            const newHtml = '<answerbrowser task-id="' + this.taskId + '"></answerbrowser>';
            const newElement = $compile(newHtml);
            par.prepend(newElement(this.scope)[0]);
        }
        // Next the inside of the plugin to non lazy
        const origHtml = plugin[0].innerHTML;
        if (origHtml.indexOf(LAZYSTART) < 0) {
            plugin = null;
        }
        if (plugin) {
            loadPlugin(origHtml, par, this.scope);
        }
    }
}

timApp.component("answerbrowserlazy", {
    bindings: {
        taskId: "@",
    },
    controller: AnswerBrowserLazyController,
    require: {
        viewctrl: "^timView",
    },
});

interface ITaskInfo {
    userMin: number;
    userMax: number;
    answerLimit: number;
}

export class AnswerBrowserController implements IController {
    private static $inject = ["$scope", "$element"];
    private element: JQuery;
    private taskId: string;
    private loading: number;
    private viewctrl: ViewCtrl;
    private rctrl: ReviewController;
    private parContent: JQuery;
    private user: IUser;
    private fetchedUser: IUser;
    private firstLoad: boolean;
    private shouldUpdateHtml: boolean;
    private saveTeacher: boolean;
    private users: IUser[];
    private answers: IAnswer[];
    private filteredAnswers: IAnswer[];
    private onlyValid: boolean;
    public selectedAnswer: IAnswer;
    private anyInvalid: boolean;
    private giveCustomPoints: boolean;
    private review: boolean;
    private shouldFocus: boolean;
    private alerts: {}[];
    private taskInfo: ITaskInfo;
    private points: number;
    private scope: IScope;

    constructor(scope, element) {
        this.scope = scope;
        this.element = element.parents(".par");
        this.parContent = this.element.find(".parContent");
        this.loading = 0;
    }

    $onInit() {
        this.scope.$watch(() => this.taskId, (newValue, oldValue) => {
            if (newValue === oldValue) {
                return;
            }
            if (this.viewctrl.teacherMode) {
                this.getAvailableUsers();
            }
            this.getAvailableAnswers();
        });

        // Loads annotations to answer
        setTimeout(() => this.changeAnswer(), 500); // TODO: Don't use timeout

        if (this.viewctrl.teacherMode) {
            this.element.attr("tabindex", 1);
            this.element.css("outline", "none");

            // ng-keypress will not fire if the textbox has focus
            this.element[0].addEventListener("keydown", this.checkKeyPress);
        }

        this.scope.$on("answerSaved", (event, args) => {
            if (args.taskId === this.taskId) {
                this.getAvailableAnswers(false);
                // HACK: for some reason the math mode is lost because of the above call, so we restore it here
                ParCompiler.processAllMathDelayed(this.element.find(".parContent"));
                if (args.error) {
                    this.alerts.push({msg: args.error, type: "warning"});
                }
            }
        });

        if (this.viewctrl.selectedUser) {
            this.user = this.viewctrl.selectedUser;
        } else if (this.viewctrl.users && this.viewctrl.users.length > 0) {
            this.user = this.viewctrl.users[0];
        } else {
            this.user = Users.getCurrent();
        }

        this.fetchedUser = null;
        this.firstLoad = true;
        this.shouldUpdateHtml = this.viewctrl.users.length > 0 && this.user !== this.viewctrl.users[0];
        if (this.shouldUpdateHtml) {
            this.dimPlugin();
        }
        this.saveTeacher = false;
        this.users = null;
        this.answers = [];
        this.filteredAnswers = [];
        this.onlyValid = true;
        this.selectedAnswer = null;
        this.taskInfo = null;
        this.anyInvalid = false;
        this.giveCustomPoints = false;
        this.review = false;
        this.shouldFocus = false;
        this.alerts = [];

        this.scope.$watch(() => this.review, () => this.changeAnswer());
        this.scope.$watchGroup([
            () => this.onlyValid,
            () => this.answers,
        ], (newValues, oldValues, scope) => this.updateFilteredAndSetNewest());

        // call checkUsers automatically for now; suitable only for lazy mode!
        this.checkUsers();
        this.element.on("mouseenter touchstart", () => {
            this.checkUsers();
        });

        this.scope.$on("userChanged", (event, args) => {
                this.user = args.user;
                this.firstLoad = false;
                this.shouldUpdateHtml = true;
                if (args.updateAll) {
                    this.loadIfChanged();
                } else if (this.hasUserChanged()) {
                    this.dimPlugin();
                } else {
                    this.parContent.css("opacity", "1.0");
                }
            },
        );
    }

    savePoints() {
        $http.put("/savePoints/" + this.user.id + "/" + this.selectedAnswer.id,
            {points: this.points}).then((response) => {
            this.selectedAnswer.points = this.points;
        }, (response) => {
            this.showError(response);
        }).finally(() => {
            this.shouldFocus = true;
        });
    }

    updatePoints() {
        this.points = this.selectedAnswer.points;
        if (this.points !== null) {
            this.giveCustomPoints = this.selectedAnswer.last_points_modifier !== null;
        } else {
            this.giveCustomPoints = false;
        }
    }


    setFocus() {
        this.element.focus();
    }

    changeAnswer() {
        if (this.selectedAnswer === null) {
            return;
        }
        this.updatePoints();
        const $par = this.element;
        const ids = dereferencePar($par);
        this.loading++;
        $http.get<{html: string, reviewHtml: string}>("/getState", {
            params: {
                ref_from_doc_id: this.viewctrl.docId,
                ref_from_par_id: getParId($par),
                doc_id: ids[0],
                par_id: ids[1],
                user_id: this.user.id,
                answer_id: this.selectedAnswer.id,
                review: this.review,
            },
        }).then((response) => {
            loadPlugin(response.data.html, $par, this.scope);
            if (this.review) {
                this.element.find(".review").html(response.data.reviewHtml);
            }
            this.rctrl.loadAnnotationsToAnswer(this.selectedAnswer.id, $par[0], this.review);

        }, (response) => {
            this.showError(response);
        }).finally(() => {
            this.loading--;
        });
    }

    nextAnswer() {
        let newIndex = this.findSelectedAnswerIndex() - 1;
        if (newIndex < 0) {
            newIndex = this.filteredAnswers.length - 1;
        }
        this.selectedAnswer = this.filteredAnswers[newIndex];
        this.changeAnswer();
    }

    previousAnswer() {
        let newIndex = this.findSelectedAnswerIndex() + 1;
        if (newIndex >= this.filteredAnswers.length) {
            newIndex = 0;
        }
        this.selectedAnswer = this.filteredAnswers[newIndex];
        this.changeAnswer();
    }

    findSelectedUserIndex() {
        if (this.users === null) {
            return -1;
        }
        for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].id === this.user.id) {
                return i;
            }
        }
        return -1;
    }

    checkKeyPress(e) {
        if (this.loading > 0) {
            return;
        }
        if (e.ctrlKey) {
            // e.key does not work on IE but it is more readable, so let's use both
            if ((e.key === "ArrowUp" || e.which === 38)) {
                e.preventDefault();
                this.changeStudent(-1);
            } else if ((e.key === "ArrowDown" || e.which === 40)) {
                e.preventDefault();
                this.changeStudent(1);
            } else if ((e.key === "ArrowLeft" || e.which === 37)) {
                e.preventDefault();
                this.previousAnswer();
            } else if ((e.key === "ArrowRight" || e.which === 39)) {
                e.preventDefault();
                this.nextAnswer();
            }
        }
    }


    changeStudent(dir) {
        if (this.users.length <= 0) {
            return;
        }
        const shouldRefocusPoints = this.shouldFocus;
        let newIndex = this.findSelectedUserIndex() + dir;
        if (newIndex >= this.users.length) {
            newIndex = 0;
        }
        if (newIndex < 0) {
            newIndex = this.users.length - 1;
        }
        if (newIndex < 0) {
            return;
        }
        this.user = this.users[newIndex];
        this.getAvailableAnswers();

        // Be careful when modifying the following code. All browsers (IE/Chrome/FF)
        // behave slightly differently when it comes to (de-)focusing something.
        $timeout(() => {
            if (shouldRefocusPoints) {
                this.shouldFocus = shouldRefocusPoints;
            } else {
                this.setFocus();
            }
        }, 200);
    }


    setNewest() {
        if (this.filteredAnswers.length > 0) {
            this.selectedAnswer = this.filteredAnswers[0];
            this.changeAnswer();
        }
    }

    setAnswerById(id) {
        for (let i = 0; i < this.filteredAnswers.length; i++) {
            if (this.filteredAnswers[i].id === id) {
                this.selectedAnswer = this.filteredAnswers[i];
                this.changeAnswer();
                break;
            }
        }
    }

    getBrowserData() {
        if (this.answers.length > 0 && this.selectedAnswer) {
            return {
                answer_id: this.selectedAnswer.id,
                saveTeacher: this.saveTeacher,
                teacher: this.viewctrl.teacherMode,
                points: this.points,
                giveCustomPoints: this.giveCustomPoints,
                userId: this.user.id,
                saveAnswer: !this.viewctrl.noBrowser,
            };
        } else {
            return {
                saveTeacher: false,
                teacher: this.viewctrl.teacherMode,
                saveAnswer: !this.viewctrl.noBrowser,
            };
        }
    }

    getAvailableUsers() {
        this.loading++;
        $http.get<IUser[]>("/getTaskUsers/" + this.taskId, {params: {group: this.viewctrl.group}})
            .then((response) => {
                this.users = response.data;
            }, (response) => {
                this.showError(response);
            }).finally(() => {
            this.loading--;
        });
    }

    showError(response) {
        this.alerts.push({msg: "Error: " + response.data.error, type: "danger"});
    }

    getAvailableAnswers(updateHtml = true) {
        if (!this.viewctrl.item.rights || !this.viewctrl.item.rights.browse_own_answers) {
            return;
        }
        if (this.user === null) {
            return;
        }
        this.loading++;
        $http.get<IAnswer[]>("/answers/" + this.taskId + "/" + this.user.id)
            .then((response) => {
                const data = response.data;
                if (data.length > 0 && (this.hasUserChanged() || data.length !== (this.answers || []).length)) {
                    this.answers = data;
                    this.updateFiltered();
                    this.selectedAnswer = this.filteredAnswers[0];
                    this.updatePoints();
                    if (updateHtml) {
                        this.changeAnswer();
                    }
                } else {
                    this.answers = data;
                    if (this.answers.length === 0 && this.viewctrl.teacherMode) {
                        this.dimPlugin();
                    }
                    this.updateFilteredAndSetNewest();
                    const i = this.findSelectedAnswerIndex();
                    if (i >= 0) {
                        this.selectedAnswer = this.filteredAnswers[i];
                        this.updatePoints();
                    }
                }
                this.fetchedUser = this.user;
            }, (response) => {
                this.showError(response);
            }).finally(() => {
            this.loading--;
        });
    }

    hasUserChanged() {
        return (this.user || {id: null}).id !== (this.fetchedUser || {id: null}).id;
    }

    dimPlugin() {
        this.parContent.css("opacity", "0.3");
    }

    allowCustomPoints() {
        if (this.taskInfo === null) {
            return false;
        }
        return this.taskInfo.userMin !== null && this.taskInfo.userMax !== null;
    }

    loadIfChanged() {
        if (this.hasUserChanged()) {
            this.getAvailableAnswers(this.shouldUpdateHtml);
            this.loadInfo();
            this.firstLoad = false;
            this.shouldUpdateHtml = false;
        }
    }

    showTeacher() {
        return this.viewctrl.teacherMode && this.viewctrl.item.rights.teacher;
    }

    showVelpsCheckBox() {
        // return this.$parent.teacherMode || $window.velpMode; // && this.$parent.item.rights.teacher;
        return $window.velpMode || $(this.element).attr("class").indexOf("has-annotation") >= 0;
    }

    getTriesLeft() {
        if (this.taskInfo === null) {
            return null;
        }
        return Math.max(this.taskInfo.answerLimit - this.answers.length, 0);
    }

    loadInfo() {
        if (this.taskInfo !== null) {
            return;
        }
        this.loading++;
        $http.get<ITaskInfo>("/taskinfo/" + this.taskId)
            .then((response) => {
                this.taskInfo = response.data;
            }, (response) => {
                this.showError(response);
            }).finally(() => {
            this.loading--;
        });
    }

    checkUsers() {
        if (this.loading > 0) {
            return;
        }
        this.loadIfChanged();
        if (this.viewctrl.teacherMode && this.users === null) {
            this.users = [];
            if (this.viewctrl.users.length > 0) {
                this.getAvailableUsers();
            }
        }
    }

    getAllAnswers() {
        $uibModal.open({
            animation: false,
            ariaLabelledBy: "modal-title",
            ariaDescribedBy: "modal-body",
            templateUrl: "/static/templates/allAnswersOptions.html",
            controller: "AllAnswersCtrl",
            controllerAs: "$ctrl",
            size: "md",
            resolve: {
                options() {
                    return {
                        url: "/allAnswersPlain/" + this.taskId,
                        identifier: this.taskId,
                        allTasks: false,
                    };
                },
            },
        });
    }

    findSelectedAnswerIndex() {
        if (this.filteredAnswers === null) {
            return -1;
        }
        for (let i = 0; i < this.filteredAnswers.length; i++) {
            if (this.filteredAnswers[i].id === this.selectedAnswer.id) {
                return i;
            }
        }
        return -1;
    }

    updateFiltered() {
        this.anyInvalid = false;
        this.filteredAnswers = $filter("filter")<IAnswer>(this.answers, (value, index, array) => {
            if (value.valid) {
                return true;
            }
            this.anyInvalid = true;
            return !this.onlyValid;
        });
    }

    updateFilteredAndSetNewest() {
        this.updateFiltered();
        if (this.findSelectedAnswerIndex() < 0) {
            this.setNewest();
        }
    }

    closeAlert(index) {
        this.alerts.splice(index, 1);
    }
}

timApp.component("answerbrowser", {
    bindings: {
        taskId: "@",
    },
    controller: AnswerBrowserController,
    require: {
        rctrl: "^timReview",
        viewctrl: "^timView",
    },
    templateUrl: "/static/templates/answerBrowser.html",
});
