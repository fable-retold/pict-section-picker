/*
	`EmptyValues` — host-declared "nothing is selected" sentinels, on top of undefined/null/''.

	The bug it exists for: a pict-section-form marshal reads values through manyfest's getValueByHash,
	which substitutes the descriptor default for an address the model does not hold yet — and, absent an
	explicit `Default`, that is manyfest's per-DataType default, which is 0 for Number/Integer/Float
	(only String defaults to ''). So a pristine `{ DataType: 'Number', InputType: 'Picker' }` field — an
	entity FK, virtually always — marshalled in as 0 and the widget painted a literal "0" as if the user
	had picked something, with no placeholder styling. There is no entity #0; it read as a bug.

	The fix is DISPLAY-only, and these tests pin that: getValue() keeps returning the raw value, so the
	host's model (where 0-means-unset is a perfectly good pattern) is never rewritten. Two guards ride
	along: a picker with no EmptyValues configured behaves exactly as before, and a sentinel that
	resolves to a REAL source row (a static option literally valued 0) is a genuine selection.

	Uses the jsdom + real Pict harness like the other view tests.
*/
const libBrowserEnv = require('browser-env');
const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');
const libPictInputTypePicker = require('../source/form/Pict-Section-Picker-FormInput.js');

const Chai = require('chai');
const Expect = Chai.expect;

