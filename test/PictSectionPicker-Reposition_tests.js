/*
	Dropdown anchoring + open/close lifecycle behaviors.

	1. Anchoring mode, decided once per open. The default is CSS-only: .pps-pop is absolute against .pps
	   (position:relative), so the panel travels with its control on page scroll for free — no measuring,
	   no listeners. When an ancestor clips (overflow != visible — a scrolling table wrapper, a dialog
	   body) an absolute panel would be cut off, because the clipper sits in its containing-block chain.
	   The view then portals the panel to <body> and places it in DOCUMENT coordinates — still absolute,
	   so the browser keeps travelling it with the page; fixed would strand it against the viewport.
	2. Re-anchor on re-render: a full render (RenderMethod 'replace') builds a fresh panel inside the
	   widget while a portaled one is still out on <body>, so onAfterRender re-decides the mode while
	   open, sweeping the orphan. Closing brings a portaled panel home.
	3. Single active instance: opening a picker closes any open sibling that ALSO opted in — at most one
	   dropdown per page, without a non-participant being closed by (or closing) a participant.
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

/**
 * Stand up the minimum real DOM _applyAnchorMode() reaches for — a `#PPS_<hash>` root holding a
 * `.pps-control` and an id'd `.pps-pop` — run the assertions against that pop element, then tear it
 * back down (including the pop itself, which may have been portaled onto <body>).
 * @param {any} pView @param {(pPop: any) => any} fTest
 */
const withPopElement = (pView, fTest) =>
{
	const tmpRoot = document.createElement('div');
	tmpRoot.id = `PPS_${pView.options.PickerHash}`;
	const tmpControl = document.createElement('div');
	tmpControl.className = 'pps-control';
	const tmpPop = document.createElement('div');
	tmpPop.className = 'pps-pop';
	tmpPop.id = `PPS_Pop_${pView.options.PickerHash}`;
	tmpRoot.appendChild(tmpControl);
	tmpRoot.appendChild(tmpPop);
	document.body.appendChild(tmpRoot);
	try { return fTest(tmpPop); }
	finally { tmpPop.remove(); tmpRoot.remove(); }
};

