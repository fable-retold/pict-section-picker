/*
	Regression test for the backdrop swallowing the click that dismissed it.

	While a picker is open, `.pps-backdrop` is a transparent full-viewport layer
	(position:fixed; inset:0) so an outside click closes the dropdown without a
	document listener. The cost, unnoticed until it was measured on a filter bar:
	that click is CONSUMED. The Apply button underneath never fired — its handler
	logged zero calls on the first click and one on the second — so every filter
	change appeared to need two clicks.

	Closing should not also eat the click. The backdrop now re-dispatches to
	whatever is under the cursor once it has hidden itself.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv();

const Chai   = require('chai');
const Expect = Chai.expect;

const libPickerView = require('../source/views/PictView-Picker.js');

/**
 * A picker view stub with just enough shape to exercise closeFromBackdrop:
 * close() records that it ran and hides the backdrop, as the real paint does.
 *
 * @param {Element} pBackdrop - The backdrop element.
 * @return {object} The stub.
 */
function pickerStub(pBackdrop)
{
	return {
		closed: 0,
		close: function() { this.closed++; if (pBackdrop) { pBackdrop.style.display = 'none'; } },
		closeFromBackdrop: libPickerView.prototype.closeFromBackdrop,
	};
}

suite('PictSectionPicker Backdrop Passthrough', () =>
{
	let tmpBackdrop = null;
	let tmpButton = null;
	let tmpClicks = 0;
	let tmpOriginalElementFromPoint = null;

	setup(() =>
	{
		document.body.innerHTML = '';
		tmpClicks = 0;
		tmpBackdrop = document.createElement('div');
		tmpBackdrop.className = 'pps-backdrop';
		document.body.appendChild(tmpBackdrop);
		tmpButton = document.createElement('button');
		tmpButton.id = 'Apply';
		tmpButton.addEventListener('click', () => { tmpClicks++; });
		document.body.appendChild(tmpButton);
		tmpOriginalElementFromPoint = document.elementFromPoint;
	});

	teardown(() =>
	{
		document.elementFromPoint = tmpOriginalElementFromPoint;
	});

	test('the click reaches the element under the cursor', () =>
	{
		// jsdom has no layout, so elementFromPoint is stubbed to answer what a real
		// browser would once the backdrop is hidden: the button beneath it.
		document.elementFromPoint = () => tmpButton;
		const tmpPicker = pickerStub(tmpBackdrop);
		tmpPicker.closeFromBackdrop({ clientX: 10, clientY: 10 });
		Expect(tmpPicker.closed, 'still closes the dropdown').to.equal(1);
		Expect(tmpClicks, 'and the button underneath fires').to.equal(1);
	});

	test('closing still happens when there is nothing underneath', () =>
	{
		document.elementFromPoint = () => document.body;
		const tmpPicker = pickerStub(tmpBackdrop);
		tmpPicker.closeFromBackdrop({ clientX: 10, clientY: 10 });
		Expect(tmpPicker.closed).to.equal(1);
		Expect(tmpClicks).to.equal(0);
	});

	test('it never re-dispatches into the backdrop itself', () =>
	{
		document.elementFromPoint = () => tmpBackdrop;
		const tmpPicker = pickerStub(tmpBackdrop);
		tmpPicker.closeFromBackdrop({ clientX: 10, clientY: 10 });
		Expect(tmpPicker.closed).to.equal(1);
		Expect(tmpClicks).to.equal(0);
	});

	test('a missing event or elementFromPoint degrades to a plain close', () =>
	{
		const tmpPicker = pickerStub(tmpBackdrop);
		tmpPicker.closeFromBackdrop(null);
		Expect(tmpPicker.closed).to.equal(1);
		document.elementFromPoint = undefined;
		tmpPicker.closeFromBackdrop({ clientX: 5, clientY: 5 });
		Expect(tmpPicker.closed).to.equal(2);
		Expect(tmpClicks).to.equal(0);
	});

	test('the backdrop markup calls closeFromBackdrop, not close', () =>
	{
		const tmpSource = require('fs').readFileSync(`${__dirname}/../source/views/PictView-Picker.js`, 'utf8');
		Expect(tmpSource).to.contain(`class="pps-backdrop" onclick="_Pict.views['{~D:Record.PickerHash~}'].closeFromBackdrop(event)"`);
	});
});
