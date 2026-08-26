const libPictApplication = require('pict-application');

// The module under test — required by relative path so edits to source/ land in the build.
const libPictSectionPicker = require('../../../source/Pict-Section-Picker.js');

const _Countries =
[
	{ Value: 'us', Text: 'United States' },
	{ Value: 'ca', Text: 'Canada' },
	{ Value: 'mx', Text: 'Mexico' },
	{ Value: 'br', Text: 'Brazil' },
	{ Value: 'gb', Text: 'United Kingdom' },
	{ Value: 'fr', Text: 'France' },
	{ Value: 'de', Text: 'Germany' },
	{ Value: 'es', Text: 'Spain' },
	{ Value: 'it', Text: 'Italy' },
	{ Value: 'jp', Text: 'Japan' },
	{ Value: 'kr', Text: 'South Korea' },
	{ Value: 'cn', Text: 'China' },
	{ Value: 'in', Text: 'India' },
	{ Value: 'au', Text: 'Australia' },
	{ Value: 'za', Text: 'South Africa' },
	{ Value: 'eg', Text: 'Egypt' },
	{ Value: 'ng', Text: 'Nigeria' },
	{ Value: 'ar', Text: 'Argentina' },
	{ Value: 'cl', Text: 'Chile' },
	{ Value: 'se', Text: 'Sweden' },
];

class PickerDemoApplication extends libPictApplication
{
	onAfterInitializeAsync(fCallback)
	{
		this.pict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);

		this.pict.AppData.Demo = { Country: 'jp' };

		const tmpPicker = this.pict.providers['Pict-Section-Picker'];
		tmpPicker.createPicker('CountryPicker',
			{
				DestinationAddress: '#CountryPicker',
				ValueAddress: 'AppData.Demo.Country',
				Placeholder: 'Select a country…',
				Options: _Countries,
				OnChange: (pValue) =>
				{
					this.pict.ContentAssignment.assignContent('#CountryValue', `Selected value: <code>${pValue}</code>`);
				},
			});

		this.pict.views['CountryPicker'].render();
		this.pict.ContentAssignment.assignContent('#CountryValue', `Selected value: <code>${this.pict.AppData.Demo.Country}</code>`);

		// --- Async picker (Phase 2): a mock server-paginated source (120 items, pageSize 20, ~200ms latency). ---
		const tmpItems = [];
		for (let i = 1; i <= 120; i++) { tmpItems.push({ Value: i, Text: `Item ${('00' + i).slice(-3)}` }); }
		const tmpMockProvider = (pSearch, pPage) => new Promise((resolve) =>
		{
			setTimeout(() =>
			{
				const tmpFiltered = pSearch ? tmpItems.filter((pItem) => pItem.Text.toLowerCase().indexOf(pSearch.toLowerCase()) >= 0) : tmpItems;
				const tmpStart = pPage * 20;
				resolve({ results: tmpFiltered.slice(tmpStart, tmpStart + 20), hasMore: (tmpStart + 20) < tmpFiltered.length });
			}, 200);
		});

		tmpPicker.createPicker('ItemPicker',
			{
				DestinationAddress: '#ItemPicker',
				ValueAddress: 'AppData.Demo.Item',
				Placeholder: 'Search items…',
				DataProvider: tmpMockProvider,
				PageSize: 20,
				OnChange: (pValue) =>
				{
					this.pict.ContentAssignment.assignContent('#ItemValue', `Selected value: <code>${pValue}</code>`);
				},
			});
		this.pict.views['ItemPicker'].render();

		// --- Entity-backed picker (Phase 2 adapter): the real Meadow path. Talks to the live Bookstore
		//     harness (Author entity, 6129 records) through pict.EntityProvider at urlPrefix /1.0/.
		//     Pre-bind IDAuthor 2 so ResolveValue resolves "J.K. Rowling" into the control on load. ---
		this.pict.AppData.Demo.Author = 2;
		tmpPicker.createEntityPicker('AuthorPicker',
			{
				Entity: 'Author',
				SearchFields: [ 'Name' ],
				ValueField: 'IDAuthor',
				TextField: 'Name',
				PageSize: 10,
				DestinationAddress: '#AuthorPicker',
				ValueAddress: 'AppData.Demo.Author',
				Placeholder: 'Search authors…',
				OnChange: (pValue, pRecord) =>
				{
					this.pict.ContentAssignment.assignContent('#AuthorValue', `Selected value: <code>${pValue}</code> — ${pRecord ? pRecord.Text : ''}`);
				},
			});
		this.pict.views['AuthorPicker'].render();

