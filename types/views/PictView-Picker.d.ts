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
    _portaled: boolean;
    _renderedShape: string;
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
     * Reflect a programmatic setValue into the DOM. Full render when the widget isn't live yet, or when
     * _shapeSignature() shows something outside the value area / list changed; otherwise just repaint
     * those two (the list's checkmark tracks the value). The targeted path is what lets a form marshal
     * re-seed on every solve without tearing down the search box (losing focus) or orphaning a portal.
     * select()/clearValue() keep their own full renders — this is only the setValue path.
     */
    _reflectValue(): void;
    /**
     * Signature of the render-affecting state the targeted refresh CANNOT repaint — the three things that
     * render outside #PPS_Value_ / #PPS_List_: the root's pps-multi/pps-readonly classes, the search box,
     * and the inline clear × (gated on value presence, so it moves with no config change). _reflectValue
     * full-renders when this changes. Extend it if the control template grows another such slot.
     * @return {string}
     */
    _shapeSignature(): string;
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
    /** Take the provider's single-active slot, closing whichever sibling holds it. Opt-in only (an off
     *  picker neither claims nor is closed). The slot holds a hash on the provider, so two pict instances
     *  sharing this module can't cross-close. */
    _claimActivePicker(): void;
    /** The pop wherever it lives (in-widget or portaled). By position not id: a re-render can briefly
     *  leave two sharing the id, and the in-widget copy is the live one. @return {HTMLElement|null} */
    _popElement(): HTMLElement | null;
    /** Pick this open's anchoring (see states above): portal when _shouldPortal finds a clipping ancestor
     *  that would cut the panel, else CSS. Judged from the control, which never moves — a portaled panel
     *  has no clipping ancestors, so testing it would flip-flop. */
    _applyAnchorMode(): void;
    /** Move the panel to <body> and place it against the control in document coords (viewport rect +
     *  scroll), flipping above when room below is short. Width is pinned since it no longer inherits the
     *  widget's. @param {HTMLElement} pPop */
    _portalPop(pPop: HTMLElement): void;
    /** Re-home a portaled panel and drop everything the portal wrote. Doubles as the orphan sweeper: if a
     *  re-render already put a fresh panel in the widget, the portaled one is stale and gets discarded.
     *  @param {HTMLElement} pPop */
    _restorePop(pPop: HTMLElement): void;
    /** Portal when ANY clipping ancestor would actually cut the panel (_clipBites) — an overflow ancestor
     *  alone isn't enough, but a roomy inner clipper doesn't excuse a tighter one further out.
     *  @param {HTMLElement} pControl @return {boolean} */
    _shouldPortal(pControl: HTMLElement): boolean;
    /** Nearest ancestor (up to, not including, body) with an overflow clip on any axis, or null. Stops at
     *  body because the document's own scroll is what the absolute anchoring rides on, not a clip.
     *  @param {HTMLElement} pElement @return {HTMLElement|null} */
    _clippingAncestor(pElement: HTMLElement): HTMLElement | null;
    /** True when the control has any overflow-clipping ancestor. Thin boolean over _clippingAncestor;
     *  the anchor decision uses _shouldPortal, which also weighs whether the clip reaches the panel.
     *  @param {HTMLElement} pElement @return {boolean} */
    _hasClippingAncestor(pElement: HTMLElement): boolean;
    /** Would the clipper cut the panel if it opened in place? The CSS path always opens downward and never
     *  flips, so project that worst-case box (control bottom + gap, up to max height) and test whether any
     *  edge falls outside the clipper. 1px slack avoids a needless portal on a flush edge.
     *  @param {HTMLElement} pControl @param {HTMLElement} pClipper @return {boolean} */
    _clipBites(pControl: HTMLElement, pClipper: HTMLElement): boolean;
    /** The single close funnel (close, single-mode select, clearValue, createFromSearch): clears open
     *  state, the provider's active-picker slot, and the results cache so nothing leaks a stale reference. */
    _markClosed(): void;
    /** Async mode: load + append the next page of results. */
    loadMore(): void;
    /** Close the dropdown. */
    close(): void;
    /** Opt-in teardown for a host that drops the view (pict-view has no destroy hook). _markClosed already
     *  releases the single-active slot, re-homes/removes a portaled panel, and clears the back-off entry;
     *  the un-destroyed case is harmless since a stray portaled pop stays hidden without pps-pop-open. */
    destroy(): void;
    /** Reflect open/closed on the root (pps-open) and on the pop (pps-pop-open) — a portaled pop is outside
     *  the root's rule, so it needs the class directly, which also keeps a stray one hidden. */
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