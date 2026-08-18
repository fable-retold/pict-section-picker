/*
	Unit tests for pict-section-picker.

	Focused on the public value API of the widget view — getValue() / setValue() across single &
	multi modes (scalar, array, csv-string and empty inputs), display-label seeding (from static
	Options and from the async ResolveValue hook), the OnChange contract, and the multi-mode mirror
	addresses — plus the provider's search-filter + entity DataProvider builders.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv();

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libPictSectionPicker = require('../source/Pict-Section-Picker.js');

/**
 * Build a quiet Pict instance with the DOM-writing side of ContentAssignment stubbed out, so a
 * view's render() can run to completion without a real destination element in the simulated DOM.
 * @return {any} a configured Pict instance
 */
const configureTestPict = () =>
{
	const tmpPict = new libPict({ LogStreams: [ { loggertype: 'console', streamtype: 'console', level: 'error' } ] });
	tmpPict.ContentAssignment.customAssignFunction = () => '';
	tmpPict.ContentAssignment.customReadFunction = () => '';
	tmpPict.ContentAssignment.customGetElementFunction = () => '';
	tmpPict.ContentAssignment.customAppendElementFunction = () => '';
	return tmpPict;
};

/** @return {any} a registered Pict-Section-Picker provider on a fresh test Pict. */
const newProvider = () =>
{
	const tmpPict = configureTestPict();
	return tmpPict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);
};

const COUNTRY_OPTIONS =
[
	{ Value: 'us', Text: 'United States' },
	{ Value: 'ca', Text: 'Canada' },
	{ Value: 'mx', Text: 'Mexico' },
];

const TAG_OPTIONS =
[
	{ Value: 'urgent', Text: 'Urgent' },
	{ Value: 'review', Text: 'Review' },
	{ Value: 'wip', Text: 'WIP' },
];

