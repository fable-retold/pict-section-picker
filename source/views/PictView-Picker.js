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
		// True while the panel is portaled out to <body> because a clipping ancestor would cut it off,
		// rather than anchored in place by CSS. Decided per open by _applyAnchorMode().
		this._portaled = false;
		// The _shapeSignature() of what is currently painted, stamped by onAfterRender. Null until the
		// first render, so a setValue before the widget exists falls through to a full build.
		this._renderedShape = null;
		// Multi-mode state: the authoritative {Value,Text} for each selected value, keyed by String(Value),
		// so a chip keeps its label even after the search results that produced it have scrolled away.
		this._values = [];
		this._selectedRecords = {};

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
	 * Reflect the current value into the DOM after a programmatic setValue. The first call — widget not
	 * yet in the DOM — does the full build; once the widget is live it refreshes the value area and the
	 * option list (whose selected-row checkmark tracks the value) but nothing else. A form host re-runs
	 * the mount + setValue on every marshal, and a full render there would rebuild the search box
	 * (dropping a mid-search focus) and orphan a portaled panel; the targeted path avoids both.
	 * select()/clearValue() keep their own full renders — this is only the setValue path.
	 */
	_reflectValue()
	{
		const tmpLive = (typeof document !== 'undefined') && !!document.getElementById(`PPS_${this.options.PickerHash}`);
		// Full build when the widget isn't in the DOM yet, and a full render whenever anything OUTSIDE the
		// value area / list would change — the targeted path cannot repaint those (see _shapeSignature).
		if (!tmpLive || (this._shapeSignature() !== this._renderedShape)) { this.render(); return; }
		this._renderValue();
		// Refresh the list too, even while closed: its selected-row checkmark tracks the value, and the
		// list container is a hidden sibling of the search box + pop, so rebuilding it keeps the mark in
		// step on the NEXT open without tearing down the search box (losing focus) or orphaning a portal.
		this._renderList();
	}

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
			}, this._tagSlots(this._recordTags(pOption), tmpTagLast));
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
		// Single-element-array conditionals (render the search box / "Load more" only when applicable).
		tmpState.SearchSlot = this.options.Searchable ? [ { PickerHash: this.options.PickerHash } ] : [];
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

	/**
	 * Take the provider's single-active slot, closing whichever sibling holds it. Only pickers that opted
	 * in participate — a picker with SingleActivePicker off neither claims the slot nor is closed by one
	 * that does. The slot holds a HASH, not a view, and lives on the provider rather than the module, so
	 * two pict instances sharing this module can't close each other's dropdowns.
	 */
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

	/**
	 * The dropdown panel, wherever it currently lives — inside its widget, or out on <body> while
	 * portaled. Resolved by position rather than by id: a re-render can briefly leave two panels sharing
	 * the id (the fresh one in the widget, the portaled one still on body), and which of those
	 * getElementById hands back is not something to depend on. The in-widget panel always wins, because
	 * after a re-render it is the live one and any portaled copy is a leftover.
	 * @return {HTMLElement|null}
	 */
	_popElement()
	{
		if (typeof document === 'undefined') { return null; }
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		const tmpInWidget = tmpRoot ? /** @type {HTMLElement} */ (tmpRoot.querySelector('.pps-pop')) : null;
		if (tmpInWidget) { return tmpInWidget; }
		return /** @type {HTMLElement} */ (document.querySelector(`body > [id="PPS_Pop_${this.options.PickerHash}"]`));
	}

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
	_applyAnchorMode()
	{
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		const tmpPop = this._popElement();
		if (!tmpPop) { return; }
		const tmpControl = tmpRoot ? /** @type {HTMLElement} */ (tmpRoot.querySelector('.pps-control')) : null;
		this._portaled = !!tmpControl && this._shouldPortal(tmpControl);
		if (this._portaled) { this._portalPop(tmpPop); }
		else { this._restorePop(tmpPop); }
		// Keep the pop's open-state class in step with the anchoring it just took (portaled panels are
		// hidden until this class is set, since the widget's .pps-open rule can't reach them on <body>).
		tmpPop.classList.toggle('pps-pop-open', !!this._open);
	}

	/**
	 * Move the panel out to <body> and place it against the control in document coordinates (viewport
	 * rect + scroll offset), flipping above when the room below is short. Width is pinned to the
	 * control's, since the panel no longer inherits it by sitting inside the widget.
	 * @param {HTMLElement} pPop
	 */
	_portalPop(pPop)
	{
		if (typeof document === 'undefined') { return; }
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		const tmpControl = tmpRoot ? tmpRoot.querySelector('.pps-control') : null;
		if (!tmpControl) { return; }
		// A re-render while portaled builds a fresh panel inside the widget and leaves the portaled copy
		// on <body> carrying the same id — sweep any stale copy before adopting this one, or duplicate
		// ids would linger and getElementById could hand back the wrong panel (or search box).
		document.querySelectorAll(`body > [id="PPS_Pop_${this.options.PickerHash}"]`)
			.forEach((pNode) => { if (pNode !== pPop) { pNode.remove(); } });
		if (pPop.parentElement !== document.body) { document.body.appendChild(pPop); }
		pPop.classList.add('pps-pop-portal');

		// The panel no longer inherits from a container that may have scoped the theme tokens, so carry
		// the RESOLVED values across with it — otherwise a host that scopes --theme-color-* to a wrapper
		// (not :root) would see the built-in hex fallbacks the moment the panel portals. Read off the
		// control, which stays inside the scope. A token the host never
		// defined reads empty and is skipped — pinning it to "" would satisfy the var(--token, #hex) lookup
		// and defeat the built-in fallback.
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
		// Document coordinates: viewport rect + the current scroll offset. Absolute against <body> means
		// the browser moves it with the document from here on, so one placement is enough.
		pPop.style.top = tmpBelow
			? `${Math.round(tmpRect.bottom + tmpGap + window.scrollY)}px`
			: `${Math.round(tmpRect.top - tmpGap + window.scrollY)}px`;
		if (!tmpBelow) { pPop.style.transform = 'translateY(-100%)'; }
		else { pPop.style.transform = ''; }
		if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(0, Math.round(Math.min(tmpBelow ? tmpSpaceBelow : tmpSpaceAbove, tmpIdeal)))}px`; }
	}

	/**
	 * Put a portaled panel back inside its widget and drop everything the portal wrote. Also the orphan
	 * sweeper: a re-render rebuilds .pps with a fresh panel, so a portaled one left on <body> is stale
	 * and must be discarded rather than re-homed.
	 * @param {HTMLElement} pPop
	 */
	_restorePop(pPop)
	{
		if (typeof document === 'undefined' || !pPop) { return; }
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		if (pPop.parentElement === document.body)
		{
			if (!tmpRoot) { pPop.remove(); return; }
			// A re-render already replaced this panel inside the widget — the portaled one is a leftover.
			if (tmpRoot.querySelector('.pps-pop') && tmpRoot.querySelector('.pps-pop') !== pPop) { pPop.remove(); return; }
			tmpRoot.appendChild(pPop);
		}
		pPop.classList.remove('pps-pop-portal');
		// Inline offsets beat the stylesheet, so they must go or they would strand the panel at the
		// coordinates of whatever context it was placed in before.
		pPop.style.top = '';
		pPop.style.left = '';
		pPop.style.right = '';
		pPop.style.bottom = '';
		pPop.style.width = '';
		pPop.style.transform = '';
		// Drop the theme tokens the portal copied on, so back inside its widget the panel inherits them
		// live again rather than freezing whatever value was resolved at portal time.
		_THEME_TOKENS.forEach((pToken) => pPop.style.removeProperty(pToken));
		const tmpPanel = /** @type {HTMLElement} */ (pPop.querySelector('.pps-panel'));
		if (tmpPanel) { tmpPanel.style.maxHeight = ''; }
	}

	/**
	 * Whether this open should portal the panel out to <body>: true when ANY clipping ancestor above the
	 * control would actually cut the panel (_clipBites). A dropdown with room to open in place stays on
	 * the CSS path even inside a scroll container — an overflow ancestor alone is not enough — but one
	 * roomy clipper does not excuse a tighter one further out. Judged from the control, which never moves.
	 * @param {HTMLElement} pControl
	 * @return {boolean}
	 */
	_shouldPortal(pControl)
	{
		// EVERY clipping ancestor, not just the nearest: a panel can sit comfortably inside a large
		// overflow:hidden wrapper (a rounded-corner card, say) and still be cut by that wrapper's own
		// scrolling ancestor. Testing only the innermost would call that safe. _clippingAncestor starts
		// from pElement.parentElement, so feeding it the clipper it just returned continues the walk out.
		let tmpClipper = this._clippingAncestor(pControl);
		while (tmpClipper)
		{
			if (this._clipBites(pControl, tmpClipper)) { return true; }
			tmpClipper = this._clippingAncestor(tmpClipper);
		}
		return false;
	}

	/**
	 * The nearest ancestor between the element and the body that establishes an overflow clip (overflow
	 * on any axis != visible), or null. Stops at body: the document's own scrolling is what the absolute
	 * anchoring rides on, not a clip.
	 * @param {HTMLElement} pElement
	 * @return {HTMLElement|null}
	 */
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

	/**
	 * Whether the clipper would cut the panel if it opened in place. The CSS path always opens DOWNWARD
	 * (top: calc(100% + gap)) and never flips, clamped to its own max-height — so project that worst-case
	 * box below the control and ask whether any edge falls outside the clipper's box. When it fits, the
	 * CSS path is safe; when it doesn't, only the portal (which can flip above and escape) will do. A
	 * pixel of slack keeps a flush edge from forcing a needless portal on sub-pixel rounding.
	 * @param {HTMLElement} pControl @param {HTMLElement} pClipper @return {boolean}
	 */
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

	/**
	 * Mark the dropdown closed: the transient open state, the provider's active-picker slot, and the
	 * loaded-results cache. Shared by every path that closes the dropdown (close(), a single-mode select,
	 * clearValue, createFromSearch) so none of them can leave a stale active-picker reference or serve
	 * results from a scope that has since changed.
	 */
	_markClosed()
	{
		this._open = false;
		this._highlight = -1;
		const tmpProvider = this.options.PickerProvider;
		if (tmpProvider && tmpProvider.currentOpenPickerHash === this.options.PickerHash) { tmpProvider.currentOpenPickerHash = false; }
		// Bring a portaled panel home, so a closed picker never leaves a stray element on <body>.
		if (this._portaled) { this._restorePop(this._popElement()); this._portaled = false; }
		// Drop the accumulated pages so the next open re-queries. BaseFilter is resolved per query
		// precisely because the host's contextual scope changes underneath the picker (a "Show All"
		// toggle, a dependent-field pick), and caching results across a close would serve the old scope.
		// The legacy select2 adapter re-queried on every open for the same reason; matching it keeps
		// hosts from needing any cache-invalidation hook at all.
		this._loaded = false;
		this._loadedResults = [];
		this._page = 0;
		this._hasMore = false;
		// Release the back-off bookkeeping too: it only spans page 0 → "load more" within one open
		// session (like the result cache above), so bounding it to open pickers keeps the provider map
		// from growing an entry per picker for the life of a long-lived, never-refreshed page.
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

	/**
	 * Release everything this picker holds outside its own DOM subtree, for a host that tears the view
	 * down. pict-view has no destroy lifecycle, so this is opt-in — call it before dropping the view.
	 * The un-destroyed case is already harmless: a portaled panel is hidden unless `pps-pop-open` is set
	 * (so a stray one shows nothing), and its back-off / single-active state is released on close.
	 */
	destroy()
	{
		// _markClosed already drops the single-active slot if held, brings a portaled panel home (or
		// removes it when the widget root is gone), and clears the back-off entry.
		this._markClosed();
		this._paintOpen();
		// If a portaled panel is somehow still on <body> — e.g. the widget root was detached mid-teardown
		// before this ran — take it with us rather than leaving an orphan.
		if (typeof document !== 'undefined')
		{
			const tmpStray = document.querySelector(`body > [id="PPS_Pop_${this.options.PickerHash}"]`);
			if (tmpStray) { tmpStray.remove(); }
		}
	}

	/** Reflect the open/closed state on the widget container. Also stamp the pop element itself, since a
	 *  portaled panel is no longer a descendant of `.pps-open` and the stylesheet's open rule can't reach
	 *  it — its visibility keys off `pps-pop-open` instead, so a stray portaled panel stays hidden. */
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

	/**
	 * @param {import('pict-view').Renderable} pRenderable
	 */
	onAfterRender(pRenderable)
	{
		if (this.pict.CSSMap && typeof this.pict.CSSMap.injectCSS === 'function') { this.pict.CSSMap.injectCSS(); }
		// Stamp what this render painted, so a later setValue can tell whether a targeted refresh is
		// still sufficient (_reflectValue). Targeted refreshes don't change the shape, so they don't
		// restamp it — only a full render does.
		this._renderedShape = this._shapeSignature();
		this._paintOpen();
		// Re-anchor when we re-render WHILE open (RenderMethod 'replace' — e.g. a host form re-marshalling
		// after a multi-select committed its value). The default CSS anchoring survives a render on its
		// own, but a portaled panel does not: the render builds a fresh one inside the widget and leaves
		// the portaled copy orphaned on <body>. Re-deciding the mode sweeps the orphan and re-portals.
		if (this._open)
		{
			this._applyAnchorMode();
			// Restore the search focus the re-render just dropped, so typing survives a marshal mid-search.
			const tmpSearch = document.getElementById(`PPS_Search_${this.options.PickerHash}`);
			if (tmpSearch && document.activeElement !== tmpSearch) { tmpSearch.focus(); }
		}
		return super.onAfterRender(pRenderable);
	}
}

module.exports = PictViewPicker;

module.exports.default_configuration = _DEFAULT_CONFIGURATION;
