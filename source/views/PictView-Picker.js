const libPictView = require('pict-view');

/**
 * The theme custom properties the widget paints from. Copied onto a portaled panel so it keeps the
 * host's theme after it stops inheriting from a scoped container (see _portalPop / _restorePop).
 * @type {Array<string>}
 */
const _THEME_TOKENS =
[
	'--theme-color-brand-primary', '--theme-color-text-primary', '--theme-color-text-secondary',
	'--theme-color-text-muted', '--theme-color-border-default', '--theme-color-border-light',
	'--theme-color-border-strong', '--theme-color-background-primary', '--theme-color-background-panel',
	'--theme-color-background-tertiary',
];

/**
 * Record columns never offered as field-decoration choices — the common Meadow audit/system columns. The
 * value + text fields and any host `DecorationIgnoreFields` are layered on top of these at runtime.
 * @type {Array<string>}
 */
const _DECORATION_IGNORE_DEFAULT =
[
	'Deleted', 'DeleteDate', 'DeletingIDUser', 'CreateDate', 'CreatingIDUser',
	'UpdateDate', 'UpdatingIDUser', 'ExternalSyncDate',
];
/** localStorage key prefix for the per-entity field-decoration choice (client-only, no server state). */
const _DECORATION_KEY_PREFIX = 'PictSectionPicker.Decoration.';

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION =
{
	ViewIdentifier: 'Pict-Section-Picker-View',

	AutoInitialize: false,
	AutoRender: false,
	AutoSolveWithApp: false,

	DefaultRenderable: 'Pict-Section-Picker-Renderable',

	// Per-instance options (supplied by PictProviderPicker.createPicker):
	PickerHash: false,
	DestinationAddress: false,
	ValueAddress: false,
	// 'single' (scalar value) or 'multi' (array of values, rendered as removable chips).
	Mode: 'single',
	Placeholder: 'Select…',
	Searchable: true,
	Options: [],
	// EntityTag badge ordering: false → badge before the label (the select2 default), true → after.
	// The per-option Tag value rides on each source row (`{Value, Text, Tag}`); the entity adapter
	// stamps it from an `EntityTag` field name. With no Tag on a row, no badge renders.
	TagLast: false,
	// Async data source (Phase 2): DataProvider(searchTerm, page) => Promise<{ results:[{Value,Text}], hasMore }>.
	// When a function, the widget searches + paginates through it instead of the static Options list.
	DataProvider: false,
	PageSize: 20,
	// Optional ResolveValue(value) => Promise<{Value,Text}> to resolve the display text of a pre-set
	// value in async mode (e.g. fetch the entity for a bound ID so the control shows its name).
	ResolveValue: false,
	// Multi mode extra bindings (the EntitySelectorMultiple contract). All optional; ValueAddress
	// always holds the array of values. These mirror it as a csv string and as the full record list.
	StringArrayValueAddress: false,
	SelectedValuesAddress: false,
	// Creatable (Phase 4): OnCreate(searchTerm) => {Value,Text} | Promise<{Value,Text}>. When set, a
	// "Create …" row appears for a non-empty search term that doesn't exactly match an existing option.
	OnCreate: false,
	// Clearable (single mode): when true, the dropdown gets a pinned "Any" row at the top and the
	// control grows an inline × while a value is selected — either empties the selection and fires
	// OnChange(null, null). Filters are the natural fit ("Any" = no constraint); multi mode already
	// clears via its chips, so the option is ignored there.
	AllowClear: false,
	ClearLabel: 'Any',

	// When true, render the resolved selection as plain, non-interactive text (no dropdown / chevron /
	// clear) — for read-only form views. The host sets PictForm.ReadOnly; the form-input passes it through.
	ReadOnly: false,

	// Opt-in: opening this picker closes any other open picker that ALSO opted in (at most one dropdown
	// on the page — select2-style). Off by default so hosts that tolerate stacked dropdowns see no
	// behavior change, and a picker left off is neither closed by nor closes a participant. Usually
	// enabled fleet-wide via the provider's SingleActivePicker option (createPicker seeds it).
	SingleActivePicker: false,

	// The Meadow entity this picker selects from. Set automatically by createEntityPicker; a custom-
	// DataProvider host may pass it to opt into entity-aware affordances (preview cards, field decoration).
	Entity: false,
	// Field decoration (opt-in). When true AND the picker is entity-aware — an `Entity` name is set and its
	// result rows carry a full `Record` — a small ⚙ in the search row lets the user pin extra record fields
	// onto every option row as tag badges ("VendorCode: 12345"), to tell same-named entities apart. The
	// choice is remembered in localStorage keyed by Entity (so it follows the user to every picker of that
	// entity) and never leaves the browser. `DecorationIgnoreFields` drops fields from the chooser, on top
	// of the value/text fields and the common audit columns, which are always hidden.
	AllowFieldDecoration: false,
	DecorationIgnoreFields: [],

	Templates:
	[
		{
			// The whole widget: control box + (transparent) backdrop + dropdown. The dropdown lives in
			// the DOM whether open or closed (toggled by the .pps-open class) so open/close needs no
			// re-render. The option list re-renders on its own for search (keeps the input focused).
			// The control is a div (role=combobox) not a button so multi-mode chips can carry their own
			// remove buttons without nesting <button> elements.
			Hash: 'Pict-Section-Picker-Control',
			Template: /*html*/`
	<div class="pps{~NE:Record.IsMulti^ pps-multi~}{~NE:Record.ReadOnly^ pps-readonly~}" id="PPS_{~D:Record.PickerHash~}">
		<div class="pps-control" role="combobox" tabindex="0" aria-haspopup="listbox" onclick="_Pict.views['{~D:Record.PickerHash~}'].toggle(event)" onkeydown="_Pict.views['{~D:Record.PickerHash~}'].onControlKey(event)">
			<div class="pps-valuearea" id="PPS_Value_{~D:Record.PickerHash~}">{~T:Pict-Section-Picker-ValueArea~}</div>
			{~TS:Pict-Section-Picker-ClearX:Record.ClearSlot~}
			<span class="pps-chevron">{~I:ChevronDown~}</span>
		</div>
		<div class="pps-backdrop" onclick="_Pict.views['{~D:Record.PickerHash~}'].close()"></div>
		<div class="pps-pop" id="PPS_Pop_{~D:Record.PickerHash~}">
			<div class="pps-panel">
				{~TS:Pict-Section-Picker-Search:Record.SearchSlot~}
				<div class="pps-decorate-panel" id="PPS_Decorate_{~D:Record.PickerHash~}">{~T:Pict-Section-Picker-DecoratePanel~}</div>
				<div class="pps-list" id="PPS_List_{~D:Record.PickerHash~}">
					{~T:Pict-Section-Picker-List~}
				</div>
			</div>
		</div>
	</div>
`
		},
		{
			// The control's value display: single-mode value span OR multi-mode chips, chosen by the
			// single-element-array slots so we never render both.
			Hash: 'Pict-Section-Picker-ValueArea',
			Template: /*html*/`
	{~TS:Pict-Section-Picker-Single:Record.SingleSlot~}
	{~TS:Pict-Section-Picker-Multi:Record.MultiSlot~}
`
		},
		{
			// The inline clear × (AllowClear) — a control-level adornment between the value area and
			// the chevron, so it centers next to the text (the value area's children stack as blocks).
			// It sits OUTSIDE #PPS_Value_, so the targeted repaint can't refresh it — and its presence
			// tracks the VALUE. _shapeSignature() therefore includes it, which forces setValue onto a
			// full render whenever it would appear or disappear. stopPropagation so clearing
			// never bubbles into the control's open/close toggle — mirrors the multi-chip remove ×.
			Hash: 'Pict-Section-Picker-ClearX',
			Template: /*html*/`
	<span class="pps-clear" title="Clear" onclick="event.stopPropagation(); _Pict.views['{~D:Record.PickerHash~}'].clearValue()">{~I:Close~}</span>
`
		},
		{
			Hash: 'Pict-Section-Picker-Single',
			Template: /*html*/`
	<span class="pps-valuebox">{~TS:Pict-Section-Picker-Tag:Record.TagBeforeSlot~}<span class="pps-value{~NE:Record.NoValue^ pps-placeholder~}">{~D:Record.DisplayText~}</span>{~TS:Pict-Section-Picker-Tag:Record.TagAfterSlot~}{~TS:Pict-Section-Picker-CardInfo:Record.CardSlot~}</span>
`
		},
		{
			// Multi-mode: the selected chips, plus a placeholder slot when nothing is selected.
			Hash: 'Pict-Section-Picker-Multi',
			Template: /*html*/`
	<span class="pps-chips">{~TS:Pict-Section-Picker-Chip:Record.Chips~}{~TS:Pict-Section-Picker-Placeholder:Record.PlaceholderSlot~}</span>
`
		},
		{
			Hash: 'Pict-Section-Picker-Placeholder',
			Template: /*html*/`
	<span class="pps-chips-ph">{~D:Record.Placeholder~}</span>
`
		},
		{
			// One selected chip with an inline remove button. stopPropagation on the × so removing a
			// chip never bubbles up to the control's open/close toggle.
			Hash: 'Pict-Section-Picker-Chip',
			Template: /*html*/`
	<span class="pps-chip">{~TS:Pict-Section-Picker-Tag:Record.TagBeforeSlot~}<span class="pps-chip-text" title="{~D:Record.Text~}">{~D:Record.Text~}</span>{~TS:Pict-Section-Picker-Tag:Record.TagAfterSlot~}{~TS:Pict-Section-Picker-CardInfo:Record.CardSlot~}<span class="pps-chip-x" onclick="event.stopPropagation(); _Pict.views['{~D:Record.PickerHash~}'].removeChip('{~D:Record.ValueKey~}')">{~I:Close~}</span></span>
`
		},
		{
			// Search box — its own template (gated by the single-element-array SearchSlot) because
			// {~NE:~} does not recursively parse nested {~I:~}/{~D:~} tags.
			Hash: 'Pict-Section-Picker-Search',
			Template: /*html*/`
	<div class="pps-search">
		<span class="pps-search-ic">{~I:Search~}</span>
		<input type="text" id="PPS_Search_{~D:Record.PickerHash~}" placeholder="Search…" autocomplete="off" oninput="_Pict.views['{~D:Record.PickerHash~}'].search(this.value)" onkeydown="_Pict.views['{~D:Record.PickerHash~}'].onSearchKey(event)">
		{~TS:Pict-Section-Picker-DecorateToggle:Record.DecorateSlot~}
	</div>
`
		},
		{
			Hash: 'Pict-Section-Picker-List',
			Template: /*html*/`
	{~TS:Pict-Section-Picker-ClearOption:Record.ClearOptionSlot~}
	{~TS:Pict-Section-Picker-Create:Record.CreateSlot~}
	{~TS:Pict-Section-Picker-Group:Record.Groups~}
	{~NE:Record.IsEmpty^<div class="pps-empty">No matches</div>~}
	{~NE:Record.Loading^<div class="pps-loading">Loading…</div>~}
	{~TS:Pict-Section-Picker-More:Record.MoreSlot~}
`
		},
		{
			// The pinned "Any" row (AllowClear, single mode) — selecting it empties the selection.
			// It shows the check when nothing is selected (i.e. "Any" is the active state).
			Hash: 'Pict-Section-Picker-ClearOption',
			Template: /*html*/`
	<button type="button" class="pps-option pps-clear-option{~NE:Record.Selected^ pps-selected~}" onclick="_Pict.views['{~D:Record.PickerHash~}'].clearValue()">
		<span class="pps-option-check{~NE:Record.NotSelected^ pps-hidden~}">{~I:Check~}</span>
		<span class="pps-option-label">{~D:Record.Label~}</span>
	</button>
`
		},
		{
			// A category: an optional header (single-element-array HeaderSlot) followed by its options.
			// With no categories everything lands in one unlabeled group, so the list path is uniform.
			Hash: 'Pict-Section-Picker-Group',
			Template: /*html*/`
	{~TS:Pict-Section-Picker-GroupHeader:Record.HeaderSlot~}
	{~TS:Pict-Section-Picker-Option:Record.Options~}
`
		},
		{
			Hash: 'Pict-Section-Picker-GroupHeader',
			Template: /*html*/`
	<div class="pps-group">{~D:Record.Label~}</div>
`
		},
		{
			// "Create <term>" row — its own template (single-element-array CreateSlot), so the nested
			// {~I:~}/{~D:~} tags parse (unlike inside an {~NE:~}).
			Hash: 'Pict-Section-Picker-Create',
			Template: /*html*/`
	<button type="button" class="pps-create" onclick="_Pict.views['{~D:Record.PickerHash~}'].createFromSearch()"><span class="pps-create-ic">{~I:Plus~}</span><span>Create &ldquo;{~D:Record.Term~}&rdquo;</span></button>
`
		},
		{
			// "Load more" — its own template (single-element-array MoreSlot) for the same nested-tag
			// reason as the search box.
			Hash: 'Pict-Section-Picker-More',
			Template: /*html*/`
	<button type="button" class="pps-more" onclick="_Pict.views['{~D:Record.PickerHash~}'].loadMore()">Load more</button>
`
		},
		{
			Hash: 'Pict-Section-Picker-Option',
			Template: /*html*/`
	<button type="button" class="pps-option{~NE:Record.Selected^ pps-selected~}{~NE:Record.Highlight^ pps-highlight~}" onclick="_Pict.views['{~D:Record.PickerHash~}'].select('{~D:Record.ValueKey~}')">
		<span class="pps-option-check{~NE:Record.NotSelected^ pps-hidden~}">{~I:Check~}</span>
		{~TS:Pict-Section-Picker-Tag:Record.TagBeforeSlot~}<span class="pps-option-label" title="{~D:Record.Text~}">{~D:Record.Text~}</span>{~TS:Pict-Section-Picker-Tag:Record.TagAfterSlot~}
	</button>
`
		},
		{
			// EntityTag badge — a small code/number pill rendered before or after the label via the
			// TagBeforeSlot / TagAfterSlot single-element-array slots on each option / chip / value record.
			Hash: 'Pict-Section-Picker-Tag',
			Template: /*html*/`
		<span class="pps-tag">{~D:Record.Tag~}</span>
`
		},
		{
			// Preview-card ⓘ trigger — a small affordance next to a selected value / chip that opens the
			// entity's registered preview card (RecordSetCardManager, a soft dependency). Gated to a
			// single-element-array CardSlot so it renders only when a card exists for the picker's Entity;
			// stopPropagation so it never toggles the control or removes a chip.
			Hash: 'Pict-Section-Picker-CardInfo',
			Template: /*html*/`
		<span class="pps-card-info" title="Preview" onclick="event.stopPropagation(); _Pict.providers.RecordSetCardManager.openCard('{~D:Record.Entity~}', '{~D:Record.Value~}', this)">{~I:Info~}</span>
`
		},
		{
			// Field-decoration ⚙ (AllowFieldDecoration) — a trailing button in the search row that opens the
			// field chooser. Rendered via the single-element-array DecorateSlot so it appears only when the
			// feature is enabled + eligible. stopPropagation so it never bubbles into the control toggle.
			Hash: 'Pict-Section-Picker-DecorateToggle',
			Template: /*html*/`<button type="button" id="PPS_DecorateBtn_{~D:Record.PickerHash~}" class="pps-decorate-btn{~NE:Record.HasFields^ pps-decorate-on~}{~NE:Record.Open^ pps-decorate-open~}" title="Show extra fields on each row" onclick="event.stopPropagation(); _Pict.views['{~D:Record.PickerHash~}'].toggleDecorate(event)">{~I:Settings~}</button>`
		},
		{
			// The field chooser — rendered into #PPS_Decorate_ between the search row and the list. Empty
			// (collapsed) unless the chooser is open; DecoratePanelSlot carries the candidate fields.
			Hash: 'Pict-Section-Picker-DecoratePanel',
			Template: /*html*/`{~TS:Pict-Section-Picker-DecorateInner:Record.DecoratePanelSlot~}`
		},
		{
			Hash: 'Pict-Section-Picker-DecorateInner',
			Template: /*html*/`
		<div class="pps-decorate">
			<div class="pps-decorate-title">Show extra fields on each row</div>
			<div class="pps-decorate-list">{~TS:Pict-Section-Picker-DecorateField:Record.Fields~}{~NE:Record.NoFields^<div class="pps-decorate-empty">No extra fields to show yet.</div>~}</div>
		</div>
`
		},
		{
			// One checkbox row in the chooser. The label wraps the input so a click anywhere toggles it.
			Hash: 'Pict-Section-Picker-DecorateField',
			Template: /*html*/`<label class="pps-decorate-opt"><input type="checkbox"{~NE:Record.Checked^ checked~} onclick="_Pict.views['{~D:Record.PickerHash~}'].toggleDecorateField('{~D:Record.Field~}')"><span class="pps-decorate-name">{~D:Record.Field~}</span></label>`
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'Pict-Section-Picker-Renderable',
			TemplateHash: 'Pict-Section-Picker-Control',
			RenderMethod: 'replace',
		},
	],
};

