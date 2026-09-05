/*
	Regression test for the multi-select placeholder wrapping.

	A quick-filter bar puts single- and multi-select pickers side by side. The
	single-select value area has always truncated (.pps-value), but the
	multi-select placeholder did not, so a long label wrapped to a second line,
	grew the control, and knocked the neighbouring filters' labels out of
	vertical alignment. Both must truncate identically.

	The stylesheet is module-local, so it is captured through the real
	registration path (CSSMap.addCSS) rather than reaching into the module.
*/

const Chai   = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libPickerProvider = require('../source/providers/Pict-Provider-Picker.js');

/**
 * Instantiate the provider against a pict whose CSSMap records what is registered.
 *
 * @return {string} The picker stylesheet as registered at runtime.
 */
function registeredPickerCSS()
{
	const tmpPict = new libPict();
	let tmpCSS = '';
	tmpPict.CSSMap = { addCSS: (pHash, pCSS) => { if (pHash === 'Pict-Section-Picker-CSS') { tmpCSS = pCSS; } } };
	new libPickerProvider(tmpPict, {});
	return tmpCSS;
}

/**
 * Pull one CSS rule body out of a stylesheet by selector.
 *
 * @param {string} pCSS - The stylesheet text.
 * @param {string} pSelector - The exact selector text to find.
 * @return {string} The declaration block, comments stripped and whitespace collapsed.
 */
function ruleBodyFor(pCSS, pSelector)
{
	const tmpIndex = pCSS.indexOf(pSelector + ' {');
	if (tmpIndex < 0) { return ''; }
	const tmpOpen = pCSS.indexOf('{', tmpIndex);
	const tmpClose = pCSS.indexOf('}', tmpOpen);
	return pCSS.slice(tmpOpen + 1, tmpClose).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
}

suite('PictSectionPicker Placeholder Truncation', () =>
{
	test('the picker stylesheet is registered on construction', () =>
	{
		Expect(registeredPickerCSS()).to.contain('.pps-chips-ph');
	});

	test('the multi-select placeholder truncates instead of wrapping', () =>
	{
		const tmpRule = ruleBodyFor(registeredPickerCSS(), '.pps-chips-ph');
		Expect(tmpRule, '.pps-chips-ph rule should be present').to.not.equal('');
		Expect(tmpRule).to.contain('white-space: nowrap');
		Expect(tmpRule).to.contain('text-overflow: ellipsis');
		Expect(tmpRule).to.contain('overflow: hidden');
	});

	test('it can actually shrink inside the flex chips row', () =>
	{
		// Without min-width:0 a flex item refuses to shrink below its content
		// width, so the ellipsis never engages and the row wraps anyway.
		Expect(ruleBodyFor(registeredPickerCSS(), '.pps-chips-ph')).to.contain('min-width: 0');
	});

	test('single-select truncation is unchanged (the behaviour being matched)', () =>
	{
		const tmpRule = ruleBodyFor(registeredPickerCSS(), '.pps-value');
		Expect(tmpRule).to.contain('white-space: nowrap');
		Expect(tmpRule).to.contain('text-overflow: ellipsis');
	});
});
