import {
    AfterViewInit,
    Component,
    ElementRef,
    HostBinding,
    Input,
    NgZone,
    OnInit,
    Renderer2,
    ViewChild,
} from "@angular/core";
import * as DOMPurify from "dompurify";

export interface TableModelProvider {
    getDimension(): { rows: number, columns: number };

    getColumnHeaderContents(columnIndex: number): string;

    getRowHeight(rowIndex: number): number | undefined;

    getColumnWidth(columnIndex: number): number | undefined;

    stylingForRow(rowIndex: number): Record<string, string>;

    stylingForCell(rowIndex: number, columnIndex: number): Record<string, string>;

    classForCell(rowIndex: number, columnIndex: number): string;

    handleClickCell(rowIndex: number, columnIndex: number): void;

    getCellContents(rowIndex: number, columnIndex: number): string;

    getRowContents(rowIndex: number): string[];

    showColumn(colIndex: number): boolean;

    showRow(rowIndex: number): boolean;

    handleFilterFieldUpdate(value: string, columnIndex: number): void;
}

export interface VirtualScrollingOptions {
    enabled: boolean;
    viewOverflow: Position;
    borderSpacing: number;
}

interface Position {
    horizontal: number;
    vertical: number;
}

interface VisibleItems {
    startIndex: number;
    count: number;
    startPosition: number;
    viewStartIndex: number;
    viewCount: number;
}

interface Viewport {
    horizontal: VisibleItems;
    vertical: VisibleItems;
}

class GridAxis {
    hiddenItems: Set<number> = new Set<number>();
    positionStart: number[] = [];
    visibleItems: number[] = []; // Ordered + hidden ones removed
    itemOrder: number[] = [];

    constructor(size: number,
                private virtual: boolean,
                private border: number,
                private getSize: (i: number) => number,
                private showItem: (i: number) => boolean) {
        this.itemOrder = Array.from(new Array(size)).map((e, i) => i);
        this.refresh();
    }

    get totalSize(): number {
        return this.positionStart[this.positionStart.length - 1];
    }

    refresh(): void {
        this.visibleItems = this.itemOrder.filter((i) => this.showItem(i));
        if (!this.virtual) {
            return;
        }
        this.positionStart = [0];
        for (let i = 0; i <= this.visibleItems.length - 1; i++) {
            const index = this.visibleItems[i];
            this.positionStart[i + 1] = this.positionStart[i] + this.getSize(index) + this.border;
        }
    }

    getVisibleItemsInViewport(vpStartPosition: number, vpSize: number, visibleStartPosition: number, visibleSize: number): VisibleItems {
        vpStartPosition = clamp(vpStartPosition, 0, this.totalSize);
        visibleStartPosition = clamp(visibleStartPosition, 0, this.totalSize);
        vpSize = Math.min(vpSize, this.totalSize - vpStartPosition);
        visibleSize = Math.min(visibleSize, this.totalSize - visibleStartPosition);
        const startIndex = this.search(vpStartPosition);
        const viewStartIndex = this.search(visibleStartPosition);
        const endIndex = this.search(vpStartPosition + vpSize);
        const viewEndIndex = this.search(visibleStartPosition + visibleSize);
        return {
            startIndex: this.visibleItems[startIndex],
            count: Math.min(endIndex - startIndex + 1, this.visibleItems.length - startIndex),
            startPosition: this.positionStart[startIndex],
            viewStartIndex: viewStartIndex - startIndex,
            viewCount: Math.min(viewEndIndex - viewStartIndex + 1, this.visibleItems.length - viewStartIndex),
        };
    }

    private search(position: number): number {
        let start = 0;
        let end = this.positionStart.length - 1;
        while (start < end) {
            const mid = Math.floor((start + end) / 2);
            const posStart = this.positionStart[mid];
            if (position < posStart) {
                end = mid - 1;
            } else if (position > posStart) {
                start = mid + 1;
            } else {
                return mid;
            }
        }
        return end;
    }
}

interface RowStore {
    rowElement: HTMLTableRowElement;
    cells: HTMLTableCellElement[];
}

class TableCache {
    rows: RowStore[] = [];
    activeArea: Position = {horizontal: 0, vertical: 0};

    constructor(private tbody: HTMLTableSectionElement,
                private cellElement: "td" | "th" = "td",
                private createCellContent?: (cell: HTMLTableCellElement, rowIndex: number, columnIndex: number) => void) {
    }