		// --- Multi-select, static options (Phase 3): chips + toggle + placeholder. ---
		this.pict.AppData.Demo.Countries = [ 'jp', 'br' ];
		tmpPicker.createPicker('CountriesPicker',
			{
				Mode: 'multi',
				DestinationAddress: '#CountriesPicker',
				ValueAddress: 'AppData.Demo.Countries',
				Placeholder: 'Add countries…',
				Options: _Countries,
				OnChange: (pValues) =>
				{
					this.pict.ContentAssignment.assignContent('#CountriesValue', `Selected: <code>${JSON.stringify(pValues)}</code>`);
				},
			});
		this.pict.views['CountriesPicker'].render();
		this.pict.ContentAssignment.assignContent('#CountriesValue', `Selected: <code>${JSON.stringify(this.pict.AppData.Demo.Countries)}</code>`);

		// --- Multi-select, entity-backed (Phase 3 + Phase 2 adapter): chips from the live harness.
		//     Pre-bind two IDs so multi ResolveValue resolves both names into chips on load. ---
		this.pict.AppData.Demo.Authors = [ 2, 10 ];
		tmpPicker.createEntityPicker('AuthorsPicker',
			{
				Mode: 'multi',
				Entity: 'Author',
				SearchFields: [ 'Name' ],
				ValueField: 'IDAuthor',
				TextField: 'Name',
				PageSize: 10,
				DestinationAddress: '#AuthorsPicker',
				ValueAddress: 'AppData.Demo.Authors',
				StringArrayValueAddress: 'AppData.Demo.AuthorsCSV',
				SelectedValuesAddress: 'AppData.Demo.AuthorsRecords',
				Placeholder: 'Add authors…',
				OnChange: (pValues) =>
				{
					this.pict.ContentAssignment.assignContent('#AuthorsValue', `Selected IDs: <code>${JSON.stringify(pValues)}</code>`);
				},
			});
		this.pict.views['AuthorsPicker'].render();

		// --- Categorized single-select (Phase 4): options carry a Group → headered sections. ---
		const _Regions =
		[
			{ Value: 'us', Text: 'United States', Group: 'Americas' },
			{ Value: 'ca', Text: 'Canada', Group: 'Americas' },
			{ Value: 'br', Text: 'Brazil', Group: 'Americas' },
			{ Value: 'gb', Text: 'United Kingdom', Group: 'Europe' },
			{ Value: 'fr', Text: 'France', Group: 'Europe' },
			{ Value: 'de', Text: 'Germany', Group: 'Europe' },
			{ Value: 'jp', Text: 'Japan', Group: 'Asia' },
			{ Value: 'cn', Text: 'China', Group: 'Asia' },
			{ Value: 'in', Text: 'India', Group: 'Asia' },
		];
		this.pict.AppData.Demo.Region = 'fr';
		tmpPicker.createPicker('RegionPicker',
			{
				DestinationAddress: '#RegionPicker',
				ValueAddress: 'AppData.Demo.Region',
				Placeholder: 'Pick a country…',
				Options: _Regions,
				OnChange: (pValue) =>
				{
					this.pict.ContentAssignment.assignContent('#RegionValue', `Selected value: <code>${pValue}</code>`);
				},
			});
		this.pict.views['RegionPicker'].render();
		this.pict.ContentAssignment.assignContent('#RegionValue', `Selected value: <code>${this.pict.AppData.Demo.Region}</code>`);

		// --- Creatable multi-select (Phase 4): "tags" you can both pick and invent via OnCreate. ---
		this.pict.AppData.Demo.Tags = [ 'urgent' ];
		let tmpCreatedTagSeq = 0;
		tmpPicker.createPicker('TagsPicker',
			{
				Mode: 'multi',
				DestinationAddress: '#TagsPicker',
				ValueAddress: 'AppData.Demo.Tags',
				Placeholder: 'Add or create tags…',
				Options:
				[
					{ Value: 'urgent', Text: 'urgent' },
					{ Value: 'review', Text: 'review' },
					{ Value: 'blocked', Text: 'blocked' },
				],
				OnCreate: (pTerm) =>
				{
					tmpCreatedTagSeq++;
					// Mint a new tag record; a real app would POST it and return the saved row (may be async).
					return { Value: `tag-${tmpCreatedTagSeq}-${pTerm.toLowerCase().replace(/\s+/g, '-')}`, Text: pTerm };
				},
				OnChange: (pValues) =>
				{
					this.pict.ContentAssignment.assignContent('#TagsValue', `Tags: <code>${JSON.stringify(pValues)}</code>`);
				},
			});
		this.pict.views['TagsPicker'].render();
		this.pict.ContentAssignment.assignContent('#TagsValue', `Tags: <code>${JSON.stringify(this.pict.AppData.Demo.Tags)}</code>`);

