import type {IScope} from "angular";
import $ from "jquery";
import {to, to2} from "tim/util/utils";
import {showNameAreaDialog} from "tim/document/editing/showNameAreaDialog";
import {showMessageDialog} from "tim/ui/showMessageDialog";
import {UserSelection} from "tim/document/editing/userSelection";
import type {IParResponse} from "tim/document/editing/edittypes";
import {EditType} from "tim/document/editing/edittypes";
import type {UnbrokenSelection} from "tim/document/editing/unbrokenSelection";
import type {ParContext} from "tim/document/structure/parContext";
import {ParSelection} from "tim/document/editing/parSelection";
import {createParContext} from "tim/document/structure/create";
import {getContextualAreaInfo} from "tim/document/structure/areaContext";
import {$http} from "tim/util/ngimport";
import type {ViewCtrl} from "tim/document/viewctrl";
import {onClick} from "tim/document/eventhandlers";
import type {INameAreaOptions} from "tim/document/editing/name-area-dialog.component";

export class AreaHandler {
    public selectedAreaName: string | undefined;
    public sc: IScope;
    public viewctrl: ViewCtrl;

    constructor(sc: IScope, view: ViewCtrl) {
        this.sc = sc;
        this.viewctrl = view;

        onClick(".areaexpand, .areacollapse", ($this, e) => {
            if (
                $(e.target).hasClass("readline") ||
                $(e.target).hasClass("editline") ||
                $(e.target).hasClass("readsection") ||
                $(e.target).parent().hasClass("readsection")
            ) {
                return;
            }
            const elem = $this[0];
            const area = createParContext(elem);
            const {areasBeforeRef, areasAfterRef} = getContextualAreaInfo(area);
            const ar =
                areasAfterRef[areasAfterRef.length - 1] ??
                areasBeforeRef[areasBeforeRef.length - 1];
            if (!ar.collapse) {
                return;
            }
            ar.collapse.toggle();
        });
    }

    startSelection(e: MouseEvent, par: ParContext) {
        this.viewctrl.editingHandler.setSelection(
            new UserSelection(new ParSelection(par, par), par)
        );
    }

    async createArea(e: MouseEvent, sel: UnbrokenSelection) {
        const result = await to2(showNameAreaDialog());
        if (result.ok) {
            await this.nameAreaOk(
                sel,
                result.result.areaName,
                result.result.options
            );
        }
    }

    async nameAreaOk(
        sel: UnbrokenSelection,
        areaName: string,
        options: INameAreaOptions
    ) {
        const r = await to(
            $http.post<IParResponse>(
                "/name_area/" + this.viewctrl.docId + "/" + areaName,
                {
                    area_start: sel.start.originalPar.id,
                    area_end: sel.end.originalPar.id,
                    options,
                }
            )
        );
        if (r.ok) {
            await this.viewctrl.editingHandler.addSavedParToDom(r.result.data, {
                type: EditType.Edit,
                pars: sel,
            });
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    cancelSelection() {
        this.viewctrl.editingHandler.setSelection(undefined);
    }

    async removeAreaMarking(e: MouseEvent, par: ParContext) {
        const areaName = this.selectedAreaName;
        if (!areaName) {
            await showMessageDialog("Could not get area name");
        }

        const r = await to(
            $http.post(
                "/unwrap_area/" + this.viewctrl.docId + "/" + areaName,
                {}
            )
        );
        if (r.ok) {
            this.viewctrl.reload();
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }
}
