/*
	SearchByID: an entity picker also finds a record by its ID. A search that is just a number keeps the text
	search and floats the record with that ID to the top of the first page; `#<number>` matches the ID only.
	On by default for entity pickers; `SearchByID: false` opts out. `SearchIDField` names the ID column
	(default `ID<Entity>`), which may differ from the picker's ValueField.
*/
const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');
const libFormInput = require('../source/form/Pict-Section-Picker-FormInput.js');

const newProvider = () =>
{
	const tmpPict = new libPict({ LogStreams: [ { loggertype: 'console', streamtype: 'console', level: 'error' } ] });
	return tmpPict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);
};

/**
 * Fake entity reads: the pinned INN fetch gets pPinned, every other read gets pNatural.
 * @return {Array<{Filter: string, Cursor: number}>} the calls made
 */
const withFakeReads = (pProvider, pPinned, pNatural) =>
{
	const tmpCalls = [];
	pProvider.pict.EntityProvider =
	{
		getEntitySetPage: (pEntity, pFilter, pCursor, pLimit, fCallback) =>
		{
			tmpCalls.push({ Filter: pFilter, Cursor: pCursor });
			return fCallback(null, (pFilter.indexOf('~INN~') > -1) ? pPinned : pNatural);
		},
	};
	return tmpCalls;
};