    getRow(rowIndex: number): HTMLTableRowElement {
        if (rowIndex > this.activeArea.vertical) {
            throw new Error(`No row ${rowIndex} found! This should be unreachable!`);
        } else {
            return this.rows[rowIndex].rowElement;
        }
    }

    getCell(rowIndex: number, cellIndex: number): HTMLTableCellElement {
        if (rowIndex > this.activeArea.vertical || cellIndex > this.activeArea.horizontal) {
            throw new Error(`No cell ${rowIndex}, ${cellIndex} found! This should be unreachable!`);
        }
        return this.rows[rowIndex].cells[cellIndex];
    }

    resize(rows: number, columns: number): boolean {
        const rowDelta = rows - this.activeArea.vertical;
        const colDelta = columns - this.activeArea.horizontal;
        if (rowDelta > 0) {
            // Too few rows => grow
            // Readd possible hidden rows
            for (let rowNumber = 0; rowNumber < rows; rowNumber++) {
                let row = this.rows[rowNumber];
                if (row) {
                    row.rowElement.hidden = false;
                    continue;
                }
                row = this.rows[rowNumber] = {
                    rowElement: el("tr"),
                    cells: [],
                };
                // Don't update col count to correct one yet, handle just rows first
                for (let columnNumber = 0; columnNumber < columns; columnNumber++) {
                    const cell = row.cells[columnNumber] = el(this.cellElement);
                    if (this.createCellContent) {
                        this.createCellContent(cell, rowNumber, columnNumber);
                    }
                    row.rowElement.appendChild(cell);
                }
                this.tbody.appendChild(row.rowElement);
            }
        } else if (rowDelta < 0) {
            // Too many rows => hide unused ones
            for (let rowNumber = rows; rowNumber < this.rows.length; rowNumber++) {
                this.rows[rowNumber].rowElement.hidden = true;
            }
        }

        if (colDelta > 0) {
            // Columns need to be added => make use of colcache here
            for (let rowNumber = 0; rowNumber < rows; rowNumber++) {
                const row = this.rows[rowNumber];
                for (let columnNumber = 0; columnNumber < columns; columnNumber++) {
                    let cell = row.cells[columnNumber];
                    if (cell) {
                        cell.hidden = false;
                    } else {
                        cell = row.cells[columnNumber] = el(this.cellElement);
                        if (this.createCellContent) {
                            this.createCellContent(cell, rowNumber, columnNumber);
                        }
                        row.rowElement.appendChild(cell);
                    }
                }
            }
        } else if (colDelta < 0) {
            // Need to hide columns
            for (let rowNumber = 0; rowNumber < rows; rowNumber++) {
                const row = this.rows[rowNumber];
                for (let colNumber = columns; colNumber < row.cells.length; colNumber++) {
                    row.cells[colNumber].hidden = true;
                }
            }
        }
        this.activeArea = {
            horizontal: columns,
            vertical: rows,
        };
        return rowDelta !== 0 && colDelta !== 0;
    }
}

const DEFAULT_VSCROLL_SETTINGS: VirtualScrollingOptions = {
    enabled: false,
    viewOverflow: {horizontal: 1, vertical: 1},
    borderSpacing: 2,
};

// TODO: Update hooks
// TODO: Filtering
// TODO: Item selection
// TODO: Checkbox interactivity
// TODO: Veriy that general horizontal scrolling works
// TODO: Verify that vscrolling works

/*
    Implementation design:
    ## Change detection
    - Expose public function for view update => updateVisible, updateValue, refresh, updateSort, updateStyle
        - updateVisible only checks for visible
        - updateValue will update value for a cell
        - updateSort updates sort info
        - updateStyle updates style info for a cell
        - refresh does total update on visible data
    ## Passing data
    - Keep important methods public and do @ViewChild on the element
    ## Checkboxes
    - On click invoke cbClicked() on model provider
    - Add isCellChecked() in model provider
    ## Filters
    - On text change invoke filterChanged() on model provider
    - Add getFilterString() to model provider to read
    ## Value editing
    - Handle cell click event + add ability to call updateValue/updateStyle
 */

