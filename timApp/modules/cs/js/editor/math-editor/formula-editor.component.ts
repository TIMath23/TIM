/* eslint no-underscore-dangle: ["error", { "allow": ["_visible"] }] */
/**
 * Formula Editor for inputting LaTeX math
 * @author Juha Reinikainen
 * @licence MIT
 * @date 28.2.2023
 */

import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
} from "@angular/core";
import {FormControl} from "@angular/forms";
import type {
    IMathQuill,
    MathFieldMethods,
    MathQuillConfig,
} from "vendor/mathquill/mathquill";
import {showConfirm} from "tim/ui/showConfirmDialog";
import {IEditor} from "../editor";

/**
 * Field which has the focus
 */
enum ActiveEditorType {
    Visual = "visual",
    Latex = "latex",
}

/**
 * OldContent is split into two at cursor location if insert operation is supported
 * if not then just put content to before and after can be empty
 */
type OldContent = {
    before: string;
    after: string;
};

@Component({
    selector: "cs-formula-editor",
    template: `
        <div [hidden]="!visible" class="formula-editor">
            <div class="formula-editor-dialog">
                <div class="buttons-container">
                   <button class="timButton" (click)="addFormula()">sqrt</button> 
                </div>
                <div class="formula-container">
                    <span class="visual-input" #visualInput></span>
        
                    <textarea name="math-editor-output" #latexInput cols="30" rows="5"
                              (click)="handleLatexFocus()"
                              (keyup)="handleLatexInput()"
                              [formControl]="latexInputControl"
                              placeholder="Write LaTeX" i18n-placeholder>
                    </textarea>                    
                </div>
        
                <div class="formula-button-container">
                    <div class="formula-buttons">
                        <button class="timButton" (click)="handleFormulaOk()">Ok</button>
                        <button class="timButton" (click)="handleFormulaCancel()" i18n>Cancel</button>                                        
                    </div>
        
                    <label class="font-weight-normal">
                        <input type="checkbox" [formControl]="isMultilineFormulaControl"><ng-container i18n>
                        Multiline</ng-container>
                    </label>
                </div>
            </div>
        </div>
            
    `,
    styleUrls: ["./formula-editor.component.scss"],
})
export class FormulaEditorComponent {
    latexInputControl = new FormControl("");
    @ViewChild("latexInput") latexInput!: ElementRef<HTMLTextAreaElement>;

    @ViewChild("visualInput") visualInput!: ElementRef<HTMLElement>;
    MQ!: IMathQuill;

    mathField!: MathFieldMethods;

    activeEditor: ActiveEditorType = ActiveEditorType.Visual;

    oldContent: OldContent = {before: "", after: ""};

    @Output() okEvent = new EventEmitter<void>();
    @Output() cancelEvent = new EventEmitter<void>();

    isMultilineFormulaControl = new FormControl(true);

    @Input() editor!: IEditor;

    @Input()
    get visible(): boolean {
        return this._visible;
    }
    set visible(isVis: boolean) {
        this._visible = isVis;
        // became visible so save what was in editor
        if (isVis) {
            this.oldContent = this.parseOldContent(this.editor.content);
        }
    }
    private _visible: boolean = false;

    constructor() {}

    /**
     * Finds cursor location from editor
     * @return index in editor.content or -1 if editor.insert not defined
     */
    findCursorLocation(): number {
        if (!this.editor.insert) {
            return -1;
        }
        const cursorMarker = "│";

        // add cursor character to know where cursor is
        this.editor.insert(cursorMarker);
        // find its index
        return this.editor.content.indexOf(cursorMarker);
    }

    /**
     * Splits string into two parts if possible at cursor location
     * @param str
     */
    parseOldContent(str: string): OldContent {
        const cursorI = this.findCursorLocation();
        if (cursorI === -1) {
            return {
                before: this.editor.content,
                after: "",
            };
        }
        // split into two ignoring the cursor character
        const result = {
            before: this.editor.content.slice(0, cursorI),
            after: this.editor.content.slice(cursorI + 1),
        };
        // also remove added cursor character from editor
        this.editor.content = result.before + result.after;
        return result;
    }

