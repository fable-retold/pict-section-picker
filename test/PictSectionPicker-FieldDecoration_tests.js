/*
	Unit tests for pict-section-picker field decoration (AllowFieldDecoration).

	Field decoration is the opt-in affordance that lets a USER pin extra record fields onto each dropdown
	row as tag badges ("VendorCode: 310009258"), to tell same-named entities apart (the "six Volkerts"
	problem). It reuses the existing Tag badge rendering; what's new is (a) the opt-in gate + eligibility,
	(b) discovering the choosable fields from the rows' `Record` (minus the value/text/audit/ignored ones),
	(c) composing the chosen fields onto each row, and (d) remembering the choice in localStorage keyed by
	Entity. These tests pin that behavior against a static-Options picker whose options carry a `Record`
	(what an entity-backed or Record-returning DataProvider stamps on each row). Uses the jsdom +
	window.localStorage from browser-env; no live backend.
*/

const libBrowserEnv = require('browser-env');
const libPict = require('pict');
const libPictSectionPicker = require('../source/Pict-Section-Picker.js');

const Chai = require('chai');
const Expect = Chai.expect;

// Organization-shaped rows carrying a full Record. Two same-named "Volkert" rows (disambiguated only by
// VendorCode) + one row whose VendorCode is blank (should render NO badge). Records carry the value field
// (IDOrganization), text field (Name), audit columns, and host-noise columns (IDCustomer/GUIDOrganization)
// so the ignore layering can be asserted.
const buildOrgOptions = () =>
[
	{ Value: 1, Text: 'Volkert', Record: { IDOrganization: 1, Name: 'Volkert', VendorCode: '310009258', City: 'Mobile', State: 'AL', IDCustomer: 10, GUIDOrganization: 'g1', CreateDate: '2020-01-01', Deleted: 0 } },
	{ Value: 2, Text: 'Volkert', Record: { IDOrganization: 2, Name: 'Volkert', VendorCode: '310009999', City: 'Baton Rouge', State: 'LA', IDCustomer: 10, GUIDOrganization: 'g2', CreateDate: '2021-01-01', Deleted: 0 } },
	{ Value: 3, Text: 'Barriere', Record: { IDOrganization: 3, Name: 'Barriere', VendorCode: '', City: 'Metairie', State: 'LA', IDCustomer: 10, GUIDOrganization: 'g3', CreateDate: '2019-01-01', Deleted: 0 } },
];