		// --- Contextual scoping (Phase 3 enabler): BaseFilter as a FUNCTION, re-evaluated every search.
		//     The host injects a dynamic scope (here a mutable demo var) without the module knowing it. ---
		this.pict.AppData.Demo.AuthorScope = '';   // e.g. set to 'FBV~IDAuthor~GT~1000' to scope the search
		tmpPicker.createEntityPicker('ScopedAuthorPicker',
			{
				Entity: 'Author',
				SearchFields: [ 'Name' ],
				ValueField: 'IDAuthor',
				TextField: 'Name',
				PageSize: 10,
				BaseFilter: () => this.pict.AppData.Demo.AuthorScope,   // resolved per search
				DestinationAddress: '#ScopedAuthorPicker',
				ValueAddress: 'AppData.Demo.ScopedAuthor',
				Placeholder: 'Search authors (scoped)…',
			});
		this.pict.views['ScopedAuthorPicker'].render();

		// --- Programmatic control (public setValue API): drive the control from OUTSIDE, the way a host
		//     form marshals a value INTO the picker during onDataMarshalToForm. setValue() does NOT fire
		//     OnChange (it's a programmatic set, not a user pick), so the buttons refresh the readout
		//     themselves via _showProgrammatic(). ---
		this.pict.AppData.Demo.ProgCountry = '';
		tmpPicker.createPicker('ProgCountryPicker',
			{
				DestinationAddress: '#ProgCountryPicker',
				ValueAddress: 'AppData.Demo.ProgCountry',
				Placeholder: 'Set me with the buttons →',
				Options: _Countries,
				// AllowClear puts an inline × on the control whenever a value is set. That × renders OUTSIDE
				// the value area, so it's the thing a targeted re-seed can't repaint — which makes these
				// buttons a live check that setValue falls back to a full render when presence flips.
				AllowClear: true,
				OnChange: () => this._showProgrammatic(),
			});
		this.pict.views['ProgCountryPicker'].render();
		this._watchReflectPath('ProgCountryPicker', '#ProgReflectMode');

		this.pict.AppData.Demo.ProgTags = [];
		tmpPicker.createPicker('ProgTagsPicker',
			{
				Mode: 'multi',
				DestinationAddress: '#ProgTagsPicker',
				ValueAddress: 'AppData.Demo.ProgTags',
				SelectedValuesAddress: 'AppData.Demo.ProgTagsRecords',
				Placeholder: 'Set me with the buttons →',
				Options:
				[
					{ Value: 'urgent', Text: 'Urgent' },
					{ Value: 'review', Text: 'Review' },
					{ Value: 'blocked', Text: 'Blocked' },
				],
				OnChange: () => this._showProgrammatic(),
			});
		this.pict.views['ProgTagsPicker'].render();
		this._showProgrammatic();

		// --- Anchoring: the same picker in a clean row and inside a scrolling wrapper. The panel is
		//     CSS-absolute against its control by default (it rides the page on scroll for free); only
		//     when an ancestor clips does the view fall back to viewport anchoring and place it once.
		//     The two pickers here differ ONLY in what they sit inside. ---
		tmpPicker.createPicker('AnchorPlainPicker',
			{
				DestinationAddress: '#AnchorPlainPicker',
				ValueAddress: 'AppData.Demo.AnchorPlain',
				Placeholder: 'Open me, then scroll the page…',
				Options: _Countries,
			});
		this.pict.views['AnchorPlainPicker'].render();
		this._watchAnchorMode('AnchorPlainPicker', '#AnchorPlainMode');

		tmpPicker.createPicker('AnchorClippedPicker',
			{
				DestinationAddress: '#AnchorClippedPicker',
				ValueAddress: 'AppData.Demo.AnchorClipped',
				Placeholder: 'Open me, then scroll…',
				Options: _Countries,
			});
		this.pict.views['AnchorClippedPicker'].render();
		this._watchAnchorMode('AnchorClippedPicker', '#AnchorClippedMode');

