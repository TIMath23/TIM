import {settingsglobals} from "tim/util/globals";
import {Component, Input} from "@angular/core";
import {HttpClient} from "@angular/common/http";

const webBrowser = "UseWebBrowser";

@Component({
    selector: "tim-language-selector",
    template: `
        <select class="form-control"
                [(ngModel)]="settings.language"
                (ngModelChange)="onChange()"
        >
            <option [ngValue]="webBrowser" i18n>Use web browser preference</option>
            <option [ngValue]="'en-US'" i18n>English</option>
            <option [ngValue]="'fi'" i18n>Finnish</option>
        </select>
    `,
})
export class LanguageSelectorComponent {
    @Input() saveOnChange = false;
    webBrowser = webBrowser;

    constructor(private http: HttpClient) {
        this.settings.language = this.settings.language ?? webBrowser;
    }

    settings = settingsglobals().userPrefs;

    async onChange() {
        if (this.saveOnChange) {
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            await this.http.put("/settings/save/lang", {lang: this.settings.language || null}).toPromise();
            location.reload();
        }
    }
}