/*
	Back-off filter auto-widening + the reload() cache-invalidation hook.

	BaseFilter's object form `{ Filters, BackOffFilters }` splits the host's contextual scope into a
	mandatory set and a preferred (back-off) set. Both apply together first; an EMPTY first page under
	the back-off set retries once WITHOUT it, so an over-narrow preferred scope auto-widens instead of
	stranding the user on "No matches". Later pages of the same search stay widened so "Load more"
	pages the set the user is actually looking at.

	reload() is the public cache-invalidation hook for a host whose contextual filters changed outside
	the picker (e.g. a "Show All" toggle): drop the accumulated results, re-query now if open.
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
	'Pict-Section-Picker — back-off filters + reload()',
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
			}
		);

		suite
		(
			'reload() — public cache invalidation',
			() =>
			{
				test
				(
					'a CLOSED async picker drops its cache and re-queries on the next open',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						let tmpQueries = 0;
						const tmpView = tmpProvider.createPicker('ReloadClosedPicker',
							{ DataProvider: () => { tmpQueries++; return Promise.resolve({ results: [ { Value: 1, Text: 'One' } ], hasMore: false }); } });
						tmpView.open();
						setTimeout(() =>
						{
							Expect(tmpQueries).to.equal(1);
							tmpView.close();
							tmpView.reload();
							// Closed: invalidated but not re-queried yet.
							Expect(tmpQueries).to.equal(1);
							Expect(tmpView._loaded).to.equal(false);
							Expect(tmpView._loadedResults).to.deep.equal([]);
							tmpView.open();
							setTimeout(() =>
							{
								Expect(tmpQueries).to.equal(2);
								return fDone();
							}, 10);
						}, 10);
					}
				);
				test
				(
					'an OPEN async picker re-queries immediately',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						let tmpQueries = 0;
						const tmpView = tmpProvider.createPicker('ReloadOpenPicker',
							{ DataProvider: () => { tmpQueries++; return Promise.resolve({ results: [], hasMore: false }); } });
						tmpView.open();
						setTimeout(() =>
						{
							Expect(tmpQueries).to.equal(1);
							tmpView.reload();
							setTimeout(() =>
							{
								Expect(tmpQueries).to.equal(2);
								Expect(tmpView._open).to.equal(true);
								return fDone();
							}, 10);
						}, 10);
					}
				);
				test
				(
					'a static Options picker is a no-op (nothing cached to drop)',
					(fDone) =>
					{
						const tmpProvider = newProvider();
						const tmpView = tmpProvider.createPicker('ReloadStaticPicker', { Options: [ { Value: 'a', Text: 'A' } ] });
						Expect(tmpView.reload()).to.equal(tmpView);
						return fDone();
					}
				);
			}
		);
	}
);
