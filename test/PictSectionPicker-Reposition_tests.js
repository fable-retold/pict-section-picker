/*
	Dropdown anchoring + open/close lifecycle behaviors.

	1. Re-anchor on re-render: the pop has no CSS default offset — its top/left/width are inline styles
	   set by _positionPop() from open(). A full render (RenderMethod 'replace') wipes them, so a
	   re-render WHILE the dropdown is open (e.g. a host form re-marshalling after a multi-select
	   committed its value) would leave the now-visible fixed panel at the unpositioned viewport corner.
	   onAfterRender re-runs _positionPop() when _open.
	2. Re-anchor on scroll/resize: the fixed panel doesn't move with the page, so while open the view
	   listens (capture-phase scroll + resize) and re-runs _positionPop(); every close path releases the
	   listeners.
	3. Single active instance: opening a picker closes any open sibling — at most one dropdown per page.
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

const COUNTRY_OPTIONS =
[
	{ Value: 'us', Text: 'United States' },
	{ Value: 'ca', Text: 'Canada' },
	{ Value: 'mx', Text: 'Mexico' },
];

suite
(
	'Pict-Section-Picker — dropdown re-anchoring on re-render',
	() =>
	{
		test
		(
			'render() re-runs _positionPop() when the dropdown is open, and not when closed',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ReanchorPicker', { Options: COUNTRY_OPTIONS, Mode: 'multi' });
				let tmpPositionCalls = 0;
				tmpView._positionPop = () => { tmpPositionCalls++; };

				// Closed re-render: nothing is showing, so no re-anchor.
				tmpView._open = false;
				tmpView.render();
				Expect(tmpPositionCalls).to.equal(0);

				// Open re-render (the multi-select-then-marshal case): re-anchor so the fixed panel stays
				// pinned to its control instead of detaching to the viewport corner.
				tmpView._open = true;
				tmpView.render();
				Expect(tmpPositionCalls).to.equal(1);
				return fDone();
			}
		);
		test
		(
			'scrolling while open re-runs _positionPop(); closing releases the listener',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ScrollAnchorPicker', { Options: COUNTRY_OPTIONS });
				// Synchronous animation frames so the throttled handler applies inline.
				const tmpRealRAF = window.requestAnimationFrame;
				window.requestAnimationFrame = (fCallback) => { fCallback(); return 0; };
				let tmpPositionCalls = 0;
				tmpView._positionPop = () => { tmpPositionCalls++; };

				tmpView.open();
				Expect(tmpPositionCalls).to.equal(1); // the open() anchor
				window.dispatchEvent(new window.Event('scroll'));
				Expect(tmpPositionCalls).to.equal(2);
				window.dispatchEvent(new window.Event('resize'));
				Expect(tmpPositionCalls).to.equal(3);

				tmpView.close();
				Expect(tmpView._fReposition).to.equal(null); // listeners released
				window.dispatchEvent(new window.Event('scroll'));
				Expect(tmpPositionCalls).to.equal(3);

				window.requestAnimationFrame = tmpRealRAF;
				return fDone();
			}
		);
		test
		(
			'a single-mode select releases the scroll listener (every close path funnels through _markClosed)',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('SelectClosePicker', { Options: COUNTRY_OPTIONS });
				tmpView.open();
				Expect(tmpView._fReposition).to.be.a('function');
				tmpView.select('ca');
				Expect(tmpView._open).to.equal(false);
				Expect(tmpView._fReposition).to.equal(null);
				return fDone();
			}
		);
		test
		(
			'SingleActivePicker (opt-in): opening a picker closes any open sibling; default off stacks as before',
			(fDone) =>
			{
				// Default (off): opening B leaves A open — no behavior change for existing hosts.
				const tmpProvider = newProvider();
				const tmpViewA = tmpProvider.createPicker('SiblingPickerA', { Options: COUNTRY_OPTIONS });
				const tmpViewB = tmpProvider.createPicker('SiblingPickerB', { Options: COUNTRY_OPTIONS });
				tmpViewA.open();
				tmpViewB.open();
				Expect(tmpViewA._open).to.equal(true);
				Expect(tmpViewB._open).to.equal(true);
				tmpViewA.close();
				tmpViewB.close();

				// Opted in per-picker: opening D closes C.
				const tmpViewC = tmpProvider.createPicker('SiblingPickerC', { Options: COUNTRY_OPTIONS, SingleActivePicker: true });
				const tmpViewD = tmpProvider.createPicker('SiblingPickerD', { Options: COUNTRY_OPTIONS, SingleActivePicker: true });
				tmpViewC.open();
				Expect(tmpViewC._open).to.equal(true);
				tmpViewD.open();
				Expect(tmpViewC._open).to.equal(false);
				Expect(tmpViewD._open).to.equal(true);
				// Reopening the same picker doesn't close itself.
				tmpViewD.open();
				Expect(tmpViewD._open).to.equal(true);
				tmpViewD.close();
				return fDone();
			}
		);
		test
		(
			'the provider-level SingleActivePicker option seeds every picker it creates (per-picker override wins)',
			(fDone) =>
			{
				const tmpPict = configureTestPict();
				const tmpProvider = tmpPict.addProvider('Pict-Section-Picker',
					Object.assign({}, libPictSectionPicker.default_configuration, { SingleActivePicker: true }), libPictSectionPicker);
				const tmpSeeded = tmpProvider.createPicker('FleetSeededPicker', { Options: COUNTRY_OPTIONS });
				const tmpOverridden = tmpProvider.createPicker('FleetOverriddenPicker', { Options: COUNTRY_OPTIONS, SingleActivePicker: false });
				Expect(tmpSeeded.options.SingleActivePicker).to.equal(true);
				Expect(tmpOverridden.options.SingleActivePicker).to.equal(false);

				tmpSeeded.open();
				tmpOverridden.open();
				// The overridden picker stacks (it doesn't close the seeded one)…
				Expect(tmpSeeded._open).to.equal(true);
				tmpOverridden.close();
				tmpSeeded.close();
				return fDone();
			}
		);
	}
);