		// Nested clippers: a tall overflow:hidden card (the panel clears it) inside a short scrolling pane
		// (the panel does not). Only checking the nearest ancestor would leave this one clipped.
		tmpPicker.createPicker('AnchorNestedPicker',
			{
				DestinationAddress: '#AnchorNestedPicker',
				ValueAddress: 'AppData.Demo.AnchorNested',
				Placeholder: 'Open me — I clear the card, not the pane…',
				Options: _Countries,
			});
		this.pict.views['AnchorNestedPicker'].render();
		this._watchAnchorMode('AnchorNestedPicker', '#AnchorNestedMode');

		// --- Single-active fleet: two opted in, one deliberately not. The opt-out must be untouched in
		//     both directions — it neither closes a participant nor is closed by one. ---
		const fSoloReadout = () =>
		{
			const tmpOpen = [ 'SoloAPicker', 'SoloBPicker', 'SoloPlainPicker' ].filter((pHash) => this.pict.views[pHash]._open);
			this.pict.ContentAssignment.assignContent('#SoloValue',
				`open right now: <code>${tmpOpen.length ? tmpOpen.join(', ') : 'none'}</code>`);
		};
		[
			{ Hash: 'SoloAPicker', Placeholder: 'Opted in (A)…', SingleActive: true },
			{ Hash: 'SoloBPicker', Placeholder: 'Opted in (B)…', SingleActive: true },
			{ Hash: 'SoloPlainPicker', Placeholder: 'Opted OUT — stacks freely…', SingleActive: false },
		].forEach((pSpec) =>
		{
			tmpPicker.createPicker(pSpec.Hash,
				{
					DestinationAddress: `#${pSpec.Hash}`,
					ValueAddress: `AppData.Demo.${pSpec.Hash}`,
					Placeholder: pSpec.Placeholder,
					Options: _Countries,
					SingleActivePicker: pSpec.SingleActive,
					OnChange: fSoloReadout,
				});
			const tmpView = this.pict.views[pSpec.Hash];
			tmpView.render();
			// Repaint the readout after any open/close so the fleet behavior is visible as it happens.
			const fOpen = tmpView.open.bind(tmpView);
			const fClose = tmpView.close.bind(tmpView);
			tmpView.open = () => { fOpen(); fSoloReadout(); };
			tmpView.close = () => { fClose(); fSoloReadout(); };
		});
		fSoloReadout();

		// --- Cache lifetime: an out-of-band scope change, with nothing invalidating anything. The picker
		//     drops its loaded pages on close, so the next open re-queries and re-reads the scope var.
		//     The query counter proves the reopen actually hit the DataProvider. ---
		this.pict.AppData.Demo.ItemScopeEvensOnly = false;
		this.pict.AppData.Demo.ItemQueries = 0;
		tmpPicker.createPicker('ScopeItemPicker',
			{
				DestinationAddress: '#ScopeItemPicker',
				ValueAddress: 'AppData.Demo.ScopeItem',
				Placeholder: 'Search items…',
				PageSize: 20,
				DataProvider: (pSearch, pPage) => new Promise((resolve) =>
				{
					this.pict.AppData.Demo.ItemQueries++;
					this._showScope();
					// Read the scope AT QUERY TIME — the same contract BaseFilter has for entity pickers.
					const tmpScoped = this.pict.AppData.Demo.ItemScopeEvensOnly
						? tmpItems.filter((pItem) => (pItem.Value % 2) === 0)
						: tmpItems;
					const tmpFiltered = pSearch ? tmpScoped.filter((pItem) => pItem.Text.toLowerCase().indexOf(pSearch.toLowerCase()) >= 0) : tmpScoped;
					const tmpStart = (pPage || 0) * 20;
					resolve({ results: tmpFiltered.slice(tmpStart, tmpStart + 20), hasMore: (tmpStart + 20) < tmpFiltered.length });
				}),
			});
		this.pict.views['ScopeItemPicker'].render();
		this._showScope();

