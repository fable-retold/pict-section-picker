/*
	Dropdown direction: the in-widget (CSS) anchoring opens upward when the room below the control is short,
	measured against the visible band of the viewport (less any fixed or sticky bar docked to its edge).
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

/** A control rect `pBottom` px down a 768px viewport (jsdom's innerHeight), 38px tall. */
const controlRectAt = (pBottom) => ({ top: pBottom - 38, bottom: pBottom, left: 20, right: 420, width: 400, height: 38 });

/**
 * A `position: fixed` bar docked to the bottom of the viewport, `pHeight` px tall, which the stubbed
 * elementsFromPoint reports under the bottom edge (jsdom has no layout).
 * @param {number} pHeight @return {HTMLElement}
 */
const addBottomBar = (pHeight) =>
{
	const tmpBar = document.createElement('nav');
	tmpBar.style.position = 'fixed';
	tmpBar.getBoundingClientRect = () => ({ top: window.innerHeight - pHeight, bottom: window.innerHeight, left: 0, right: window.innerWidth, width: window.innerWidth, height: pHeight });
	document.body.appendChild(tmpBar);
	return tmpBar;
};

/**
 * Stand up a `#PPS_<hash>` root holding a `.pps-control` and a `.pps-pop` with a `.pps-panel`, run the test,
 * then tear it down.
 * @param {any} pView @param {(pRoot: HTMLElement, pControl: HTMLElement, pPop: HTMLElement) => any} fTest
 */
const withWidget = (pView, fTest) =>
{
	const tmpRoot = document.createElement('div');
	tmpRoot.id = `PPS_${pView.options.PickerHash}`;
	const tmpControl = document.createElement('div');
	tmpControl.className = 'pps-control';
	const tmpPop = document.createElement('div');
	tmpPop.className = 'pps-pop';
	tmpPop.id = `PPS_Pop_${pView.options.PickerHash}`;
	const tmpPanel = document.createElement('div');
	tmpPanel.className = 'pps-panel';
	tmpPop.appendChild(tmpPanel);
	tmpRoot.appendChild(tmpControl);
	tmpRoot.appendChild(tmpPop);
	document.body.appendChild(tmpRoot);
	try
	{
		return fTest(tmpRoot, tmpControl, tmpPop);
	}
	finally
	{
		tmpPop.remove();
		tmpRoot.remove();
	}
};

suite
(
	'Pict-Section-Picker — dropdown opens above when the room below is short',
	() =>
	{
		let tmpOriginalElementsFromPoint;
		setup(() =>
		{
			tmpOriginalElementsFromPoint = document.elementsFromPoint;
			document.elementsFromPoint = () => [];
		});
		teardown(() =>
		{
			document.elementsFromPoint = tmpOriginalElementsFromPoint;
		});

		test('opens below with room to spare, above when the control sits near the bottom', () =>
		{
			const tmpView = newProvider().createPicker('DirectionPicker', { Options: COUNTRY_OPTIONS });
			Expect(tmpView._dropdownPlacement(controlRectAt(200), null).Below).to.equal(true);
			const tmpNearBottom = tmpView._dropdownPlacement(controlRectAt(700), null);
			Expect(tmpNearBottom.Below).to.equal(false);
			Expect(tmpNearBottom.MaxHeight).to.equal(360);
		});

		test('a fixed bar docked to the bottom edge counts as no room', () =>
		{
			const tmpView = newProvider().createPicker('BarPicker', { Options: COUNTRY_OPTIONS });
			// Room below = 768 - bar - control bottom - 13 (gap + margin); room above = control top - 13.
			// A control ending at 395 fits the 360px panel below an unobstructed viewport.
			Expect(tmpView._dropdownPlacement(controlRectAt(395), null)).to.deep.equal({ Below: true, MaxHeight: 360 });
			const tmpBar = addBottomBar(56);
			document.elementsFromPoint = () => [ tmpBar ];
			try
			{
				Expect(tmpView._edgeBarExtent(100, 'bottom', null)).to.equal(56);
				Expect(tmpView._edgeBarExtent(100, 'top', null), 'a bottom bar does not reach the top edge').to.equal(0);
				// With the bar: 304 below vs 344 above → flips up, capped to the room above.
				Expect(tmpView._dropdownPlacement(controlRectAt(395), null)).to.deep.equal({ Below: false, MaxHeight: 344 });
			}
			finally
			{
				tmpBar.remove();
			}
		});

		test('a fixed element that holds the picker, or covers half the viewport, is not a bar', () =>
		{
			const tmpView = newProvider().createPicker('DialogPicker', { Options: COUNTRY_OPTIONS });
			withWidget(tmpView, (pRoot) =>
			{
				const tmpDialog = addBottomBar(56);
				tmpDialog.appendChild(pRoot);
				const tmpOverlay = addBottomBar(500);
				document.elementsFromPoint = () => [ tmpDialog, tmpOverlay ];
				try
				{
					Expect(tmpView._edgeBarExtent(100, 'bottom', pRoot)).to.equal(0);
				}
				finally
				{
					document.body.appendChild(pRoot);
					tmpDialog.remove();
					tmpOverlay.remove();
				}
			});
		});

		test('in-widget anchoring toggles pps-pop-above and caps the panel; restoring clears both', () =>
		{
			const tmpView = newProvider().createPicker('InWidgetPicker', { Options: COUNTRY_OPTIONS });
			withWidget(tmpView, (pRoot, pControl, pPop) =>
			{
				const tmpPanel = /** @type {HTMLElement} */ (pPop.querySelector('.pps-panel'));
				pControl.getBoundingClientRect = () => controlRectAt(700);
				tmpView._open = true;
				tmpView._applyAnchorMode();
				Expect(tmpView._portaled).to.equal(false);
				Expect(pPop.classList.contains('pps-pop-above')).to.equal(true);
				Expect(tmpPanel.style.maxHeight).to.equal('min(60vh, 360px)');

				pControl.getBoundingClientRect = () => controlRectAt(200);
				tmpView._applyAnchorMode();
				Expect(pPop.classList.contains('pps-pop-above')).to.equal(false);

				pControl.getBoundingClientRect = () => controlRectAt(700);
				tmpView._applyAnchorMode();
				tmpView._restorePop(pPop);
				Expect(pPop.classList.contains('pps-pop-above')).to.equal(false);
				Expect(tmpPanel.style.maxHeight).to.equal('');
			});
		});
	}
);