@Component({
    selector: "app-data-view",
    template: `
        <div class="header" #headerContainer>
            <table [ngStyle]="tableStyle" #headerTable>
                <thead #headerIdBody></thead>
                <tbody #filterBody></tbody>
            </table>
        </div>
        <div class="summary">
            <table [ngStyle]="tableStyle" #summaryTable>
                <thead>
                <tr>
                    <td [style.width]="idHeaderCellWidth" class="nrcolumn totalnr">{{totalRows}}</td>
                    <td class="cbColumn"><input type="checkbox"></td>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td [style.width]="idHeaderCellWidth" class="nrcolumn totalnr"></td>
                    <td class="cbColumn"><input type="checkbox"></td>
                </tr>
                </tbody>
            </table>
        </div>
        <div class="ids" #idContainer>
            <table [ngStyle]="tableStyle" #idTable>
                <tbody #idBody></tbody>
            </table>
        </div>
        <div class="data" [ngStyle]="{'maxHeight': tableMaxHeight}" #mainDataContainer>
            <table [ngClass]="tableClass" [ngStyle]="tableStyle" [class.virtual]="virtualScrolling.enabled"
                   #mainDataTable>
                <tbody class="content" #mainDataBody></tbody>
            </table>
        </div>
    `,
    styleUrls: ["./data-view.component.scss"],
})
export class DataViewComponent implements AfterViewInit, OnInit {
    // region Fields
    @Input() modelProvider!: TableModelProvider; // TODO: Make optional and error out if missing
    @Input() virtualScrolling: Partial<VirtualScrollingOptions> = DEFAULT_VSCROLL_SETTINGS;
    @Input() tableClass: { [klass: string]: unknown } = {};
    @Input() tableStyle: { [klass: string]: unknown } = {};
    @Input() headerStyle: Record<string, string> | null = {};
    @Input() columnIdStart: number = 1;
    @Input() tableMaxHeight: string = "2000em";
    @Input() tableMaxWidth: string = "fit-content";
    idHeaderCellWidth: string = "";
    @HostBinding("style.width") private componentWidth: string = "";
    @ViewChild("headerContainer") private headerContainer?: ElementRef<HTMLDivElement>;
    @ViewChild("headerTable") private headerTable?: ElementRef<HTMLTableElement>;
    @ViewChild("headerIdBody") private headerIdBody?: ElementRef<HTMLTableSectionElement>;
    @ViewChild("filterBody") private filterBody?: ElementRef<HTMLTableSectionElement>;
    @ViewChild("idContainer") private idContainer?: ElementRef<HTMLDivElement>;
    @ViewChild("idTable") private idTable?: ElementRef<HTMLTableElement>;
    @ViewChild("idBody") private idBody?: ElementRef<HTMLTableSectionElement>;
    @ViewChild("mainDataBody") private mainDataBody!: ElementRef<HTMLTableSectionElement>;
    @ViewChild("mainDataTable") private mainDataTable!: ElementRef<HTMLTableElement>;
    @ViewChild("mainDataContainer") private mainDataContainer!: ElementRef<HTMLDivElement>;
    @ViewChild("summaryTable") private summaryTable!: ElementRef<HTMLTableElement>;
    private scrollDY = 0;
    private cellValueCache: Record<number, string[]> = {};
    private dataTableCache!: TableCache;
    private idTableCache?: TableCache;
    private headerIdTableCache?: TableCache;
    private filterTableCache?: TableCache;
    private scheduledUpdate = false;
    private viewport!: Viewport;
    private rowAxis!: GridAxis;
    private colAxis!: GridAxis;
    private vScroll: VirtualScrollingOptions = {...DEFAULT_VSCROLL_SETTINGS, ...this.virtualScrolling};
    private colHeaderWidths: number[] = [];

    // endregion

    constructor(private r2: Renderer2, private zone: NgZone, private componentRef: ElementRef<HTMLElement>) {
    }

    get totalRows() {
        return this.modelProvider.getDimension().rows;
    }

    private get tableWidth(): number {
        return Math.min(this.mainDataContainer.nativeElement.offsetWidth, this.mainDataTable.nativeElement.offsetWidth);
    }

    private get tableHeight(): number {
        return Math.min(this.mainDataContainer.nativeElement.offsetHeight, this.mainDataTable.nativeElement.offsetHeight);
    }