		// --- Escaped / special-character values (regression): option values carrying a double quote
		//     (inch marks like 1"), an apostrophe, an ampersand, or a `<`. Before the data-attribute fix
		//     the raw value was inlined into the option / chip onclick (`select('1"')`), so the `"` closed
		//     the attribute and the browser threw "Uncaught SyntaxError: Invalid or unexpected token" the
		//     moment the option list rendered — the control was dead. Now the value rides in an HTML-escaped
		//     `data-` attribute the handler reads back, so it round-trips exactly. Both are pre-seeded so the
		//     value box (single) and the chips (multi) render their escaped values on load, not just on open.
		const _SpecialOptions =
		[
			{ Value: '1"', Text: '1"' },
			{ Value: '2"', Text: '2"' },
			{ Value: '4"', Text: '4"' },
			{ Value: '6"', Text: '6"' },
			{ Value: 'O\'Brien & Sons', Text: 'O\'Brien & Sons' },
			{ Value: 'a <b> "wide"', Text: 'a <b> "wide"' },
		];
		this.pict.AppData.Demo.SpecialChars = '2"';
		this.pict.AppData.Demo.SpecialCharsMulti = [ '1"', 'O\'Brien & Sons' ];
		const fEscapeDemo = (pValue) => String((pValue === null || pValue === undefined) ? '' : pValue)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		const fSpecialReadout = (pSelector, pValue) =>
		{
			const tmpText = Array.isArray(pValue)
				? (pValue.length ? pValue.map(fEscapeDemo).join(', ') : '(none)')
				: ((pValue === '' || pValue === undefined || pValue === null) ? '(none)' : fEscapeDemo(pValue));
			this.pict.ContentAssignment.assignContent(pSelector, `Selected value: <code>${tmpText}</code>`);
		};
		tmpPicker.createPicker('SpecialCharsPicker',
			{
				DestinationAddress: '#SpecialCharsPicker',
				ValueAddress: 'AppData.Demo.SpecialChars',
				Placeholder: 'Pick a width…',
				Options: _SpecialOptions,
				OnChange: (pValue) => fSpecialReadout('#SpecialCharsValue', pValue),
			});
		this.pict.views['SpecialCharsPicker'].render();
		fSpecialReadout('#SpecialCharsValue', this.pict.AppData.Demo.SpecialChars);

		tmpPicker.createPicker('SpecialCharsMultiPicker',
			{
				Mode: 'multi',
				DestinationAddress: '#SpecialCharsMultiPicker',
				ValueAddress: 'AppData.Demo.SpecialCharsMulti',
				Placeholder: 'Pick widths…',
				Options: _SpecialOptions,
				OnChange: (pValue) => fSpecialReadout('#SpecialCharsMultiValue', pValue),
			});
		this.pict.views['SpecialCharsMultiPicker'].render();
		fSpecialReadout('#SpecialCharsMultiValue', this.pict.AppData.Demo.SpecialCharsMulti);

		// --- Numeric UNSET value (regression): a picker bound to a NUMBER-typed field paints "0" as if it
		//     were a selection. This section exists to settle WHERE that bug lives, because the value's
		//     provenance points at a different library than the symptom does.
		//
		//     Provenance: a pict-section-form marshal reads through manyfest's getValueByHash, which
		//     substitutes the descriptor default for any address the model does not hold yet — and with no
		//     explicit `Default` that is manyfest's per-DataType default: '' for String, but 0 for
		//     Number/Integer/Float. So a pristine `{ DataType: 'Number', InputType: 'Picker' }` field (an
		//     entity FK, virtually always) reaches the widget as 0. The readout below computes exactly
		//     that, from manyfest alone, so you can see the 0 is not invented by the form layer.
		//
		//     Symptom: THIS demo app has no pict-section-form and no dynamic form in it at all — just
		//     `setValue(0)` straight into the picker. The first control below still paints "0". That is the
		//     proof the display bug is the PICKER's, not the form's: 0 was simply a value the widget had no
		//     way to know meant "nothing selected". Hence `EmptyValues` — a display-only sentinel list. The
		//     second control is the identical picker with it set; the third shows the escape hatch.
		const _Vendors =
		[
			{ Value: 1, Text: 'Ace Paving' },
			{ Value: 2, Text: 'Bedrock Materials' },
			{ Value: 3, Text: 'Cornerstone Construction' },
			{ Value: 4, Text: 'Delta Aggregates' },
		];

