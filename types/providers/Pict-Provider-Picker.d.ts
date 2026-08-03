export = PictProviderPicker;
/**
 * The pict-section-picker provider — the primary API surface. Registers the widget CSS once and
 * creates/manages picker view instances.
 */
declare class PictProviderPicker extends libPictProvider {
    constructor(pFable: any, pOptions: any, pServiceHash: any);
    /** @type {Record<string, {Dropped: boolean, Term: string|null}>} */
    backOffState: Record<string, {
        Dropped: boolean;
        Term: string | null;
    }>;
    /** @type {string|false} */
    currentOpenPickerHash: string | false;
    /**
     * Create (or reconfigure + reuse) a picker widget instance.
     *
     * @param {string} pPickerHash - A unique hash/id for this picker; the widget renders its control
     *   into the DOM element `#<pPickerHash>` unless a DestinationAddress is given.
     * @param {Record<string, any>} pConfig - Picker configuration:
     *   - DestinationAddress {string} - CSS selector to render into (default `#<pPickerHash>`).
     *   - ValueAddress {string} - AppData address the selection is read from / written to.
     *   - Mode {'single'} - selection mode (multi/categories/creatable land in later phases).
     *   - Placeholder {string} - text shown when nothing is selected.
     *   - Searchable {boolean} - show the search box (default true).
     *   - Options {Array<{Value:any, Text:string}>} - static option list.
     *   - OnChange {function} - optional callback invoked with the new value after a selection.
     *   - SingleActivePicker {boolean} - opt-in: opening this picker closes any open sibling
     *     (defaults from the provider's own SingleActivePicker option).
     * @return {any} The picker view instance.
     */
    createPicker(pPickerHash: string, pConfig: Record<string, any>): any;
    /**
     * Build the Meadow FoxHound filter for a search term across one or more fields.
     *
     * Single field → a clean AND-connected `FBV~Field~LK~%term%`. Multiple fields → the LIKEs are
     * OR'd together inside a paren group (`FOP…FCP`) so the OR can't bleed into a sibling AND base
     * filter. The term is `encodeURIComponent`-wrapped exactly as pict-section-recordset does, so the
     * structural `~` separators stay literal in the URL path while the value is escaped.
     *
     * @param {Array<string>} pSearchFields - The entity fields to LIKE-match.
     * @param {string} pTerm - The (raw) search term.
     * @return {string} The FoxHound filter stanza(s).
     */
    buildSearchFilter(pSearchFields: Array<string>, pTerm: string): string;
    /**
     * Build an async picker DataProvider backed by a Meadow entity (via `pict.EntityProvider`).
     * Returns a `(searchTerm, page) => Promise<{ results:[{Value,Text,Record}], hasMore }>` function —
     * the exact contract PictViewPicker consumes for server search + pagination.
     *
     * @param {Record<string, any>} pConfig - Entity source configuration:
     *   - Entity {string} (required) - the Meadow entity name (e.g. `Author`).
     *   - SearchFields {Array<string>} - fields to LIKE-search (default `['Name']`).
     *   - ValueField {string} - record field used as the option Value (default `ID<Entity>`).
     *   - TextField {string} - record field used as the option Text (default `Name`).
     *   - TextTemplate {string} - optional pict template rendered against the whole record for the option
     *       Text (overrides TextField; composes with JoinEntity). Lets a host show a composed, disambiguated
     *       label, e.g. `{~DWTF:Record.NameFull:...~} ({~D:Record.Email~})`.
     *   - PageSize {number} - records per page (default 20).
     *   - Sort {string} - optional field to sort ascending (adds `FSF~<field>~ASC~0`).
     *   - BaseFilter {string|Array<string>|Object|function} - optional always-applied FoxHound filter
     *     (AND), e.g. `FBV~IDCustomer~EQ~1`. May be a **function** `(searchTerm, page) => string|string[]|Object`
     *     evaluated on every search — the generic hook for host-injected CONTEXTUAL scoping (project,
     *     tenant, spec-year, …). The module stays agnostic; the host supplies the closure.
     *     The object form `{ Filters, BackOffFilters }` (each a string or array of stanzas) splits the
     *     scope into a MANDATORY set and a BACK-OFF set: both are applied together first, and when the
     *     first page of a search comes back EMPTY the request is retried once WITHOUT the back-off set —
     *     so a host can narrow aggressively ("this project's items") yet auto-widen instead of showing
     *     "No matches" when the narrow scope has none. Later pages of the same search stay widened so
     *     "Load more" pages the set the user is actually looking at.
     *   - MapRecord {function} - optional `(record) => {Value, Text}` mapper (overrides Value/TextField).
     *   - JoinEntity {string} - optional second entity to JOIN for a compound display (e.g. a `LineItem`
     *     shown with its `Project`). Each searched row must carry the FK (`JoinField`). Because Meadow
     *     can't join in one read, this is fetch-then-merge: after the primary page resolves, the unique
     *     FK ids drive ONE `FBL~ID{JoinEntity}~INN~<ids>` request, and the joined display field is
     *     stitched onto each row (as `Record.JoinName` / `Record.JoinRecord`) + composed into the Text.
     *   - JoinField {string} - the FK column ON THE SEARCHED ROW pointing at JoinEntity (default `ID{JoinEntity}`).
     *   - JoinEntityValueField {string} - the PK column on JoinEntity to match (default `ID{JoinEntity}`).
     *   - JoinEntityDisplayField {string} - the JoinEntity field to display (default `Name`).
     *   - JoinEntityFirst {boolean} - put the joined value first in the compound (default `true`):
     *     `JoinName - baseText`; when `false`, `baseText - JoinName`.
     *   - JoinSeparator {string} - the compound separator (default `' - '`).
     *   - EntityTag {string} - optional record field whose value becomes a `Tag` badge on each option
     *     (e.g. a `LineItem`'s `ItemNumber`). The picker view renders it as a styled badge alongside the
     *     label (ordering via the picker's `TagLast` option). Composes with JoinEntity (tag is outermost).
     *   - EntityTags {Array<string|{Field:string, Label?:string, Template?:string}>} - a SET of extra
     *     fields rendered as multiple disambiguation chips (e.g. `['ISBN', { Field: 'PublicationYear',
     *     Label: 'Year' }]`). A string spec shows the raw value; an object spec can prefix a `Label`
     *     (`"Year: 2000"`) or render a `Template` against the whole record. Renders as `Tags` (an array)
     *     alongside the optional single `Tag`.
     * @param {string} [pStateKey] - Key (the picker hash) under which the back-off bookkeeping is held on
     *   the provider, so it survives this closure being rebuilt on re-mount. Omit for closure-local state.
     * @return {(pSearchTerm: string, pPage: number) => Promise<{results: Array<any>, hasMore: boolean}>}
     */
    createEntityDataProvider(pConfig: Record<string, any>, pStateKey?: string): (pSearchTerm: string, pPage: number) => Promise<{
        results: Array<any>;
        hasMore: boolean;
    }>;
    /**
     * Normalize a resolved BaseFilter value into `{ Filter, BackOffFilter }` joined-stanza strings.
     * Accepts the historical string / array forms (all-mandatory, no back-off) and the object form
     * `{ Filters, BackOffFilters }` where each side is itself a string or array of stanzas.
     *
     * @param {any} pResolved - The BaseFilter config value, or a BaseFilter function's return value.
     * @return {{Filter: string, BackOffFilter: string}}
     */
    _normalizeBaseFilter(pResolved: any): {
        Filter: string;
        BackOffFilter: string;
    };
    /**
     * Resolve the JoinEntity options off an entity-source config into a normalized internal shape, or
     * `false` when no JoinEntity is configured. Centralizes the defaults so the DataProvider and the
     * ResolveValue builders agree.
     *
     * @param {Record<string, any>} pConfig
     * @return {false | {Entity:string, FKColumn:string, PKColumn:string, DisplayField:string, First:boolean, Separator:string}}
     */
    _resolveJoinConfig(pConfig: Record<string, any>): false | {
        Entity: string;
        FKColumn: string;
        PKColumn: string;
        DisplayField: string;
        First: boolean;
        Separator: string;
    };
    /**
     * Compose a compound display from a base text + a joined value, honoring ordering + separator.
     * Falls back to just the base text when there is no joined value.
     *
     * @param {any} pBaseText @param {any} pJoinText @param {boolean} pFirst @param {string} pSeparator
     * @return {any}
     */
    _composeJoinedText(pBaseText: any, pJoinText: any, pFirst: boolean, pSeparator: string): any;
    /**
     * Build the picker option `{ Value, Text, Record[, Tag] }` from a (possibly join-decorated) record:
     * the Text honors any JoinEntity compound, and a Tag badge is added from `pTagField` when set. Shared
     * by the DataProvider (per page row) and the ResolveValue (pre-bound value) so they stay consistent.
     *
     * @param {any} pRecord @param {string} pValueField @param {string} pTextField
     * @param {false | Record<string, any>} pJoinConfig @param {string|false} pTagField
     * @return {{Value:any, Text:any, Record:any, Tag?:any}}
     */
    _composeOption(pRecord: any, pValueField: string, pTextField: string, pJoinConfig: false | Record<string, any>, pTagField: string | false, pTextTemplate: any, pTagFields: any): {
        Value: any;
        Text: any;
        Record: any;
        Tag?: any;
    };
    /**
     * Resolve one EntityTags spec to a chip string. A spec is either a field name (`'ISBN'` → the raw
     * value) or an object `{ Field, Label, Template }`: `Template` renders against the whole record;
     * `Label` prefixes the value (`"Year: 2000"`) — useful when several numeric chips would be ambiguous.
     *
     * @param {string|Record<string, any>} pSpec @param {any} pRecord
     * @return {any}
     */
    _composeTagValue(pSpec: string | Record<string, any>, pRecord: any): any;
    /**
     * Fetch-then-merge the join entity for a page of searched records. Collects the unique FK ids the
     * rows carry (`JoinConfig.FKColumn`), issues ONE `FBL~{PKColumn}~INN~<ids>` request against the join
     * entity, and stitches `JoinRecord` + `JoinName` onto each searched row. Resolves the (mutated) same
     * array; on any error or when there's nothing to join, resolves the records un-decorated (the Text
     * gracefully degrades to the base field).
     *
     * @param {Array<any>} pRecords @param {false | Record<string, any>} pJoinConfig
     * @return {Promise<Array<any>>}
     */
    _decorateRecordsWithJoin(pRecords: Array<any>, pJoinConfig: false | Record<string, any>): Promise<Array<any>>;
    /**
     * Build a `ResolveValue(value) => Promise<{Value,Text}>` for an entity-backed picker, so a
     * pre-bound ID resolves to its display text on first render (fetched + cached by `getEntity`).
     *
     * @param {Record<string, any>} pConfig - Same shape as {@link createEntityDataProvider}.
     * @return {(pValue: any) => Promise<any>}
     */
    createEntityResolveValue(pConfig: Record<string, any>): (pValue: any) => Promise<any>;
    /**
     * Create a picker backed by a Meadow entity — the high-level entry point for the real
     * lims/config/bridge entity pickers. Wires a server DataProvider + ResolveValue from `pConfig`
     * and delegates to {@link createPicker}. Any picker option (DestinationAddress, ValueAddress,
     * Placeholder, OnChange, …) may also be supplied and is passed through.
     *
     * @param {string} pPickerHash - Unique hash/id for this picker.
     * @param {Record<string, any>} pConfig - {@link createEntityDataProvider} config + picker options.
     * @return {any} The picker view instance.
     */
    createEntityPicker(pPickerHash: string, pConfig: Record<string, any>): any;
}
declare namespace PictProviderPicker {
    export { _DEFAULT_CONFIGURATION as default_configuration };
}
import libPictProvider = require("pict-provider");
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION: Record<string, any>;
//# sourceMappingURL=Pict-Provider-Picker.d.ts.map