suite
(
	'Pict-Section-Picker',
	() =>
	{
		suite
		(
			'Module exports',
			() =>
			{
				test
				(
					'exports the provider class as the module root',
					(fDone) =>
					{
						Expect(libPictSectionPicker).to.be.a('function');
						Expect(libPictSectionPicker.PictProviderPicker).to.be.a('function');
						Expect(libPictSectionPicker.PictViewPicker).to.be.a('function');
						return fDone();
					}
				);
				test
				(
					'exports a default_configuration with the provider identifier',
					(fDone) =>
					{
						Expect(libPictSectionPicker.default_configuration).to.be.an('object');
						Expect(libPictSectionPicker.default_configuration.ProviderIdentifier).to.equal('Pict-Section-Picker');
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Provider createPicker',
			() =>
			{
				test
				(
					'creates a picker view instance reachable through pict.views',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('CountryPicker', { Options: COUNTRY_OPTIONS });
						Expect(tmpView).to.be.an('object');
						Expect(tmpProvider.pict.views['CountryPicker']).to.equal(tmpView);
						return fDone();
					}
				);
				test
				(
					'reuses (reconfigures) an existing instance for the same hash',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpFirst = tmpProvider.createPicker('ReusePicker', { Placeholder: 'First' });
						const tmpSecond = tmpProvider.createPicker('ReusePicker', { Placeholder: 'Second' });
						Expect(tmpSecond).to.equal(tmpFirst);
						Expect(tmpFirst.options.Placeholder).to.equal('Second');
						return fDone();
					}
				);
			}
		);

		suite
		(
			'getValue',
			() =>
			{
				test
				(
					'single mode returns the scalar at the bound address',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('GV-Single', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS });
						tmpProvider.pict.AppData.Form = { Country: 'ca' };
						Expect(tmpView.getValue()).to.equal('ca');
						return fDone();
					}
				);
				test
				(
					'multi mode returns [] when the bound value is empty / unset',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('GV-MultiEmpty', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						Expect(tmpView.getValue()).to.be.an('array').that.is.empty;
						tmpProvider.pict.AppData.Form = { Tags: '' };
						Expect(tmpView.getValue()).to.be.an('array').that.is.empty;
						return fDone();
					}
				);
				test
				(
					'multi mode passes an array value through unchanged',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('GV-MultiArray', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpProvider.pict.AppData.Form = { Tags: [ 'urgent', 'review' ] };
						Expect(tmpView.getValue()).to.deep.equal([ 'urgent', 'review' ]);
						return fDone();
					}
				);
				test
				(
					'multi mode normalizes a csv string into an array',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('GV-MultiCSV', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpProvider.pict.AppData.Form = { Tags: 'urgent,review,wip' };
						Expect(tmpView.getValue()).to.deep.equal([ 'urgent', 'review', 'wip' ]);
						return fDone();
					}
				);
				test
				(
					'multi mode wraps a bare scalar into a single-element array',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('GV-MultiScalar', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpProvider.pict.AppData.Form = { Tags: 7 };
						Expect(tmpView.getValue()).to.deep.equal([ 7 ]);
						return fDone();
					}
				);
			}
		);

		suite
		(
			'setValue — single mode',
			() =>
			{
				test
				(
					'sets the value and writes it through to the bound address',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SV-Single', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS });
						tmpView.setValue('ca');
						Expect(tmpView.getValue()).to.equal('ca');
						Expect(tmpProvider.pict.AppData.Form.Country).to.equal('ca');
						return fDone();
					}
				);
				test
				(
					'returns the view instance for chaining',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SV-Chain', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS });
						Expect(tmpView.setValue('us')).to.equal(tmpView);
						return fDone();
					}
				);
				test
				(
					'seeds the display record from the static Options',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SV-Seed', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS });
						tmpView.setValue('ca');
						Expect(tmpView._selectedRecords['ca']).to.be.an('object');
						Expect(tmpView._selectedRecords['ca'].Text).to.equal('Canada');
						return fDone();
					}
				);
				test
				(
					'clears the cached label when switching to a value with no known record',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SV-Stale', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS });
						tmpView.setValue('ca');
						Expect(tmpView._selectedText).to.equal(null);
						// Switch to a value that is not in Options — no stale 'Canada' label should linger.
						tmpView.setValue('zz');
						Expect(tmpView._selectedText).to.equal(null);
						Expect(tmpView.getValue()).to.equal('zz');
						return fDone();
					}
				);
				test
				(
					'clears the selection when set to an empty value',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SV-Clear', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS });
						tmpView.setValue('ca');
						tmpView.setValue('');
						Expect(tmpView.getValue()).to.equal('');
						Expect(tmpProvider.pict.AppData.Form.Country).to.equal('');
						return fDone();
					}
				);
				test
				(
					'does not fire OnChange (programmatic set, not a user pick)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						let tmpChangeCount = 0;
						const tmpView = tmpProvider.createPicker('SV-NoChange', { ValueAddress: 'AppData.Form.Country', Options: COUNTRY_OPTIONS, OnChange: () => { tmpChangeCount++; } });
						tmpView.setValue('ca');
						Expect(tmpChangeCount).to.equal(0);
						return fDone();
					}
				);
			}
		);

		suite
		(
			'setValue — multi mode',
			() =>
			{
				test
				(
					'sets an array and writes it through to the bound address',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVM-Array', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpView.setValue([ 'urgent', 'review' ]);
						Expect(tmpView.getValue()).to.deep.equal([ 'urgent', 'review' ]);
						Expect(tmpProvider.pict.AppData.Form.Tags).to.deep.equal([ 'urgent', 'review' ]);
						return fDone();
					}
				);
				test
				(
					'normalizes a csv string into an array',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVM-CSV', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpView.setValue('urgent,review,wip');
						Expect(tmpView.getValue()).to.deep.equal([ 'urgent', 'review', 'wip' ]);
						return fDone();
					}
				);
				test
				(
					'wraps a bare scalar into a single-element array',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVM-Scalar', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpView.setValue('urgent');
						Expect(tmpView.getValue()).to.deep.equal([ 'urgent' ]);
						return fDone();
					}
				);
				test
				(
					'mirrors the selection to the csv and records addresses with real labels',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVM-Mirror',
							{
								Mode: 'multi',
								ValueAddress: 'AppData.Form.Tags',
								StringArrayValueAddress: 'AppData.Form.TagsCSV',
								SelectedValuesAddress: 'AppData.Form.TagsRecords',
								Options: TAG_OPTIONS,
							});
						tmpView.setValue([ 'urgent', 'review' ]);
						Expect(tmpProvider.pict.AppData.Form.TagsCSV).to.equal('urgent,review');
						const tmpRecords = tmpProvider.pict.AppData.Form.TagsRecords;
						Expect(tmpRecords).to.be.an('array').with.lengthOf(2);
						// The records mirror must carry the option's real Text, not a String(value) fallback.
						Expect(tmpRecords[0].Value).to.equal('urgent');
						Expect(tmpRecords[0].Text).to.equal('Urgent');
						Expect(tmpRecords[1].Text).to.equal('Review');
						return fDone();
					}
				);
				test
				(
					'clears the selection (and its mirrors) when set to an empty value',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVM-Clear',
							{
								Mode: 'multi',
								ValueAddress: 'AppData.Form.Tags',
								StringArrayValueAddress: 'AppData.Form.TagsCSV',
								Options: TAG_OPTIONS,
							});
						tmpView.setValue([ 'urgent', 'review' ]);
						tmpView.setValue([]);
						Expect(tmpView.getValue()).to.be.an('array').that.is.empty;
						Expect(tmpProvider.pict.AppData.Form.TagsCSV).to.equal('');
						// null and '' clear the same way.
						tmpView.setValue('urgent');
						tmpView.setValue(null);
						Expect(tmpView.getValue()).to.be.an('array').that.is.empty;
						return fDone();
					}
				);
				test
				(
					'getSelectedRecords reflects the current multi selection',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVM-Records', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS });
						tmpView.setValue([ 'review', 'wip' ]);
						const tmpRecords = tmpView.getSelectedRecords();
						Expect(tmpRecords.map((pRecord) => pRecord.Text)).to.deep.equal([ 'Review', 'WIP' ]);
						return fDone();
					}
				);
				test
				(
					'does not fire OnChange (programmatic set, not a user pick)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						let tmpChangeCount = 0;
						const tmpView = tmpProvider.createPicker('SVM-NoChange', { Mode: 'multi', ValueAddress: 'AppData.Form.Tags', Options: TAG_OPTIONS, OnChange: () => { tmpChangeCount++; } });
						tmpView.setValue([ 'urgent', 'review' ]);
						Expect(tmpChangeCount).to.equal(0);
						return fDone();
					}
				);
			}
		);

		suite
		(
			'setValue — async label resolution',
			() =>
			{
				test
				(
					'single mode resolves the display label via ResolveValue',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVA-Single',
							{
								ValueAddress: 'AppData.Form.Author',
								DataProvider: () => Promise.resolve({ results: [], hasMore: false }),
								ResolveValue: (pValue) => Promise.resolve({ Value: pValue, Text: `Author #${pValue}` }),
							});
						tmpView.setValue(141);
						// Synchronously the raw value is bound; the label arrives on a later tick.
						Expect(tmpView.getValue()).to.equal(141);
						setTimeout(() =>
						{
							Expect(tmpView._selectedRecords['141']).to.be.an('object');
							Expect(tmpView._selectedRecords['141'].Text).to.equal('Author #141');
							Expect(tmpView._selectedText).to.equal('Author #141');
							return fDone();
						}, 15);
					}
				);
				test
				(
					'multi mode resolves a label for each value via ResolveValue',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('SVA-Multi',
							{
								Mode: 'multi',
								ValueAddress: 'AppData.Form.Authors',
								DataProvider: () => Promise.resolve({ results: [], hasMore: false }),
								ResolveValue: (pValue) => Promise.resolve({ Value: pValue, Text: `Author #${pValue}` }),
							});
						tmpView.setValue([ 7, 9 ]);
						Expect(tmpView.getValue()).to.deep.equal([ 7, 9 ]);
						setTimeout(() =>
						{
							Expect(tmpView._selectedRecords['7'].Text).to.equal('Author #7');
							Expect(tmpView._selectedRecords['9'].Text).to.equal('Author #9');
							return fDone();
						}, 15);
					}
				);
			}
		);

		suite
		(
			'Provider buildSearchFilter',
			() =>
			{
				test
				(
					'builds a single-field LIKE stanza with an encoded term',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						Expect(tmpProvider.buildSearchFilter([ 'Name' ], 'foo')).to.equal(`FBV~Name~LK~${encodeURIComponent('%foo%')}`);
						return fDone();
					}
				);
				test
				(
					'OR-groups multiple fields inside a paren group',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpFilter = tmpProvider.buildSearchFilter([ 'Name', 'Email' ], 'bar');
						const tmpEncoded = encodeURIComponent('%bar%');
						Expect(tmpFilter).to.equal(`FOP~0~(~0~FBV~Name~LK~${tmpEncoded}~FBVOR~Email~LK~${tmpEncoded}~FCP~0~)~0`);
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Provider createEntityDataProvider',
			() =>
			{
				/** Install a fake EntityProvider that records the FoxHound filter it is asked for. */
				const withFakeEntityProvider = (pProvider, pRecords) =>
				{
					const tmpCalls = [];
					pProvider.pict.EntityProvider =
					{
						getEntitySetPage: (pEntity, pFilter, pCursor, pLimit, fCallback) =>
						{
							tmpCalls.push({ Entity: pEntity, Filter: pFilter, Cursor: pCursor, Limit: pLimit });
							return fCallback(null, pRecords || []);
						},
					};
					return tmpCalls;
				};

				test
				(
					'maps entity records to {Value, Text} option rows',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						withFakeEntityProvider(tmpProvider, [ { IDAuthor: 1, Name: 'Ada' }, { IDAuthor: 2, Name: 'Grace' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', SearchFields: [ 'Name' ], PageSize: 20 });
						tmpDataProvider('a', 0).then((pResult) =>
						{
							Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 1, 2 ]);
							Expect(pResult.results.map((pRow) => pRow.Text)).to.deep.equal([ 'Ada', 'Grace' ]);
							Expect(pResult.hasMore).to.equal(false);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'applies a string BaseFilter (AND) ahead of the search stanza',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withFakeEntityProvider(tmpProvider, []);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', SearchFields: [ 'Name' ], BaseFilter: 'FBV~IDCustomer~EQ~1' });
						tmpDataProvider('ada', 0).then(() =>
						{
							Expect(tmpCalls).to.have.lengthOf(1);
							Expect(tmpCalls[0].Filter).to.contain('FBV~IDCustomer~EQ~1');
							Expect(tmpCalls[0].Filter).to.contain(`FBV~Name~LK~${encodeURIComponent('%ada%')}`);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'evaluates a function BaseFilter at search time (contextual scope)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withFakeEntityProvider(tmpProvider, []);
						let tmpScope = 'FBV~IDProject~EQ~10';
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'LineItem', SearchFields: [ 'Name' ], BaseFilter: () => tmpScope });
						tmpDataProvider('', 0).then(() =>
						{
							Expect(tmpCalls[0].Filter).to.contain('FBV~IDProject~EQ~10');
							// Re-evaluated per search: change the scope, search again, get the new stanza.
							tmpScope = 'FBV~IDProject~EQ~20';
							return tmpDataProvider('', 0);
						}).then(() =>
						{
							Expect(tmpCalls[1].Filter).to.contain('FBV~IDProject~EQ~20');
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'joins an array-form BaseFilter into the filter',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withFakeEntityProvider(tmpProvider, []);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'LineItem', SearchFields: [ 'Name' ], BaseFilter: () => [ 'FBV~IDProject~EQ~3', 'FBV~Active~EQ~1' ] });
						tmpDataProvider('', 0).then(() =>
						{
							Expect(tmpCalls[0].Filter).to.contain('FBV~IDProject~EQ~3');
							Expect(tmpCalls[0].Filter).to.contain('FBV~Active~EQ~1');
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'reports hasMore when a full page is returned',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpFullPage = [ { IDAuthor: 1, Name: 'A' }, { IDAuthor: 2, Name: 'B' } ];
						withFakeEntityProvider(tmpProvider, tmpFullPage);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', SearchFields: [ 'Name' ], PageSize: 2 });
						tmpDataProvider('', 0).then((pResult) =>
						{
							Expect(pResult.hasMore).to.equal(true);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'attaches an EntityTag badge value to each option when configured',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						withFakeEntityProvider(tmpProvider, [ { IDLineItem: 5, Name: 'Widget', ItemNumber: 'W-001' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'LineItem', SearchFields: [ 'Name' ], EntityTag: 'ItemNumber' });
						tmpDataProvider('w', 0).then((pResult) =>
						{
							Expect(pResult.results[0].Tag).to.equal('W-001');
							return fDone();
						}).catch(fDone);
					}
				);
			}
		);

		suite
		(
			'Provider createEntityDataProvider — PriorityValues (pin-to-top)',
			() =>
			{
				/** Fake EntityProvider that answers the priority INN fetch and the natural (NIN) page differently. */
				const withPinnedEntityProvider = (pProvider, pPinnedRecords, pNaturalRecords) =>
				{
					const tmpCalls = [];
					pProvider.pict.EntityProvider =
					{
						getEntitySetPage: (pEntity, pFilter, pCursor, pLimit, fCallback) =>
						{
							tmpCalls.push({ Entity: pEntity, Filter: pFilter, Cursor: pCursor, Limit: pLimit });
							return fCallback(null, (pFilter.indexOf('~INN~') > -1) ? pPinnedRecords : pNaturalRecords);
						},
					};
					return tmpCalls;
				};

				test
				(
					'floats PriorityValues to the top of the first browse page and holds them out of the natural flow',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withPinnedEntityProvider(tmpProvider, [ { IDAuthor: 7, Name: 'Pinned' } ], [ { IDAuthor: 1, Name: 'A' }, { IDAuthor: 2, Name: 'B' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', ValueField: 'IDAuthor', TextField: 'Name', SearchFields: [ 'Name' ], PriorityValues: [ 7 ] });
						tmpDataProvider('', 0).then((pResult) =>
						{
							Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 7, 1, 2 ]);
							const tmpNatural = tmpCalls.find((pCall) => pCall.Filter.indexOf('~NIN~') > -1);
							const tmpPriority = tmpCalls.find((pCall) => pCall.Filter.indexOf('~INN~') > -1);
							Expect(tmpNatural, 'natural query present').to.not.equal(undefined);
							Expect(tmpNatural.Filter).to.contain('FBL~IDAuthor~NIN~7');
							Expect(tmpPriority, 'priority INN fetch present').to.not.equal(undefined);
							Expect(tmpPriority.Filter).to.contain('FBL~IDAuthor~INN~7');
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'does not prepend on later pages but still excludes the pinned ids',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withPinnedEntityProvider(tmpProvider, [ { IDAuthor: 7, Name: 'Pinned' } ], [ { IDAuthor: 3, Name: 'C' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', ValueField: 'IDAuthor', TextField: 'Name', SearchFields: [ 'Name' ], PriorityValues: [ 7 ], PageSize: 25 });
						tmpDataProvider('', 1).then((pResult) =>
						{
							Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 3 ]);
							Expect(tmpCalls.some((pCall) => pCall.Filter.indexOf('FBL~IDAuthor~NIN~7') > -1)).to.equal(true);
							Expect(tmpCalls.some((pCall) => pCall.Filter.indexOf('~INN~') > -1)).to.equal(false);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'defers to natural relevance when a search term is present (no pin, no exclusion)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withPinnedEntityProvider(tmpProvider, [ { IDAuthor: 7, Name: 'Pinned' } ], [ { IDAuthor: 9, Name: 'Grace' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', ValueField: 'IDAuthor', TextField: 'Name', SearchFields: [ 'Name' ], PriorityValues: [ 7 ] });
						tmpDataProvider('grace', 0).then((pResult) =>
						{
							Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 9 ]);
							Expect(tmpCalls.every((pCall) => pCall.Filter.indexOf('~NIN~') === -1), 'no NIN in search mode').to.equal(true);
							Expect(tmpCalls.every((pCall) => pCall.Filter.indexOf('~INN~') === -1), 'no INN prepend in search mode').to.equal(true);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'accepts a function resolver for PriorityValues',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						withPinnedEntityProvider(tmpProvider, [ { IDAuthor: 7, Name: 'Pinned' } ], [ { IDAuthor: 1, Name: 'A' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Author', ValueField: 'IDAuthor', TextField: 'Name', SearchFields: [ 'Name' ], PriorityValues: () => Promise.resolve([ 7 ]) });
						tmpDataProvider('', 0).then((pResult) =>
						{
							Expect(pResult.results[0].Value).to.equal(7);
							return fDone();
						}).catch(fDone);
					}
				);
			}
		);

		suite
		(
			'Clearable (AllowClear)',
			() =>
			{
				test
				(
					'clearValue empties a single-mode selection and fires OnChange(null, null) once',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpChanges = [];
						const tmpView = tmpProvider.createPicker('ClearablePicker',
							{
								Options: COUNTRY_OPTIONS,
								AllowClear: true,
								OnChange: (pValue, pRecord) => tmpChanges.push([ pValue, pRecord ]),
							});
						tmpView.select('ca');
						Expect(tmpView.getValue()).to.equal('ca');
						tmpView.clearValue();
						Expect(tmpView.getValue()).to.equal(null);
						Expect(tmpChanges.length).to.equal(2, 'select + clear each fire OnChange');
						Expect(tmpChanges[1]).to.deep.equal([ null, null ]);
						// Clearing while already empty closes quietly — no extra OnChange.
						tmpView.clearValue();
						Expect(tmpChanges.length).to.equal(2);
						return fDone();
					}
				);
				test
				(
					'state slots: the pinned Any row tracks the selection; the inline × only shows with a value',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('ClearableSlotPicker', { Options: COUNTRY_OPTIONS, AllowClear: true, ClearLabel: 'Any' });
						let tmpState = tmpView._buildState();
						Expect(tmpState.ClearOptionSlot.length).to.equal(1);
						Expect(tmpState.ClearOptionSlot[0].Label).to.equal('Any');
						Expect(tmpState.ClearOptionSlot[0].Selected).to.equal(true, 'Any is the active state when nothing is selected');
						Expect(tmpState.ClearSlot.length).to.equal(0, 'no clear control without a value');
						tmpView.select('mx');
						tmpState = tmpView._buildState();
						Expect(tmpState.ClearOptionSlot[0].Selected).to.equal(false);
						Expect(tmpState.ClearSlot.length).to.equal(1, 'the clear control appears with a value');
						return fDone();
					}
				);
				test
				(
					'AllowClear is ignored without the option and in multi mode',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpPlain = tmpProvider.createPicker('PlainPicker', { Options: COUNTRY_OPTIONS });
						const tmpPlainState = tmpPlain._buildState();
						Expect(tmpPlainState.ClearOptionSlot.length).to.equal(0);
						Expect(tmpPlainState.ClearSlot.length).to.equal(0);

						const tmpMulti = tmpProvider.createPicker('MultiClearPicker', { Options: COUNTRY_OPTIONS, Mode: 'multi', AllowClear: true });
						tmpMulti.select('us');
						const tmpMultiState = tmpMulti._buildState();
						Expect(tmpMultiState.ClearOptionSlot.length).to.equal(0, 'multi clears via chips; AllowClear is single-mode only');
						Expect(tmpMultiState.ClearSlot.length).to.equal(0);
						tmpMulti.clearValue();
						Expect(tmpMulti.getValue()).to.deep.equal([ 'us' ], 'clearValue is a no-op in multi mode');
						return fDone();
					}
				);
			}
		);
	}
);
