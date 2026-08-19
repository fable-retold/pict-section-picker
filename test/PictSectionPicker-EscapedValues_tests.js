/*
	Regression guard: option values / labels that contain a double quote (e.g. the inch mark `1"`), an
	apostrophe, or other HTML-significant characters must not break the widget. Historically the option /
	chip / card / decorate handlers inlined the raw value into the onclick attribute
	(`onclick="….select('1"')"`), so a `"` closed the attribute and produced an
	`Uncaught SyntaxError: Invalid or unexpected token`. The fix carries the value in an HTML-escaped
	`data-` attribute that the handler reads back (the browser decodes it), and HTML-escapes every value
	that lands in an attribute / text node. These tests assert both the safe markup and the round-trip.

	Uses the jsdom + real Pict harness like the other view tests.
*/
const libBrowserEnv = require('browser-env');
const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');

const Chai = require('chai');
const Expect = Chai.expect;

suite
(
	'Pict-Section-Picker escaped values (quotes in option values / labels)',
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

		// Inch marks, an apostrophe, and a mix of HTML-significant characters.
		const buildOptions = () =>
		[
			{ Value: '1"', Text: '1"' },
			{ Value: '2"', Text: '2"' },
			{ Value: 'O\'Brien', Text: 'O\'Brien' },
			{ Value: 'a<b>&"', Text: 'a<b>&"' },
		];

		const createPicker = (pHash, pOverrides) =>
			_PickerProvider.createPicker(pHash, Object.assign(
				{
					DestinationAddress: `#${pHash}Host`,
					Mode: 'single',
					ValueAddress: `AppData.QForm.${pHash}`,
					Options: buildOptions(),
				}, pOverrides || {}));

		test
		(
			'option rows carry the value in an HTML-escaped data attribute, never inlined into the handler',
			() =>
			{
				document.body.innerHTML = '<div id="OptHost"></div>';
				const tmpPicker = createPicker('Opt', { DestinationAddress: '#OptHost' });
				tmpPicker.render();
				const tmpHTML = document.getElementById('OptHost').innerHTML;

				// The historical break: the raw value inlined into the onclick string.
				Expect(tmpHTML).to.not.contain('select(\'1"\')', 'the raw inch-mark value must not be inlined into the handler');
				Expect(tmpHTML).to.contain('selectFromElement(this)', 'the option handler reads the value from the element');
				// The `"` MUST be escaped in the serialized attribute (else it would close it) — the core of the bug.
				Expect(tmpHTML).to.contain('data-pps-valuekey="1&quot;"', 'a double-quote value is HTML-escaped in the data attribute');

				// The real invariant for every value (regardless of which characters the serializer normalizes):
				// each option element decodes its data attribute back to the exact raw value.
				const tmpByKey = {};
				for (const tmpEl of document.querySelectorAll('#OptHost .pps-option')) { tmpByKey[tmpEl.getAttribute('data-pps-valuekey')] = tmpEl; }
				for (const tmpValue of [ '1"', '2"', 'O\'Brien', 'a<b>&"' ])
				{
					Expect(tmpByKey[tmpValue], `an option element round-trips data-pps-valuekey back to ${JSON.stringify(tmpValue)}`).to.be.ok;
				}
			}
		);

		test
		(
			'the option element decodes its data attribute back to the raw value, and driving it selects that value',
			() =>
			{
				document.body.innerHTML = '<div id="RtHost"></div>';
				const tmpPicker = createPicker('Rt', { DestinationAddress: '#RtHost' });
				tmpPicker.render();

				const tmpOptions = Array.from(document.querySelectorAll('#RtHost .pps-option'));
				const tmpInch = tmpOptions.find((pEl) => pEl.getAttribute('data-pps-valuekey') === '1"');
				Expect(tmpInch, 'the rendered option element decodes data-pps-valuekey back to `1"`').to.be.ok;

				tmpPicker.selectFromElement(tmpInch);
				Expect(tmpPicker.getValue()).to.equal('1"', 'selecting the inch-mark option through the real element stores the raw value');
			}
		);

		test
		(
			'OnChange fires with the raw (unescaped) value',
			() =>
			{
				document.body.innerHTML = '<div id="OcHost"></div>';
				let tmpChanged;
				const tmpPicker = createPicker('Oc', { DestinationAddress: '#OcHost', OnChange: (pValue) => { tmpChanged = pValue; } });
				tmpPicker.render();

				// Shim reads the (already-decoded) attribute value off the clicked element.
				tmpPicker.selectFromElement({ getAttribute: (pAttr) => ((pAttr === 'data-pps-valuekey') ? 'O\'Brien' : null) });
				Expect(tmpChanged).to.equal('O\'Brien', 'OnChange receives the raw value');
				Expect(tmpPicker.getValue()).to.equal('O\'Brien');
			}
		);

		test
		(
			'the selected-value display escapes a quoted value and decodes back to the raw text',
			() =>
			{
				document.body.innerHTML = '<div id="ValHost"></div>';
				_Pict.AppData.QForm.Val = '1"';
				const tmpPicker = createPicker('Val', { DestinationAddress: '#ValHost' });
				tmpPicker.render();

				const tmpHTML = document.getElementById('ValHost').innerHTML;
				Expect(tmpHTML).to.contain('1&quot;', 'the value box carries the escaped value');
				const tmpValueEl = document.querySelector('#ValHost .pps-value');
				Expect(tmpValueEl && tmpValueEl.textContent).to.equal('1"', 'the rendered value text decodes back to `1"`');
			}
		);

		test
		(
			'multi chips carry an escaped remove handle, and removeChipFromElement removes the right value',
			() =>
			{
				document.body.innerHTML = '<div id="MultiHost"></div>';
				_Pict.AppData.QForm.Multi = [ '1"', '2"' ];
				const tmpPicker = createPicker('Multi', { DestinationAddress: '#MultiHost', Mode: 'multi' });
				tmpPicker.render();

				const tmpHTML = document.getElementById('MultiHost').innerHTML;
				Expect(tmpHTML).to.not.contain('removeChip(\'1"\')', 'the raw value must not be inlined into the chip handler');
				Expect(tmpHTML).to.contain('removeChipFromElement(this)', 'the chip × reads the value from the element');
				Expect(tmpHTML).to.contain('data-pps-valuekey="1&quot;"', 'the chip remove handle carries the escaped value');

				const tmpRemovers = Array.from(document.querySelectorAll('#MultiHost .pps-chip-x'));
				const tmpRemoveInch = tmpRemovers.find((pEl) => pEl.getAttribute('data-pps-valuekey') === '1"');
				Expect(tmpRemoveInch, 'a chip × element decodes back to `1"`').to.be.ok;

				tmpPicker.removeChipFromElement(tmpRemoveInch);
				Expect(tmpPicker.getValue()).to.deep.equal([ '2"' ], 'removing the inch-mark chip leaves only the other value');
			}
		);
	}
);
