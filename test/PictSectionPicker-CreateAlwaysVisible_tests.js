/*
	CreateAlwaysVisible / CreateLabel: the creatable "Create …" row can be pinned at the top of the open
	list whatever the search says, so creating needs no typing, and its text can be set by the host.
	Uses the jsdom + real Pict harness like the other view tests.
*/
const libBrowserEnv = require('browser-env');
const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');

const Chai = require('chai');
const Expect = Chai.expect;

suite
(
	'Pict-Section-Picker CreateAlwaysVisible',
	() =>
	{
		let _Pict;
		let _PickerProvider;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;
			_Pict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);
			_PickerProvider = _Pict.providers['Pict-Section-Picker'];
			_Pict.AppData.QForm = {};
		});

		const createPicker = (pHash, pOverrides) =>
		{
			document.body.textContent = '';
			const tmpHost = document.createElement('div');
			tmpHost.id = `${pHash}Host`;
			document.body.append(tmpHost);
			const tmpPicker = _PickerProvider.createPicker(pHash, Object.assign(
				{
					DestinationAddress: `#${pHash}Host`,
					Mode: 'single',
					ValueAddress: `AppData.QForm.${pHash}`,
					Options: [ { Value: 'a', Text: 'Alpha' }, { Value: 'b', Text: 'Beta' } ],
				}, pOverrides || {}));
			tmpPicker.render();
			tmpPicker.open();
			return tmpPicker;
		};

		const createRow = (pHash) => document.querySelector(`#${pHash}Host .pps-create`);
		const createRowText = (pHash) => document.querySelector(`#${pHash}Host .pps-create-label`).textContent;
		const settle = () => new Promise((fResolve) => setTimeout(fResolve, 0));
		const makeRecord = (pTerm) => ({ Value: 'new', Text: pTerm ? `New: ${pTerm}` : 'A new one' });

		test
		(
			'without CreateAlwaysVisible an empty search shows no create row',
			() =>
			{
				createPicker('Def', { OnCreate: makeRecord });
				Expect(createRow('Def'), 'no create row before typing').to.not.be.ok;
			}
		);

		test
		(
			'without CreateAlwaysVisible a typed term still reads Create "<term>"',
			() =>
			{
				const tmpPicker = createPicker('Typed', { OnCreate: makeRecord });
				tmpPicker.search('Gamma');
				Expect(createRowText('Typed')).to.equal('Create “Gamma”');
			}
		);

		test
		(
			'with CreateAlwaysVisible the row shows on open, above the options, reading "Create new"',
			() =>
			{
				createPicker('Pinned', { OnCreate: makeRecord, CreateAlwaysVisible: true });
				Expect(createRow('Pinned'), 'the create row renders with no search').to.be.ok;
				Expect(createRowText('Pinned')).to.equal('Create new');
				const tmpFirstOption = document.querySelector('#PinnedHost .pps-option');
				Expect(tmpFirstOption, 'the options still render').to.be.ok;
				Expect(createRow('Pinned').compareDocumentPosition(tmpFirstOption) & Node.DOCUMENT_POSITION_FOLLOWING, 'the create row comes first').to.be.ok;
			}
		);

		test
		(
			'with CreateAlwaysVisible the row stays for an exact match and for a search with no matches',
			() =>
			{
				const tmpPicker = createPicker('Stays', { OnCreate: makeRecord, CreateAlwaysVisible: true });
				tmpPicker.search('Alpha');
				Expect(createRow('Stays'), 'shown for an exact match').to.be.ok;
				tmpPicker.search('zzz');
				Expect(createRow('Stays'), 'shown with no matches').to.be.ok;
				Expect(document.querySelector('#StaysHost .pps-empty'), 'no empty text beside the create row').to.not.be.ok;
			}
		);

		test
		(
			'CreateAlwaysVisible without OnCreate shows no create row',
			() =>
			{
				createPicker('NoFn', { CreateAlwaysVisible: true });
				Expect(createRow('NoFn')).to.not.be.ok;
			}
		);

		test
		(
			'choosing the pinned row with no search calls OnCreate with an empty term and selects the record',
			async () =>
			{
				const tmpTerms = [];
				const tmpChanges = [];
				const tmpPicker = createPicker('Make',
					{
						CreateAlwaysVisible: true,
						OnCreate: (pTerm) =>
						{
							tmpTerms.push(pTerm);
							return Promise.resolve(makeRecord(pTerm));
						},
						OnChange: (pValue) => tmpChanges.push(pValue),
					});
				tmpPicker.createFromSearch();
				await settle();
				Expect(tmpTerms).to.deep.equal([ '' ]);
				Expect(_Pict.AppData.QForm.Make).to.equal('new');
				Expect(tmpChanges).to.deep.equal([ 'new' ]);
			}
		);

		test
		(
			'choosing the pinned row a second time does not duplicate the created option',
			async () =>
			{
				const tmpPicker = createPicker('Twice', { CreateAlwaysVisible: true, OnCreate: () => ({ Value: 'new', Text: 'A new one' }) });
				tmpPicker.createFromSearch();
				await settle();
				tmpPicker.open();
				tmpPicker.createFromSearch();
				await settle();
				Expect(tmpPicker.options.Options.filter((pRow) => pRow.Value === 'new')).to.have.length(1);
			}
		);

		test
		(
			'Enter with an empty search and nothing highlighted does not create',
			async () =>
			{
				let tmpCalls = 0;
				const tmpPicker = createPicker('Enter', { CreateAlwaysVisible: true, OnCreate: () => { tmpCalls++; return makeRecord(''); } });
				tmpPicker.onSearchKey({ key: 'Enter', preventDefault: () => {} });
				await settle();
				Expect(tmpCalls).to.equal(0);
				tmpPicker.search('Gamma');
				tmpPicker.onSearchKey({ key: 'Enter', preventDefault: () => {} });
				await settle();
				Expect(tmpCalls, 'a typed term still creates on Enter').to.equal(1);
			}
		);

		test
		(
			'a string CreateLabel replaces the row text, with or without a search',
			() =>
			{
				const tmpPicker = createPicker('Str', { CreateAlwaysVisible: true, OnCreate: makeRecord, CreateLabel: 'Add a new record...' });
				Expect(createRowText('Str')).to.equal('Add a new record...');
				tmpPicker.search('Gamma');
				Expect(createRowText('Str')).to.equal('Add a new record...');
			}
		);

		test
		(
			'a function CreateLabel gets the trimmed search term',
			() =>
			{
				const tmpTerms = [];
				const tmpPicker = createPicker('Fn',
					{
						CreateAlwaysVisible: true,
						OnCreate: makeRecord,
						CreateLabel: (pTerm) =>
						{
							tmpTerms.push(pTerm);
							return pTerm ? `Add ${pTerm}` : 'Add one';
						},
					});
				Expect(createRowText('Fn')).to.equal('Add one');
				tmpPicker.search('  Gamma ');
				Expect(createRowText('Fn')).to.equal('Add Gamma');
				Expect(tmpTerms).to.include('');
				Expect(tmpTerms).to.include('Gamma');
			}
		);

		test
		(
			'a CreateLabel that throws or returns blank falls back to the default',
			() =>
			{
				createPicker('Throw', { CreateAlwaysVisible: true, OnCreate: makeRecord, CreateLabel: () => { throw new Error('boom'); } });
				Expect(createRowText('Throw')).to.equal('Create new');
				createPicker('Blank', { CreateAlwaysVisible: true, OnCreate: makeRecord, CreateLabel: () => '' });
				Expect(createRowText('Blank')).to.equal('Create new');
			}
		);

		test
		(
			'the label and the typed term are rendered as text, never as markup',
			() =>
			{
				createPicker('Esc', { CreateAlwaysVisible: true, OnCreate: makeRecord, CreateLabel: '<b>new</b> & "quoted"' });
				Expect(createRowText('Esc')).to.equal('<b>new</b> & "quoted"');
				Expect(createRow('Esc').querySelector('b'), 'no element is created from the label').to.not.be.ok;
				const tmpPicker = createPicker('EscTerm', { OnCreate: makeRecord });
				tmpPicker.search('<i>x</i>');
				Expect(createRowText('EscTerm')).to.equal('Create “<i>x</i>”');
				Expect(createRow('EscTerm').querySelector('i'), 'no element is created from the term').to.not.be.ok;
			}
		);
	}
);
