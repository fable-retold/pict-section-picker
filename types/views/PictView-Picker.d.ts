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
     * Reflect the current value into the DOM after a programmatic setValue. The first call — widget not
     * yet in the DOM — does the full build; once the widget is live it refreshes the value area and the
     * option list (whose selected-row checkmark tracks the value) but nothing else. A form host re-runs
     * the mount + setValue on every marshal, and a full render there would rebuild the search box
     * (dropping a mid-search focus) and orphan a portaled panel; the targeted path avoids both.
     * select()/clearValue() keep their own full renders — this is only the setValue path.
     */
    _reflectValue(): void;
    /**
     * A signature of the render-affecting state that the targeted refresh does NOT repaint. Exactly three
     * things in the control template live outside #PPS_Value_ and #PPS_List_: the root's pps-multi /
     * pps-readonly modifier classes, the panel's search box (SearchSlot), and the control's inline clear ×
     * (ClearSlot — gated on VALUE PRESENCE, so it moves without any config change). When this differs from
     * what is currently painted, _reflectValue must fall back to a full render.
     *
     * Extend this if the control template ever grows another slot outside those two containers.
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
    /**
     * Take the provider's single-active slot, closing whichever sibling holds it. Only pickers that opted
     * in participate — a picker with SingleActivePicker off neither claims the slot nor is closed by one
     * that does. The slot holds a HASH, not a view, and lives on the provider rather than the module, so
     * two pict instances sharing this module can't close each other's dropdowns.
     */
    _claimActivePicker(): void;
    /**
     * The dropdown panel, wherever it currently lives — inside its widget, or out on <body> while
     * portaled. Resolved by position rather than by id: a re-render can briefly leave two panels sharing
     * the id (the fresh one in the widget, the portaled one still on body), and which of those
     * getElementById hands back is not something to depend on. The in-widget panel always wins, because
     * after a re-render it is the live one and any portaled copy is a leftover.
     * @return {HTMLElement|null}
     */
    _popElement(): HTMLElement | null;
    /**
     * Choose the dropdown's anchoring, once per open. The default is CSS-only: .pps-pop is absolute
     * against .pps (position:relative), so it travels with the control on scroll for free. That breaks
     * when an ancestor clips (overflow != visible) — a scrolling table wrapper, a dialog body — and such
     * a container can't be un-clipped in CSS, since an overflow:auto axis forces the other off `visible`.
     *
     * The escape is to give the panel a containing block OUTSIDE the clip: an overflow ancestor only
     * clips an absolutely positioned box when it sits in that box's containing-block chain. So we move
     * the panel out to <body> and place it in document coordinates. It stays `absolute` on purpose —
     * absolute against the document means the browser keeps it travelling with the page on scroll, so
     * this path needs no repositioning either. Clipping is judged from the CONTROL, which never moves;
     * testing the panel would flip-flop, since a portaled panel has no clipping ancestors by definition.
     *
     * We portal only when the clip would ACTUALLY reach the panel (_shouldPortal): a dropdown with room
     * to open in place stays on the cheap CSS path even inside a scroll container, keeping its scoped
     * theme tokens and its inner-container scroll tracking. Only one near a clipping edge portals — the
     * one case where the portal is the right answer — so an overflow ancestor is not by itself enough.
     */
    _applyAnchorMode(): void;
    /**
     * Move the panel out to <body> and place it against the control in document coordinates (viewport
     * rect + scroll offset), flipping above when the room below is short. Width is pinned to the
     * control's, since the panel no longer inherits it by sitting inside the widget.
     * @param {HTMLElement} pPop
     */
    _portalPop(pPop: HTMLElement): void;
    /**
     * Put a portaled panel back inside its widget and drop everything the portal wrote. Also the orphan
     * sweeper: a re-render rebuilds .pps with a fresh panel, so a portaled one left on <body> is stale
     * and must be discarded rather than re-homed.
     * @param {HTMLElement} pPop
     */
    _restorePop(pPop: HTMLElement): void;
    /**
     * Whether this open should portal the panel out to <body>: true when ANY clipping ancestor above the
     * control would actually cut the panel (_clipBites). A dropdown with room to open in place stays on
     * the CSS path even inside a scroll container — an overflow ancestor alone is not enough — but one
     * roomy clipper does not excuse a tighter one further out. Judged from the control, which never moves.
     * @param {HTMLElement} pControl
     * @return {boolean}
     */
    _shouldPortal(pControl: HTMLElement): boolean;
    /**
     * The nearest ancestor between the element and the body that establishes an overflow clip (overflow
     * on any axis != visible), or null. Stops at body: the document's own scrolling is what the absolute
     * anchoring rides on, not a clip.
     * @param {HTMLElement} pElement
     * @return {HTMLElement|null}
     */
    _clippingAncestor(pElement: HTMLElement): HTMLElement | null;
    /** True when the control has any overflow-clipping ancestor. Thin boolean over _clippingAncestor;
     *  the anchor decision uses _shouldPortal, which also weighs whether the clip reaches the panel.
     *  @param {HTMLElement} pElement @return {boolean} */
    _hasClippingAncestor(pElement: HTMLElement): boolean;
    /**
     * Whether the clipper would cut the panel if it opened in place. The CSS path always opens DOWNWARD
     * (top: calc(100% + gap)) and never flips, clamped to its own max-height — so project that worst-case
     * box below the control and ask whether any edge falls outside the clipper's box. When it fits, the
     * CSS path is safe; when it doesn't, only the portal (which can flip above and escape) will do. A
     * pixel of slack keeps a flush edge from forcing a needless portal on sub-pixel rounding.
     * @param {HTMLElement} pControl @param {HTMLElement} pClipper @return {boolean}
     */
    _clipBites(pControl: HTMLElement, pClipper: HTMLElement): boolean;
    /**
     * Mark the dropdown closed: the transient open state, the provider's active-picker slot, and the
     * loaded-results cache. Shared by every path that closes the dropdown (close(), a single-mode select,
     * clearValue, createFromSearch) so none of them can leave a stale active-picker reference or serve
     * results from a scope that has since changed.
     */
    _markClosed(): void;
    /** Async mode: load + append the next page of results. */
    loadMore(): void;
    /** Close the dropdown. */
    close(): void;
    /**
     * Release everything this picker holds outside its own DOM subtree, for a host that tears the view
     * down. pict-view has no destroy lifecycle, so this is opt-in — call it before dropping the view.
     * The un-destroyed case is already harmless: a portaled panel is hidden unless `pps-pop-open` is set
     * (so a stray one shows nothing), and its back-off / single-active state is released on close.
     */
    destroy(): void;
    /** Reflect the open/closed state on the widget container. Also stamp the pop element itself, since a
     *  portaled panel is no longer a descendant of `.pps-open` and the stylesheet's open rule can't reach
     *  it — its visibility keys off `pps-pop-open` instead, so a stray portaled panel stays hidden. */
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