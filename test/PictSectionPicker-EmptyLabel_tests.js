/*
	EmptyLabel: the text the open dropdown shows when a search has no options. A string, or a function of the
	search term that is asked again on every empty render, so a host can explain why the list is empty
	(e.g. its own scope narrowed it). Uses the jsdom + real Pict harness like the other view tests.
*/
const libBrowserEnv = require('browser-env');
const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');

const Chai = require('chai');
const Expect = Chai.expect;

suite
(
	'Pict-Section-Picker EmptyLabel',
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

		const emptyElement = (pHash) => document.querySelector(`#${pHash}Host .pps-empty`);

		test
		(
			'with no EmptyLabel an empty search still reads "No matches"',
			() =>
			{
				const tmpPicker = createPicker('Def');
				tmpPicker.search('zzz');
				Expect(emptyElement('Def'), 'the empty row renders').to.be.ok;
				Expect(emptyElement('Def').textContent).to.equal('No matches');
			}
		);

		test
		(
			'a string EmptyLabel replaces the empty text',
			() =>
			{
				const tmpPicker = createPicker('Str', { EmptyLabel: 'Nothing in this list' });
				tmpPicker.search('zzz');
				Expect(emptyElement('Str').textContent).to.equal('Nothing in this list');
			}
		);

		test
		(
			'a function EmptyLabel gets the search term and is asked again on each empty render',
			() =>
			{
				const tmpTerms = [];
				const tmpPicker = createPicker('Fn',
					{
						EmptyLabel: (pSearchTerm) =>
						{
							tmpTerms.push(pSearchTerm);
							return `Nothing for ${pSearchTerm}`;
						},
					});
				tmpPicker.search('zzz');
				Expect(emptyElement('Fn').textContent).to.equal('Nothing for zzz');
				tmpPicker.search('qqq');
				Expect(emptyElement('Fn').textContent).to.equal('Nothing for qqq');
				Expect(tmpTerms).to.include('zzz');
				Expect(tmpTerms).to.include('qqq');
			}
		);

		test
		(
			'the function is not consulted while the list has options',
			() =>
			{
				let tmpCalls = 0;
				const tmpPicker = createPicker('Some', { EmptyLabel: () => { tmpCalls++; return 'unused'; } });
				tmpPicker.search('Al');
				Expect(emptyElement('Some'), 'no empty row while an option matches').to.not.be.ok;
				Expect(tmpCalls).to.equal(0);
			}
		);

		test
		(
			'the label is rendered as text, never as markup',
			() =>
			{
				const tmpPicker = createPicker('Esc', { EmptyLabel: () => '<b>none</b> & "quoted"' });
				tmpPicker.search('zzz');
				Expect(emptyElement('Esc').textContent).to.equal('<b>none</b> & "quoted"');
				Expect(emptyElement('Esc').querySelector('b'), 'no element is created from the label').to.not.be.ok;
			}
		);

		test
		(
			'a function that throws or returns nothing falls back to "No matches"',
			() =>
			{
				const tmpThrows = createPicker('Throw', { EmptyLabel: () => { throw new Error('host bug'); } });
				tmpThrows.search('zzz');
				Expect(emptyElement('Throw').textContent).to.equal('No matches');

				const tmpBlank = createPicker('Blank', { EmptyLabel: () => '' });
				tmpBlank.search('zzz');
				Expect(emptyElement('Blank').textContent).to.equal('No matches');
			}
		);
	}
);