class PictViewPicker extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		// Render the control into the host-supplied destination, and read state from this picker's
		// AppData slot (keyed by hash so many pickers can share the global templates).
		this.options.DefaultDestinationAddress = this.options.DestinationAddress || `#${this.options.PickerHash}`;
		this._StateAddress = `AppData.PictSectionPicker.${this.options.PickerHash}`;
		this.options.DefaultTemplateRecordAddress = this._StateAddress;
		if (Array.isArray(this.options.Renderables) && this.options.Renderables[0])
		{
			this.options.Renderables[0].ContentDestinationAddress = this.options.DefaultDestinationAddress;
		}

		// Transient UI state (the data lives in AppData; these drive a single picker's interaction).
		this._open = false;
		this._search = '';
		this._highlight = -1;
		// Async-mode state (Phase 2): accumulated results across pages + paging/loading flags.
		this._loadedResults = [];
		this._page = 0;
		this._hasMore = false;
		this._loading = false;
		this._loaded = false;
		this._searchTimer = null;
		this._selectedText = null;
		// Anchoring: true while portaled to <body>, false while CSS-anchored. Decided per open (see the
		// "Dropdown anchoring & render states" note below).
		this._portaled = false;
		// _shapeSignature() of the current paint, stamped by onAfterRender (null until first render).
		this._renderedShape = null;
		// Multi-mode state: the authoritative {Value,Text} for each selected value, keyed by String(Value),
		// so a chip keeps its label even after the search results that produced it have scrolled away.
		this._values = [];
		this._selectedRecords = {};

		// Field-decoration (opt-in) state: the chosen extra fields (loaded from localStorage) + the chooser's
		// open flag + a lazily-resolved storage backend. Load before the first _buildState so the initial
		// paint already carries any remembered decorations.
		this._decorationOpen = false;
		this._decorationFields = [];
		this._decorationStore = null;
		this._loadDecorationFields();

		// Populate the AppData state slot now so the template Record (resolved from
		// DefaultTemplateRecordAddress) reflects it on the very first render — pict resolves the
		// Record before onBeforeRender runs.
		try { this._buildState(); } catch (pError) { /* AppData/value not ready — onBeforeRender will build it */ }

		// Async mode: resolve the display text of pre-set bound value(s) (e.g. fetch the entity for an ID).
		if (this._isAsync() && typeof this.options.ResolveValue === 'function')
		{
			this._resolveInitialValues();
		}
	}

	/** @return {boolean} True when a DataProvider function is configured (async/server mode). */
	_isAsync()
	{
		return (typeof this.options.DataProvider === 'function');
	}

	/** @return {boolean} True when the picker is in multi-select (chips) mode. */
	_isMulti()
	{
		return (this.options.Mode === 'multi');
	}

	/** @return {Record<string, any>} The AppData state slot for this picker. */
	_state()
	{
		this.pict.AppData.PictSectionPicker = this.pict.AppData.PictSectionPicker || {};
		this.pict.AppData.PictSectionPicker[this.options.PickerHash] = this.pict.AppData.PictSectionPicker[this.options.PickerHash] || {};
		return this.pict.AppData.PictSectionPicker[this.options.PickerHash];
	}

	/** Resolve display text for any pre-bound value(s) via the async ResolveValue hook, then repaint. */
	_resolveInitialValues()
	{
		const tmpResolveOne = (pValue) =>
		{
			if (pValue === undefined || pValue === null || pValue === '') { return; }
			Promise.resolve(this.options.ResolveValue(pValue)).then((pResolved) =>
			{
				if (pResolved && pResolved.Text)
				{
					if (this._isMulti())
					{
						this._selectedRecords[String(pValue)] = { Value: pResolved.Value !== undefined ? pResolved.Value : pValue, Text: pResolved.Text, Tag: pResolved.Tag, Tags: pResolved.Tags };
						this._renderValue();
					}
					else
					{
						this._selectedText = pResolved.Text;
						this.render();
					}
				}
			}).catch(() => { /* leave the raw value showing */ });
		};

		if (this._isMulti())
		{
			this.getValue().forEach(tmpResolveOne);
		}
		else
		{
			tmpResolveOne(this.getValue());
		}
	}

	/**
	 * @return {any} The current selection: a scalar in single mode, or an array of values in multi mode
	 *   (normalizing a csv string or scalar at the bound address into an array).
	 */
	getValue()
	{
		const tmpRaw = this.options.ValueAddress
			? this.pict.manifest.getValueAtAddress(this.pict, this.options.ValueAddress)
			: (this._isMulti() ? this._values : this._value);
		if (!this._isMulti())
		{
			return tmpRaw;
		}
		if (tmpRaw === undefined || tmpRaw === null || tmpRaw === '') { return []; }
		if (Array.isArray(tmpRaw)) { return tmpRaw; }
		if (typeof tmpRaw === 'string') { return tmpRaw.split(',').filter((pPart) => pPart !== ''); }
		return [ tmpRaw ];
	}

	/**
	 * Persist the selection to the bound address(es). Single mode writes the scalar; multi mode writes
	 * the array to ValueAddress and mirrors it to the optional csv / records addresses.
	 * @param {any} pValue - The new value (scalar in single mode, array in multi mode).
	 */
	_setValue(pValue)
	{
		if (!this._isMulti())
		{
			this._value = pValue;
			if (this.options.ValueAddress)
			{
				this.pict.manifest.setValueAtAddress(this.pict, this.options.ValueAddress, pValue);
			}
			return;
		}

		const tmpArray = Array.isArray(pValue) ? pValue : [];
		this._values = tmpArray;
		if (this.options.ValueAddress)
		{
			this.pict.manifest.setValueAtAddress(this.pict, this.options.ValueAddress, tmpArray);
		}
		if (this.options.StringArrayValueAddress)
		{
			this.pict.manifest.setValueAtAddress(this.pict, this.options.StringArrayValueAddress, tmpArray.join(','));
		}
		if (this.options.SelectedValuesAddress)
		{
			const tmpRecords = tmpArray.map((pVal) => this._selectedRecords[String(pVal)] || { Value: pVal, Text: String(pVal) });
			this.pict.manifest.setValueAtAddress(this.pict, this.options.SelectedValuesAddress, tmpRecords);
		}
	}

	/**
	 * Public: set the picker's value programmatically (e.g. when a host form marshals data into it).
	 * Accepts a scalar (single mode) or an array / csv string (multi mode), seeds display text for any
	 * unknown values (from the source rows, else async ResolveValue), then repaints.
	 * @param {any} pValue
	 * @return {PictViewPicker} this
	 */
	setValue(pValue)
	{
		if (this._isMulti())
		{
			let tmpArray = pValue;
			if (tmpArray === undefined || tmpArray === null || tmpArray === '') { tmpArray = []; }
			else if (typeof tmpArray === 'string') { tmpArray = tmpArray.split(',').filter((pPart) => pPart !== ''); }
			else if (!Array.isArray(tmpArray)) { tmpArray = [ tmpArray ]; }
			// Seed the {Value,Text} records BEFORE persisting, so the SelectedValuesAddress mirror that
			// _setValue writes carries real labels (not String(value) fallbacks). Mirrors select()'s
			// seed-then-persist order.
			this._seedSelectedRecords(tmpArray);
			this._setValue(tmpArray);
		}
		else
		{
			this._setValue(pValue);
			this._selectedText = null;
			this._seedSelectedRecords((pValue === undefined || pValue === null || pValue === '') ? [] : [ pValue ]);
		}
		this._reflectValue();
		return this;
	}

	/**
	 * Reflect a programmatic setValue into the DOM. Full render when the widget isn't live yet, or when
	 * _shapeSignature() shows something outside the value area / list changed; otherwise just repaint
	 * those two (the list's checkmark tracks the value). The targeted path is what lets a form marshal
	 * re-seed on every solve without tearing down the search box (losing focus) or orphaning a portal.
	 * select()/clearValue() keep their own full renders — this is only the setValue path.
	 */
	_reflectValue()
	{
		const tmpLive = (typeof document !== 'undefined') && !!document.getElementById(`PPS_${this.options.PickerHash}`);
		if (!tmpLive || (this._shapeSignature() !== this._renderedShape)) { this.render(); return; }
		this._renderValue();
		this._renderList();
	}

	/**
	 * Signature of the render-affecting state the targeted refresh CANNOT repaint — the three things that
	 * render outside #PPS_Value_ / #PPS_List_: the root's pps-multi/pps-readonly classes, the search box,
	 * and the inline clear × (gated on value presence, so it moves with no config change). _reflectValue
	 * full-renders when this changes. Extend it if the control template grows another such slot.
	 * @return {string}
	 */
	_shapeSignature()
	{
		const tmpMulti = this._isMulti();
		const tmpValue = tmpMulti ? undefined : this.getValue();
		const tmpHasValue = (tmpValue !== undefined && tmpValue !== null && tmpValue !== '');
		return [
			tmpMulti,
			!!this.options.ReadOnly,
			!!this.options.Searchable,
			(!tmpMulti && this.options.AllowClear === true && tmpHasValue),
		].join('|');
	}

	/**
	 * Ensure each value has a {Value,Text} in _selectedRecords — from the current source rows when
	 * present, else (async mode) fetched via ResolveValue and painted in when it resolves.
	 * @param {Array<any>} pValues
	 */
	_seedSelectedRecords(pValues)
	{
		pValues.forEach((pVal) =>
		{
			if (pVal === undefined || pVal === null || pVal === '' || this._selectedRecords[String(pVal)]) { return; }
			const tmpRow = this._sourceRows().find((pRow) => String(pRow.Value) === String(pVal));
			if (tmpRow)
			{
				this._selectedRecords[String(pVal)] = { Value: tmpRow.Value, Text: tmpRow.Text, Tag: tmpRow.Tag, Tags: tmpRow.Tags };
				return;
			}
			if (this._isAsync() && typeof this.options.ResolveValue === 'function')
			{
				Promise.resolve(this.options.ResolveValue(pVal)).then((pResolved) =>
				{
					if (pResolved && pResolved.Text)
					{
						this._selectedRecords[String(pVal)] = { Value: pResolved.Value !== undefined ? pResolved.Value : pVal, Text: pResolved.Text, Tag: pResolved.Tag, Tags: pResolved.Tags };
						if (!this._isMulti()) { this._selectedText = pResolved.Text; }
						this._renderValue();
					}
				}).catch(() => { /* leave the raw value showing */ });
			}
		});
	}

	/** @return {Array<{Value:any, Text:string, Tag?:any}>} The current option source rows (async results or static Options). */
	_sourceRows()
	{
		if (this._isAsync()) { return this._loadedResults; }
		return Array.isArray(this.options.Options) ? this.options.Options : [];
	}

	/**
	 * Build the EntityTag before/after render slots for a record. Accepts a single tag value OR an array
	 * of them (the `Tags` multi-badge form), so a record can carry several disambiguation chips (e.g. a
	 * book's ISBN + year). Empty/blank entries are dropped; a tag-less record renders no badge. The slot
	 * is a per-tag `{Tag}` array, and the value/chip/option templates already iterate it with `{~TS:~}`.
	 * @param {any} pTags - a tag value, or an array of tag values.
	 * @param {boolean} pTagLast
	 * @return {{TagBeforeSlot:Array<any>, TagAfterSlot:Array<any>}}
	 */
	_tagSlots(pTags, pTagLast)
	{
		const tmpList = Array.isArray(pTags)
			? pTags
			: ((pTags !== undefined && pTags !== null && pTags !== '') ? [ pTags ] : []);
		const tmpSlot = tmpList
			.filter((pTag) => (pTag !== undefined && pTag !== null && pTag !== ''))
			.map((pTag) => ({ Tag: pTag }));
		return {
			TagBeforeSlot: (tmpSlot.length > 0 && !pTagLast) ? tmpSlot : [],
			TagAfterSlot: (tmpSlot.length > 0 && pTagLast) ? tmpSlot : [],
		};
	}

	/**
	 * The tag(s) to render for a record — the multi-badge `Tags` array when present, else the single
	 * `Tag` (back-compat). Centralizes the precedence used by every `_tagSlots` call site.
	 * @param {any} pRecord
	 * @return {any}
	 */
	_recordTags(pRecord)
	{
		if (!pRecord) { return undefined; }
		return (pRecord.Tags !== undefined) ? pRecord.Tags : pRecord.Tag;
	}

	// --- Field decoration (opt-in): let the user pin extra record fields onto each option row ---

	/** @return {boolean} The decoration affordance is available: opted in, interactive, and namespaced. */
	_decorationEnabled()
	{
		return (this.options.AllowFieldDecoration === true) && !this.options.ReadOnly && !!this._decorationKey();
	}

	/** localStorage key — per Entity, so a field pinned on one Organization picker shows on them all;
	 *  falls back to the picker hash when no Entity is set. @return {string} */
	_decorationKey()
	{
		if (this.options.Entity) { return `${_DECORATION_KEY_PREFIX}${this.options.Entity}`; }
		return this.options.PickerHash ? `${_DECORATION_KEY_PREFIX}${this.options.PickerHash}` : '';
	}

	/** Lazily resolve a storage backend: window.localStorage in a browser, an in-memory shim otherwise
	 *  (unit tests / SSR), mirroring the pict-section-recordset persistence idiom. */
	_decorationStorage()
	{
		if (this._decorationStore) { return this._decorationStore; }
		if ((typeof window === 'object') && window && (typeof window.localStorage === 'object') && window.localStorage)
		{
			this._decorationStore = window.localStorage;
		}
		else
		{
			const tmpMemory = {};
			this._decorationStore = {
				getItem: (pKey) => ((pKey in tmpMemory) ? tmpMemory[pKey] : null),
				setItem: (pKey, pValue) => { tmpMemory[pKey] = String(pValue); },
				removeItem: (pKey) => { delete tmpMemory[pKey]; },
			};
		}
		return this._decorationStore;
	}

	/** Read the persisted decoration field list for this picker's entity into _decorationFields. */
	_loadDecorationFields()
	{
		this._decorationFields = [];
		if (this.options.AllowFieldDecoration !== true) { return; }
		const tmpKey = this._decorationKey();
		if (!tmpKey) { return; }
		try
		{
			const tmpRaw = this._decorationStorage().getItem(tmpKey);
			const tmpParsed = tmpRaw ? JSON.parse(tmpRaw) : [];
			if (Array.isArray(tmpParsed)) { this._decorationFields = tmpParsed.filter((pField) => ((typeof pField === 'string') && pField)); }
		}
		catch (pError) { this._decorationFields = []; }
	}

	/** Persist the current decoration field list under this picker's entity key. */
	_saveDecorationFields()
	{
		const tmpKey = this._decorationKey();
		if (!tmpKey) { return; }
		try { this._decorationStorage().setItem(tmpKey, JSON.stringify(this._decorationFields)); }
		catch (pError) { /* storage full / disabled — the in-session choice still applies */ }
	}

	/** Field names hidden from the chooser: the common audit columns + the host's DecorationIgnoreFields +
	 *  the value/text fields (already shown as the row's value + label). @return {Set<string>} */
	_decorationIgnoreSet()
	{
		const tmpSet = new Set(_DECORATION_IGNORE_DEFAULT);
		const tmpHostIgnore = Array.isArray(this.options.DecorationIgnoreFields) ? this.options.DecorationIgnoreFields : [];
		tmpHostIgnore.forEach((pField) => { if (pField) { tmpSet.add(String(pField)); } });
		if (this.options.ValueField) { tmpSet.add(String(this.options.ValueField)); }
		else if (this.options.Entity) { tmpSet.add(`ID${this.options.Entity}`); }
		tmpSet.add(this.options.TextField ? String(this.options.TextField) : 'Name');
		return tmpSet;
	}

	/** Candidate decoration fields: the union of keys across the loaded rows' `Record` objects, minus the
	 *  ignore set, sorted. Empty until a result page carries records. @return {Array<string>} */
	_decorationCandidateFields()
	{
		const tmpKeys = {};
		this._sourceRows().forEach((pRow) =>
		{
			const tmpRecord = pRow && pRow.Record;
			if (tmpRecord && (typeof tmpRecord === 'object')) { Object.keys(tmpRecord).forEach((pKey) => { tmpKeys[pKey] = true; }); }
		});
		const tmpIgnore = this._decorationIgnoreSet();
		return Object.keys(tmpKeys).filter((pKey) => !tmpIgnore.has(pKey)).sort();
	}

	/** The decoration chips for an option: "Field: value" for each chosen field present on its `Record`.
	 *  @param {any} pOption @return {Array<string>|null} */
	_decorationTagsFor(pOption)
	{
		if (!this._decorationEnabled() || (this._decorationFields.length === 0)) { return null; }
		const tmpRecord = pOption && pOption.Record;
		if (!tmpRecord || (typeof tmpRecord !== 'object')) { return null; }
		const tmpTags = this._decorationFields
			.map((pField) => { const tmpValue = tmpRecord[pField]; return ((tmpValue !== undefined && tmpValue !== null && tmpValue !== '') ? `${pField}: ${tmpValue}` : null); })
			.filter((pTag) => (pTag !== null));
		return (tmpTags.length > 0) ? tmpTags : null;
	}

	/** The row's own EntityTag(s) plus the user's decoration chips (decorations last). @param {any} pOption */
	_combinedTags(pOption)
	{
		const tmpBase = this._recordTags(pOption);
		const tmpDecoration = this._decorationTagsFor(pOption);
		if (!tmpDecoration) { return tmpBase; }
		const tmpBaseList = Array.isArray(tmpBase) ? tmpBase : ((tmpBase !== undefined && tmpBase !== null && tmpBase !== '') ? [ tmpBase ] : []);
		return tmpBaseList.concat(tmpDecoration);
	}

	/** Toggle the field chooser open/closed (the ⚙ in the search row); repaints just the chooser + button. */
	toggleDecorate(pEvent)
	{
		if (pEvent && (typeof pEvent.stopPropagation === 'function')) { pEvent.stopPropagation(); }
		if (!this._decorationEnabled()) { return; }
		this._decorationOpen = !this._decorationOpen;
		this._renderDecorate();
		this._syncDecorateToggle();
	}

	/** Add/remove a field from the decoration set, persist, and repaint the option list + chooser. */
	toggleDecorateField(pField)
	{
		if (!pField) { return; }
		const tmpIndex = this._decorationFields.indexOf(pField);
		if (tmpIndex >= 0) { this._decorationFields.splice(tmpIndex, 1); }
		else { this._decorationFields.push(pField); }
		this._saveDecorationFields();
		this._renderList();
		this._renderDecorate();
		this._syncDecorateToggle();
	}

	/** Re-render only the chooser panel (mirrors _renderList — targeted, keeps the search input focused). */
	_renderDecorate()
	{
		if (typeof document === 'undefined') { return; }
		if (!document.getElementById(`PPS_Decorate_${this.options.PickerHash}`)) { return; }
		this._buildState();
		const tmpHTML = this.pict.parseTemplateByHash('Pict-Section-Picker-DecoratePanel', this._state());
		this.pict.ContentAssignment.assignContent(`#PPS_Decorate_${this.options.PickerHash}`, tmpHTML);
	}

	/** Reflect the on/open state onto the ⚙ button without rebuilding the search row (which holds focus). */
	_syncDecorateToggle()
	{
		if (typeof document === 'undefined') { return; }
		const tmpBtn = document.getElementById(`PPS_DecorateBtn_${this.options.PickerHash}`);
		if (!tmpBtn) { return; }
		tmpBtn.classList.toggle('pps-decorate-on', (this._decorationFields.length > 0));
		tmpBtn.classList.toggle('pps-decorate-open', !!this._decorationOpen);
	}

	/**
	 * (Re)compute the picker's render state into AppData: the displayed value / chips + the
	 * (search-filtered) option list with selected/highlight flags.
	 */
	_buildState()
	{
		const tmpState = this._state();
		const tmpAsync = this._isAsync();
		const tmpMulti = this._isMulti();
		const tmpSearch = (this._search || '').toLowerCase();

		// Source rows: async = the accumulated server results (already filtered server-side);
		// static = the configured Options, filtered locally by the search term.
		const tmpStatic = Array.isArray(this.options.Options) ? this.options.Options : [];
		const tmpSource = tmpAsync
			? this._loadedResults
			: tmpStatic.filter((pOption) => !tmpSearch || String(pOption.Text).toLowerCase().includes(tmpSearch));

		// Membership set used to flag options as selected (multi: every value; single: the one value).
		const tmpSelectedKeys = new Set((tmpMulti ? this.getValue() : [ this.getValue() ])
			.filter((pVal) => pVal !== undefined && pVal !== null && pVal !== '')
			.map((pVal) => String(pVal)));

		const tmpTagLast = !!this.options.TagLast;
		tmpState.Options = tmpSource.map((pOption, pIndex) =>
		{
			const tmpIsSelected = tmpSelectedKeys.has(String(pOption.Value));
			return Object.assign({
				PickerHash: this.options.PickerHash,
				ValueKey: String(pOption.Value),
				Text: pOption.Text,
				Selected: tmpIsSelected,
				NotSelected: !tmpIsSelected,
				Highlight: (pIndex === this._highlight),
			}, this._tagSlots(this._combinedTags(pOption), tmpTagLast));
		});

		// Cluster options into categories (preserving order), keyed by each source row's optional Group.
		// With no Group fields everything lands in one unlabeled group, so the renderer has one path.
		const tmpGroups = [];
		const tmpGroupIndex = {};
		tmpState.Options.forEach((pOption, pIndex) =>
		{
			const tmpLabel = (tmpSource[pIndex] && tmpSource[pIndex].Group) ? String(tmpSource[pIndex].Group) : '';
			if (!(tmpLabel in tmpGroupIndex))
			{
				tmpGroupIndex[tmpLabel] = tmpGroups.length;
				tmpGroups.push({ Label: tmpLabel, HeaderSlot: tmpLabel ? [ { Label: tmpLabel } ] : [], Options: [] });
			}
			tmpGroups[tmpGroupIndex[tmpLabel]].Options.push(pOption);
		});
		tmpState.Groups = tmpGroups;

		// Creatable: offer "Create <term>" for a non-empty search that doesn't exactly match a known row.
		const tmpTerm = (this._search || '').trim();
		const tmpCanCreate = (typeof this.options.OnCreate === 'function') && tmpTerm.length > 0
			&& !this._sourceRows().some((pRow) => String(pRow.Text).trim().toLowerCase() === tmpTerm.toLowerCase());
		tmpState.CreateSlot = tmpCanCreate ? [ { PickerHash: this.options.PickerHash, Term: tmpTerm } ] : [];

		tmpState.PickerHash = this.options.PickerHash;
		tmpState.IsMulti = tmpMulti;
		tmpState.Placeholder = this.options.Placeholder;
		tmpState.Searchable = !!this.options.Searchable;
		tmpState.ReadOnly = !!this.options.ReadOnly;

		// Clearable (AllowClear, single mode): the pinned "Any" dropdown row — checked when nothing is
		// selected ("Any" is the active state) — and the control's inline × while a value is selected.
		const tmpAllowClear = (!tmpMulti && this.options.AllowClear === true);
		const tmpClearableValue = tmpMulti ? undefined : this.getValue();
		const tmpClearableHasValue = (tmpClearableValue !== undefined && tmpClearableValue !== null && tmpClearableValue !== '');
		tmpState.ClearOptionSlot = tmpAllowClear
			? [ { PickerHash: this.options.PickerHash, Label: this.options.ClearLabel || 'Any', Selected: !tmpClearableHasValue, NotSelected: tmpClearableHasValue } ]
			: [];
		tmpState.ClearSlot = (tmpAllowClear && tmpClearableHasValue) ? [ { PickerHash: this.options.PickerHash } ] : [];
		// Field decoration (opt-in): the ⚙ toggle rides in the search row; the chooser panel renders between
		// search and list. Both are single-element-array slots gated on the feature being enabled + eligible.
		const tmpDecorate = this._decorationEnabled();
		const tmpDecorateFields = (tmpDecorate && this._decorationOpen) ? this._decorationCandidateFields() : [];
		tmpState.DecoratePanelSlot = (tmpDecorate && this._decorationOpen)
			? [ {
				PickerHash: this.options.PickerHash,
				Fields: tmpDecorateFields.map((pField) => ({ PickerHash: this.options.PickerHash, Field: pField, Checked: (this._decorationFields.indexOf(pField) >= 0) })),
				NoFields: (tmpDecorateFields.length === 0),
			} ]
			: [];
		// Single-element-array conditionals (render the search box / "Load more" only when applicable).
		tmpState.SearchSlot = this.options.Searchable
			? [ {
				PickerHash: this.options.PickerHash,
				DecorateSlot: tmpDecorate ? [ { PickerHash: this.options.PickerHash, HasFields: (this._decorationFields.length > 0), Open: !!this._decorationOpen } ] : [],
			} ]
			: [];
		tmpState.Loading = !!this._loading;
		tmpState.IsEmpty = (tmpState.Options.length === 0 && !this._loading && !tmpCanCreate);
		tmpState.HasMore = !!(tmpAsync && this._hasMore && !this._loading);
		tmpState.MoreSlot = tmpState.HasMore ? [ { PickerHash: this.options.PickerHash } ] : [];

		// Preview-card affordance (opt-in): a small ⓘ next to the selected value / chips that opens the
		// entity's registered preview card. Active only when the host registered a RecordSetCardManager
		// (soft dependency) that has a card for this picker's Entity, and the picker didn't opt out
		// (RecordCard !== false). Otherwise the picker renders exactly as before.
		const tmpCardManager = this.pict.providers.RecordSetCardManager;
		const tmpCardEntity = this.options.Entity;
		const tmpCardEnabled = !!(tmpCardManager && tmpCardEntity && (this.options.RecordCard !== false) && (typeof tmpCardManager.hasCard === 'function') && tmpCardManager.hasCard(tmpCardEntity));

		// The single/multi value-area is rendered via single-element-array slots; each slot's element
		// IS the Record for its sub-template, so it must carry everything that template references.
		if (tmpMulti)
		{
			const tmpValues = this.getValue();
			const tmpNoValue = (tmpValues.length === 0);
			const tmpChips = tmpValues.map((pVal) =>
			{
				const tmpRecord = this._lookupRecord(pVal);
				return Object.assign(
					{ PickerHash: this.options.PickerHash, ValueKey: String(pVal), Text: tmpRecord ? tmpRecord.Text : String(pVal), CardSlot: tmpCardEnabled ? [ { Entity: tmpCardEntity, Value: String(pVal) } ] : [] },
					this._tagSlots(this._recordTags(tmpRecord), tmpTagLast));
			});
			tmpState.SingleSlot = [];
			tmpState.MultiSlot = [ {
				PickerHash: this.options.PickerHash,
				Chips: tmpChips,
				PlaceholderSlot: tmpNoValue ? [ { Placeholder: this.options.Placeholder } ] : [],
			} ];
		}
		else
		{
			const tmpValue = this.getValue();
			const tmpHasValue = (tmpValue !== undefined && tmpValue !== null && tmpValue !== '');
			const tmpSelected = this._lookupRecord(tmpValue);
			tmpState.SingleSlot = [ Object.assign({
				PickerHash: this.options.PickerHash,
				DisplayText: tmpSelected ? tmpSelected.Text : (this._selectedText || (tmpHasValue ? String(tmpValue) : this.options.Placeholder)),
				NoValue: !tmpHasValue,
				CardSlot: (tmpCardEnabled && tmpHasValue) ? [ { Entity: tmpCardEntity, Value: String(tmpValue) } ] : [],
			}, this._tagSlots(this._recordTags(tmpSelected), tmpTagLast)) ];
			tmpState.MultiSlot = [];
		}
		return tmpState;
	}

	/**
	 * Find the {Value,Text} record for a value: the stored selection record (authoritative for chips /
	 * async), else a row in the current source (static Options or loaded results).
	 * @param {any} pValue
	 * @return {{Value:any, Text:string, Tag?:any}|null}
	 */
	_lookupRecord(pValue)
	{
		if (pValue === undefined || pValue === null || pValue === '') { return null; }
		const tmpStored = this._selectedRecords[String(pValue)];
		if (tmpStored) { return tmpStored; }
		return this._sourceRows().find((pOption) => String(pOption.Value) === String(pValue)) || null;
	}

	/**
	 * Load a page of results from the async DataProvider, accumulating (append) or replacing the list.
	 * @param {number} pPage - zero-based page index.
	 * @param {boolean} pAppend - true to append (Load more), false to replace (new search / first open).
	 */
	_loadPage(pPage, pAppend)
	{
		if (!this._isAsync()) { return; }
		this._loading = true;
		this._renderList();
		const tmpSearchAtRequest = this._search;
		Promise.resolve()
			.then(() => this.options.DataProvider(this._search, pPage))
			.then((pResult) =>
			{
				// Drop a stale first-page response if the search term changed while it was in flight.
				if (!pAppend && pPage === 0 && tmpSearchAtRequest !== this._search) { return; }
				const tmpResults = (pResult && Array.isArray(pResult.results)) ? pResult.results : [];
				this._loadedResults = pAppend ? this._loadedResults.concat(tmpResults) : tmpResults;
				this._hasMore = !!(pResult && pResult.hasMore);
				this._page = pPage;
				this._loaded = true;
				this._loading = false;
				this._renderList();
			})
			.catch((pError) =>
			{
				this.pict.log.warn(`Pict-Section-Picker [${this.options.PickerHash}] DataProvider error.`, pError);
				this._loading = false;
				this._renderList();
			});
	}

	/**
	 * @param {import('pict-view').Renderable} pRenderable
	 */
	onBeforeRender(pRenderable)
	{
		this._buildState();
		return super.onBeforeRender(pRenderable);
	}

	/** Toggle the dropdown open/closed. */
	toggle(pEvent)
	{
		if (pEvent) { pEvent.preventDefault(); }
		return this._open ? this.close() : this.open();
	}

	/** Keyboard on the control: open the dropdown on Enter / Space / ArrowDown. */
	onControlKey(pEvent)
	{
		if (pEvent.key === 'Enter' || pEvent.key === ' ' || pEvent.key === 'ArrowDown')
		{
			pEvent.preventDefault();
			if (!this._open) { this.open(); }
		}
		else if (pEvent.key === 'Escape')
		{
			this.close();
		}
	}

	/** Open the dropdown and focus the search box. With the opt-in SingleActivePicker option, closes
	 *  any open sibling picker first — one active dropdown per page. */
	open()
	{
		this._claimActivePicker();
		this._open = true;
		this._highlight = -1;
		this._paintOpen();
		this._applyAnchorMode();
		if (this._isAsync() && !this._loaded) { this._loadPage(0, false); }
		const tmpSearch = /** @type {HTMLInputElement} */ (document.getElementById(`PPS_Search_${this.options.PickerHash}`));
		if (tmpSearch) { tmpSearch.focus(); tmpSearch.select(); }
	}

	/** Take the provider's single-active slot, closing whichever sibling holds it. Opt-in only (an off
	 *  picker neither claims nor is closed). The slot holds a hash on the provider, so two pict instances
	 *  sharing this module can't cross-close. */
	_claimActivePicker()
	{
		const tmpProvider = this.options.PickerProvider;
		if (!this.options.SingleActivePicker || !tmpProvider) { return; }
		const tmpOpenHash = tmpProvider.currentOpenPickerHash;
		if (tmpOpenHash && tmpOpenHash !== this.options.PickerHash)
		{
			const tmpOpenView = this.pict.views[tmpOpenHash];
			if (tmpOpenView && typeof tmpOpenView.close === 'function') { tmpOpenView.close(); }
		}
		tmpProvider.currentOpenPickerHash = this.options.PickerHash;
	}

	/*
	 * Dropdown anchoring & render states
	 * ----------------------------------
	 * Anchoring (picked per open by _applyAnchorMode -> _shouldPortal):
	 *   CSS      : .pps-pop is absolute inside the widget and rides page scroll for free. Default.
	 *   Portaled : moved to <body> in document coords when a clipping ancestor (overflow != visible)
	 *              would actually cut it. Still absolute, so it rides scroll too; carries the control's
	 *              --theme-color-* across since it left any scoped container.
	 * Open  : _open -> pps-open on the root, pps-pop-open on the pop (a portaled pop is outside the
	 *         root's .pps-open rule, so it needs its own class to show).
	 * Render: full render() rebuilds the widget; setValue uses the targeted _reflectValue (value area +
	 *         list only) unless _shapeSignature() shows something outside them changed.
	 * _popElement finds the pop in either place; _markClosed is the single close funnel.
	 */

	/** The pop wherever it lives (in-widget or portaled). By position not id: a re-render can briefly
	 *  leave two sharing the id, and the in-widget copy is the live one. @return {HTMLElement|null} */
	_popElement()
	{
		if (typeof document === 'undefined') { return null; }
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		const tmpInWidget = tmpRoot ? /** @type {HTMLElement} */ (tmpRoot.querySelector('.pps-pop')) : null;
		if (tmpInWidget) { return tmpInWidget; }
		return /** @type {HTMLElement} */ (document.querySelector(`body > [id="PPS_Pop_${this.options.PickerHash}"]`));
	}

	/** Pick this open's anchoring (see states above): portal when _shouldPortal finds a clipping ancestor
	 *  that would cut the panel, else CSS. Judged from the control, which never moves — a portaled panel
	 *  has no clipping ancestors, so testing it would flip-flop. */
	_applyAnchorMode()
	{
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		const tmpPop = this._popElement();
		if (!tmpPop) { return; }
		const tmpControl = tmpRoot ? /** @type {HTMLElement} */ (tmpRoot.querySelector('.pps-control')) : null;
		this._portaled = !!tmpControl && this._shouldPortal(tmpControl);
		if (this._portaled) { this._portalPop(tmpPop); }
		else { this._restorePop(tmpPop); }
		// A portaled pop is hidden until pps-pop-open is set (it's outside the root's .pps-open rule).
		tmpPop.classList.toggle('pps-pop-open', !!this._open);
	}

	/** Move the panel to <body> and place it against the control in document coords (viewport rect +
	 *  scroll), flipping above when room below is short. Width is pinned since it no longer inherits the
	 *  widget's. @param {HTMLElement} pPop */
	_portalPop(pPop)
	{
		if (typeof document === 'undefined') { return; }
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		const tmpControl = tmpRoot ? tmpRoot.querySelector('.pps-control') : null;
		if (!tmpControl) { return; }
		// Sweep any stale portaled copy a prior re-render left on <body> (same id) before adopting this one.
		document.querySelectorAll(`body > [id="PPS_Pop_${this.options.PickerHash}"]`)
			.forEach((pNode) => { if (pNode !== pPop) { pNode.remove(); } });
		if (pPop.parentElement !== document.body) { document.body.appendChild(pPop); }
		pPop.classList.add('pps-pop-portal');

		// Carry the resolved --theme-color-* across: on <body> the panel has left any scoped container, so
		// without this it would fall back to the hex defaults. Skip empty reads — pinning "" would defeat
		// the var(--token, #hex) fallback for tokens the host never defined.
		if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
		{
			const tmpComputed = window.getComputedStyle(tmpControl);
			_THEME_TOKENS.forEach((pToken) =>
			{
				const tmpValue = tmpComputed.getPropertyValue(pToken);
				if (tmpValue && tmpValue.trim() !== '') { pPop.style.setProperty(pToken, tmpValue.trim()); }
			});
		}

		const tmpRect = tmpControl.getBoundingClientRect();
		const tmpGap = 5;
		const tmpMargin = 8;
		const tmpIdeal = 360;
		const tmpWidth = Math.max(200, Math.round(tmpRect.width));
		const tmpSpaceBelow = window.innerHeight - tmpRect.bottom - tmpGap - tmpMargin;
		const tmpSpaceAbove = tmpRect.top - tmpGap - tmpMargin;
		const tmpBelow = (tmpSpaceBelow >= tmpIdeal) || (tmpSpaceBelow >= tmpSpaceAbove);
		const tmpPanel = /** @type {HTMLElement} */ (pPop.querySelector('.pps-panel'));

		pPop.style.width = `${tmpWidth}px`;
		pPop.style.left = `${Math.round(Math.max(tmpMargin, Math.min(tmpRect.left, window.innerWidth - tmpWidth - tmpMargin)) + window.scrollX)}px`;
		pPop.style.bottom = 'auto';
		// Document coords (viewport rect + scroll): absolute against <body>, so one placement is enough.
		pPop.style.top = tmpBelow
			? `${Math.round(tmpRect.bottom + tmpGap + window.scrollY)}px`
			: `${Math.round(tmpRect.top - tmpGap + window.scrollY)}px`;
		if (!tmpBelow) { pPop.style.transform = 'translateY(-100%)'; }
		else { pPop.style.transform = ''; }
		if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(0, Math.round(Math.min(tmpBelow ? tmpSpaceBelow : tmpSpaceAbove, tmpIdeal)))}px`; }
	}

	/** Re-home a portaled panel and drop everything the portal wrote. Doubles as the orphan sweeper: if a
	 *  re-render already put a fresh panel in the widget, the portaled one is stale and gets discarded.
	 *  @param {HTMLElement} pPop */
	_restorePop(pPop)
	{
		if (typeof document === 'undefined' || !pPop) { return; }
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		if (pPop.parentElement === document.body)
		{
			if (!tmpRoot) { pPop.remove(); return; }
			// A re-render already put a fresh panel in the widget — this portaled one is a leftover.
			if (tmpRoot.querySelector('.pps-pop') && tmpRoot.querySelector('.pps-pop') !== pPop) { pPop.remove(); return; }
			tmpRoot.appendChild(pPop);
		}
		pPop.classList.remove('pps-pop-portal');
		// Clear the inline offsets, or they'd override the stylesheet and strand the panel.
		pPop.style.top = '';
		pPop.style.left = '';
		pPop.style.right = '';
		pPop.style.bottom = '';
		pPop.style.width = '';
		pPop.style.transform = '';
		// Drop the copied tokens so back in the widget it inherits them live again.
		_THEME_TOKENS.forEach((pToken) => pPop.style.removeProperty(pToken));
		const tmpPanel = /** @type {HTMLElement} */ (pPop.querySelector('.pps-panel'));
		if (tmpPanel) { tmpPanel.style.maxHeight = ''; }
	}

	/** Portal when ANY clipping ancestor would actually cut the panel (_clipBites) — an overflow ancestor
	 *  alone isn't enough, but a roomy inner clipper doesn't excuse a tighter one further out.
	 *  @param {HTMLElement} pControl @return {boolean} */
	_shouldPortal(pControl)
	{
		// Walk every clipper outward, not just the nearest: _clippingAncestor starts from parentElement,
		// so re-feeding it the clipper it returned continues the walk.
		let tmpClipper = this._clippingAncestor(pControl);
		while (tmpClipper)
		{
			if (this._clipBites(pControl, tmpClipper)) { return true; }
			tmpClipper = this._clippingAncestor(tmpClipper);
		}
		return false;
	}

	/** Nearest ancestor (up to, not including, body) with an overflow clip on any axis, or null. Stops at
	 *  body because the document's own scroll is what the absolute anchoring rides on, not a clip.
	 *  @param {HTMLElement} pElement @return {HTMLElement|null} */
	_clippingAncestor(pElement)
	{
		if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') { return null; }
		let tmpNode = pElement ? pElement.parentElement : null;
		while (tmpNode && tmpNode.nodeType === 1 && tmpNode !== document.body)
		{
			const tmpStyle = window.getComputedStyle(tmpNode);
			if (tmpStyle && [ tmpStyle.overflow, tmpStyle.overflowX, tmpStyle.overflowY ].some((pValue) => pValue && pValue !== 'visible'))
			{
				return /** @type {HTMLElement} */ (tmpNode);
			}
			tmpNode = tmpNode.parentElement;
		}
		return null;
	}

	/** True when the control has any overflow-clipping ancestor. Thin boolean over _clippingAncestor;
	 *  the anchor decision uses _shouldPortal, which also weighs whether the clip reaches the panel.
	 *  @param {HTMLElement} pElement @return {boolean} */
	_hasClippingAncestor(pElement) { return !!this._clippingAncestor(pElement); }

	/** Would the clipper cut the panel if it opened in place? The CSS path always opens downward and never
	 *  flips, so project that worst-case box (control bottom + gap, up to max height) and test whether any
	 *  edge falls outside the clipper. 1px slack avoids a needless portal on a flush edge.
	 *  @param {HTMLElement} pControl @param {HTMLElement} pClipper @return {boolean} */
	_clipBites(pControl, pClipper)
	{
		if (!pControl || !pClipper || typeof pControl.getBoundingClientRect !== 'function'
			|| typeof pClipper.getBoundingClientRect !== 'function') { return true; }
		const tmpControlRect = pControl.getBoundingClientRect();
		const tmpClipRect = pClipper.getBoundingClientRect();
		const tmpGap = 5;
		const tmpIdeal = 360;
		const tmpSlack = 1;
		const tmpPanelTop = tmpControlRect.bottom + tmpGap;
		const tmpPanelBottom = tmpPanelTop + tmpIdeal;
		const tmpWidth = Math.max(200, tmpControlRect.width);
		const tmpPanelLeft = tmpControlRect.left;
		const tmpPanelRight = tmpControlRect.left + tmpWidth;
		return (tmpPanelBottom > tmpClipRect.bottom + tmpSlack)
			|| (tmpPanelTop < tmpClipRect.top - tmpSlack)
			|| (tmpPanelLeft < tmpClipRect.left - tmpSlack)
			|| (tmpPanelRight > tmpClipRect.right + tmpSlack);
	}

	/** The single close funnel (close, single-mode select, clearValue, createFromSearch): clears open
	 *  state, the provider's active-picker slot, and the results cache so nothing leaks a stale reference. */
	_markClosed()
	{
		this._open = false;
		this._highlight = -1;
		this._decorationOpen = false;
		const tmpProvider = this.options.PickerProvider;
		if (tmpProvider && tmpProvider.currentOpenPickerHash === this.options.PickerHash) { tmpProvider.currentOpenPickerHash = false; }
		// Bring a portaled panel home, so a closed picker never leaves a stray on <body>.
		if (this._portaled) { this._restorePop(this._popElement()); this._portaled = false; }
		// Drop the accumulated pages so the next open re-queries — BaseFilter is resolved per query
		// because the host's scope shifts underneath the picker (a "Show All" toggle, a dependent pick),
		// so caching across a close would serve the old scope. Matches the legacy select2 re-query.
		this._loaded = false;
		this._loadedResults = [];
		this._page = 0;
		this._hasMore = false;
		// Back-off state spans only page 0 -> "load more" in one session, so release it here too.
		if (tmpProvider && tmpProvider.backOffState) { delete tmpProvider.backOffState[this.options.PickerHash]; }
	}


	/** Async mode: load + append the next page of results. */
	loadMore()
	{
		if (this._isAsync() && this._hasMore && !this._loading)
		{
			this._loadPage(this._page + 1, true);
		}
	}

	/** Close the dropdown. */
	close()
	{
		this._markClosed();
		this._paintOpen();
	}

	/** Opt-in teardown for a host that drops the view (pict-view has no destroy hook). _markClosed already
	 *  releases the single-active slot, re-homes/removes a portaled panel, and clears the back-off entry;
	 *  the un-destroyed case is harmless since a stray portaled pop stays hidden without pps-pop-open. */
	destroy()
	{
		this._markClosed();
		this._paintOpen();
		// Belt-and-suspenders: if the widget root was detached mid-teardown, take any stray pop with us.
		if (typeof document !== 'undefined')
		{
			const tmpStray = document.querySelector(`body > [id="PPS_Pop_${this.options.PickerHash}"]`);
			if (tmpStray) { tmpStray.remove(); }
		}
	}

	/** Reflect open/closed on the root (pps-open) and on the pop (pps-pop-open) — a portaled pop is outside
	 *  the root's rule, so it needs the class directly, which also keeps a stray one hidden. */
	_paintOpen()
	{
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		if (tmpRoot) { tmpRoot.classList.toggle('pps-open', !!this._open); }
		const tmpPop = this._popElement();
		if (tmpPop) { tmpPop.classList.toggle('pps-pop-open', !!this._open); }
	}

	/** Re-render only the option list (keeps the search input + its focus intact). */
	_renderList()
	{
		this._buildState();
		const tmpHTML = this.pict.parseTemplateByHash('Pict-Section-Picker-List', this._state());
		this.pict.ContentAssignment.assignContent(`#PPS_List_${this.options.PickerHash}`, tmpHTML);
	}

	/** Re-render only the control's value area (the value span or the chips) — used in multi mode so
	 *  toggling a selection updates the chips without tearing down the open dropdown + search box. */
	_renderValue()
	{
		this._buildState();
		const tmpHTML = this.pict.parseTemplateByHash('Pict-Section-Picker-ValueArea', this._state());
		this.pict.ContentAssignment.assignContent(`#PPS_Value_${this.options.PickerHash}`, tmpHTML);
	}

	/** @param {string} pValue - Filter the option list by this search term. */
	search(pValue)
	{
		this._search = pValue || '';
		this._highlight = -1;
		if (this._isAsync())
		{
			// Debounce server searches; reset to page 0.
			if (this._searchTimer) { clearTimeout(this._searchTimer); }
			this._searchTimer = setTimeout(() => { this._loadPage(0, false); }, 220);
		}
		else
		{
			this._renderList();
		}
	}

	/** Keyboard navigation within the search box: arrows highlight, Enter selects, Escape closes. */
	onSearchKey(pEvent)
	{
		const tmpOptions = this._state().Options || [];
		if (pEvent.key === 'ArrowDown')
		{
			pEvent.preventDefault();
			this._highlight = Math.min(this._highlight + 1, tmpOptions.length - 1);
			this._renderList();
		}
		else if (pEvent.key === 'ArrowUp')
		{
			pEvent.preventDefault();
			this._highlight = Math.max(this._highlight - 1, 0);
			this._renderList();
		}
		else if (pEvent.key === 'Enter')
		{
			pEvent.preventDefault();
			if (this._highlight >= 0 && tmpOptions[this._highlight])
			{
				this.select(tmpOptions[this._highlight].ValueKey);
			}
			else if ((this._state().CreateSlot || []).length > 0)
			{
				this.createFromSearch();
			}
		}
		else if (pEvent.key === 'Escape')
		{
			pEvent.preventDefault();
			this.close();
		}
	}

	/**
	 * Select an option. Single mode: set the value + close. Multi mode: toggle the value in/out of the
	 * selection, keep the dropdown open, and refocus the search box for rapid multi-pick.
	 * @param {string} pValueKey - String(Value) of the option.
	 */
	select(pValueKey)
	{
		const tmpOption = this._sourceRows().find((pOption) => String(pOption.Value) === String(pValueKey));
		if (!tmpOption) { return; }

		if (!this._isMulti())
		{
			this._selectedText = tmpOption.Text;
			this._selectedRecords[String(tmpOption.Value)] = { Value: tmpOption.Value, Text: tmpOption.Text, Tag: tmpOption.Tag, Tags: tmpOption.Tags };
			this._setValue(tmpOption.Value);
			this._search = '';
			this._markClosed();
			this.render();
			if (typeof this.options.OnChange === 'function')
			{
				this.options.OnChange(tmpOption.Value, tmpOption);
			}
			return;
		}

		// Multi: toggle membership.
		const tmpValues = this.getValue().slice();
		const tmpIndex = tmpValues.findIndex((pVal) => String(pVal) === String(pValueKey));
		if (tmpIndex >= 0)
		{
			tmpValues.splice(tmpIndex, 1);
			delete this._selectedRecords[String(pValueKey)];
		}
		else
		{
			tmpValues.push(tmpOption.Value);
			this._selectedRecords[String(pValueKey)] = { Value: tmpOption.Value, Text: tmpOption.Text, Tag: tmpOption.Tag, Tags: tmpOption.Tags };
		}
		this._setValue(tmpValues);
		this._renderValue();
		this._renderList();
		if (typeof this.options.OnChange === 'function')
		{
			this.options.OnChange(tmpValues, this.getSelectedRecords());
		}
		// Focus AFTER OnChange: a host that re-marshals inside its handler re-renders the widget and would
		// blow away a focus set before it. onAfterRender also restores focus while open, covering the
		// re-render that does happen; this covers the common case where it does not.
		const tmpSearch = document.getElementById(`PPS_Search_${this.options.PickerHash}`);
		if (tmpSearch) { tmpSearch.focus(); }
	}

	/**
	 * Clearable (AllowClear, single mode): empty the selection — from the control's inline × or the
	 * pinned "Any" dropdown row. Closing mirrors select() (clearing IS a selection: "Any"), and
	 * OnChange(null, null) fires only when there was a value to clear, so clicking "Any" while
	 * already empty just closes the dropdown.
	 */
	clearValue()
	{
		if (this._isMulti()) { return; }
		const tmpValue = this.getValue();
		const tmpHadValue = (tmpValue !== undefined && tmpValue !== null && tmpValue !== '');
		this._selectedText = null;
		this._setValue(null);
		this._search = '';
		this._markClosed();
		this.render();
		if (tmpHadValue && typeof this.options.OnChange === 'function')
		{
			this.options.OnChange(null, null);
		}
	}

	/** @return {Array<{Value:any, Text:string}>} The full record list for the current multi selection. */
	getSelectedRecords()
	{
		return this.getValue().map((pVal) => this._selectedRecords[String(pVal)] || { Value: pVal, Text: String(pVal) });
	}

	/**
	 * Creatable: build a new option from the current search term via OnCreate, then select it (single:
	 * set + close; multi: add a chip). The created record is inserted into the source list so it shows
	 * as a normal, checked option.
	 */
	createFromSearch()
	{
		const tmpTerm = (this._search || '').trim();
		if (!tmpTerm || typeof this.options.OnCreate !== 'function') { return; }
		Promise.resolve(this.options.OnCreate(tmpTerm)).then((pRecord) =>
		{
			if (!pRecord || pRecord.Value === undefined || pRecord.Value === null) { return; }
			// Make the new record part of the source so the list can render it like any other option.
			if (this._isAsync())
			{
				if (!this._loadedResults.some((pRow) => String(pRow.Value) === String(pRecord.Value))) { this._loadedResults.unshift(pRecord); }
			}
			else if (Array.isArray(this.options.Options) && !this.options.Options.some((pRow) => String(pRow.Value) === String(pRecord.Value)))
			{
				this.options.Options.unshift(pRecord);
			}
			this._selectedRecords[String(pRecord.Value)] = { Value: pRecord.Value, Text: pRecord.Text, Tag: pRecord.Tag };

			if (this._isMulti())
			{
				const tmpValues = this.getValue().slice();
				if (!tmpValues.some((pVal) => String(pVal) === String(pRecord.Value))) { tmpValues.push(pRecord.Value); }
				this._setValue(tmpValues);
				this._search = '';
				this._highlight = -1;
				this._renderValue();
				this._renderList();
				const tmpSearchBox = /** @type {HTMLInputElement} */ (document.getElementById(`PPS_Search_${this.options.PickerHash}`));
				if (tmpSearchBox) { tmpSearchBox.value = ''; tmpSearchBox.focus(); }
				if (typeof this.options.OnChange === 'function') { this.options.OnChange(tmpValues, this.getSelectedRecords()); }
			}
			else
			{
				this._selectedText = pRecord.Text;
				this._setValue(pRecord.Value);
				this._search = '';
				this._markClosed();
				this.render();
				if (typeof this.options.OnChange === 'function') { this.options.OnChange(pRecord.Value, pRecord); }
			}
		}).catch((pError) =>
		{
			this.pict.log.warn(`Pict-Section-Picker [${this.options.PickerHash}] OnCreate error.`, pError);
		});
	}

	/** Multi mode: remove a selected value (chip ×). Keeps the dropdown state as-is. */
	removeChip(pValueKey)
	{
		const tmpValues = this.getValue().filter((pVal) => String(pVal) !== String(pValueKey));
		delete this._selectedRecords[String(pValueKey)];
		this._setValue(tmpValues);
		this._renderValue();
		if (this._open) { this._renderList(); }
		if (typeof this.options.OnChange === 'function')
		{
			this.options.OnChange(tmpValues, this.getSelectedRecords());
		}
	}

	/** @param {import('pict-view').Renderable} pRenderable */
	onAfterRender(pRenderable)
	{
		if (this.pict.CSSMap && typeof this.pict.CSSMap.injectCSS === 'function') { this.pict.CSSMap.injectCSS(); }
		// Stamp the painted shape so a later setValue knows if a targeted refresh still fits (_reflectValue).
		this._renderedShape = this._shapeSignature();
		this._paintOpen();
		// A render while open rebuilds a fresh in-widget pop and orphans any portaled one; re-anchoring
		// sweeps the orphan and re-portals, then we restore the search focus the render dropped.
		if (this._open)
		{
			this._applyAnchorMode();
			const tmpSearch = document.getElementById(`PPS_Search_${this.options.PickerHash}`);
			if (tmpSearch && document.activeElement !== tmpSearch) { tmpSearch.focus(); }
		}
		return super.onAfterRender(pRenderable);
	}
}

module.exports = PictViewPicker;

module.exports.default_configuration = _DEFAULT_CONFIGURATION;