		// Where the 0 actually comes from — manyfest, from a Number descriptor carrying NO Default at all.
		const tmpManyfest = this.pict.manifest.constructor;
		const tmpUnsetManifest = new tmpManyfest(
			{
				Scope: 'UnsetDemo',
				Descriptors:
				{
					'Header.Contractor': { Hash: 'Contractor', DataAddress: 'Header.Contractor', DataType: 'Number' },
					'Header.Reference': { Hash: 'Reference', DataAddress: 'Header.Reference', DataType: 'String' },
				},
			});
		const tmpPristineFormData = {};   // a brand-new form: neither address is set
		this.pict.ContentAssignment.assignContent('#UnsetProvenance',
			`manyfest <code>getValueByHash({}, …)</code> on a pristine form —`
			+ ` <code>DataType: 'Number'</code> → <code>${JSON.stringify(tmpUnsetManifest.getValueByHash(tmpPristineFormData, 'Contractor'))}</code>`
			+ ` · <code>DataType: 'String'</code> → <code>${JSON.stringify(tmpUnsetManifest.getValueByHash(tmpPristineFormData, 'Reference'))}</code>`);

		// 1. The bug, live: no EmptyValues, so 0 is just a value the picker cannot resolve → it paints "0".
		this.pict.AppData.Demo.UnsetRaw = 0;
		tmpPicker.createPicker('UnsetRawPicker',
			{
				DestinationAddress: '#UnsetRawPicker',
				ValueAddress: 'AppData.Demo.UnsetRaw',
				Placeholder: 'Select a contractor…',
				Options: _Vendors,
				OnChange: () => this._showUnset(),
			});
		this.pict.views['UnsetRawPicker'].render();

		// 2. The fix: the same picker told that 0 means unset. Display only — getValue() still returns 0.
		this.pict.AppData.Demo.UnsetFixed = 0;
		tmpPicker.createPicker('UnsetFixedPicker',
			{
				DestinationAddress: '#UnsetFixedPicker',
				ValueAddress: 'AppData.Demo.UnsetFixed',
				Placeholder: 'Select a contractor…',
				Options: _Vendors,
				EmptyValues: [ 0 ],
				OnChange: () => this._showUnset(),
			});
		this.pict.views['UnsetFixedPicker'].render();

		// 3. Reality beats the sentinel: 0 IS a real option here, so it selects normally despite EmptyValues.
		this.pict.AppData.Demo.UnsetRealZero = 0;
		tmpPicker.createPicker('UnsetRealZeroPicker',
			{
				DestinationAddress: '#UnsetRealZeroPicker',
				ValueAddress: 'AppData.Demo.UnsetRealZero',
				Placeholder: 'Select a tier…',
				Options: [ { Value: 0, Text: 'None (a real option valued 0)' } ].concat(_Vendors),
				EmptyValues: [ 0 ],
				OnChange: () => this._showUnset(),
			});
		this.pict.views['UnsetRealZeroPicker'].render();
		this._showUnset();

