import {Coords} from "../util/utils";
import {Paragraph} from "./parhelpers";

export type MenuFunction = (
    e: JQuery.MouseEventBase,
    par: Paragraph,
    coords?: Coords
) => unknown;

export interface IMenuFunctionEntry {
    func: MenuFunction;
    desc: string;
    show: boolean;
    closeAfter?: boolean;
}

export type MenuFunctionList = IMenuFunctionEntry[];

export function getEmptyCoords() {
    return {left: 0, top: 0};
}

export interface ICtrlWithMenuFunctionEntry {
    getMenuEntry: () => IMenuFunctionEntry;
}
