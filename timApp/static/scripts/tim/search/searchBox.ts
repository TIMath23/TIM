/**
 * A search box component.
 */

import {IController} from "angular";
import {timApp} from "../app";
import {$http, $localStorage} from "../util/ngimport";
import {IItem} from "../item/IItem";
import {Binding, to} from "../util/utils";
import {showSearchResultDialog} from "./searchResultsCtrl";
import {ngStorage} from "ngstorage";
import {IExtraData} from "../document/editing/edittypes";

export interface ISearchResult {
    doc: IItem;
    par: IExtraData;
    match_start_index: number;
    match_end_index: number;
    match_word: string;
    num_results: number;
    num_pars: number;
    num_pars_found: number;
}

class SearchBoxCtrl implements IController {
    private query: string = "";
    private folder!: Binding<string, "<">;
    private regex: boolean = false;
    private caseSensitive: boolean = false;
    private results: ISearchResult[] = [];
    private errorMessage: string = "";
    private beginning: boolean = true; // When search hasn't been used yet.
    private onlyfirst: number = 100; // # first results returned.
    private queryMinLength: number = 3;
    private advancedSearch: boolean = false;
    private ignorePluginsSettings: boolean = false;
    private focusMe: boolean = true;
    private storage: ngStorage.StorageService & {searchWordStorage: null | string, optionsStorage: null | boolean[]};

    constructor() {
        this.storage = $localStorage.$default({
            optionsStorage: null,
            searchWordStorage: null,
        });
    }

    $onInit() {
        this.loadLocalStorage();
        this.defaultFolder();
    }

    $onDestroy() {
        this.updateLocalStorage();
    }

    /**
     * Word search on target folder.
     * @returns {Promise<void>}
     */
    async search() {
        // Server side has separate 3 character minimum check as well.
        if (this.query.trim().length < this.queryMinLength) {
            this.errorMessage = (`Search text must be at least ${this.queryMinLength} characters
             long with whitespace stripped.`);
            return;
        }
        if (!this.folder.trim()) {
            this.errorMessage = (`Root directory searches are not allowed.`);
            return;
        }
        this.errorMessage = "";
        this.beginning = false;
        const [err, response] = await to($http<ISearchResult[]>({
            method: "GET",
            params: {
                caseSensitive: this.caseSensitive,
                folder: this.folder,
                ignorePluginsSettings: this.ignorePluginsSettings,
                onlyfirst: this.onlyfirst,
                query: this.query,
                regex: this.regex,
            },
            url: "/search",
        }));
        if (err) {
            this.errorMessage = err.data.error;
            this.results = [];
        }
        if (response) {
            this.errorMessage = "";
            this.results = response.data;
        }
        if (this.results.length === 0) {
            this.errorMessage = `Your search '${this.query}' did not match any documents.`;
            return;
        }
        void showSearchResultDialog({
            errorMessage: this.errorMessage,
            results: this.results,
            searchWord: this.query,
        });
    }

    /*
     * Calls tag search function when Enter is pressed.
     * @param event Keyboard event.
     */
    async keyPressed(event: KeyboardEvent) {
        if (event.which === 13) {
            await this.search();
        }
    }

    /**
     * Saves options and search word to local storage.
     */
    private updateLocalStorage() {
        if (this.query.trim().length > this.queryMinLength) {
            this.storage.searchWordStorage = this.query;
        }
        this.storage.optionsStorage = [];
        // Alphabetical order.
        this.storage.optionsStorage.push(this.advancedSearch);
        this.storage.optionsStorage.push(this.caseSensitive);
        this.storage.optionsStorage.push(this.ignorePluginsSettings);
        this.storage.optionsStorage.push(this.regex);
    }

    /**
     * Fetches options and search word from local storage, if existent.
     */
    private loadLocalStorage() {
        if (this.storage.searchWordStorage) {
            this.query = this.storage.searchWordStorage;
        }
        if (this.storage.optionsStorage && this.storage.optionsStorage.length >= 4) {
            this.advancedSearch = this.storage.optionsStorage[0];
            this.caseSensitive = this.storage.optionsStorage[1];
            this.ignorePluginsSettings = this.storage.optionsStorage[2];
            this.regex = this.storage.optionsStorage[3];
        }
    }

    /**
     * Decide default folder for the search.
     */
    private defaultFolder() {
        if (!this.folder) {
            this.folder = "kurssit";
        }
        // In users/username/something* search from users/username.
        const path = this.folder.split("/");
        if (path[0] === "users" && path.length > 2) {
            this.folder = `${path[0]}/${path[1]}`;
        }
        // In kurssit/faculty/course/something* search from kurssit/faculty/course.
        if (path[0] === "kurssit" && path.length > 3) {
            this.folder = `${path[0]}/${path[1]}/${path[2]}`;
        }
    }
}

timApp.component("searchBox", {
    bindings: {
        folder: "<",
    },
    controller: SearchBoxCtrl,
    template: `<div class="input-group">
        <input ng-model="$ctrl.query" name="searchField" ng-keypress="$ctrl.keyPressed($event)"
               type="text" focus-me="$ctrl.focusMe"
               title="Search documents with key word"
               placeholder="Input a search word"
               class="form-control" autocomplete="on">
        <span class="input-group-addon btn" ng-click="$ctrl.search()">
                <span class="glyphicon glyphicon-search" title="Search with word '{{$ctrl.query}}'"></span>
        </span>
        <span class="input-group-addon btn" ng-click="$ctrl.advancedSearch = !$ctrl.advancedSearch"
            title="Toggle advanced search">
                <span class="glyphicon glyphicon-menu-hamburger"></span>
        </span>
   </div>
   <div ng-cloak ng-show="$ctrl.errorMessage" class="alert alert-warning">
    <span class="glyphicon glyphicon-exclamation-sign"></span> {{$ctrl.errorMessage}}
   </div>
   <div ng-if="$ctrl.advancedSearch" title="Advanced search options">
      <h5>Advanced search options</h5>
      <form class="form-horizontal">
           <div class="form-group" title="Write folder path to search from">
                <label for="folder-selector" class="col-sm-2 control-label">Folder:</label>
                <div class="col-sm-10">
                    <input ng-model="$ctrl.folder" name="folder-selector"
                           type="text" class="form-control" id="folder-selector" placeholder="Input a folder to search">
                </div>
            </div>
        <label class="font-weight-normal"><input type="checkbox" ng-model="$ctrl.caseSensitive"
            title="Distinguishing between upper- and lower-case letters"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Case sensitive</label>
        <label class="font-weight-normal"><input type="checkbox" ng-model="$ctrl.ignorePluginsSettings"
            title="Leave plugins and settings out of the results"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Ignore plugins</label>
        <label class="font-weight-normal"><input type="checkbox" ng-model="$ctrl.regex"
            title="Regular expressions"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Regex</label>
      </div>
      </form>
    </div>
`,
});
