/**
 * Defines the client-side implementation of a drag plugin.
 */
import * as t from "io-ts";
import {polyfill} from "mobile-drag-drop";
import {platformBrowserDynamic} from "@angular/platform-browser-dynamic";
import {BrowserModule} from "@angular/platform-browser";
import {HttpClientModule} from "@angular/common/http";
import {FormsModule} from "@angular/forms";
import {DndModule, EffectAllowed} from "ngx-drag-drop";
import {ApplicationRef, Component, DoBootstrap, NgModule, OnInit, StaticProvider} from "@angular/core";
import {scrollBehaviourDragImageTranslateOverride} from "mobile-drag-drop/scroll-behaviour";
import {ITimComponent} from "../../../static/scripts/tim/document/viewctrl";
import {GenericPluginMarkup, Info, nullable, withDefault} from "../../../static/scripts/tim/plugin/attributes";
import {shuffleStrings} from "../../../static/scripts/tim/plugin/util";
import {$http} from "../../../static/scripts/tim/util/ngimport";
import {to} from "../../../static/scripts/tim/util/utils";
import {createDowngradedModule, doDowngrade} from "../../../static/scripts/tim/downgrade";
import {AngularPluginBase} from "../../../static/scripts/tim/plugin/angular-plugin-base.directive";
import {TimUtilityModule} from "../../../static/scripts/tim/ui/tim-utility.module";
import {vctrlInstance} from "../../../static/scripts/tim/document/viewctrlinstance";
import {PurifyModule} from "../../../static/scripts/tim/util/purify.module";

const DragMarkup = t.intersection([
    t.partial({
        inputstem: t.string,
        words: t.array(t.string),
        copy: t.keyof({target: null, source: null}),
        type: t.string,
        max: t.refinement(t.number, (x) => x > 0, "a positive number value"),
        trash: t.boolean,
        savebutton: t.boolean,
        shuffle: t.boolean,
        followid: t.string,
    }),
    GenericPluginMarkup,
    t.type({
        // All withDefaults should come here; NOT in t.partial.
        autoupdate: withDefault(t.number, 500),
        cols: withDefault(t.number, 20),
    }),
]);
const DragAll = t.intersection([
    t.partial({}),
    t.type({
        info: Info,
        markup: DragMarkup,
        preview: t.boolean,
        state: nullable(t.type({c: t.array(t.string)})),
    }),
]);

interface WordObject {
    id: number;
    word: string;
    type?: string;
    effectAllowed: EffectAllowed;
}

