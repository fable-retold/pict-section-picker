/*
	Back-off filter auto-widening + the loaded-results cache lifetime.

	BaseFilter's object form `{ Filters, BackOffFilters }` splits the host's contextual scope into a
	mandatory set and a preferred (back-off) set. Both apply together first; an EMPTY first page under
	the back-off set retries once WITHOUT it, so an over-narrow preferred scope auto-widens instead of
	stranding the user on "No matches". Later pages of the same search stay widened so "Load more"
	pages the set the user is actually looking at.

	The accumulated pages are dropped when the dropdown CLOSES, so every open re-queries and re-resolves
	BaseFilter. A host whose contextual filters changed outside the picker (e.g. a "Show All" toggle)
	therefore needs no invalidation hook — the next open already reflects the change.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv();

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libPictSectionPicker = require('../source/Pict-Section-Picker.js');

/** Quiet Pict with the DOM-writing side of ContentAssignment stubbed, so render() runs without a real element. */
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

/**
 * Install a fake EntityProvider whose per-call responses come from fResponder(call) — so a test can
 * answer the narrow (back-off) request empty and the widened retry with records. Records every call's
 * filter for assertions.
 */
const withRespondingEntityProvider = (pProvider, fResponder) =>
{
	const tmpCalls = [];
	pProvider.pict.EntityProvider =
	{
		getEntitySetPage: (pEntity, pFilter, pCursor, pLimit, fCallback) =>
		{
			const tmpCall = { Entity: pEntity, Filter: pFilter, Cursor: pCursor, Limit: pLimit };
			tmpCalls.push(tmpCall);
			return fCallback(null, fResponder(tmpCall));
		},
	};
	return tmpCalls;
};

const NARROW = 'FBL~IDMaterial~INN~1,2,3';
const MANDATORY = 'FBV~IDProject~EQ~10';