    /**
     * Updates all visible elements in the table
     */
    updateVisible() {
        this.rowAxis.refresh();
        this.colAxis.refresh();

        if (this.vScroll.enabled) {
            this.updateVTable();
            return;
        }

        // For normal mode: simply hide rows that are no more visible/show hidden rows
        for (const [rowNumber, row] of this.dataTableCache.rows.entries()) {
            const rowIndex = this.rowAxis.itemOrder[rowNumber];
            const shouldHide = !this.modelProvider.showRow(rowIndex);
            const hidden = row.rowElement.hidden;
            if (shouldHide != hidden) {
                row.rowElement.hidden = shouldHide;
            }

            // if (!row.rowElement.hidden) {
            //     for (const [cellNumber, cell] of row.cells.entries()) {
            //         const cellIndex = this.colAxis.
            //     }
            // }
        }
        requestAnimationFrame(() => this.updateHeaderSizes());
    }

    // region Initialization

    ngOnInit(): void {
        this.componentWidth = this.tableMaxWidth;
        if (this.vScroll.enabled) {
            this.startCellPurifying();
        }
        const {rows, columns} = this.modelProvider.getDimension();
        this.rowAxis = new GridAxis(rows,
            this.vScroll.enabled,
            this.vScroll.borderSpacing,
            (i) => this.modelProvider.getRowHeight(i) ?? 0,
            (i) => this.modelProvider.showRow(i));
        this.colAxis = new GridAxis(columns,
            this.vScroll.enabled,
            this.vScroll.borderSpacing,
            (i) => this.modelProvider.getColumnWidth(i) ?? 0,
            (i) => this.modelProvider.showColumn(i));
    }

    ngAfterViewInit(): void {
        this.initTableCaches();
        // Run table building in multiple frames to ensure layout happens so that size of elements is known
        runMultiFrame(this.buildTable());

        // Scrolling can cause change detection on some cases, which slows down the table
        // Since scrolling is
        // * Only used in vscrolling mode
        // * Doesn't change the template
        // it's better to run scroll events outside zones
        this.zone.runOutsideAngular(() => {
            this.r2.listen(this.mainDataContainer.nativeElement, "scroll", () => this.handleScroll());
        });
        this.zone.runOutsideAngular(() => {
            window.addEventListener("resize", () => this.handleWindowResize());
        });
    }

    private initTableCaches() {
        this.dataTableCache = new TableCache(this.mainDataBody.nativeElement);
        if (this.idBody) {
            this.idTableCache = new TableCache(
                this.idBody.nativeElement,
                "td",
                (cell, rowIndex, columnIndex) => {
                    if (columnIndex !== 1) {
                        return;
                    }
                    cell.className = "cbColumn";
                    const input = cell.appendChild(el("input"));
                    input.type = "checkbox";
                }
            );
        }
        if (this.headerIdBody) {
            this.headerIdTableCache = new TableCache(this.headerIdBody.nativeElement, "td", (cell) => {
                applyBasicStyle(cell, this.headerStyle);
            });
        }
        if (this.filterBody) {
            this.filterTableCache = new TableCache(
                this.filterBody.nativeElement,
                "td",
                (cell) => {
                    const input = cell.appendChild(el("input"));
                    input.type = "text";
                });
        }
    }

    // endregion

    // region Resizing

    private handleWindowResize(): void {
        this.updateHeaderSizes();
        if (!this.vScroll.enabled) {
            return;
        }
        this.viewport = this.getViewport();
        runMultiFrame(this.updateViewport());
    }

    private updateHeaderSizes(): void {
        if (!this.headerContainer || !this.idContainer) {
            return;
        }
        this.headerContainer.nativeElement.style.width = `${this.tableWidth + getWindowScrollbarWidth()}px`;
        this.idContainer.nativeElement.style.height = `${this.tableHeight}px`;
        this.updateColumnHeaderCellSizes();
        this.updateRowHeaderCellSizes();
        this.updateSummaryCellSizes();
    }

    private updateRowHeaderCellSizes(): void {
        if (!this.idTableCache) {
            return;
        }
        const {horizontal, vertical} = this.viewport;

        this.idTableCache.resize(this.viewport.vertical.count, 2);
        // Get sizes in batch for speed
        const sizes = Array.from(new Array(horizontal.count)).map((value, index) => {
            const rowIndex = this.rowAxis.visibleItems[index + vertical.startIndex];
            return this.getRowHeaderHeight(rowIndex);
        });
        for (let row = 0; row < vertical.count; row++) {
            const tr = this.idTableCache.getRow(row);
            tr.style.height = `${sizes[row]}px`;
        }
    }