    /**
     * write changes in visual field to latex field if visual field
     * is the one being typed
     * @param field reference to mathField
     */
    editHandler(field: MathFieldMethods) {
        if (this.activeEditor === ActiveEditorType.Visual) {
            const latex = field.latex();
            this.latexInputControl.setValue(latex);
            this.updateFormulaToEditor();
        }
    }

    enterHandler(field: MathFieldMethods) {
        this.handleFormulaOk();
    }

    async loadMathQuill() {
        const elem = this.visualInput.nativeElement;
        elem.addEventListener("click", (_e: MouseEvent) => {
            this.activeEditor = ActiveEditorType.Visual;
        });
        const config: MathQuillConfig = {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: (field: MathFieldMethods) => this.editHandler(field),
                enter: (field: MathFieldMethods) => this.enterHandler(field),
            },
        };
        const mq = (await import("vendor/mathquill/mathquill")).default;
        this.MQ = mq.getInterface(2);

        this.mathField = this.MQ.MathField(elem, config);
    }

    ngAfterViewInit() {
        void this.loadMathQuill();

        this.isMultilineFormulaControl.valueChanges.subscribe((value) => {
            this.updateFormulaToEditor();
        });
    }

    handleLatexFocus() {
        this.activeEditor = ActiveEditorType.Latex;
    }

    /**
     * write changes in latex field to visual field if latex field
     * is the one being typed in.
     */
    handleLatexInput() {
        if (
            this.activeEditor === ActiveEditorType.Latex &&
            this.latexInputControl.value !== null
        ) {
            this.mathField.latex(this.latexInputControl.value);
            this.updateFormulaToEditor();
        }
    }

    clearFields() {
        this.mathField.latex("");
        this.latexInputControl.setValue("");
    }

    formatLatex(latex: string, isMultiline: boolean): string {
        const wrapSymbol = isMultiline ? "$$" : "$";
        if (latex.length === 0) {
            return "";
        }
        return isMultiline
            ? `${wrapSymbol}\n${latex}\n${wrapSymbol}`
            : `${wrapSymbol}${latex}${wrapSymbol}`;
    }

    /**
     * Updates editor text with current formula text
     */
    updateFormulaToEditor() {
        if (
            this.latexInputControl.value !== null &&
            this.isMultilineFormulaControl.value !== null
        ) {
            const isMultiline = this.isMultilineFormulaControl.value;
            const latex = isMultiline
                ? this.latexInputControl.value
                : this.mathField.latex();
            if (typeof latex === "string") {
                const formulaLatex = this.formatLatex(latex, isMultiline);

                this.editor.content =
                    this.oldContent.before +
                    formulaLatex +
                    this.oldContent.after;
            }
        }
    }

    handleFormulaOk() {
        this.updateFormulaToEditor();
        const finalContent = this.editor.content;
        this.okEvent.emit();
        this.clearFields();
        // clearing fields triggers update to editor content
        // rewrite it
        this.editor.content = finalContent;
    }

    async handleFormulaCancel() {
        // content hasn't changed from what it was before opening formula editor
        // so cancel
        if (
            this.oldContent.before + this.oldContent.after ===
                this.editor.content ||
            (await showConfirm(
                $localize`Are you sure?`,
                $localize`This will clear the editor.`
            ))
        ) {
            this.editor.content =
                this.oldContent.before + this.oldContent.after;
            const finalContent = this.editor.content;
            this.cancelEvent.emit();
            this.clearFields();
            // clearing fields triggers update to editor content
            // rewrite it
            this.editor.content = finalContent;
        }
    }

    addFormula() {
        const formula = "\\sqrt";

        if (this.activeEditor === ActiveEditorType.Latex) {
            const startPos = this.latexInput.nativeElement.selectionStart;
            const endPos = this.latexInput.nativeElement.selectionEnd;
            const oldValue = this.latexInput.nativeElement.value;
            const newValue =
                oldValue.substring(0, startPos) +
                formula +
                "{}" +
                oldValue.substring(endPos, oldValue.length);
            this.latexInputControl.setValue(newValue);
            this.latexInput.nativeElement.selectionStart =
                startPos + newValue.length;
            this.latexInput.nativeElement.selectionEnd =
                endPos + newValue.length;
            this.handleLatexInput();
        } else {
            this.mathField.cmd(formula);
        }
    }
}
