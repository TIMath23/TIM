/**
 * Math Editor for inputting LaTeX math
 * @author Juha Reinikainen
 * @licence MIT
 * @date 20.2.2023
 */

import type {OnInit} from "@angular/core";
import {Component, Input, ViewChild} from "@angular/core";
import type {IEditor} from "../editor";
import {AceEditorComponent} from "../ace";

@Component({
    selector: "cs-math-editor",
    template: `
        <div class="math-editor-container">
            <cs-formula-editor (okEvent)="handleOk()"></cs-formula-editor>
            
             <cs-ace-editor #aceEditor
                    [languageMode]="languageMode"
                    [minRows]="minRows"
                    [maxRows]="maxRows"
                    [placeholder]="placeholder"
                    [disabled]="disabled">
            </cs-ace-editor>
        </div>
    `,
    styleUrls: ["./math-editor.component.scss"],
})
export class MathEditorComponent implements OnInit, IEditor {
    content: string = "";

    @ViewChild("aceEditor") aceEditor!: AceEditorComponent;

    // ACE editor settings
    @Input() placeholder: string = "";
    @Input() languageMode: string = "";
    @Input() disabled: boolean = false;
    @Input() minRows: number = 0;
    @Input() maxRows: number = 0;

    constructor() {}

    ngOnInit(): void {}

    focus(): void {}

    ngAfterViewInit() {
        this.aceEditor.content = "";
    }

    setReadOnly(b: boolean): void {}

    handleOk() {}
}