suite
(
	'Pict-Section-Picker — back-off filters + cache lifetime',
	() =>
	{
		suite
		(
			'BaseFilter { Filters, BackOffFilters } auto-widen',
			() =>
			{
				test
				(
					'applies mandatory + back-off together when the narrow scope has results (no retry)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider, () => [ { IDMaterial: 1, Name: 'Gravel' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider(
							{ Entity: 'Material', BaseFilter: () => ({ Filters: MANDATORY, BackOffFilters: NARROW }) });
						tmpDataProvider('', 0).then((pResult) =>
						{
							Expect(tmpCalls).to.have.lengthOf(1);
							Expect(tmpCalls[0].Filter).to.contain(MANDATORY);
							Expect(tmpCalls[0].Filter).to.contain(NARROW);
							Expect(pResult.results.map((pRow) => pRow.Text)).to.deep.equal([ 'Gravel' ]);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'retries an EMPTY first page once WITHOUT the back-off set (mandatory filters kept)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider,
							(pCall) => pCall.Filter.includes(NARROW) ? [] : [ { IDMaterial: 9, Name: 'Out-of-scope Sand' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider(
							{ Entity: 'Material', SearchFields: [ 'Name' ], BaseFilter: () => ({ Filters: MANDATORY, BackOffFilters: NARROW }) });
						tmpDataProvider('sand', 0).then((pResult) =>
						{
							Expect(tmpCalls).to.have.lengthOf(2);
							Expect(tmpCalls[0].Filter).to.contain(NARROW);
							Expect(tmpCalls[1].Filter).to.not.contain(NARROW);
							// The mandatory scope AND the search term survive the widen.
							Expect(tmpCalls[1].Filter).to.contain(MANDATORY);
							Expect(tmpCalls[1].Filter).to.contain(`FBV~Name~LK~${encodeURIComponent('%sand%')}`);
							Expect(pResult.results.map((pRow) => pRow.Text)).to.deep.equal([ 'Out-of-scope Sand' ]);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'pages the WIDENED set on "Load more" after a widen, then re-narrows on the next fresh search',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider,
							(pCall) => pCall.Filter.includes(NARROW) ? [] : [ { IDMaterial: 9, Name: 'Wide' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider(
							{ Entity: 'Material', PageSize: 1, BaseFilter: () => ({ Filters: MANDATORY, BackOffFilters: NARROW }) });
						tmpDataProvider('w', 0).then(() =>
						{
							// Page 0: narrow attempt + widened retry.
							Expect(tmpCalls).to.have.lengthOf(2);
							return tmpDataProvider('w', 1);
						}).then(() =>
						{
							// Page 1 of the same term: stays widened, no narrow attempt.
							Expect(tmpCalls).to.have.lengthOf(3);
							Expect(tmpCalls[2].Filter).to.not.contain(NARROW);
							Expect(tmpCalls[2].Cursor).to.equal(1);
							return tmpDataProvider('x', 0);
						}).then(() =>
						{
							// A fresh page-0 search re-applies the back-off set first.
							Expect(tmpCalls[3].Filter).to.contain(NARROW);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'accepts the object form as a static config value, with array stanza lists on both sides',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider, () => [ { IDMaterial: 1, Name: 'A' } ]);
						const tmpDataProvider = tmpProvider.createEntityDataProvider(
							{ Entity: 'Material', BaseFilter: { Filters: [ MANDATORY, 'FBV~Active~EQ~1' ], BackOffFilters: [ NARROW ] } });
						tmpDataProvider('', 0).then(() =>
						{
							Expect(tmpCalls[0].Filter).to.contain(MANDATORY);
							Expect(tmpCalls[0].Filter).to.contain('FBV~Active~EQ~1');
							Expect(tmpCalls[0].Filter).to.contain(NARROW);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'an empty page with NO back-off set does not retry (plain string BaseFilter unchanged)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider, () => []);
						const tmpDataProvider = tmpProvider.createEntityDataProvider({ Entity: 'Material', BaseFilter: MANDATORY });
						tmpDataProvider('', 0).then((pResult) =>
						{
							Expect(tmpCalls).to.have.lengthOf(1);
							Expect(pResult.results).to.deep.equal([]);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'the widened state survives a re-mount of the same picker (state is keyed by picker hash)',
					(fDone) =>
					{
						// A form host re-mounts its pickers on every marshal, and createEntityPicker rebuilds the
						// DataProvider closure each time. If the back-off bookkeeping lived in that closure, a
						// marshal between page 0 and "Load more" would silently re-narrow page 1 and append it
						// under the widened rows the view still holds.
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider,
							(pCall) => pCall.Filter.includes(NARROW) ? [] : [ { IDMaterial: 9, Name: 'Wide' } ]);
						const tmpConfig = { Entity: 'Material', PageSize: 1, BaseFilter: () => ({ Filters: MANDATORY, BackOffFilters: NARROW }) };
						const tmpView = tmpProvider.createEntityPicker('RemountBackOffPicker', tmpConfig);
						tmpView.options.DataProvider('w', 0).then(() =>
						{
							Expect(tmpCalls).to.have.lengthOf(2); // narrow attempt + widened retry
							// The re-mount: same hash, fresh config object, brand new DataProvider closure.
							const tmpRemounted = tmpProvider.createEntityPicker('RemountBackOffPicker', Object.assign({}, tmpConfig));
							return tmpRemounted.options.DataProvider('w', 1);
						}).then(() =>
						{
							Expect(tmpCalls).to.have.lengthOf(3);
							Expect(tmpCalls[2].Filter).to.not.contain(NARROW);
							return fDone();
						}).catch(fDone);
					}
				);
				test
				(
					'back-off state is per picker — one picker widening does not widen another',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpCalls = withRespondingEntityProvider(tmpProvider,
							(pCall) => pCall.Filter.includes(NARROW) ? [] : [ { IDMaterial: 9, Name: 'Wide' } ]);
						const tmpConfig = { Entity: 'Material', PageSize: 1, BaseFilter: () => ({ Filters: MANDATORY, BackOffFilters: NARROW }) };
						const tmpFirst = tmpProvider.createEntityPicker('BackOffPickerOne', tmpConfig);
						const tmpSecond = tmpProvider.createEntityPicker('BackOffPickerTwo', Object.assign({}, tmpConfig));
						tmpFirst.options.DataProvider('w', 0).then(() =>
						{
							tmpCalls.length = 0;
							// The second picker has its own slot, so its page 0 still tries the narrow scope first.
							return tmpSecond.options.DataProvider('w', 0);
						}).then(() =>
						{
							Expect(tmpCalls[0].Filter).to.contain(NARROW);
							return fDone();
						}).catch(fDone);
					}
				);
			}
		);

		suite
		(
			'cache lifetime — closing drops the loaded pages',
			() =>
			{
				test
				(
					'closing invalidates, and the next open re-queries (no invalidation hook needed)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						let tmpQueries = 0;
						const tmpView = tmpProvider.createPicker('ReopenRequeryPicker',
							{ DataProvider: () => { tmpQueries++; return Promise.resolve({ results: [ { Value: 1, Text: 'One' } ], hasMore: false }); } });
						tmpView.open();
						setTimeout(() =>
						{
							Expect(tmpQueries).to.equal(1);
							tmpView.close();
							// Closed: the accumulated pages are gone, but nothing is re-queried until it reopens.
							Expect(tmpQueries).to.equal(1);
							Expect(tmpView._loaded).to.equal(false);
							Expect(tmpView._loadedResults).to.deep.equal([]);
							Expect(tmpView._page).to.equal(0);
							Expect(tmpView._hasMore).to.equal(false);
							tmpView.open();
							setTimeout(() =>
							{
								// A host whose contextual scope changed while we were closed (a "Show All" toggle)
								// gets the new scope here, because BaseFilter is re-resolved on this query.
								Expect(tmpQueries).to.equal(2);
								return fDone();
							}, 10);
						}, 10);
					}
				);
				test
				(
					'a selected value keeps its label across the invalidation (selection is separate state)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('ReopenLabelPicker',
							{ DataProvider: () => Promise.resolve({ results: [ { Value: 7, Text: 'Seven' } ], hasMore: false }) });
						tmpView.open();
						setTimeout(() =>
						{
							tmpView.select(7);
							Expect(tmpView.getValue()).to.equal(7);
							// select() closes in single mode, which drops _loadedResults — the label must survive
							// because it lives in _selectedRecords, not in the result cache.
							Expect(tmpView._loadedResults).to.deep.equal([]);
							Expect(tmpView._lookupRecord(7).Text).to.equal('Seven');
							return fDone();
						}, 10);
					}
				);
				test
				(
					'a static Options picker keeps its list across a close (nothing was cached)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('ReopenStaticPicker', { Options: [ { Value: 'a', Text: 'A' } ] });
						tmpView.open();
						tmpView.close();
						Expect(tmpView._sourceRows()).to.deep.equal([ { Value: 'a', Text: 'A' } ]);
						return fDone();
					}
				);
			}
		);
	}
);
