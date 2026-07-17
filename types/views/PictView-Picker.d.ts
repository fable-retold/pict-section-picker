export = PictViewPicker;
declare class PictViewPicker extends libPictView {
    constructor(pFable: any, pOptions: any, pServiceHash: any);
    _StateAddress: string;
    _open: boolean;
    _search: string;
    _highlight: number;
    _loadedResults: any[];
    _page: number;
    _hasMore: boolean;
    _loading: boolean;
    _loaded: boolean;
    _searchTimer: NodeJS.Timeout;
    _selectedText: any;
    _fReposition: () => void;
    _repositionFrame: number;
    _values: any[];
    _selectedRecords: {};
    /** @return {boolean} True when a DataProvider function is configured (async/server mode). */
    _isAsync(): boolean;
    /** @return {boolean} True when the picker is in multi-select (chips) mode. */
    _isMulti(): boolean;
    /** @return {Record<string, any>} The AppData state slot for this picker. */
    _state(): Record<string, any>;
    /** Resolve display text for any pre-bound value(s) via the async ResolveValue hook, then repaint. */
    _resolveInitialValues(): void;
    /**
     * @return {any} The current selection: a scalar in single mode, or an array of values in multi mode
     *   (normalizing a csv string or scalar at the bound address into an array).
     */
    getValue(): any;
    /**
     * Persist the selection to the bound address(es). Single mode writes the scalar; multi mode writes
     * the array to ValueAddress and mirrors it to the optional csv / records addresses.
     * @param {any} pValue - The new value (scalar in single mode, array in multi mode).
     */
    _setValue(pValue: any): void;
    _value: any;
    /**
     * Public: set the picker's value programmatically (e.g. when a host form marshals data into it).
     * Accepts a scalar (single mode) or an array / csv string (multi mode), seeds display text for any
     * unknown values (from the source rows, else async ResolveValue), then repaints.
     * @param {any} pValue
     * @return {PictViewPicker} this
     */
    setValue(pValue: any): PictViewPicker;
    /**
     * Ensure each value has a {Value,Text} in _selectedRecords — from the current source rows when
     * present, else (async mode) fetched via ResolveValue and painted in when it resolves.
     * @param {Array<any>} pValues
     */
    _seedSelectedRecords(pValues: Array<any>): void;
    /** @return {Array<{Value:any, Text:string, Tag?:any}>} The current option source rows (async results or static Options). */
    _sourceRows(): Array<{
        Value: any;
        Text: string;
        Tag?: any;
    }>;
    /**
     * Build the EntityTag before/after render slots for a record. Accepts a single tag value OR an array
     * of them (the `Tags` multi-badge form), so a record can carry several disambiguation chips (e.g. a
     * book's ISBN + year). Empty/blank entries are dropped; a tag-less record renders no badge. The slot
     * is a per-tag `{Tag}` array, and the value/chip/option templates already iterate it with `{~TS:~}`.
     * @param {any} pTags - a tag value, or an array of tag values.
     * @param {boolean} pTagLast
     * @return {{TagBeforeSlot:Array<any>, TagAfterSlot:Array<any>}}
     */
    _tagSlots(pTags: any, pTagLast: boolean): {
        TagBeforeSlot: Array<any>;
        TagAfterSlot: Array<any>;
    };
    /**
     * The tag(s) to render for a record — the multi-badge `Tags` array when present, else the single
     * `Tag` (back-compat). Centralizes the precedence used by every `_tagSlots` call site.
     * @param {any} pRecord
     * @return {any}
     */
    _recordTags(pRecord: any): any;
    /**
     * (Re)compute the picker's render state into AppData: the displayed value / chips + the
     * (search-filtered) option list with selected/highlight flags.
     */
    _buildState(): Record<string, any>;
    /**
     * Find the {Value,Text} record for a value: the stored selection record (authoritative for chips /
     * async), else a row in the current source (static Options or loaded results).
     * @param {any} pValue
     * @return {{Value:any, Text:string, Tag?:any}|null}
     */
    _lookupRecord(pValue: any): {
        Value: any;
        Text: string;
        Tag?: any;
    } | null;
    /**
     * Load a page of results from the async DataProvider, accumulating (append) or replacing the list.
     * @param {number} pPage - zero-based page index.
     * @param {boolean} pAppend - true to append (Load more), false to replace (new search / first open).
     */
    _loadPage(pPage: number, pAppend: boolean): void;
    /** Toggle the dropdown open/closed. */
    toggle(pEvent: any): void;
    /** Keyboard on the control: open the dropdown on Enter / Space / ArrowDown. */
    onControlKey(pEvent: any): void;
    /** Open the dropdown and focus the search box. With the opt-in SingleActivePicker option, closes
     *  any open sibling picker first — one active dropdown per page. */
    open(): void;
    /**
     * Bind the while-open viewport listeners: scrolling (any ancestor scroll pane — hence capture
     * phase) or resizing moves the control while the position:fixed dropdown stays put, so both
     * re-run _positionPop() to keep the panel anchored to its control. Throttled to animation frames.
     */
    _bindRepositionListeners(): void;
    /** Release the while-open viewport listeners (every close path funnels through _markClosed). */
    _unbindRepositionListeners(): void;
    /**
     * Mark the dropdown closed: the transient open state, the module-level active-picker slot, and the
     * while-open viewport listeners. Shared by every path that closes the dropdown (close(), a
     * single-mode select, clearValue, createFromSearch) so none of them can leak a listener or leave a
     * stale active-picker reference.
     */
    _markClosed(): void;
    /**
     * Position the (fixed) dropdown against the control, flipping above when there's more room there.
     * Because the popover is position:fixed (viewport-anchored), no ancestor overflow can clip it; the
     * trade-off is we set its top/left/width ourselves from the control's rect on open.
     *
     * A position:fixed element is only viewport-anchored when no ancestor establishes a containing
     * block. An ancestor with a transform / perspective / filter (a modal centered with
     * translate(-50%, -50%), a card with a drop-shadow filter, ...) becomes the containing block, and
     * then top/left/bottom resolve against THAT box instead of the viewport -- the dropdown flies off
     * toward a corner. So we detect such an ancestor and shift the viewport-space coordinates we compute
     * into its space. With no such ancestor the offsets are zero and the math is identical to before.
     * (The shift assumes the containing block is translated, not scaled -- the transforms that show up
     * in practice here, modal centering and drop-shadows, translate but do not scale.)
     */
    _positionPop(): void;
    /**
     * The bounding rect of the nearest ancestor that establishes the containing block for this
     * position:fixed popover -- an element with a transform, perspective, filter, backdrop-filter, or a
     * will-change / contain that promotes one -- or null when the popover is anchored to the viewport as
     * usual. Used by _positionPop() to convert viewport-space coordinates into that ancestor's space so
     * the dropdown still lands against its control inside, for example, a transform-centered modal.
     * @param {HTMLElement} pElement
     * @return {DOMRect | null}
     */
    _fixedContainingBlockRect(pElement: HTMLElement): DOMRect | null;
    /** Async mode: load + append the next page of results. */
    loadMore(): void;
    /** Close the dropdown. */
    close(): void;
    /**
     * Async mode: invalidate the loaded results and re-query the DataProvider. The public hook for a
     * host whose CONTEXTUAL scope changed outside the picker (a "Show All" toggle, a dependent field
     * pick, …) — the accumulated pages no longer reflect the filters, so drop them; an open dropdown
     * re-queries immediately, a closed one on its next open. No-op for static Options pickers (their
     * list is filtered live, nothing is cached).
     * @return {PictViewPicker} this
     */
    reload(): PictViewPicker;
    /** Reflect the open/closed state on the widget container. */
    _paintOpen(): void;
    /** Re-render only the option list (keeps the search input + its focus intact). */
    _renderList(): void;
    /** Re-render only the control's value area (the value span or the chips) — used in multi mode so
     *  toggling a selection updates the chips without tearing down the open dropdown + search box. */
    _renderValue(): void;
    /** @param {string} pValue - Filter the option list by this search term. */
    search(pValue: string): void;
    /** Keyboard navigation within the search box: arrows highlight, Enter selects, Escape closes. */
    onSearchKey(pEvent: any): void;
    /**
     * Select an option. Single mode: set the value + close. Multi mode: toggle the value in/out of the
     * selection, keep the dropdown open, and refocus the search box for rapid multi-pick.
     * @param {string} pValueKey - String(Value) of the option.
     */
    select(pValueKey: string): void;
    /**
     * Clearable (AllowClear, single mode): empty the selection — from the control's inline × or the
     * pinned "Any" dropdown row. Closing mirrors select() (clearing IS a selection: "Any"), and
     * OnChange(null, null) fires only when there was a value to clear, so clicking "Any" while
     * already empty just closes the dropdown.
     */
    clearValue(): void;
    /** @return {Array<{Value:any, Text:string}>} The full record list for the current multi selection. */
    getSelectedRecords(): Array<{
        Value: any;
        Text: string;
    }>;
    /**
     * Creatable: build a new option from the current search term via OnCreate, then select it (single:
     * set + close; multi: add a chip). The created record is inserted into the source list so it shows
     * as a normal, checked option.
     */
    createFromSearch(): void;
    /** Multi mode: remove a selected value (chip ×). Keeps the dropdown state as-is. */
    removeChip(pValueKey: any): void;
}
declare namespace PictViewPicker {
    export { _DEFAULT_CONFIGURATION as default_configuration };
}
import libPictView = require("pict-view");
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION: Record<string, any>;
//# sourceMappingURL=PictView-Picker.d.ts.map