@Component({
    selector: `drag-runner`,
    template: `
        <tim-markup-error *ngIf="markupError" [data]="markupError"></tim-markup-error>
        <div class="form-inline">
            <div class="draggingarea">
                <ul *ngIf="trash"
                    class="dropword"
                    [dndDropzone]
                    [dndDraggable]="[]"
                    dndEffectAllowed="all">
                    <li>TRASHCAN</li>
                </ul>
                <ul *ngIf="!trash"
                    class="dropword"
                    [dndDropzone]="[type]"
                    [dndHorizontal]="true"
                    [dndDraggable]="wordObjs"
                    [dndDisableDragIf]="wordObjs.length >= max"
                    [dndEffectAllowed]="effectAllowed"
                    (dndDrop)="wordObjs.splice($event.index || 0, 0, $event.data)"
                >
                    <li class="dndPlaceholder" dndPlaceholderRef></li>
                    <li *ngFor="let item of wordObjs; let i = index"
                        [innerHTML]="item.word | purify"
                        class="dragword"
                        [dndDraggable]="item"
                        [dndType]="item.type"
                        (dndMoved)="wordObjs.splice(i, 1)"
                        (dndCanceled)="(copy !== 'target') || wordObjs.splice(i, 1)"
                        [dndEffectAllowed]="item.effectAllowed"
                    ></li>
                </ul>
            </div>
            <button class="timButton"
                    *ngIf="saveButton"
                    (click)="save()">
                Save
            </button>
        </div>
        <div *ngIf="error" [innerHTML]="error | purify"></div>
        <div *ngIf="footer" class="plgfooter" [textContent]="footer"></div>
        <ng-template #itemTemplate let-item="item">
            <div [innerHTML]="item.value.word | purify"></div>
        </ng-template>
    `,
    styleUrls: [
        "./drag.scss",
    ],
})
export class DragComponent extends AngularPluginBase<t.TypeOf<typeof DragMarkup>, t.TypeOf<typeof DragAll>, typeof DragAll>
    implements OnInit, ITimComponent {
    error?: string;
    trash?: boolean;
    saveButton?: boolean;
    wordObjs: WordObject[] = [];
    type: string = " ";
    max!: number;
    copy?: string;
    effectAllowed: EffectAllowed = "copyMove";
    private forceSave = false;
    private shuffle?: boolean;
    private vctrl = vctrlInstance;

    getAttributeType(): typeof DragAll {
        return DragAll;
    }

    getDefaultMarkup(): Partial<t.TypeOf<typeof DragMarkup>> {
        return {};
    }

    ngOnInit() {
        super.ngOnInit();
        this.max = this.markup.max ?? 1e100;
        this.copy = this.markup.copy ?? "";
        this.type = this.markup.type ?? " ";
        this.trash = this.markup.trash ?? false;
        this.shuffle = this.markup.shuffle ?? false;
        this.saveButton = this.markup.savebutton ?? false;
        const words = this.attrsall.state?.c ?? this.markup.words ?? [];
        this.createWordobjs(this.shuffle ? shuffleStrings(words) : words);

        polyfill({
            // Use this to make use of the scroll behaviour.
            dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
        });

        window.addEventListener("touchmove", () => {
            // This is a fix for ios problems arising in safari 10+.
            // This is also used for detecting touchscreen to change css layout.
            this.element.addClass("touchdrag");
        }, {passive: false});

        if (!this.attrsall.preview) {
            this.vctrl?.addTimComponent(this);
        }
    }

    /**
     * Creates word-object-models that have attributes essential to the functionality of drag and drop actions.
     * In addition, initializes program logic.
     * @param words Array of strings to be transformed into draggable models.
     */
    createWordobjs(words: string[]) {
        if (!words) {
            return;
        }
        this.wordObjs = [];
        this.effectAllowed = "move";
        if (this.copy == "source" || this.copy == "target") {
            this.effectAllowed = "copy";
        }
        this.wordObjs = words.map((x, i) => ({
            effectAllowed: this.effectAllowed,
            id: i,
            type: this.type,
            word: x,
        }));
        if (this.copy == "source") {
            this.max = this.wordObjs.length;
        }
    }

    /**
     * Returns content separated by a comma or undefined if no content is contained.
     * @returns {string} Returns content as a string separated by comma.
     */
    getContent() {
        const cont = this.getContentArray().join(",");
        if (cont.length < 1) {
            return undefined;
        }
        return cont;
    }

    /**
     * Returns contained words as a string array.
     * @returns {string} Plugin content in a string array.
     */
    getContentArray(): string[] {
        const words: string[] = [];
        if (this.wordObjs) {
            this.wordObjs.map((el) => {
                words.push(el.word);
            });
        }
        return words;
    }

    /**
     * Force the plugin to save its information.
     *
     * @param force Whether to force a save.
     */
    setForceAnswerSave(force: boolean) {
        this.forceSave = force;
    }

    /**
     * Sets words in plugin.
     * @param words The words to be set as draggable words in plugin.
     */
    setPluginWords(words: string []) {
        if (this.shuffle) {
            this.createWordobjs(shuffleStrings(words));
        } else {
            this.createWordobjs(words);
        }
    }

    resetField(): undefined {
        this.setPluginWords(this.markup.words ?? []);
        return undefined;
    }

    async save() {
        return await this.doSave(false);
    }

    async doSave(nosave: false) {
        const params = {
            input: {
                nosave: false,
                words: this.getContentArray(),
            },
            options: {
                forceSave: this.forceSave,
            },
        };

        if (nosave) {
            params.input.nosave = true;
        }

        const url = this.pluginMeta.getAnswerUrl();
        const r = await to($http.put<{ web: { result: string, error?: string } }>(url, params));

        if (r.ok) {
            const data = r.result.data;
            this.error = data.web.error;
        } else {
            this.error = r.result.data.error;
        }
        return {saved: r.ok, message: this.error};
    }

    isUnSaved() {
        return false; // TODO
    }
}

@NgModule({
    declarations: [
        DragComponent,
    ],
    imports: [
        BrowserModule,
        HttpClientModule,
        DndModule,
        TimUtilityModule,
        PurifyModule,
        FormsModule,
    ],
})
export class DragModule implements DoBootstrap {
    ngDoBootstrap(appRef: ApplicationRef): void {
    }
}

const bootstrapFn = (extraProviders: StaticProvider[]) => {
    const platformRef = platformBrowserDynamic(extraProviders);
    return platformRef.bootstrapModule(DragModule);
};

const angularJsModule = createDowngradedModule(bootstrapFn);
doDowngrade(angularJsModule, "dragRunner", DragComponent);
export const moduleDefs = [angularJsModule];
