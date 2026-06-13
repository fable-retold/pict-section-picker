const libPictView = require('pict-view');

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
	<div class="pps{~NE:Record.IsMulti^ pps-multi~}" id="PPS_{~D:Record.PickerHash~}">
		<div class="pps-control" role="combobox" tabindex="0" aria-haspopup="listbox" onclick="_Pict.views['{~D:Record.PickerHash~}'].toggle(event)" onkeydown="_Pict.views['{~D:Record.PickerHash~}'].onControlKey(event)">
			<div class="pps-valuearea" id="PPS_Value_{~D:Record.PickerHash~}">{~T:Pict-Section-Picker-ValueArea~}</div>
			{~TS:Pict-Section-Picker-ClearX:Record.ClearSlot~}
			<span class="pps-chevron">{~I:ChevronDown~}</span>
		</div>
		<div class="pps-backdrop" onclick="_Pict.views['{~D:Record.PickerHash~}'].close()"></div>
		<div class="pps-pop">
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
			// Value PRESENCE only changes through full renders (select / clearValue / setValue), so it
			// never goes stale outside the value-area's targeted repaint. stopPropagation so clearing
			// never bubbles into the control's open/close toggle — mirrors the multi-chip remove ×.
			Hash: 'Pict-Section-Picker-ClearX',
			Template: /*html*/`
	<span class="pps-clear" title="Clear" onclick="event.stopPropagation(); _Pict.views['{~D:Record.PickerHash~}'].clearValue()">{~I:Close~}</span>
`
		},
		{
			Hash: 'Pict-Section-Picker-Single',
			Template: /*html*/`
	<span class="pps-valuebox">{~TS:Pict-Section-Picker-Tag:Record.TagBeforeSlot~}<span class="pps-value{~NE:Record.NoValue^ pps-placeholder~}">{~D:Record.DisplayText~}</span>{~TS:Pict-Section-Picker-Tag:Record.TagAfterSlot~}</span>
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
	<span class="pps-chip">{~TS:Pict-Section-Picker-Tag:Record.TagBeforeSlot~}<span class="pps-chip-text" title="{~D:Record.Text~}">{~D:Record.Text~}</span>{~TS:Pict-Section-Picker-Tag:Record.TagAfterSlot~}<span class="pps-chip-x" onclick="event.stopPropagation(); _Pict.views['{~D:Record.PickerHash~}'].removeChip('{~D:Record.ValueKey~}')">{~I:Close~}</span></span>
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
		this.render();
		return this;
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
					{ PickerHash: this.options.PickerHash, ValueKey: String(pVal), Text: tmpRecord ? tmpRecord.Text : String(pVal) },
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

	/** Open the dropdown and focus the search box. */
	open()
	{
		this._open = true;
		this._highlight = -1;
		this._paintOpen();
		this._positionPop();
		if (this._isAsync() && !this._loaded) { this._loadPage(0, false); }
		const tmpSearch = /** @type {HTMLInputElement} */ (document.getElementById(`PPS_Search_${this.options.PickerHash}`));
		if (tmpSearch) { tmpSearch.focus(); tmpSearch.select(); }
	}

	/**
	 * Position the (fixed) dropdown against the control, flipping above when there's more room there.
	 * Because the popover is position:fixed (viewport-anchored), no ancestor overflow can clip it; the
	 * trade-off is we set its top/left/width ourselves from the control's rect on open.
	 */
	_positionPop()
	{
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		if (!tmpRoot) { return; }
		const tmpControl = tmpRoot.querySelector('.pps-control');
		const tmpPop = /** @type {HTMLElement} */ (tmpRoot.querySelector('.pps-pop'));
		const tmpPanel = /** @type {HTMLElement} */ (tmpRoot.querySelector('.pps-panel'));
		if (!tmpControl || !tmpPop) { return; }
		const tmpRect = tmpControl.getBoundingClientRect();
		const tmpGap = 5;
		const tmpMargin = 8;
		const tmpVH = window.innerHeight;
		const tmpVW = window.innerWidth;
		const tmpWidth = Math.max(200, Math.round(tmpRect.width));
		tmpPop.style.width = `${tmpWidth}px`;
		tmpPop.style.left = `${Math.round(Math.max(tmpMargin, Math.min(tmpRect.left, tmpVW - tmpWidth - tmpMargin)))}px`;
		tmpPop.style.right = 'auto';
		const tmpSpaceBelow = tmpVH - tmpRect.bottom - tmpGap - tmpMargin;
		const tmpSpaceAbove = tmpRect.top - tmpGap - tmpMargin;
		// Prefer the natural downward direction; only flip above when the room below is genuinely cramped.
		if (tmpSpaceBelow >= 200 || tmpSpaceBelow >= tmpSpaceAbove)
		{
			tmpPop.style.top = `${Math.round(tmpRect.bottom + tmpGap)}px`;
			tmpPop.style.bottom = 'auto';
			if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(140, Math.min(tmpSpaceBelow, 360))}px`; }
		}
		else
		{
			tmpPop.style.top = 'auto';
			tmpPop.style.bottom = `${Math.round(tmpVH - tmpRect.top + tmpGap)}px`;
			if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(140, Math.min(tmpSpaceAbove, 360))}px`; }
		}
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
		this._open = false;
		this._highlight = -1;
		this._paintOpen();
	}

	/** Reflect the open/closed state on the widget container. */
	_paintOpen()
	{
		const tmpRoot = document.getElementById(`PPS_${this.options.PickerHash}`);
		if (tmpRoot) { tmpRoot.classList.toggle('pps-open', !!this._open); }
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
			this._open = false;
			this._highlight = -1;
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
		const tmpSearch = document.getElementById(`PPS_Search_${this.options.PickerHash}`);
		if (tmpSearch) { tmpSearch.focus(); }
		if (typeof this.options.OnChange === 'function')
		{
			this.options.OnChange(tmpValues, this.getSelectedRecords());
		}
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
		this._open = false;
		this._highlight = -1;
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
				this._open = false;
				this._highlight = -1;
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
		this._paintOpen();
		return super.onAfterRender(pRenderable);
	}
}

module.exports = PictViewPicker;

module.exports.default_configuration = _DEFAULT_CONFIGURATION;