		return super.onAfterInitializeAsync(fCallback);
	}

	/** Drive all three unset-demo pickers at once, so the pair can be compared on the same value. */
	setUnsetValue(pValue)
	{
		[ 'UnsetRawPicker', 'UnsetFixedPicker', 'UnsetRealZeroPicker' ].forEach((pHash) => this.pict.views[pHash].setValue(pValue));
		this._showUnset();
	}

	/** Paint what each unset-demo picker STORES next to what it SHOWS — the whole point being that the
	 *  stored value is identical and only the painted text differs. */
	_showUnset()
	{
		const fShown = (pHash) =>
		{
			const tmpView = this.pict.views[pHash];
			const tmpSlot = tmpView._buildState().SingleSlot[0];
			return { Value: tmpView.getValue(), Text: tmpSlot.DisplayText, Placeholder: tmpSlot.NoValue };
		};
		const fRow = (pLabel, pHash) =>
		{
			const tmpState = fShown(pHash);
			return `${pLabel} — stored <code>${JSON.stringify(tmpState.Value)}</code>`
				+ ` · painted <code>${tmpState.Text}</code>${tmpState.Placeholder ? ' <em>(placeholder)</em>' : ''}`;
		};
		this.pict.ContentAssignment.assignContent('#UnsetValue',
			[
				fRow('no EmptyValues', 'UnsetRawPicker'),
				fRow('EmptyValues: [0]', 'UnsetFixedPicker'),
				fRow('0 is a real option', 'UnsetRealZeroPicker'),
			].join('<br>'));
	}

	/**
	 * Paint a picker's resolved anchoring mode after each open. Wraps open() rather than reading the flag
	 * on a timer so the badge updates exactly when the decision is made.
	 * @param {string} pViewHash @param {string} pBadgeSelector
	 */
	_watchAnchorMode(pViewHash, pBadgeSelector)
	{
		const tmpView = this.pict.views[pViewHash];
		const fOpen = tmpView.open.bind(tmpView);
		tmpView.open = () =>
		{
			fOpen();
			const tmpPortaled = tmpView._portaled;
			this.pict.ContentAssignment.assignContent(pBadgeSelector,
				tmpPortaled ? 'portaled to body (clipped ancestor)' : 'CSS absolute (in place)');
			const tmpElement = this.pict.ContentAssignment.getElement(pBadgeSelector);
			if (tmpElement && tmpElement[0])
			{
				tmpElement[0].className = `demo-mode ${tmpPortaled ? 'demo-mode-fixed' : 'demo-mode-css'}`;
			}
		};
	}

	/**
	 * Badge which path the last programmatic setValue took: a targeted refresh (value area + list only)
	 * or a full render. A full render is required whenever something outside those — here the inline
	 * clear × — would change, so this makes the trade-off visible: setting over an existing value stays
	 * on the fast path, while empty↔set repaints the control so the × can appear or go.
	 * @param {string} pViewHash @param {string} pBadgeSelector
	 */
	_watchReflectPath(pViewHash, pBadgeSelector)
	{
		const tmpView = this.pict.views[pViewHash];
		const fRender = tmpView.render.bind(tmpView);
		let tmpFullRender = false;
		tmpView.render = () => { tmpFullRender = true; return fRender(); };
		const fSetValue = tmpView.setValue.bind(tmpView);
		tmpView.setValue = (pValue) =>
		{
			tmpFullRender = false;
			const tmpResult = fSetValue(pValue);
			this.pict.ContentAssignment.assignContent(pBadgeSelector,
				tmpFullRender ? 'full render (shape changed)' : 'targeted refresh (fast path)');
			const tmpElement = this.pict.ContentAssignment.getElement(pBadgeSelector);
			if (tmpElement && tmpElement[0])
			{
				tmpElement[0].className = `demo-mode ${tmpFullRender ? 'demo-mode-fixed' : 'demo-mode-css'}`;
			}
			return tmpResult;
		};
	}

	/** Flip the demo's contextual scope. Nothing else — no invalidation call, by design. */
	toggleItemScope()
	{
		this.pict.AppData.Demo.ItemScopeEvensOnly = !this.pict.AppData.Demo.ItemScopeEvensOnly;
		this._showScope();
	}

	/** Paint the current scope + the running DataProvider query count. */
	_showScope()
	{
		this.pict.ContentAssignment.assignContent('#ScopeValue',
			`scope: <code>${this.pict.AppData.Demo.ItemScopeEvensOnly ? 'evens only' : 'all items'}</code>`
			+ ` · DataProvider queries: <code>${this.pict.AppData.Demo.ItemQueries}</code>`);
	}

	/** Set the single picker from outside via the public setValue() API, then refresh the readout. */
	setProgCountry(pValue)
	{
		this.pict.views['ProgCountryPicker'].setValue(pValue);
		this._showProgrammatic();
	}

	/** Set the multi picker from outside (array OR csv string) via setValue(), then refresh the readout. */
	setProgTags(pValue)
	{
		this.pict.views['ProgTagsPicker'].setValue(pValue);
		this._showProgrammatic();
	}

	/** Paint the live getValue() / getSelectedRecords() readout for the programmatic-control pickers. */
	_showProgrammatic()
	{
		const tmpCountry = this.pict.views['ProgCountryPicker'].getValue();
		const tmpTags = this.pict.views['ProgTagsPicker'].getValue();
		const tmpRecords = this.pict.views['ProgTagsPicker'].getSelectedRecords();
		this.pict.ContentAssignment.assignContent('#ProgValue',
			`single getValue(): <code>${JSON.stringify(tmpCountry)}</code> · multi getValue(): <code>${JSON.stringify(tmpTags)}</code><br>`
			+ `multi getSelectedRecords(): <code>${JSON.stringify(tmpRecords)}</code>`);
	}
}

PickerDemoApplication.default_configuration =
{
	Name: 'Picker Demo',
	Hash: 'PickerDemo',
};

module.exports = PickerDemoApplication;

module.exports.default_configuration = PickerDemoApplication.default_configuration;
