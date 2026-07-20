const libPictProvider = require('pict-provider');

const libPictViewPicker = require('../views/PictView-Picker.js');

// Themeable widget CSS. Registered once (by hash) regardless of how many picker instances exist.
// Host apps brand by defining the --theme-color-* tokens; the hardcoded values are fallbacks.
const _PickerCSS = /*css*/`
.pps { position: relative; width: 100%; box-sizing: border-box; }
.pps *, .pps *::before, .pps *::after { box-sizing: border-box; }
.pps-control { display: flex; align-items: center; gap: 0.5rem; width: 100%; cursor: pointer; font: inherit; font-size: 0.92rem;
	padding: 0.45rem 0.7rem; border-radius: 8px; border: 1px solid var(--theme-color-border-default, #d7dce3);
	background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-primary, #1f2733); text-align: left; }
.pps-control:hover { border-color: var(--theme-color-border-strong, #c2c9d2); }
.pps.pps-open .pps-control { border-color: var(--theme-color-brand-primary, #156dd1);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 16%, transparent); }
.pps-valuearea { flex: 1 1 auto; min-width: 0; }
.pps-value { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pps-value.pps-placeholder { color: var(--theme-color-text-muted, #6b7686); }
.pps-chevron { flex: 0 0 auto; display: inline-flex; color: var(--theme-color-text-muted, #6b7686); font-size: 0.8rem; transition: transform 0.15s ease; }
.pps.pps-open .pps-chevron { transform: rotate(180deg); }
/* Read-only: render the resolved selection as plain, non-interactive text (no border / chevron / clear /
   dropdown). Used by read-only form views; the value text inherits the surrounding field styling. */
.pps-readonly .pps-control { border-color: transparent; background: transparent; padding-left: 0; padding-right: 0; cursor: default; pointer-events: none; }
.pps-readonly .pps-control:hover { border-color: transparent; box-shadow: none; }
.pps-readonly .pps-chevron, .pps-readonly .pps-clear, .pps-readonly .pps-chip-x { display: none; }
.pps-readonly .pps-pop, .pps-readonly .pps-backdrop { display: none; }
/* Clearable (AllowClear): the inline × next to the value (mirrors the chip ×) and the pinned "Any" row. */
.pps-clear { flex: 0 0 auto; display: inline-flex; align-items: center; cursor: pointer; font-size: 0.78rem; border-radius: 4px; padding: 0.1rem;
	color: var(--theme-color-text-muted, #6b7686); opacity: 0.7; }
.pps-clear:hover { opacity: 1; background: color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 22%, transparent); }
.pps-clear-option { border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0); }
.pps-clear-option .pps-option-label { color: var(--theme-color-text-muted, #6b7686); font-style: italic; }

/* Multi-select chips. The control hosts a wrapping row of removable tags + a muted placeholder. */
.pps-multi .pps-control { align-items: flex-start; }
.pps-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; min-width: 0; }
.pps-chips-ph { color: var(--theme-color-text-muted, #6b7686); }
.pps-chip { display: inline-flex; align-items: center; gap: 0.3rem; max-width: 100%; font-size: 0.82rem; line-height: 1.4;
	padding: 0.1rem 0.2rem 0.1rem 0.5rem; border-radius: 6px;
	background: color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 12%, transparent);
	color: var(--theme-color-brand-primary, #156dd1); }
.pps-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pps-chip-x { flex: 0 0 auto; display: inline-flex; align-items: center; cursor: pointer; font-size: 0.78rem; border-radius: 4px; padding: 0.1rem; opacity: 0.7; }
.pps-chip-x:hover { opacity: 1; background: color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 22%, transparent); }

/* Preview-card ⓘ — the opt-in affordance next to a selected value / chip. Stays clickable in
   read-only mode (where the control itself has pointer-events: none). */
.pps-card-info { flex: 0 0 auto; display: inline-flex; align-items: center; cursor: pointer; font-size: 0.82rem; padding: 0 0.1rem; opacity: 0.5; color: var(--theme-color-text-muted, #6b7686); }
.pps-card-info:hover { opacity: 1; color: var(--theme-color-brand-primary, #156dd1); }
.pps-readonly .pps-card-info { pointer-events: auto; }

/* EntityTag badge — a small code/number pill shown next to an option / chip / selected value (the
   select2 EntitySelector "tag" parity). Ordering (before/after the label) is driven by the TagLast
   option in the view's render state. */
.pps-tag { flex: 0 0 auto; display: inline-flex; align-items: center; font-size: 0.74rem; font-weight: 600; line-height: 1.25;
	padding: 0.05rem 0.4rem; border-radius: 5px; white-space: nowrap;
	background: var(--theme-color-background-tertiary, #eceef2); color: var(--theme-color-text-secondary, #45596b); }
.pps-valuebox { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
.pps-valuebox .pps-value { min-width: 0; }
.pps-option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Transparent full-viewport backdrop: closes on outside click (no document listener). Only present
   while OPEN — otherwise a fixed full-viewport layer would swallow every click on the page. When open,
   the control is raised above it so its chips/× stay clickable; the dropdown sits above both. */
.pps-backdrop { position: fixed; inset: 0; z-index: 0; display: none; }
.pps.pps-open .pps-backdrop { display: block; }
.pps.pps-open .pps-control { position: relative; z-index: 1; }
/* Anchored to the control's own box (.pps is position:relative), so the panel travels with the control
   on page scroll for free — no measuring, no JS, no scroll listeners. This is the default because a
   typical form-row wrapper sets no overflow, leaving nothing to clip the panel. */
.pps-pop { position: absolute; z-index: 40; top: calc(100% + 0.3rem); left: 0; right: 0; min-width: 200px; display: none; }
.pps.pps-open .pps-pop { display: block; }
/* Clipped-context fallback, applied by the view when an ancestor sets overflow != visible (a scrolling
   table wrapper, a dialog body). Such a container can't be un-clipped in CSS — an overflow:auto axis
   forces the other axis off visible — so the view moves the panel out to <body> and places it once in
   DOCUMENT coordinates. Still absolute, deliberately: an absolute box on <body> resolves against the
   document, so the browser keeps it travelling with the page on scroll, exactly like the default path.
   (position:fixed would resolve against the viewport and strand the panel when the page scrolled.) */
.pps-pop.pps-pop-portal { position: absolute; right: auto; display: block; }
.pps-panel { position: relative; z-index: 1; display: flex; flex-direction: column; max-height: min(60vh, 360px);
	background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3);
	border-radius: 10px; box-shadow: 0 10px 28px rgba(17, 24, 39, 0.14); overflow: hidden; }
.pps-search { flex: 0 0 auto; display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0); }
.pps-search-ic { display: inline-flex; color: var(--theme-color-text-muted, #6b7686); font-size: 0.9rem; }
.pps-search input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 0.9rem; border: none; outline: none; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
.pps-list { flex: 1 1 auto; overflow-y: auto; padding: 0.25rem; }
.pps-option { display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; cursor: pointer; font: inherit; font-size: 0.9rem;
	padding: 0.45rem 0.6rem; border: none; border-radius: 6px; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
.pps-option:hover, .pps-option.pps-highlight { background: var(--theme-color-background-tertiary, #eceef2); }
.pps-option.pps-selected { color: var(--theme-color-brand-primary, #156dd1); font-weight: 600; }
.pps-option-check { flex: 0 0 auto; display: inline-flex; width: 1em; color: var(--theme-color-brand-primary, #156dd1); }
.pps-option-check.pps-hidden { visibility: hidden; }
.pps-empty { padding: 0.7rem 0.6rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.86rem; text-align: center; }
.pps-loading { padding: 0.6rem; text-align: center; color: var(--theme-color-text-muted, #6b7686); font-size: 0.85rem; }
.pps-more { display: block; width: calc(100% - 0.5rem); margin: 0.25rem; padding: 0.4rem; cursor: pointer; font: inherit; font-size: 0.85rem;
	border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 6px; background: transparent; color: var(--theme-color-brand-primary, #156dd1); }
.pps-more:hover { background: var(--theme-color-background-tertiary, #eceef2); }

/* Category header (groups) + creatable "Create …" row. */
.pps-group { padding: 0.45rem 0.6rem 0.2rem; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--theme-color-text-muted, #6b7686); }
.pps-create { display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; cursor: pointer; font: inherit; font-size: 0.9rem;
	padding: 0.45rem 0.6rem; border: none; border-radius: 6px; background: transparent; color: var(--theme-color-brand-primary, #156dd1); font-weight: 600; }
.pps-create:hover { background: var(--theme-color-background-tertiary, #eceef2); }
.pps-create-ic { flex: 0 0 auto; display: inline-flex; }

/* Form-input adapter (pict-section-picker/form): the picker host fills its row like the host's
   native inputs (width:100% forces it to wrap below the label span + fill, matching a scalar input). */
.pps-form-host { flex: 1 1 100%; min-width: 0; width: 100%; }
`;

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION =
{
	ProviderIdentifier: 'Pict-Section-Picker',

	AutoInitialize: true,
	AutoInitializeOrdinal: 0,

	// Opt-in fleet default: when true, every picker this provider creates closes any open sibling on
	// open (at most one dropdown on the page — select2 parity). Off by default so existing hosts see
	// no behavior change; a per-picker SingleActivePicker in createPicker's config overrides it.
	SingleActivePicker: false,
};

