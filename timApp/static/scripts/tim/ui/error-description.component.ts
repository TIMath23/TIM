import {Input, Component} from "@angular/core";

@Component({
    selector: "tim-error-description",
    template: `
        <ng-container [ngSwitch]="error">
            <ng-container *ngSwitchCase="'EmailOrPasswordNotMatch'" i18n>Email or password is incorrect.</ng-container>
            <ng-container *ngSwitchCase="'EmailOrPasswordNotMatchUseHaka'" i18n>
                Email or password is incorrect. Haka members (e.g. universities) can use Haka login.
            </ng-container>
            <ng-container *ngSwitchCase="'WrongTempPassword'" i18n>Incorrect temporary password.</ng-container>
            <ng-container *ngSwitchCase="'PasswordsNotMatch'" i18n>Passwords do not match.</ng-container>
            <ng-container *ngSwitchCase="'PasswordTooShort'" i18n>Password is too short.</ng-container>
            <ng-container *ngSwitchCase="'UserAlreadyExists'" i18n>User already exists.</ng-container>
            <ng-container *ngSwitchDefault i18n>Unknown error: {{error}}</ng-container>
        </ng-container>
    `,
})
export class ErrorDescriptionComponent {
    @Input() error!: string;
}