    private updateColumnHeaderCellSizes(): void {
        if (!this.headerIdTableCache || !this.filterTableCache) {
            return;
        }
        const {horizontal} = this.viewport;

        this.headerIdTableCache.resize(1, this.viewport.horizontal.count);
        this.filterTableCache.resize(1, this.viewport.horizontal.count);
        const sizes = Array.from(new Array(horizontal.count)).map((value, index) => {
            const columnIndex = this.colAxis.visibleItems[index + horizontal.startIndex];
            return Math.max(this.getColumnHeaderWidth(columnIndex), this.colHeaderWidths[columnIndex]);
        });
        for (let column = 0; column < horizontal.count; column++) {
            const width = sizes[column];
            const headerCell = this.headerIdTableCache.getCell(0, column);
            const filterCell = this.filterTableCache.getCell(0, column);
            headerCell.style.width = `${width}px`;
            filterCell.style.width = `${width}px`;
        }
    }

    private updateSummaryCellSizes(): void {
        const width = this.idTableCache?.getCell(0, 0)?.offsetWidth;
        if (!width) {
            return;
        }
        this.summaryTable.nativeElement.querySelectorAll(".nrcolumn").forEach((e) => {
            if (e instanceof HTMLElement) {
                e.style.width = `${width}px`;
            }
        });
    }

    // endregion

    // region Virtual scrolling

    private updateVTable() {
        // Set viewport already here to account for subsequent handlers
        const newViewport = this.getViewport();
        this.scrollDY = newViewport.vertical.startIndex - this.viewport.vertical.startIndex;
        this.viewport = newViewport;
        this.updateTableTransform();
        runMultiFrame(this.updateViewport());
    }

    private isOutsideSafeViewZone(): boolean {
        const data = this.mainDataContainer.nativeElement;
        const h = data.clientHeight * this.vScroll.viewOverflow.vertical;
        const w = data.clientWidth * this.vScroll.viewOverflow.horizontal;
        const overVertical = Math.abs(this.viewport.vertical.startPosition - data.scrollTop + h) > h;
        const overHorizontal = Math.abs(this.viewport.horizontal.startPosition - data.scrollLeft + w) > w;
        return overHorizontal || overVertical;
    }

    private handleScroll(): void {
        this.syncHeaderScroll();
        if (!this.vScroll.enabled) {
            return;
        }
        if (this.scheduledUpdate) {
            return;
        }
        if (!this.isOutsideSafeViewZone()) {
            return;
        }
        this.scheduledUpdate = true;
        this.updateVTable();
    }

    private* updateViewport(): Generator {
        const {vertical, horizontal} = this.viewport;
        this.dataTableCache.resize(this.viewport.vertical.count, this.viewport.horizontal.count);
        this.idTableCache?.resize(this.viewport.vertical.count, 2);
        this.headerIdTableCache?.resize(1, this.viewport.horizontal.count);
        this.filterTableCache?.resize(1, this.viewport.horizontal.count);
        const render = (startRow: number, endRow: number) => {
            for (let rowNumber = startRow; rowNumber < endRow; rowNumber++) {
                const tr = this.dataTableCache.getRow(rowNumber);
                tr.hidden = false;
                const rowIndex = this.rowAxis.visibleItems[vertical.startIndex + rowNumber];
                this.updateRow(tr, rowIndex);
                for (let columnNumber = 0; columnNumber < horizontal.count; columnNumber++) {
                    const td = this.dataTableCache.getCell(rowNumber, columnNumber);
                    td.hidden = false;
                    const columnIndex = this.colAxis.visibleItems[horizontal.startIndex + columnNumber];
                    this.updateCell(td, rowIndex, columnIndex, this.getCellValue(rowIndex, columnIndex));
                }

                if (this.idTableCache) {
                    const idRow = this.idTableCache.getRow(rowNumber);
                    idRow.style.height = `${this.modelProvider.getRowHeight(rowIndex)}px`;
                    const idCell = this.idTableCache.getCell(rowNumber, 0);
                    idCell.textContent = `${rowIndex + this.columnIdStart}`;
                }

                if (this.headerIdTableCache && this.filterTableCache) {
                    for (let columnNumber = 0; columnNumber < horizontal.count; columnNumber++) {
                        const headerIdCell = this.headerIdTableCache.getCell(0, columnNumber);
                        const filterCell = this.filterTableCache.getCell(0, columnNumber);
                        const columnIndex = this.colAxis.visibleItems[horizontal.startIndex + columnNumber];
                        // TODO: Cache for speedup
                        const width = this.getColumnHeaderWidth(columnIndex);
                        headerIdCell.style.width = filterCell.style.width = `${width}px`;
                        headerIdCell.textContent = `${columnIndex}`;
                    }
                }
            }
        };
        // Render in three parts:
        // * The main visible area
        // * The top part
        // * The bottom part
        let renderOrder = [
            () => render(0, vertical.viewStartIndex),
            () => render(vertical.viewStartIndex + vertical.viewCount, vertical.count),
        ];
        if (this.scrollDY > 0) {
            renderOrder = renderOrder.reverse();
        }
        render(vertical.viewStartIndex, vertical.viewStartIndex + vertical.viewCount);
        yield;
        for (const r of renderOrder) {
            r();
            yield;
        }
        this.mainDataBody.nativeElement.style.visibility = "visible";
        // If we veered off the new safe view zone, we need to update it again!
        if (this.isOutsideSafeViewZone()) {
            // This could have been likely caused by fast scrolling, in which case hide the element to prevent
            // flickering
            this.mainDataBody.nativeElement.style.visibility = "hidden";
            this.viewport = this.getViewport();
            this.updateTableTransform();
            runMultiFrame(this.updateViewport());
        } else {
            this.scheduledUpdate = false;
        }
    }