/**
 * The pict-section-picker provider — the primary API surface. Registers the widget CSS once and
 * creates/manages picker view instances.
 */
class PictProviderPicker extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		// Per-picker back-off bookkeeping, keyed by picker hash. This lives on the provider (a singleton
		// with page lifetime) rather than in the DataProvider closure because createEntityPicker rebuilds
		// that closure on EVERY call — and a form host re-mounts its pickers on every marshal, which would
		// silently reset the state while the view's accumulated _loadedResults survived.
		/** @type {Record<string, {Dropped: boolean, Term: string|null}>} */
		this.backOffState = {};

		// The hash of the picker whose dropdown is currently open, for the opt-in SingleActivePicker
		// behavior. A hash (not a view reference) so nothing here retains a view, and provider-scoped so
		// two pict instances on one page can't close each other's pickers.
		/** @type {string|false} */
		this.currentOpenPickerHash = false;

		if (this.pict && this.pict.CSSMap && typeof this.pict.CSSMap.addCSS === 'function')
		{
			this.pict.CSSMap.addCSS('Pict-Section-Picker-CSS', _PickerCSS, 500);
		}
	}

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
	createPicker(pPickerHash, pConfig)
	{
		const tmpConfig = Object.assign(
			{
				DestinationAddress: `#${pPickerHash}`,
				Mode: 'single',
				Searchable: true,
				Placeholder: 'Select…',
				Options: [],
				// Seed the provider-level fleet default; an explicit per-picker value overrides it.
				SingleActivePicker: !!this.options.SingleActivePicker,
			},
			pConfig || {},
			// PickerProvider lets the view reach provider-scoped bookkeeping (the single-active slot)
			// without guessing the service hash this provider was registered under.
			{ PickerHash: pPickerHash, PickerProvider: this });

		if (this.pict.views[pPickerHash])
		{
			Object.assign(this.pict.views[pPickerHash].options, tmpConfig);
			return this.pict.views[pPickerHash];
		}
		return this.pict.addView(pPickerHash, tmpConfig, libPictViewPicker);
	}

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
	buildSearchFilter(pSearchFields, pTerm)
	{
		const tmpEncoded = encodeURIComponent(`%${pTerm}%`);
		if (pSearchFields.length === 1)
		{
			return `FBV~${pSearchFields[0]}~LK~${tmpEncoded}`;
		}
		const tmpInner = pSearchFields.map((pField, pIndex) => `${pIndex === 0 ? 'FBV' : 'FBVOR'}~${pField}~LK~${tmpEncoded}`).join('~');
		return `FOP~0~(~0~${tmpInner}~FCP~0~)~0`;
	}

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
	createEntityDataProvider(pConfig, pStateKey)
	{
		const tmpEntity = pConfig.Entity;
		const tmpSearchFields = (Array.isArray(pConfig.SearchFields) && pConfig.SearchFields.length > 0) ? pConfig.SearchFields : [ 'Name' ];
		const tmpValueField = pConfig.ValueField || `ID${tmpEntity}`;
		const tmpTextField = pConfig.TextField || 'Name';
		const tmpPageSize = pConfig.PageSize || 20;
		const tmpSort = pConfig.Sort || false;
		const tmpBaseFilterConfig = pConfig.BaseFilter || '';
		const tmpMapRecord = (typeof pConfig.MapRecord === 'function') ? pConfig.MapRecord : false;
		const tmpJoinConfig = this._resolveJoinConfig(pConfig);
		const tmpEntityTagField = pConfig.EntityTag || false;
		const tmpEntityTagFields = Array.isArray(pConfig.EntityTags) ? pConfig.EntityTags : false;
		const tmpTextTemplate = pConfig.TextTemplate || false;

		// Back-off state: once a page-0 search came back empty and was retried without the back-off set,
		// later pages of the SAME term stay widened so "Load more" pages the widened set the user is
		// actually looking at. A new page-0 search resets it. Held on the provider (keyed by picker hash)
		// so it outlives this closure — createEntityPicker rebuilds the closure on every mount, and hosts
		// re-mount on every marshal. With no key (direct API use) it falls back to closure-local state.
		const tmpBackOff = pStateKey
			? (this.backOffState[pStateKey] = this.backOffState[pStateKey] || { Dropped: false, Term: null })
			: { Dropped: false, Term: null };

		return (pSearchTerm, pPage) => new Promise((resolve, reject) =>
		{
			if (!this.pict.EntityProvider || typeof this.pict.EntityProvider.getEntitySetPage !== 'function')
			{
				return reject(new Error('Pict-Section-Picker: pict.EntityProvider is not available for entity-backed pickers.'));
			}

			// Resolve the base filter at SEARCH time. A function form lets the host inject contextual
			// scoping (e.g. "only this project's line items") without the module knowing the context;
			// it can return a single stanza, an array of stanzas, a `{ Filters, BackOffFilters }` split,
			// or nothing.
			let tmpBaseFilter = tmpBaseFilterConfig;
			if (typeof tmpBaseFilterConfig === 'function')
			{
				try { tmpBaseFilter = tmpBaseFilterConfig(pSearchTerm, pPage); }
				catch (pScopeError) { this.pict.log.warn(`Pict-Section-Picker [${tmpEntity}] BaseFilter() threw; ignoring contextual scope.`, pScopeError); tmpBaseFilter = ''; }
			}
			const tmpScope = this._normalizeBaseFilter(tmpBaseFilter);

			const tmpPageIndex = (pPage || 0);
			if (tmpPageIndex === 0) { tmpBackOff.Dropped = false; tmpBackOff.Term = null; }
			const tmpCarryWidened = tmpBackOff.Dropped && (tmpBackOff.Term === (pSearchTerm || ''));
			const tmpApplyBackOff = !!tmpScope.BackOffFilter && !tmpCarryWidened;

			const fComposeFilter = (pIncludeBackOff) =>
			{
				const tmpStanzas = [];
				if (tmpScope.Filter) { tmpStanzas.push(tmpScope.Filter); }
				if (pIncludeBackOff && tmpScope.BackOffFilter) { tmpStanzas.push(tmpScope.BackOffFilter); }
				if (pSearchTerm) { tmpStanzas.push(this.buildSearchFilter(tmpSearchFields, pSearchTerm)); }
				if (tmpSort) { tmpStanzas.push(`FSF~${tmpSort}~ASC~0`); }
				return tmpStanzas.filter(Boolean).join('~');
			};

			const fFinish = (pRecords) =>
			{
				const tmpList = Array.isArray(pRecords) ? pRecords : [];
				// JoinEntity (when configured): one INN fetch for the joined rows, stitched onto each
				// searched row, before mapping — so the option Text can show the compound display.
				this._decorateRecordsWithJoin(tmpList, tmpJoinConfig).then((pDecorated) =>
				{
					const tmpResults = pDecorated.map((pRecord) => tmpMapRecord
						? tmpMapRecord(pRecord)
						: this._composeOption(pRecord, tmpValueField, tmpTextField, tmpJoinConfig, tmpEntityTagField, tmpTextTemplate, tmpEntityTagFields));
					// hasMore: a full page came back, so there is (probably) another. Avoids a Count round-trip.
					return resolve({ results: tmpResults, hasMore: (tmpList.length >= tmpPageSize) });
				});
			};

			const tmpCursor = tmpPageIndex * tmpPageSize;
			this.pict.EntityProvider.getEntitySetPage(tmpEntity, fComposeFilter(tmpApplyBackOff), tmpCursor, tmpPageSize,
				(pError, pRecords) =>
				{
					if (pError) { return reject(pError); }
					const tmpList = Array.isArray(pRecords) ? pRecords : [];
					// Back-off retry: an EMPTY first page under the back-off set means the narrow scope has
					// nothing — auto-widen by retrying once without it, instead of stranding the user on
					// "No matches" for options that exist just outside the preferred scope.
					if (tmpList.length < 1 && tmpApplyBackOff && tmpPageIndex === 0)
					{
						tmpBackOff.Dropped = true;
						tmpBackOff.Term = (pSearchTerm || '');
						return this.pict.EntityProvider.getEntitySetPage(tmpEntity, fComposeFilter(false), tmpCursor, tmpPageSize,
							(pRetryError, pRetryRecords) =>
							{
								if (pRetryError) { return reject(pRetryError); }
								return fFinish(pRetryRecords);
							});
					}
					return fFinish(tmpList);
				});
		});
	}

	/**
	 * Normalize a resolved BaseFilter value into `{ Filter, BackOffFilter }` joined-stanza strings.
	 * Accepts the historical string / array forms (all-mandatory, no back-off) and the object form
	 * `{ Filters, BackOffFilters }` where each side is itself a string or array of stanzas.
	 *
	 * @param {any} pResolved - The BaseFilter config value, or a BaseFilter function's return value.
	 * @return {{Filter: string, BackOffFilter: string}}
	 */
	_normalizeBaseFilter(pResolved)
	{
		const fJoin = (pValue) => Array.isArray(pValue) ? pValue.filter(Boolean).join('~') : (pValue || '');
		if (pResolved && typeof pResolved === 'object' && !Array.isArray(pResolved))
		{
			return { Filter: fJoin(pResolved.Filters), BackOffFilter: fJoin(pResolved.BackOffFilters) };
		}
		return { Filter: fJoin(pResolved), BackOffFilter: '' };
	}

	/**
	 * Resolve the JoinEntity options off an entity-source config into a normalized internal shape, or
	 * `false` when no JoinEntity is configured. Centralizes the defaults so the DataProvider and the
	 * ResolveValue builders agree.
	 *
	 * @param {Record<string, any>} pConfig
	 * @return {false | {Entity:string, FKColumn:string, PKColumn:string, DisplayField:string, First:boolean, Separator:string}}
	 */
	_resolveJoinConfig(pConfig)
	{
		if (!pConfig || !pConfig.JoinEntity) { return false; }
		return {
			Entity: pConfig.JoinEntity,
			// The FK on the SEARCHED row, and the PK it points at on the join entity (the INN column).
			FKColumn: pConfig.JoinField || `ID${pConfig.JoinEntity}`,
			PKColumn: pConfig.JoinEntityValueField || `ID${pConfig.JoinEntity}`,
			DisplayField: pConfig.JoinEntityDisplayField || 'Name',
			// Default join-first (mirrors the documented select2 EntitySelector default).
			First: (pConfig.JoinEntityFirst !== false),
			Separator: (typeof pConfig.JoinSeparator === 'string') ? pConfig.JoinSeparator : ' - ',
		};
	}

	/**
	 * Compose a compound display from a base text + a joined value, honoring ordering + separator.
	 * Falls back to just the base text when there is no joined value.
	 *
	 * @param {any} pBaseText @param {any} pJoinText @param {boolean} pFirst @param {string} pSeparator
	 * @return {any}
	 */
	_composeJoinedText(pBaseText, pJoinText, pFirst, pSeparator)
	{
		if (pJoinText === undefined || pJoinText === null || pJoinText === '') { return pBaseText; }
		const tmpBase = (pBaseText === undefined || pBaseText === null) ? '' : pBaseText;
		return pFirst ? `${pJoinText}${pSeparator}${tmpBase}` : `${tmpBase}${pSeparator}${pJoinText}`;
	}

	/**
	 * Build the picker option `{ Value, Text, Record[, Tag] }` from a (possibly join-decorated) record:
	 * the Text honors any JoinEntity compound, and a Tag badge is added from `pTagField` when set. Shared
	 * by the DataProvider (per page row) and the ResolveValue (pre-bound value) so they stay consistent.
	 *
	 * @param {any} pRecord @param {string} pValueField @param {string} pTextField
	 * @param {false | Record<string, any>} pJoinConfig @param {string|false} pTagField
	 * @return {{Value:any, Text:any, Record:any, Tag?:any}}
	 */
	_composeOption(pRecord, pValueField, pTextField, pJoinConfig, pTagField, pTextTemplate, pTagFields)
	{
		// The option label is either a single field (pTextField) or — when a TextTemplate is configured — a
		// template rendered against the whole record, so a host can show a composed, disambiguated display
		// (e.g. "Brian Smith (brian@…)") instead of one ambiguous column. JoinEntity still wraps the result.
		const tmpBaseText = pTextTemplate
			? this.pict.parseTemplate(pTextTemplate, pRecord)
			: pRecord[pTextField];
		const tmpText = pJoinConfig
			? this._composeJoinedText(tmpBaseText, pRecord.JoinName, pJoinConfig.First, pJoinConfig.Separator)
			: tmpBaseText;
		const tmpOption = { Value: pRecord[pValueField], Text: tmpText, Record: pRecord };
		if (pTagField) { tmpOption.Tag = pRecord[pTagField]; }
		// EntityTags: a set of extra fields rendered as disambiguation chips (e.g. a book's ISBN + Year).
		if (Array.isArray(pTagFields) && pTagFields.length > 0)
		{
			tmpOption.Tags = pTagFields
				.map((pSpec) => this._composeTagValue(pSpec, pRecord))
				.filter((pTag) => (pTag !== undefined && pTag !== null && pTag !== ''));
		}
		return tmpOption;
	}

	/**
	 * Resolve one EntityTags spec to a chip string. A spec is either a field name (`'ISBN'` → the raw
	 * value) or an object `{ Field, Label, Template }`: `Template` renders against the whole record;
	 * `Label` prefixes the value (`"Year: 2000"`) — useful when several numeric chips would be ambiguous.
	 *
	 * @param {string|Record<string, any>} pSpec @param {any} pRecord
	 * @return {any}
	 */
	_composeTagValue(pSpec, pRecord)
	{
		if (typeof pSpec === 'string')
		{
			return pRecord[pSpec];
		}
		if (pSpec && typeof pSpec === 'object')
		{
			let tmpValue = pSpec.Template ? this.pict.parseTemplate(pSpec.Template, pRecord) : pRecord[pSpec.Field];
			if (tmpValue === undefined || tmpValue === null || tmpValue === '') { return ''; }
			return pSpec.Label ? `${pSpec.Label}: ${tmpValue}` : tmpValue;
		}
		return '';
	}

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
	_decorateRecordsWithJoin(pRecords, pJoinConfig)
	{
		return new Promise((resolve) =>
		{
			if (!pJoinConfig || !Array.isArray(pRecords) || pRecords.length < 1 || !this.pict.EntityProvider) { return resolve(pRecords); }
			const tmpIDs = [];
			const tmpSeen = {};
			for (let i = 0; i < pRecords.length; i++)
			{
				const tmpID = pRecords[i][pJoinConfig.FKColumn];
				if (tmpID !== undefined && tmpID !== null && tmpID !== '' && !tmpSeen[tmpID]) { tmpSeen[tmpID] = true; tmpIDs.push(tmpID); }
			}
			if (tmpIDs.length < 1) { return resolve(pRecords); }
			const tmpFilter = `FBL~${pJoinConfig.PKColumn}~INN~${tmpIDs.join(',')}`;
			this.pict.EntityProvider.getEntitySetPage(pJoinConfig.Entity, tmpFilter, 0, tmpIDs.length,
				(pError, pJoinRecords) =>
				{
					if (pError)
					{
						this.pict.log.warn(`Pict-Section-Picker [${pJoinConfig.Entity}] join fetch failed; showing un-joined text.`, pError);
						return resolve(pRecords);
					}
					const tmpMap = {};
					const tmpJoinList = Array.isArray(pJoinRecords) ? pJoinRecords : [];
					for (let i = 0; i < tmpJoinList.length; i++) { tmpMap[tmpJoinList[i][pJoinConfig.PKColumn]] = tmpJoinList[i]; }
					for (let i = 0; i < pRecords.length; i++)
					{
						const tmpJoinRecord = tmpMap[pRecords[i][pJoinConfig.FKColumn]];
						if (tmpJoinRecord) { pRecords[i].JoinRecord = tmpJoinRecord; pRecords[i].JoinName = tmpJoinRecord[pJoinConfig.DisplayField]; }
					}
					return resolve(pRecords);
				});
		});
	}

	/**
	 * Build a `ResolveValue(value) => Promise<{Value,Text}>` for an entity-backed picker, so a
	 * pre-bound ID resolves to its display text on first render (fetched + cached by `getEntity`).
	 *
	 * @param {Record<string, any>} pConfig - Same shape as {@link createEntityDataProvider}.
	 * @return {(pValue: any) => Promise<any>}
	 */
	createEntityResolveValue(pConfig)
	{
		const tmpEntity = pConfig.Entity;
		const tmpValueField = pConfig.ValueField || `ID${tmpEntity}`;
		const tmpTextField = pConfig.TextField || 'Name';
		const tmpMapRecord = (typeof pConfig.MapRecord === 'function') ? pConfig.MapRecord : false;
		const tmpJoinConfig = this._resolveJoinConfig(pConfig);
		const tmpEntityTagField = pConfig.EntityTag || false;
		const tmpEntityTagFields = Array.isArray(pConfig.EntityTags) ? pConfig.EntityTags : false;
		const tmpTextTemplate = pConfig.TextTemplate || false;

		return (pValue) => new Promise((resolve) =>
		{
			if (pValue === undefined || pValue === null || pValue === '' || !this.pict.EntityProvider)
			{
				return resolve(null);
			}
			this.pict.EntityProvider.getEntity(tmpEntity, pValue,
				(pError, pRecord) =>
				{
					if (pError || !pRecord) { return resolve(null); }
					const fFinish = () =>
					{
						if (tmpMapRecord) { return resolve(tmpMapRecord(pRecord)); }
						return resolve(this._composeOption(pRecord, tmpValueField, tmpTextField, tmpJoinConfig, tmpEntityTagField, tmpTextTemplate, tmpEntityTagFields));
					};
					// JoinEntity: resolve the single joined record (cached getEntity) for the compound label.
					const tmpFK = tmpJoinConfig ? pRecord[tmpJoinConfig.FKColumn] : null;
					if (!tmpJoinConfig || tmpFK === undefined || tmpFK === null || tmpFK === '') { return fFinish(); }
					this.pict.EntityProvider.getEntity(tmpJoinConfig.Entity, tmpFK,
						(pJoinError, pJoinRecord) =>
						{
							if (!pJoinError && pJoinRecord) { pRecord.JoinRecord = pJoinRecord; pRecord.JoinName = pJoinRecord[tmpJoinConfig.DisplayField]; }
							return fFinish();
						});
				});
		});
	}

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
	createEntityPicker(pPickerHash, pConfig)
	{
		const tmpConfig = Object.assign({}, pConfig);
		// Key the back-off state by picker hash so it survives this rebuild (hosts re-mount every marshal).
		tmpConfig.DataProvider = this.createEntityDataProvider(pConfig, pPickerHash);
		if (!tmpConfig.ResolveValue) { tmpConfig.ResolveValue = this.createEntityResolveValue(pConfig); }
		return this.createPicker(pPickerHash, tmpConfig);
	}
}

module.exports = PictProviderPicker;

module.exports.default_configuration = _DEFAULT_CONFIGURATION;