suite
(
	'Pict-Section-Picker Field Decoration (AllowFieldDecoration)',
	() =>
	{
		let _Pict;
		let _PickerProvider;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			if ((typeof window !== 'undefined') && window.localStorage && (typeof window.localStorage.clear === 'function')) { window.localStorage.clear(); }
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;
			_Pict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);
			_PickerProvider = _Pict.providers['Pict-Section-Picker'];
			_Pict.AppData.DecoForm = {};
		});

		const createPicker = (pHash, pOverrides) =>
			_PickerProvider.createPicker(pHash, Object.assign(
				{
					DestinationAddress: `#${pHash}Host`,
					Mode: 'single',
					ValueAddress: `AppData.DecoForm.${pHash}`,
					Options: buildOrgOptions(),
				}, pOverrides || {}));

		test
		(
			'off by default: no opt-in, so no ⚙ affordance and rows render clean',
			() =>
			{
				document.body.innerHTML = '<div id="OffHost"></div>';
				const tmpPicker = createPicker('Off', { DestinationAddress: '#OffHost', Entity: 'Organization' });
				Expect(tmpPicker._decorationEnabled()).to.equal(false, 'AllowFieldDecoration defaults false');
				tmpPicker.render();
				const tmpHTML = document.getElementById('OffHost').innerHTML;
				Expect(tmpHTML).to.not.contain('pps-decorate-btn', 'no gear button when not opted in');
			}
		);

		test
		(
			'opt-in + Entity: the ⚙ toggle renders in the search row',
			() =>
			{
				document.body.innerHTML = '<div id="OnHost"></div>';
				const tmpPicker = createPicker('On', { DestinationAddress: '#OnHost', Entity: 'Organization', AllowFieldDecoration: true });
				Expect(tmpPicker._decorationEnabled()).to.equal(true);
				tmpPicker.render();
				const tmpHTML = document.getElementById('OnHost').innerHTML;
				Expect(tmpHTML).to.contain('pps-decorate-btn', 'the gear button renders');
			}
		);

		test
		(
			'candidate fields = Record keys minus the value/text fields, audit columns, and DecorationIgnoreFields',
			() =>
			{
				const tmpPicker = createPicker('Cand', { Entity: 'Organization', AllowFieldDecoration: true, DecorationIgnoreFields: [ 'IDCustomer', 'GUIDOrganization' ] });
				const tmpFields = tmpPicker._decorationCandidateFields();
				Expect(tmpFields).to.deep.equal([ 'City', 'State', 'VendorCode' ], 'only the useful business columns, sorted');
				Expect(tmpFields).to.not.include('IDOrganization', 'the value field (ID<Entity>) is hidden');
				Expect(tmpFields).to.not.include('Name', 'the text field is hidden');
				Expect(tmpFields).to.not.include('CreateDate', 'audit columns are hidden by default');
				Expect(tmpFields).to.not.include('Deleted', 'audit columns are hidden by default');
				Expect(tmpFields).to.not.include('IDCustomer', 'host DecorationIgnoreFields are hidden');
				Expect(tmpFields).to.not.include('GUIDOrganization', 'host DecorationIgnoreFields are hidden');
			}
		);

		test
		(
			'pinning a field decorates each row that has a value; blank values render no badge',
			() =>
			{
				document.body.innerHTML = '<div id="DecoHost"></div>';
				const tmpPicker = createPicker('Deco', { DestinationAddress: '#DecoHost', Entity: 'Organization', AllowFieldDecoration: true });
				tmpPicker.toggleDecorateField('VendorCode');
				tmpPicker.render();
				const tmpHTML = document.getElementById('DecoHost').innerHTML;

				Expect(tmpHTML).to.contain('pps-tag', 'the badge class renders');
				Expect(tmpHTML).to.contain('VendorCode: 310009258', 'the first Volkert badge renders');
				Expect(tmpHTML).to.contain('VendorCode: 310009999', 'the second Volkert badge renders');
				const tmpBadgeCount = (tmpHTML.match(/VendorCode:/g) || []).length;
				Expect(tmpBadgeCount).to.equal(2, 'the blank-VendorCode row (Barriere) shows no badge');
			}
		);

		test
		(
			'the choice persists to localStorage and reloads on a fresh picker of the same entity',
			() =>
			{
				const tmpPickerA = createPicker('PersistA', { Entity: 'Organization', AllowFieldDecoration: true });
				tmpPickerA.toggleDecorateField('VendorCode');
				Expect(window.localStorage.getItem('PictSectionPicker.Decoration.Organization')).to.equal('["VendorCode"]', 'the key is namespaced by Entity');

				// A brand-new picker of the same entity picks up the remembered field at construction time.
				const tmpPickerB = createPicker('PersistB', { Entity: 'Organization', AllowFieldDecoration: true });
				Expect(tmpPickerB._decorationFields).to.deep.equal([ 'VendorCode' ], 'restored from localStorage, no interaction');
			}
		);

		test
		(
			'the storage key is per-entity: a choice on one entity does not leak to another',
			() =>
			{
				const tmpOrg = createPicker('OrgPk', { Entity: 'Organization', AllowFieldDecoration: true });
				tmpOrg.toggleDecorateField('VendorCode');

				const tmpContract = createPicker('ContractPk', { Entity: 'Contract', AllowFieldDecoration: true });
				Expect(tmpContract._decorationFields).to.deep.equal([], 'the Contract picker is unaffected');
				Expect(window.localStorage.getItem('PictSectionPicker.Decoration.Contract')).to.equal(null, 'nothing written under the other entity');
			}
		);

		test
		(
			'toggling a pinned field off clears it from state + storage',
			() =>
			{
				const tmpPicker = createPicker('Toggle', { Entity: 'Organization', AllowFieldDecoration: true });
				tmpPicker.toggleDecorateField('VendorCode');
				Expect(tmpPicker._decorationFields).to.deep.equal([ 'VendorCode' ]);
				tmpPicker.toggleDecorateField('VendorCode');
				Expect(tmpPicker._decorationFields).to.deep.equal([]);
				Expect(window.localStorage.getItem('PictSectionPicker.Decoration.Organization')).to.equal('[]');
			}
		);

		test
		(
			'decoration composes WITH a dev-configured EntityTag: both badges render',
			() =>
			{
				document.body.innerHTML = '<div id="ComboHost"></div>';
				const tmpOptions = buildOrgOptions().map((pOption) => Object.assign({ Tag: `T${pOption.Value}` }, pOption));
				const tmpPicker = _PickerProvider.createPicker('Combo',
					{
						DestinationAddress: '#ComboHost',
						Mode: 'single',
						ValueAddress: 'AppData.DecoForm.Combo',
						Options: tmpOptions,
						Entity: 'Organization',
						AllowFieldDecoration: true,
					});
				tmpPicker.toggleDecorateField('VendorCode');
				tmpPicker.render();
				const tmpHTML = document.getElementById('ComboHost').innerHTML;

				Expect(tmpHTML).to.contain('>T1<', 'the dev EntityTag badge still renders');
				Expect(tmpHTML).to.contain('VendorCode: 310009258', 'the user decoration badge renders alongside it');
			}
		);
	}
);