    private syncHeaderScroll(): void {
        if (!this.headerContainer || !this.idContainer) {
            return;
        }
        const header = this.headerContainer.nativeElement;
        const data = this.mainDataContainer.nativeElement;
        const ids = this.idContainer.nativeElement;
        header.scrollLeft = data.scrollLeft;
        ids.scrollTop = data.scrollTop;
    }

    private updateTableTransform(): void {
        if (!this.vScroll.enabled || !this.idBody || !this.headerTable || !this.filterBody) {
            return;
        }
        const idTable = this.idBody.nativeElement;
        const headerIdTable = this.headerTable.nativeElement;
        const filterTable = this.filterBody.nativeElement;
        this.mainDataBody.nativeElement.style.transform = `translateX(${this.viewport.horizontal.startPosition}px) translateY(${this.viewport.vertical.startPosition}px)`;
        idTable.style.transform = `translateY(${this.viewport.vertical.startPosition}px)`;
        headerIdTable.style.transform = filterTable.style.transform = `translateX(${this.viewport.horizontal.startPosition}px)`;
    }

    // endregion

    // region Table building

    private setTableSizes(): void {
        if (!this.vScroll.enabled || !this.idTable || !this.headerTable) {
            return;
        }
        const table = this.mainDataTable.nativeElement;
        const idTable = this.idTable.nativeElement;
        const headerTable = this.headerTable.nativeElement;
        table.style.height = `${this.rowAxis.totalSize}px`;
        table.style.width = `${this.colAxis.totalSize}px`;
        table.style.borderSpacing = `${this.vScroll.borderSpacing}px`;
        idTable.style.height = `${this.rowAxis.totalSize}px`;
        idTable.style.borderSpacing = `${this.vScroll.borderSpacing}px`;
        headerTable.style.width = `${this.colAxis.totalSize}px`;
        headerTable.style.borderSpacing = `${this.vScroll.borderSpacing}px`;
    }

    private getViewport(): Viewport {
        const data = this.mainDataContainer.nativeElement;
        const {rows, columns} = this.modelProvider.getDimension();
        if (this.vScroll.enabled) {
            const viewportWidth = data.clientWidth * (1 + 2 * this.vScroll.viewOverflow.horizontal);
            const viewportHeight = data.clientHeight * (1 + 2 * this.vScroll.viewOverflow.vertical);
            return {
                horizontal: this.colAxis.getVisibleItemsInViewport(
                    data.scrollLeft - data.clientWidth * this.vScroll.viewOverflow.horizontal,
                    viewportWidth,
                    data.scrollLeft,
                    data.clientWidth),
                vertical: this.rowAxis.getVisibleItemsInViewport(
                    data.scrollTop - data.clientHeight * this.vScroll.viewOverflow.vertical,
                    viewportHeight,
                    data.scrollTop,
                    data.clientHeight),
            };
        }
        return {
            horizontal: {startPosition: 0, count: columns, startIndex: 0, viewCount: 0, viewStartIndex: 0},
            vertical: {startPosition: 0, count: rows, startIndex: 0, viewCount: 0, viewStartIndex: 0},
        };
    }