suite
(
	'Pict-Section-Picker — dropdown re-anchoring on re-render',
	() =>
	{
		test
		(
			'no clipping ancestor: the panel stays put and is anchored purely by CSS',
			(fDone) =>
			{
				// The default. .pps-pop is absolute against .pps, so it travels with the control on scroll
				// with no measuring at all — which is why there is nothing to re-run on scroll or resize.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('CleanAnchorPicker', { Options: COUNTRY_OPTIONS });
				tmpView._hasClippingAncestor = () => false;
				withPopElement(tmpView, (pPop) =>
				{
					tmpView.open();
					Expect(tmpView._portaled).to.equal(false);
					Expect(pPop.classList.contains('pps-pop-portal')).to.equal(false);
					Expect(pPop.parentElement.id, 'stays inside its widget').to.equal('PPS_CleanAnchorPicker');
					Expect(pPop.style.top, 'nothing is written inline').to.equal('');
					return fDone();
				});
			}
		);
		test
		(
			'a clipping ancestor: the panel is portaled to <body> in document coordinates',
			(fDone) =>
			{
				// A scrolling table wrapper (overflow-y: hidden) or a dialog body would cut off an absolute
				// panel, because the clipper sits in its containing-block chain. Moving the panel to <body>
				// takes it out of that chain — and keeping it ABSOLUTE (not fixed) means the browser still
				// travels it with the page, so this path needs no repositioning either.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ClippedAnchorPicker', { Options: COUNTRY_OPTIONS });
				tmpView._hasClippingAncestor = () => true;
				withPopElement(tmpView, (pPop) =>
				{
					tmpView.open();
					Expect(tmpView._portaled).to.equal(true);
					Expect(pPop.classList.contains('pps-pop-portal')).to.equal(true);
					Expect(pPop.parentElement, 'lives on body while open').to.equal(document.body);
					Expect(pPop.style.top, 'placed in document coordinates').to.not.equal('');
					return fDone();
				});
			}
		);
		test
		(
			'closing brings a portaled panel home and clears what the portal wrote',
			(fDone) =>
			{
				// A closed picker must never leave a stray panel on <body>, and the inline offsets have to
				// go with it — they would beat the stylesheet and strand the panel on the next CSS-path open.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('AnchorSwitchPicker', { Options: COUNTRY_OPTIONS });
				tmpView._hasClippingAncestor = () => true;
				withPopElement(tmpView, (pPop) =>
				{
					tmpView.open();
					Expect(pPop.parentElement).to.equal(document.body);
					tmpView.close();
					Expect(tmpView._portaled).to.equal(false);
					Expect(pPop.parentElement.id, 'back inside its widget').to.equal('PPS_AnchorSwitchPicker');
					Expect(pPop.classList.contains('pps-pop-portal')).to.equal(false);
					Expect(pPop.style.top).to.equal('');
					Expect(pPop.style.left).to.equal('');
					Expect(pPop.style.width).to.equal('');
					return fDone();
				});
			}
		);
		test
		(
			'a re-render while portaled sweeps the orphan instead of leaving a duplicate id on body',
			(fDone) =>
			{
				// The render rebuilds .pps with a fresh panel while the portaled one is still out on body,
				// both carrying the same id. The stale copy has to go, or getElementById could later hand
				// back the wrong panel (and with it the wrong search box).
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('OrphanSweepPicker', { Options: COUNTRY_OPTIONS });
				tmpView._hasClippingAncestor = () => true;
				withPopElement(tmpView, (pPop) =>
				{
					tmpView.open();
					Expect(pPop.parentElement).to.equal(document.body);

					// Simulate the re-render: a brand new panel appears inside the widget, same id.
					const tmpRoot = document.getElementById('PPS_OrphanSweepPicker');
					const tmpFresh = document.createElement('div');
					tmpFresh.className = 'pps-pop';
					tmpFresh.id = 'PPS_Pop_OrphanSweepPicker';
					tmpRoot.appendChild(tmpFresh);

					tmpView._applyAnchorMode();
					const tmpOnBody = document.querySelectorAll('body > [id="PPS_Pop_OrphanSweepPicker"]');
					Expect(tmpOnBody.length, 'exactly one panel on body').to.equal(1);
					Expect(tmpOnBody[0], 'and it is the fresh one').to.equal(tmpFresh);
					tmpFresh.remove();
					return fDone();
				});
			}
		);
		test
		(
			'_hasClippingAncestor detects an overflow ancestor and ignores a clean chain',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ClipDetectPicker', { Options: COUNTRY_OPTIONS });

				const tmpClean = document.createElement('div');
				const tmpCleanChild = document.createElement('div');
				tmpClean.appendChild(tmpCleanChild);
				document.body.appendChild(tmpClean);
				Expect(tmpView._hasClippingAncestor(tmpCleanChild)).to.equal(false);

				const tmpClipped = document.createElement('div');
				tmpClipped.style.overflowY = 'hidden';
				const tmpClippedChild = document.createElement('div');
				tmpClipped.appendChild(tmpClippedChild);
				document.body.appendChild(tmpClipped);
				Expect(tmpView._hasClippingAncestor(tmpClippedChild)).to.equal(true);

				document.body.removeChild(tmpClean);
				document.body.removeChild(tmpClipped);
				return fDone();
			}
		);
		test
		(
			'a re-render while open re-applies the fixed fallback (the class and offsets are rebuilt away)',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ReanchorPicker', { Options: COUNTRY_OPTIONS, Mode: 'multi' });
				let tmpAnchorCalls = 0;
				tmpView._applyAnchorMode = () => { tmpAnchorCalls++; };

				// Closed re-render: nothing is showing, so no re-anchor.
				tmpView._open = false;
				tmpView.render();
				Expect(tmpAnchorCalls).to.equal(0);

				// Open re-render (the multi-select-then-marshal case).
				tmpView._open = true;
				tmpView.render();
				Expect(tmpAnchorCalls).to.equal(1);
				return fDone();
			}
		);
		test
		(
			'a single-mode select closes through _markClosed (every close path drops the result cache)',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('SelectClosePicker', { Options: COUNTRY_OPTIONS });
				tmpView.open();
				Expect(tmpView._open).to.equal(true);
				tmpView.select('ca');
				Expect(tmpView._open).to.equal(false);
				Expect(tmpView._loaded).to.equal(false);
				Expect(tmpView._loadedResults).to.deep.equal([]);
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
		test
		(
			'a mixed fleet: a non-opt-in picker neither claims the slot nor is closed by one that does',
			(fDone) =>
			{
				// The slot must only ever hold an opted-in picker. If a non-participant could claim it, it
				// would be closed by the next participant to open (it never asked for that), AND the
				// participant it displaced would be left open (it did ask for that).
				const tmpProvider = newProvider();
				const tmpOptedIn = tmpProvider.createPicker('MixedOptedInPicker', { Options: COUNTRY_OPTIONS, SingleActivePicker: true });
				const tmpPlain = tmpProvider.createPicker('MixedPlainPicker', { Options: COUNTRY_OPTIONS });
				const tmpOther = tmpProvider.createPicker('MixedOtherPicker', { Options: COUNTRY_OPTIONS, SingleActivePicker: true });

				tmpOptedIn.open();
				Expect(tmpProvider.currentOpenPickerHash).to.equal('MixedOptedInPicker');
				// The plain picker opens alongside without touching the slot.
				tmpPlain.open();
				Expect(tmpProvider.currentOpenPickerHash).to.equal('MixedOptedInPicker');
				Expect(tmpOptedIn._open).to.equal(true);

				// A second participant closes the participant that held the slot, and leaves the plain one be.
				tmpOther.open();
				Expect(tmpOptedIn._open).to.equal(false);
				Expect(tmpPlain._open).to.equal(true);
				Expect(tmpOther._open).to.equal(true);
				Expect(tmpProvider.currentOpenPickerHash).to.equal('MixedOtherPicker');

				// Closing the slot holder releases it.
				tmpOther.close();
				Expect(tmpProvider.currentOpenPickerHash).to.equal(false);
				tmpPlain.close();
				return fDone();
			}
		);
	}
);
