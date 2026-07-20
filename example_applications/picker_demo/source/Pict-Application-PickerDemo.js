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
				OnChange: () => this._showProgrammatic(),
			});
		this.pict.views['ProgCountryPicker'].render();

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

		return super.onAfterInitializeAsync(fCallback);
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