suite
(
	'Pict-Section-Picker EmptyValues (numeric unset sentinels)',
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
			_PickerProvider.createPicker(pHash, Object.assign(
				{
					DestinationAddress: `#${pHash}Host`,
					Mode: 'single',
					Placeholder: 'Select a Contractor…',
					Options: [],
				}, pOverrides || {}));

		/** The single-mode value slot the control paints from. */
		const valueSlot = (pPicker) => pPicker._buildState().SingleSlot[0];

		test
		(
			'a pristine Number field marshalling in as 0 paints the placeholder, not "0"',
			() =>
			{
				const tmpPicker = createPicker('Zero', { EmptyValues: [ 0 ], ResolveValue: () => Promise.resolve(null) });
				tmpPicker.setValue(0);

				const tmpSlot = valueSlot(tmpPicker);
				Expect(tmpSlot.DisplayText).to.equal('Select a Contractor…', 'the sentinel paints the placeholder');
				Expect(tmpSlot.NoValue).to.equal(true, 'NoValue drives the .pps-placeholder styling');
			}
		);

		test
		(
			'the string "0" (a csv round-trip through the hidden informary input) is the same sentinel',
			() =>
			{
				const tmpPicker = createPicker('ZeroString', { EmptyValues: [ 0 ], ResolveValue: () => Promise.resolve(null) });
				tmpPicker.setValue('0');

				Expect(valueSlot(tmpPicker).NoValue).to.equal(true, 'the sentinel compares as a string, so "0" matches 0');
			}
		);

		test
		(
			'the raw value survives — the suppression is display-only and never rewrites the model',
			() =>
			{
				const tmpPicker = createPicker('Model', { ValueAddress: 'AppData.QForm.Model', EmptyValues: [ 0 ] });
				tmpPicker.setValue(0);

				Expect(tmpPicker.getValue()).to.equal(0, 'getValue() still returns the sentinel');
				Expect(_Pict.AppData.QForm.Model).to.equal(0, 'the bound address still holds it');
			}
		);

		test
		(
			'a real id still paints as a selection',
			() =>
			{
				const tmpPicker = createPicker('Real', { EmptyValues: [ 0 ], ResolveValue: () => Promise.resolve(null) });
				tmpPicker.setValue(5512);

				const tmpSlot = valueSlot(tmpPicker);
				Expect(tmpSlot.NoValue).to.equal(false, 'a non-sentinel value is a selection');
				Expect(tmpSlot.DisplayText).to.equal('5512', 'the raw id shows until the async resolve paints the name');
			}
		);

		test
		(
			'without EmptyValues the widget behaves exactly as it did before (0 is a value)',
			() =>
			{
				const tmpPicker = createPicker('Legacy');
				tmpPicker.setValue(0);

				const tmpSlot = valueSlot(tmpPicker);
				Expect(tmpSlot.NoValue).to.equal(false, 'no sentinel configured → no behavior change');
				Expect(tmpSlot.DisplayText).to.equal('0');
			}
		);

		test
		(
			'a sentinel that IS a real option is a genuine selection (reality beats the sentinel)',
			() =>
			{
				const tmpPicker = createPicker('RealZero',
					{ EmptyValues: [ 0 ], Options: [ { Value: 0, Text: 'None' }, { Value: 1, Text: 'One' } ] });
				tmpPicker.setValue(0);

				const tmpSlot = valueSlot(tmpPicker);
				Expect(tmpSlot.NoValue).to.equal(false, 'a static option valued 0 is something the user can actually pick');
				Expect(tmpSlot.DisplayText).to.equal('None');
			}
		);

		test
		(
			'an entity picker never fires the async resolve for a sentinel (there is no entity #0)',
			() =>
			{
				const tmpResolved = [];
				const tmpPicker = createPicker('NoFetch',
					{
						EmptyValues: [ 0 ],
						DataProvider: () => Promise.resolve({ results: [], hasMore: false }),
						ResolveValue: (pValue) => { tmpResolved.push(pValue); return Promise.resolve(null); },
					});

				tmpPicker.setValue(0);
				Expect(tmpResolved).to.deep.equal([], 'no wasted read for the sentinel');

				tmpPicker.setValue(5512);
				Expect(tmpResolved).to.deep.equal([ 5512 ], 'a real id still resolves its display text');
			}
		);

		test
		(
			'multi mode drops the sentinel from the chips and shows the placeholder',
			() =>
			{
				const tmpPicker = createPicker('Multi',
					{ Mode: 'multi', EmptyValues: [ 0 ], ResolveValue: () => Promise.resolve(null) });
				tmpPicker.setValue('0');

				const tmpSlot = tmpPicker._buildState().MultiSlot[0];
				Expect(tmpSlot.Chips).to.have.length(0, 'no "0" chip');
				Expect(tmpSlot.PlaceholderSlot).to.have.length(1, 'the chips placeholder shows instead');
				Expect(tmpPicker.getValue()).to.deep.equal([ '0' ], 'the raw array is still what the host set');
			}
		);

		test
		(
			'the clearable affordances read the sentinel as empty ("Any" checked, no inline ×)',
			() =>
			{
				const tmpPicker = createPicker('Clearable', { AllowClear: true, EmptyValues: [ 0 ], ResolveValue: () => Promise.resolve(null) });
				tmpPicker.setValue(0);

				const tmpState = tmpPicker._buildState();
				Expect(tmpState.ClearSlot).to.have.length(0, 'nothing is selected, so there is nothing to clear');
				Expect(tmpState.ClearOptionSlot[0].Selected).to.equal(true, 'the pinned "Any" row is the active state');
			}
		);

		suite
		(
			'the pict-section-form adapter derives the sentinel from the descriptor DataType',
			() =>
			{
				/** The adapter's config builder, exercised without a form/DOM around it. */
				const emptyValuesFor = (pInput) =>
					libPictInputTypePicker.prototype._resolveEmptyValues.call({}, pInput);

				test('Number / Integer / Float get the 0 sentinel', () =>
				{
					Expect(emptyValuesFor({ DataType: 'Number', PictForm: {} })).to.deep.equal([ 0 ]);
					Expect(emptyValuesFor({ DataType: 'Integer', PictForm: {} })).to.deep.equal([ 0 ]);
					Expect(emptyValuesFor({ DataType: 'Float', PictForm: {} })).to.deep.equal([ 0 ]);
				});

				test('String (and anything else) gets none — manyfest already defaults those to \'\'', () =>
				{
					Expect(emptyValuesFor({ DataType: 'String', PictForm: {} })).to.deep.equal([]);
					Expect(emptyValuesFor({ DataType: 'PreciseNumber', PictForm: {} })).to.deep.equal([]);
					Expect(emptyValuesFor({ PictForm: {} })).to.deep.equal([]);
				});

				test('PictForm.EmptyValues overrides, including [] to opt out and show the 0', () =>
				{
					Expect(emptyValuesFor({ DataType: 'Number', PictForm: { EmptyValues: [] } })).to.deep.equal([]);
					Expect(emptyValuesFor({ DataType: 'Number', PictForm: { EmptyValues: [ 0, -1 ] } })).to.deep.equal([ 0, -1 ]);
				});
			}
		);
	}
);