    private* buildTable(): Generator {
        this.componentRef.nativeElement.style.visibility = "hidden";
        this.viewport = this.getViewport();
        this.setTableSizes();
        this.updateTableTransform();

        this.buildColumnHeaderTable();
        this.buildRowHeaderTable();
        this.buildDataTable();

        // Force the main table to layout first so that we can compute the header sizes
        yield;
        this.updateHeaderSizes();
        this.componentRef.nativeElement.style.visibility = "visible";
    }

    private buildDataTable(): void {
        const tbody = this.mainDataBody.nativeElement;
        const {vertical, horizontal} = this.viewport;
        this.dataTableCache.resize(vertical.count, horizontal.count);
        const getItem = (axis: GridAxis, index: number) =>
            this.vScroll.enabled ? this.rowAxis.visibleItems[index] : this.rowAxis.itemOrder[index];

        for (let rowNumber = 0; rowNumber < vertical.count; rowNumber++) {
            const rowIndex = getItem(this.rowAxis, vertical.startIndex + rowNumber);
            this.updateRow(this.dataTableCache.getRow(rowNumber), rowIndex);
            for (let columnNumber = 0; columnNumber < horizontal.count; columnNumber++) {
                const columnIndex = getItem(this.colAxis, horizontal.startIndex + columnNumber);
                const cell = this.dataTableCache.getCell(rowNumber, columnNumber);
                this.updateCell(cell, rowIndex, columnIndex, this.getCellValue(rowIndex, columnIndex));
            }
        }
        // Optimization in normal mode: sanitize whole tbody in place
        if (!this.vScroll.enabled) {
            DOMPurify.sanitize(tbody, {IN_PLACE: true});
        }
    }

    private buildColumnHeaderTable(): void {
        if (!this.headerIdTableCache || !this.filterTableCache) {
            return;
        }
        this.headerIdTableCache.resize(1, this.viewport.horizontal.count);
        this.filterTableCache.resize(1, this.viewport.horizontal.count);
        const {horizontal} = this.viewport;
        const colIndices: [HTMLTableCellElement, number][] = [];
        for (let column = 0; column < horizontal.count; column++) {
            const columnIndex = this.colAxis.visibleItems[column + horizontal.startIndex];
            const headerCell = this.headerIdTableCache.getCell(0, column);
            colIndices.push([headerCell, columnIndex]);
            headerCell.textContent = `${this.modelProvider.getColumnHeaderContents(columnIndex)}`;

            const filterCell = this.filterTableCache.getCell(0, column);
            const input = filterCell.getElementsByTagName("input")[0];
            input.oninput = () => {
                this.modelProvider.handleFilterFieldUpdate(input.value, columnIndex);
            };
        }
        for (const [cell, columnIndex] of colIndices) {
            this.colHeaderWidths[columnIndex] = cell.offsetWidth;
        }
    }

    private buildRowHeaderTable(): void {
        if (!this.idTableCache) {
            return;
        }
        this.idTableCache.resize(this.viewport.vertical.count, 2);
        const {vertical} = this.viewport;
        for (let row = 0; row < vertical.count; row++) {
            const rowIndex = this.rowAxis.visibleItems[row + vertical.startIndex];
            const idCell = this.idTableCache.getCell(row, 0);
            idCell.textContent = `${rowIndex + this.columnIdStart}`;
        }
    }

    private updateRow(row: HTMLTableRowElement, rowIndex: number): HTMLTableRowElement {
        row.style.cssText = joinCss(this.modelProvider.stylingForRow(rowIndex));
        row.hidden = !this.vScroll.enabled && this.rowAxis.hiddenItems.has(rowIndex);
        const rowHeight = this.modelProvider.getRowHeight(rowIndex);
        if (rowHeight) {
            row.style.height = `${rowHeight}px`;
            row.style.overflow = "hidden";
        }
        return row;
    }