suite
(
	'Pict-Section-Picker SearchByID',
	() =>
	{
		test
		(
			'a number keeps the text search and floats the record with that ID to the top',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [ { IDBook: 42, Title: 'The Answer' } ], [ { IDBook: 7, Title: 'Catch 42' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('42', 0).then((pResult) =>
				{
					Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 42, 7 ]);
					const tmpNatural = tmpCalls.find((pCall) => pCall.Filter.indexOf('~INN~') < 0);
					Expect(tmpNatural.Filter, 'the text search still runs').to.contain('FBV~Title~LK~');
					Expect(tmpNatural.Filter, 'the ID match is held out of the natural list').to.contain('FBL~IDBook~NIN~42');
					Expect(tmpCalls.find((pCall) => pCall.Filter.indexOf('FBL~IDBook~INN~42') > -1), 'the ID match is fetched').to.not.equal(undefined);
				});
			}
		);

		test
		(
			'a number with no record of that ID returns the text matches alone',
			() =>
			{
				const tmpProvider = newProvider();
				withFakeReads(tmpProvider, [], [ { IDBook: 7, Title: 'Catch 42' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('42', 0).then((pResult) =>
				{
					Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 7 ]);
				});
			}
		);

		test
		(
			'#<number> matches the ID only',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [], [ { IDBook: 42, Title: 'The Answer' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('#42', 0).then((pResult) =>
				{
					Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 42 ]);
					Expect(tmpCalls).to.have.length(1);
					Expect(tmpCalls[0].Filter).to.contain('FBV~IDBook~EQ~42');
					Expect(tmpCalls[0].Filter, 'no text clause').to.not.contain('~LK~');
				});
			}
		);

		test
		(
			'later pages of a number search are the text matches only, never the pinned record again',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [ { IDBook: 42, Title: 'The Answer' } ], [ { IDBook: 8, Title: '42 Again' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ], PageSize: 1 });
				return tmpData('42', 1).then((pResult) =>
				{
					Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 8 ]);
					Expect(tmpCalls.every((pCall) => pCall.Filter.indexOf('~INN~') < 0), 'no pinned fetch past page 0').to.equal(true);
					Expect(tmpCalls[0].Filter).to.contain('FBL~IDBook~NIN~42');
				});
			}
		);

		test
		(
			'words, mixed text and digits, and several tokens search as before',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [], [ { IDBook: 7, Title: 'LA 348' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('LA 348', 0)
					.then(() => tmpData('A42', 0))
					.then(() => tmpData('#4a', 0))
					.then(() =>
					{
						Expect(tmpCalls.every((pCall) => pCall.Filter.indexOf('IDBook') < 0), 'no ID clause for non-ID searches').to.equal(true);
					});
			}
		);

		test
		(
			'SearchByID: false opts out: a number is plain text and #<number> is literal text',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [ { IDBook: 42, Title: 'The Answer' } ], [ { IDBook: 7, Title: 'Catch 42' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ], SearchByID: false });
				return tmpData('42', 0)
					.then((pResult) => Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 7 ]))
					.then(() => tmpData('#42', 0))
					.then(() =>
					{
						Expect(tmpCalls.every((pCall) => pCall.Filter.indexOf('IDBook') < 0)).to.equal(true);
						Expect(tmpCalls[1].Filter).to.contain(`FBV~Title~LK~${encodeURIComponent('%#42%')}`);
					});
			}
		);

		test
		(
			'SearchIDField pins by the ID column even when the picker stores another value',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [ { IDBook: 42, GUIDBook: 'g-42', Title: 'The Answer' } ], [ { IDBook: 7, GUIDBook: 'g-7', Title: 'Catch 42' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', ValueField: 'GUIDBook', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('42', 0).then((pResult) =>
				{
					Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 'g-42', 'g-7' ]);
					Expect(tmpCalls.find((pCall) => pCall.Filter.indexOf('FBL~IDBook~INN~42') > -1)).to.not.equal(undefined);
					Expect(tmpCalls.find((pCall) => pCall.Filter.indexOf('FBL~IDBook~NIN~42') > -1)).to.not.equal(undefined);
				});
			}
		);

		test
		(
			'the pinned ID record stays inside the picker\'s mandatory scope',
			() =>
			{
				const tmpProvider = newProvider();
				const tmpCalls = withFakeReads(tmpProvider, [], []);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ], BaseFilter: 'FBV~IDShelf~EQ~3' });
				return tmpData('42', 0).then(() =>
				{
					const tmpPinned = tmpCalls.find((pCall) => pCall.Filter.indexOf('~INN~') > -1);
					Expect(tmpPinned.Filter).to.contain('FBV~IDShelf~EQ~3');
				});
			}
		);

		test
		(
			'the row found by its ID carries a "<Entity> #<ID>" marker; text matches do not',
			() =>
			{
				const tmpProvider = newProvider();
				withFakeReads(tmpProvider, [ { IDBook: 42, Title: 'The Answer' } ], [ { IDBook: 7, Title: 'Catch 42' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('42', 0).then((pResult) =>
				{
					Expect(pResult.results[0].IDMatch).to.equal('Book #42');
					Expect(pResult.results[1].IDMatch).to.equal(undefined);
				});
			}
		);

		test
		(
			'#<number> rows carry the marker too',
			() =>
			{
				const tmpProvider = newProvider();
				withFakeReads(tmpProvider, [], [ { IDBook: 42, Title: 'The Answer' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ] });
				return tmpData('#42', 0).then((pResult) => Expect(pResult.results[0].IDMatch).to.equal('Book #42'));
			}
		);

		test
		(
			'IDMatchLabel as a word replaces the entity name; as a function it writes the whole marker',
			() =>
			{
				const tmpProvider = newProvider();
				withFakeReads(tmpProvider, [ { IDBook: 42, Title: 'The Answer' } ], []);
				const tmpWord = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ], IDMatchLabel: 'Volume' });
				const tmpFunction = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ], IDMatchLabel: (pRecord, pID) => `ID ${pID} (${pRecord.Title.length} chars)` });
				return tmpWord('42', 0)
					.then((pResult) => Expect(pResult.results[0].IDMatch).to.equal('Volume #42'))
					.then(() => tmpFunction('42', 0))
					.then((pResult) => Expect(pResult.results[0].IDMatch).to.equal('ID 42 (10 chars)'));
			}
		);

		test
		(
			'PriorityValues pins on a browse are not marked as ID matches',
			() =>
			{
				const tmpProvider = newProvider();
				withFakeReads(tmpProvider, [ { IDBook: 7, Title: 'Pinned' } ], [ { IDBook: 1, Title: 'A' } ]);
				const tmpData = tmpProvider.createEntityDataProvider({ Entity: 'Book', TextField: 'Title', SearchFields: [ 'Title' ], PriorityValues: [ 7 ] });
				return tmpData('', 0).then((pResult) =>
				{
					Expect(pResult.results.map((pRow) => pRow.Value)).to.deep.equal([ 7, 1 ]);
					Expect(pResult.results.every((pRow) => pRow.IDMatch === undefined)).to.equal(true);
				});
			}
		);

		test
		(
			'the open list shows the marker after the label, as text, and the selected value does not',
			() =>
			{
				require('browser-env')({ url: 'http://localhost/' });
				const tmpPict = new libPict({ LogStreams: [ { loggertype: 'console', streamtype: 'console', level: 'error' } ] });
				tmpPict.LogNoisiness = 0;
				tmpPict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);
				tmpPict.AppData.QForm = {};
				document.body.textContent = '';
				const tmpHost = document.createElement('div');
				tmpHost.id = 'MarkHost';
				document.body.append(tmpHost);
				const tmpPicker = tmpPict.providers['Pict-Section-Picker'].createPicker('Mark',
					{
						DestinationAddress: '#MarkHost',
						Mode: 'single',
						ValueAddress: 'AppData.QForm.Mark',
						Options: [ { Value: 42, Text: 'The Answer', IDMatch: 'Book <#42>' }, { Value: 7, Text: 'Catch 42' } ],
					});
				tmpPicker.render();
				tmpPicker.open();
				const tmpMarks = [ ...document.querySelectorAll('#MarkHost .pps-option-idmatch') ];
				Expect(tmpMarks.map((pEl) => pEl.textContent)).to.deep.equal([ 'Book <#42>' ]);
				Expect(tmpMarks[0].previousElementSibling.textContent).to.equal('The Answer');
				tmpPicker.selectFromElement(document.querySelector('#MarkHost .pps-option'));
				Expect(document.querySelector('#MarkHost .pps-value').textContent).to.equal('The Answer');
			}
		);

		test
		(
			'the form adapter passes PictForm.SearchByID and SearchIDField through',
			() =>
			{
				const tmpPict = new libPict({ LogStreams: [ { loggertype: 'console', streamtype: 'console', level: 'error' } ] });
				const tmpInput = Object.create(libFormInput.PictInputTypePicker.prototype);
				tmpInput.pict = tmpPict;
				const tmpConfig = tmpInput._buildPickerConfig({ PictForm: { Entity: 'Book', SearchByID: false, SearchIDField: 'IDVolume' } }, '#Host', () => undefined);
				Expect(tmpConfig.SearchByID).to.equal(false);
				Expect(tmpConfig.SearchIDField).to.equal('IDVolume');
			}
		);
	}
);
