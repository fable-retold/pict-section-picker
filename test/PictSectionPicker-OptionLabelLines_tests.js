/*
	OptionLabelLines: how many lines a long option label may wrap to in the open list before it ends in an
	ellipsis. The view hands the count to the stylesheet as --pps-option-lines on the list; the label rule
	clamps to it. Uses the jsdom + real Pict harness like the other view tests.
*/
const libBrowserEnv = require('browser-env');
const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');
const libPictProviderPicker = require('../source/providers/Pict-Provider-Picker.js');
const libPictInputPicker = require('../source/form/Pict-Section-Picker-FormInput.js');

const Chai = require('chai');
const Expect = Chai.expect;

suite
(
	'Pict-Section-Picker OptionLabelLines',
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
					Options: [ { Value: 'a', Text: 'A first-edition hardcover with a long subtitle that runs well past the width of the list' } ],
				}, pOverrides || {}));
			tmpPicker.render();
			tmpPicker.open();
			return tmpPicker;
		};

		// Read from the style attribute: jsdom's style parser drops custom properties.
		const listLines = (pHash) =>
		{
			const tmpMatch = /--pps-option-lines:\s*([^;"]+)/.exec(document.querySelector(`#${pHash}Host .pps-list`).getAttribute('style') || '');
			return tmpMatch ? tmpMatch[1].trim() : '';
		};

		test
		(
			'with no OptionLabelLines the list allows 3 lines',
			() =>
			{
				createPicker('Def');
				Expect(listLines('Def')).to.equal('3');
			}
		);

		test
		(
			'a number sets the line count, and 1 keeps rows on one line',
			() =>
			{
				createPicker('Five', { OptionLabelLines: 5 });
				Expect(listLines('Five')).to.equal('5');
				createPicker('One', { OptionLabelLines: 1 });
				Expect(listLines('One')).to.equal('1');
			}
		);

		test
		(
			'0 or false lifts the limit',
			() =>
			{
				createPicker('Zero', { OptionLabelLines: 0 });
				Expect(listLines('Zero')).to.equal('none');
				createPicker('Off', { OptionLabelLines: false });
				Expect(listLines('Off')).to.equal('none');
			}
		);

		test
		(
			'an unusable value (undefined from an adapter, negative, text) falls back to 3',
			() =>
			{
				createPicker('Undef', { OptionLabelLines: undefined });
				Expect(listLines('Undef')).to.equal('3');
				createPicker('Neg', { OptionLabelLines: -2 });
				Expect(listLines('Neg')).to.equal('3');
				createPicker('Text', { OptionLabelLines: 'many' });
				Expect(listLines('Text')).to.equal('3');
			}
		);

		test
		(
			'the stylesheet clamps the option label to --pps-option-lines and lets it wrap',
			() =>
			{
				const tmpPict = new libPict();
				let tmpCSS = '';
				tmpPict.CSSMap = { addCSS: (pHash, pCSS) =>
				{
					if (pHash === 'Pict-Section-Picker-CSS')
					{
						tmpCSS = pCSS;
					}
				} };
				new libPictProviderPicker(tmpPict, {});
				const tmpRule = tmpCSS.match(/^\.pps-option-label \{[^}]*\}/m)[0];
				Expect(tmpRule).to.contain('-webkit-line-clamp: var(--pps-option-lines, 3)');
				Expect(tmpRule).to.contain('line-clamp: var(--pps-option-lines, 3)');
				Expect(tmpRule).to.not.contain('nowrap');
			}
		);

		test
		(
			'the form adapter passes PictForm.OptionLabelLines through',
			() =>
			{
				const tmpInput = _Pict.addProvider('Pict-Input-Picker-Test', {}, libPictInputPicker);
				const tmpConfig = tmpInput._buildPickerConfig({ PictForm: { OptionLabelLines: 2 } }, '#Host', () => {});
				Expect(tmpConfig.OptionLabelLines).to.equal(2);
			}
		);
	}
);