    private updateCell(cell: HTMLTableCellElement, rowIndex: number, columnIndex: number, contents?: string): HTMLTableCellElement {
        cell.hidden = !this.vScroll.enabled && this.colAxis.hiddenItems.has(columnIndex);
        cell.className = this.modelProvider.classForCell(rowIndex, columnIndex);
        cell.style.cssText = joinCss(this.modelProvider.stylingForCell(rowIndex, columnIndex));
        cell.onclick = () => this.modelProvider.handleClickCell(rowIndex, columnIndex);
        const colWidth = this.getDataColumnWidth(columnIndex);
        if (colWidth) {
            if (this.vScroll.enabled) {
                cell.style.width = `${colWidth}px`;
                cell.style.overflow = "hidden";
            } else {
                cell.style.minWidth = `${colWidth}px`;
            }
        }
        if (contents) {
            cell.innerHTML = contents;
        }
        return cell;
    }

    // endregion

    // region Utils

    private getCellValue(rowIndex: number, columnIndex: number): string {
        if (!this.vScroll.enabled) {
            return this.modelProvider.getCellContents(rowIndex, columnIndex);
        }
        const row = this.cellValueCache[rowIndex];
        if (row?.[columnIndex]) {
            return this.cellValueCache[rowIndex][columnIndex];
        }
        if (!row) {
            this.cellValueCache[rowIndex] = [];
        }
        // If the web worker hasn't sanitized the contents yet, do it ourselves
        return this.cellValueCache[rowIndex][columnIndex] = DOMPurify.sanitize(this.modelProvider.getCellContents(rowIndex, columnIndex));
    }

    private startCellPurifying(): void {
        if (typeof Worker !== "undefined") {
            // Note: this triggers worker-plugin to be run
            // As of 27.7., worker-plugin triggers the following warning
            //
            // WARNING in new Worker() will only be bundled if passed a String.
            //
            // Because of ACE editor using workers without {type: "module"}
            // This was fixed in worker-plugin master:
            // https://github.com/GoogleChromeLabs/worker-plugin/pull/73
            // but it's not yet released nor part of Angular CLI.
            const worker = new Worker("./table-purify.worker", {type: "module"});
            worker.onmessage = ({data}: { data: PurifyData }) => {
                this.cellValueCache[data.row] = data.data;
            };
            const {rows} = this.modelProvider.getDimension();
            for (let row = 0; row < rows; row++) {
                worker.postMessage({
                    row,
                    data: this.modelProvider.getRowContents(row),
                } as PurifyData);
            }
        }
    }

    private getDataColumnWidth(columnIndex: number): number {
        const res = this.modelProvider.getColumnWidth(columnIndex);
        const headerRes = this.colHeaderWidths[columnIndex];
        if (res === undefined || headerRes === undefined) {
            return res ?? headerRes;
        }
        return Math.max(res, headerRes);
    }

    private getColumnHeaderWidth(columnIndex: number): number {
        const res = this.modelProvider.getColumnWidth(columnIndex);
        if (res !== undefined) {
            return res;
        }
        if (this.rowAxis.visibleItems.length == 0) {
            return 0;
        }
        return this.dataTableCache.getCell(this.rowAxis.visibleItems[0], columnIndex).offsetWidth;
    }

    private getRowHeaderHeight(rowIndex: number): number {
        const res = this.modelProvider.getRowHeight(rowIndex);
        if (res !== undefined) {
            return res;
        }
        if (this.rowAxis.visibleItems.length == 0) {
            return 0;
        }
        return this.dataTableCache.getRow(rowIndex).offsetHeight;
    }

    // endregion
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
    return document.createElement(tag);
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(Math.min(val, max), min);
}

function runMultiFrame(iter: Generator): void {
    const cb = () => {
        const result = iter.next();
        if (!result.done) {
            requestAnimationFrame(cb);
        }
    };
    requestAnimationFrame(cb);
}

function joinCss(obj: Record<string, string>) {
    let result = "";
    // eslint-disable-next-line guard-for-in
    for (const k in obj) {
        // noinspection JSUnfilteredForInLoop
        result = `${result}; ${k}:${obj[k]}`;
    }
    return result;
}

function applyBasicStyle(element: HTMLElement, style: Record<string, string> | null) {
    if (style != null) {
        Object.assign(element.style, style);
    }
}

interface PurifyData {
    row: number;
    data: string[];
}

// TODO: This only works if there is a scrollbar on the window
function getWindowScrollbarWidth() {
    return (window.innerWidth - document.getElementsByTagName("html")[0].clientWidth);
}
