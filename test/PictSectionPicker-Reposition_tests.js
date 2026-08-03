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
				tmpView._shouldPortal = () => false;
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
				tmpView._shouldPortal = () => true;
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
				tmpView._shouldPortal = () => true;
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
				tmpView._shouldPortal = () => true;
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
		test
		(
			'a clip the panel would clear keeps the CSS path (an overflow ancestor alone does not portal)',
			(fDone) =>
			{
				// The reviewer's point: overflow:hidden is everywhere (rounded corners, ellipsis). We portal
				// only when the clip would actually reach the panel — a dropdown with room to open in place
				// stays on the cheap CSS path and keeps its scoped tokens / inner-scroll tracking.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ClipFitsPicker', { Options: COUNTRY_OPTIONS });
				withPopElement(tmpView, (pPop) =>
				{
					const tmpRoot = document.getElementById('PPS_ClipFitsPicker');
					const tmpControl = tmpRoot.querySelector('.pps-control');
					tmpRoot.style.overflowY = 'hidden'; // a real clipping ancestor…
					// …but a tall one that a 360px panel below the control clears with room to spare.
					tmpControl.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 50, right: 250, width: 200, height: 30 });
					tmpRoot.getBoundingClientRect = () => ({ top: 0, bottom: 900, left: 0, right: 400, width: 400, height: 900 });
					tmpView.open();
					Expect(tmpView._portaled, 'clip does not reach the panel → CSS path').to.equal(false);
					Expect(pPop.classList.contains('pps-pop-portal')).to.equal(false);
					Expect(pPop.parentElement.id).to.equal('PPS_ClipFitsPicker');
					return fDone();
				});
			}
		);
		test
		(
			'a clip the panel would overflow portals it out (the escape the CSS path cannot give)',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ClipBitesPicker', { Options: COUNTRY_OPTIONS });
				withPopElement(tmpView, (pPop) =>
				{
					const tmpRoot = document.getElementById('PPS_ClipBitesPicker');
					const tmpControl = tmpRoot.querySelector('.pps-control');
					tmpRoot.style.overflowY = 'hidden';
					// The control sits near the bottom of a short clipper: a 360px panel below runs past it.
					tmpControl.getBoundingClientRect = () => ({ top: 700, bottom: 730, left: 50, right: 250, width: 200, height: 30 });
					tmpRoot.getBoundingClientRect = () => ({ top: 0, bottom: 760, left: 0, right: 400, width: 400, height: 760 });
					tmpView.open();
					Expect(tmpView._portaled, 'clip reaches the panel → portal').to.equal(true);
					Expect(pPop.classList.contains('pps-pop-portal')).to.equal(true);
					Expect(pPop.parentElement, 'out on body').to.equal(document.body);
					return fDone();
				});
			}
		);
		test
		(
			'a portaled panel carries the resolved theme tokens across, and _restorePop clears them',
			(fDone) =>
			{
				// A portaled panel no longer inherits from a scoped container, so it copies the resolved
				// --theme-color-* off the control; bringing it home drops them so it inherits live again.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('TokenPortalPicker', { Options: COUNTRY_OPTIONS });
				tmpView._shouldPortal = () => true;
				const tmpRealGCS = window.getComputedStyle;
				window.getComputedStyle = () => ({ getPropertyValue: (pProp) => (pProp === '--theme-color-brand-primary' ? 'rgb(1, 2, 3)' : '') });
				try
				{
					withPopElement(tmpView, (pPop) =>
					{
						// jsdom's CSSStyleDeclaration doesn't round-trip custom properties, so assert the
						// mechanism by watching the writes rather than reading the value back.
						const tmpSet = {};
						const tmpRemoved = {};
						const tmpRealSet = pPop.style.setProperty.bind(pPop.style);
						const tmpRealRemove = pPop.style.removeProperty.bind(pPop.style);
						pPop.style.setProperty = (pProp, pVal) => { if (String(pProp).indexOf('--theme-color-') === 0) { tmpSet[pProp] = pVal; } return tmpRealSet(pProp, pVal); };
						pPop.style.removeProperty = (pProp) => { if (String(pProp).indexOf('--theme-color-') === 0) { tmpRemoved[pProp] = true; } return tmpRealRemove(pProp); };
						tmpView.open();
						Expect(tmpSet['--theme-color-brand-primary'], 'resolved token copied onto the portaled panel').to.equal('rgb(1, 2, 3)');
						tmpView.close();
						Expect(tmpRemoved['--theme-color-brand-primary'], 'token cleared when the panel comes home').to.equal(true);
						return fDone();
					});
				}
				finally { window.getComputedStyle = tmpRealGCS; }
			}
		);
		test
		(
			'a portaled panel is shown only while open (pps-pop-open gates it, not the widget open rule)',
			(fDone) =>
			{
				// On <body> the panel is outside .pps.pps-open, so its own pps-pop-open class is what makes
				// it visible — a stray one (orphaned by a re-render) shows nothing until it is genuinely open.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('PortalOpenGatePicker', { Options: COUNTRY_OPTIONS });
				tmpView._shouldPortal = () => true;
				withPopElement(tmpView, (pPop) =>
				{
					tmpView.open();
					Expect(pPop.classList.contains('pps-pop-portal')).to.equal(true);
					Expect(pPop.classList.contains('pps-pop-open'), 'shown while open').to.equal(true);
					tmpView.close();
					Expect(pPop.classList.contains('pps-pop-open'), 'hidden once closed').to.equal(false);
					return fDone();
				});
			}
		);
		test
		(
			'close releases the provider back-off entry (it never outlives an open session)',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('BackOffReleasePicker', { Options: COUNTRY_OPTIONS });
				tmpProvider.backOffState['BackOffReleasePicker'] = { Dropped: true, Term: 'abc' };
				tmpView.open();
				tmpView.close();
				Expect(Object.prototype.hasOwnProperty.call(tmpProvider.backOffState, 'BackOffReleasePicker'), 'entry gone after close').to.equal(false);
				return fDone();
			}
		);
		test
		(
			'destroy() releases the slot, the back-off entry, and any portaled panel',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('DestroyPicker', { Options: COUNTRY_OPTIONS, SingleActivePicker: true });
				tmpProvider.backOffState['DestroyPicker'] = { Dropped: true, Term: 'x' };
				tmpView._shouldPortal = () => true;
				withPopElement(tmpView, (pPop) =>
				{
					tmpView.open();
					Expect(pPop.parentElement, 'portaled out on open').to.equal(document.body);
					Expect(tmpProvider.currentOpenPickerHash).to.equal('DestroyPicker');
					tmpView.destroy();
					Expect(tmpProvider.currentOpenPickerHash, 'slot released').to.equal(false);
					Expect(Object.prototype.hasOwnProperty.call(tmpProvider.backOffState, 'DestroyPicker'), 'back-off entry released').to.equal(false);
					Expect(document.querySelectorAll('body > [id="PPS_Pop_DestroyPicker"]').length, 'no orphan left on body').to.equal(0);
					return fDone();
				});
			}
		);
		test
		(
			'a re-seed while live refreshes the value area without a full render (search box + focus survive)',
			(fDone) =>
			{
				// A form marshal re-runs mount + setValue on every solve. Once the widget is live that has to
				// be a targeted value refresh, not a teardown — else the search box (and a mid-search focus)
				// is rebuilt away. This is the answer to "why does the marshal re-render".
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ReseedPicker', { Options: COUNTRY_OPTIONS });
				withPopElement(tmpView, () =>
				{
					let tmpFullRenders = 0;
					let tmpValueRefreshes = 0;
					// Stand in for the render that already painted this widget: onAfterRender stamps the shape,
					// and the stubbed render below never runs the real one. Without this the guard would
					// (correctly) see an unpainted shape and force a full render.
					tmpView._renderedShape = tmpView._shapeSignature();
					tmpView.render = () => { tmpFullRenders++; };
					tmpView._renderValue = () => { tmpValueRefreshes++; };
					// Root #PPS_ReseedPicker is live (withPopElement built it) and this picker has no AllowClear,
					// so setting a value changes nothing outside the value area → the re-seed stays targeted.
					tmpView.setValue('ca');
					Expect(tmpFullRenders, 'no teardown render while live').to.equal(0);
					Expect(tmpValueRefreshes, 'value area refreshed instead').to.equal(1);
					return fDone();
				});
			}
		);
		test
		(
			'a roomy clipper does not excuse a tighter one further out (every ancestor is checked)',
			(fDone) =>
			{
				// The nested case: the panel clears the big overflow:hidden card it sits in, but that card
				// lives in a short scrolling pane that WOULD cut it. Testing only the nearest clipper called
				// this safe and let the pane clip the dropdown.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('NestedClipPicker', { Options: COUNTRY_OPTIONS });
				const tmpPane = document.createElement('div');   // outer: short + scrolls → bites
				tmpPane.style.overflowY = 'auto';
				const tmpCard = document.createElement('div');   // inner: tall + hidden → does NOT bite
				tmpCard.style.overflow = 'hidden';
				const tmpControl = document.createElement('div');
				tmpCard.appendChild(tmpControl);
				tmpPane.appendChild(tmpCard);
				document.body.appendChild(tmpPane);

				tmpControl.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 50, right: 250, width: 200, height: 30 });
				// The card is 900px tall, so a 360px panel below the control fits inside it with room to spare…
				tmpCard.getBoundingClientRect = () => ({ top: 90, bottom: 990, left: 40, right: 400, width: 360, height: 900 });
				// …but the pane only shows 220px, so the panel runs straight past its bottom edge.
				tmpPane.getBoundingClientRect = () => ({ top: 90, bottom: 310, left: 40, right: 400, width: 360, height: 220 });

				Expect(tmpView._clipBites(tmpControl, tmpCard), 'inner card alone would say "fits"').to.equal(false);
				Expect(tmpView._clipBites(tmpControl, tmpPane), 'the outer pane is what cuts it').to.equal(true);
				Expect(tmpView._shouldPortal(tmpControl), 'so we must still portal').to.equal(true);

				document.body.removeChild(tmpPane);
				return fDone();
			}
		);
		test
		(
			'nested clippers that both have room keep the CSS path (no needless portal)',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('NestedRoomyPicker', { Options: COUNTRY_OPTIONS });
				const tmpPane = document.createElement('div');
				tmpPane.style.overflowY = 'auto';
				const tmpCard = document.createElement('div');
				tmpCard.style.overflow = 'hidden';
				const tmpControl = document.createElement('div');
				tmpCard.appendChild(tmpControl);
				tmpPane.appendChild(tmpCard);
				document.body.appendChild(tmpPane);

				tmpControl.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 50, right: 250, width: 200, height: 30 });
				tmpCard.getBoundingClientRect = () => ({ top: 90, bottom: 990, left: 40, right: 400, width: 360, height: 900 });
				tmpPane.getBoundingClientRect = () => ({ top: 80, bottom: 1200, left: 30, right: 420, width: 390, height: 1120 });

				Expect(tmpView._shouldPortal(tmpControl), 'both roomy → stay in place').to.equal(false);

				document.body.removeChild(tmpPane);
				return fDone();
			}
		);
		test
		(
			'a re-seed that flips the inline clear × does a full render (the targeted path cannot repaint it)',
			(fDone) =>
			{
				// ClearSlot renders OUTSIDE #PPS_Value_ and is gated on VALUE PRESENCE, so an empty→set
				// setValue has to fall back to a full render or the × never appears.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ClearShapePicker', { Options: COUNTRY_OPTIONS, AllowClear: true });
				withPopElement(tmpView, () =>
				{
					let tmpFullRenders = 0;
					tmpView._renderedShape = tmpView._shapeSignature();   // stands in for the paint already on screen
					tmpView.render = () => { tmpFullRenders++; };

					tmpView.setValue('ca');            // empty → set: the × must appear
					Expect(tmpFullRenders, 'empty→set repaints the control').to.equal(1);

					// Re-stamp as the real render would have, then a set→set re-seed (the common marshal).
					tmpView._renderedShape = tmpView._shapeSignature();
					tmpView.setValue('mx');
					Expect(tmpFullRenders, 'set→set stays on the fast path').to.equal(1);

					tmpView.setValue('');              // set → empty: the × must go
					Expect(tmpFullRenders, 'set→empty repaints the control').to.equal(2);
					return fDone();
				});
			}
		);
		test
		(
			'a config change (ReadOnly) forces a full render on the next re-seed',
			(fDone) =>
			{
				// createPicker re-assigns options on every marshal, so a flipped ReadOnly lands in options —
				// but pps-readonly lives on the root, which the targeted path never touches.
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ReadOnlyShapePicker', { Options: COUNTRY_OPTIONS });
				withPopElement(tmpView, () =>
				{
					let tmpFullRenders = 0;
					tmpView._renderedShape = tmpView._shapeSignature();
					tmpView.render = () => { tmpFullRenders++; };
					tmpView.options.ReadOnly = true;
					tmpView.setValue('ca');
					Expect(tmpFullRenders, 'readonly flip repaints the root').to.equal(1);
					return fDone();
				});
			}
		);
		test
		(
			'a re-seed before the widget is live does the full build',
			(fDone) =>
			{
				const tmpProvider = newProvider();
				const tmpView = tmpProvider.createPicker('ReseedColdPicker', { Options: COUNTRY_OPTIONS });
				let tmpFullRenders = 0;
				tmpView.render = () => { tmpFullRenders++; };
				// No #PPS_ReseedColdPicker in the DOM → _reflectValue must fall back to a full render.
				tmpView.setValue('mx');
				Expect(tmpFullRenders, 'builds when not yet live').to.equal(1);
				return fDone();
			}
		);
	}
);
