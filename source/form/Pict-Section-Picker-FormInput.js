/**
 * pict-section-form input-type adapter for pict-section-picker.
 *
 * Renders a picker widget into a dynamic-form cell — the host-agnostic replacement for a select2
 * entity input. Registered as a pict-section-form InputType (default name `Picker`); a host opts a
 * field in with `PictForm.InputType: 'Picker'` (+ Entity / SearchFields / Multiple / …). Used by the
 * pict-section-recordset entity filters and by document forms alike.
 *
 * Contextual scoping (project / spec-year / tenant / …) stays host configuration: the descriptor may
 * carry a `PictForm.GetContextScopeFilter()` hook, OR a host subclass overrides
 * `getContextualSearchFilters(pInput)`. Either way the module never learns what the context means.
 *
 * Requires `pict-section-form` (an OPTIONAL peer dependency — only loaded when you require this file)
 * and the `Pict-Section-Picker` provider registered on the pict instance.
 */
const libPictInputExtension = require('pict-section-form').PictInputExtensionProvider;

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION =
{
	ProviderIdentifier: 'Pict-Input-Picker',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoSolveWithApp: false,
};

/**
 * Build the InputType metatemplate entries (a hidden informary input + a host element the picker
 * renders into) for a given InputType name + provider hash. Injected via injectTemplateSet.
 *
 * @param {string} pInputTypeName - e.g. 'Picker'.
 * @param {string} pProviderHash - the input-extension provider service hash to auto-attach.
 * @return {Array<Record<string, any>>}
 */
const buildPickerInputTemplates = (pInputTypeName, pProviderHash) =>
[
	{
		// Mirror the host's DEFAULT input metatemplate structure exactly — a label span + the control
		// where the <input>/<select> would be — so the picker inherits the host's filter/form chrome
		// (label style, spacing, and the row's flex-end trash alignment) instead of inventing its own.
		HashPostfix: `-Template-Input-InputType-${pInputTypeName}`,
		DefaultInputExtensions: [ pProviderHash ],
		Template: /*html*/`
			<!-- InputType ${pInputTypeName} {~D:Record.Hash~} {~D:Record.DataType~} -->
			<input type="hidden" id="{~D:Record.Macro.RawHTMLID~}" tabindex="-1" {~D:Record.Macro.InputFullProperties~} {~D:Record.Macro.InputChangeHandler~} value="" />
			<span>{~D:Record.Name~}:</span> <div class="pps-form-host" id="PICKER-FOR-{~D:Record.Macro.RawHTMLID~}"></div>`,
	},
	{
		HashPostfix: `-VerticalTemplate-Input-InputType-${pInputTypeName}`,
		DefaultInputExtensions: [ pProviderHash ],
		Template: /*html*/`
			<!-- InputType ${pInputTypeName} {~D:Record.Hash~} {~D:Record.DataType~} -->
			<input type="hidden" id="{~D:Record.Macro.RawHTMLID~}" tabindex="-1" {~D:Record.Macro.InputFullProperties~} {~D:Record.Macro.InputChangeHandler~} value="" />
			<span>{~D:Record.Name~}:</span> <div class="pps-form-host" id="PICKER-FOR-{~D:Record.Macro.RawHTMLID~}"></div>`,
	},
	{
		HashPostfix: `-TabularTemplate-Begin-Input-InputType-${pInputTypeName}`,
		DefaultInputExtensions: [ pProviderHash ],
		Template: /*html*/`
			<input type="hidden" id="PICKER-TABULAR-DATA-{~D:Record.Macro.RawHTMLID~}-{~D:Context[2].Key~}" tabindex="-1" {~D:Record.Macro.InformaryTabular~} `,
	},
	{
		HashPostfix: `-TabularTemplate-End-Input-InputType-${pInputTypeName}`,
		DefaultInputExtensions: [ pProviderHash ],
		Template: /*html*/`
			value="" />
			<div class="pps-form-host" id="PICKER-TABULAR-{~D:Record.Macro.RawHTMLID~}-{~D:Context[2].Key~}"></div>`,
	},
];

class PictInputTypePicker extends libPictInputExtension
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, Object.assign({}, _DEFAULT_CONFIGURATION, pOptions), pServiceHash);
		/** @type {any} */
		this.pict;
	}

	// Visible host + picker-view-hash ids. Must match the metatemplate element ids above.
	getPickerHostID(pRawHTMLID) { return `#PICKER-FOR-${pRawHTMLID}`; }
	getPickerHash(pRawHTMLID) { return `Picker-${pRawHTMLID}`; }
	getTabularPickerHostID(pRawHTMLID, pRowIndex) { return `#PICKER-TABULAR-${pRawHTMLID}-${pRowIndex}`; }
	getTabularPickerHash(pRawHTMLID, pRowIndex) { return `Picker-${pRawHTMLID}-${pRowIndex}`; }
	getTabularHiddenID(pRawHTMLID, pRowIndex) { return `#PICKER-TABULAR-DATA-${pRawHTMLID}-${pRowIndex}`; }

	/**
	 * Overridable: extra FoxHound scope stanza(s) AND-applied to the entity search. Default reads the
	 * descriptor's `GetContextScopeFilter()` hook (set by the host / recordset filter base), else its
	 * static `BaseFilter`. Host subclasses override this to read app state (project / spec-year / …).
	 *
	 * @param {Record<string, any>} pInput @return {string|Array<string>}
	 */
	getContextualSearchFilters(pInput)
	{
		const tmpHook = pInput && pInput.PictForm && pInput.PictForm.GetContextScopeFilter;
		if (typeof tmpHook === 'function')
		{
			try { return tmpHook() || ''; }
			catch (pError) { this.pict.log.warn(`Pict-Input-Picker: GetContextScopeFilter threw.`, pError); return ''; }
		}
		return (pInput && pInput.PictForm && pInput.PictForm.BaseFilter) || '';
	}

	/** Build the picker config from a form input descriptor. */
	_buildPickerConfig(pInput, pHostSelector, fOnChange)
	{
		const tmpPF = pInput.PictForm || {};
		return {
			DestinationAddress: pHostSelector,
			Mode: tmpPF.Multiple ? 'multi' : 'single',
			Placeholder: tmpPF.Placeholder || (tmpPF.Entity ? `Select ${tmpPF.Entity}…` : 'Select…'),
			Searchable: (tmpPF.Searchable !== false),
			ReadOnly: !!tmpPF.ReadOnly,
			Entity: tmpPF.Entity,
			SearchFields: tmpPF.SearchFields,
			ValueField: tmpPF.ValueField,
			TextField: tmpPF.TextField,
			// Optional composed-display template (overrides TextField); see the picker's TextTemplate option.
			TextTemplate: tmpPF.TextTemplate,
			PageSize: tmpPF.PageSize || 20,
			Options: tmpPF.Options || [],
			// JoinEntity compound display (1:1 / 1:many parent-entity context) — passed straight through
			// to the picker's entity adapter, which fetch-then-merges the join. No-op when JoinEntity unset.
			JoinEntity: tmpPF.JoinEntity,
			JoinField: tmpPF.JoinField,
			JoinEntityValueField: tmpPF.JoinEntityValueField,
			JoinEntityDisplayField: tmpPF.JoinEntityDisplayField,
			JoinEntityFirst: tmpPF.JoinEntityFirst,
			JoinSeparator: tmpPF.JoinSeparator,
			// EntityTag badge: the record field whose value becomes a Tag pill, ordered by EntityTagLast.
			EntityTag: tmpPF.EntityTag,
			TagLast: tmpPF.EntityTagLast,
			// Per-search contextual scope — the generic hook the host fills.
			BaseFilter: () => this.getContextualSearchFilters(pInput),
			OnChange: fOnChange,
		};
	}

	/** Instantiate (or reuse) the picker view for a config — entity-backed when Entity is set. */
	_instantiatePicker(pPickerHash, pConfig)
	{
		const tmpProvider = this.pict.providers['Pict-Section-Picker'];
		if (!tmpProvider)
		{
			this.pict.log.warn('Pict-Input-Picker: the Pict-Section-Picker provider is not registered.');
			return null;
		}
		return pConfig.Entity
			? tmpProvider.createEntityPicker(pPickerHash, pConfig)
			: tmpProvider.createPicker(pPickerHash, pConfig);
	}

	/**
	 * Write a picker value into the form: csv to the hidden informary input (+ dataChanged), plus the
	 * raw array to `PictForm.ValueArrayAddress` when set (the recordset filter reads Values as an
	 * array). The csv-vs-array bridge lives HERE (generic) instead of in each host.
	 */
	_commit(pView, pInput, pValue, pHTMLSelector)
	{
		const tmpCSV = Array.isArray(pValue) ? pValue.join(',') : (pValue === undefined || pValue === null ? '' : pValue);
		this.pict.ContentAssignment.assignContent(pHTMLSelector, tmpCSV);
		if (pInput.PictForm && pInput.PictForm.ValueArrayAddress && pView.Bundle)
		{
			const tmpArray = Array.isArray(pValue) ? pValue : (tmpCSV === '' ? [] : String(tmpCSV).split(','));
			this.pict.manifest.setValueAtAddress(pView.Bundle, pInput.PictForm.ValueArrayAddress, tmpArray);
		}
		pView.dataChanged(pInput.Hash);
	}

	_commitTabular(pView, pInput, pValue, pHiddenID, pRowIndex)
	{
		const tmpCSV = Array.isArray(pValue) ? pValue.join(',') : (pValue === undefined || pValue === null ? '' : pValue);
		this.pict.ContentAssignment.assignContent(pHiddenID, tmpCSV);
		pView.dataChangedTabular(pInput.PictForm.GroupIndex, pInput.PictForm.InputIndex, pRowIndex);
	}

	/**
	 * Idempotently mount (or reuse) the picker into its host element + seed its value. Called from both
	 * onInputInitialize and onDataMarshalToForm because, in the async-virtual filter render, the host
	 * element only exists in the real DOM by the marshal pass — whichever hook fires post-DOM wins, and
	 * re-calls are harmless (the picker view is reused by hash).
	 *
	 * setValue does the work: it builds the widget on the first call and, once the widget is live, re-seeds
	 * the value WITHOUT a full render — so a marshal (which re-runs this on every solve) no longer rebuilds
	 * the search box or orphans a portaled dropdown. That is why there is no explicit render() here.
	 * @return {boolean} true if the picker is mounted.
	 */
	_mountPicker(pView, pInput, pValue, pHostSelector, pPickerHash, fOnChange)
	{
		if (!this.pict.ContentAssignment.getElement(pHostSelector)?.[0]) { return false; }
		const tmpView = this._instantiatePicker(pPickerHash, this._buildPickerConfig(pInput, pHostSelector, fOnChange));
		if (!tmpView) { return false; }
		tmpView.setValue(pValue);
		return true;
	}

	// --- non-tabular lifecycle ---

	onInputInitialize(pView, pGroup, pRow, pInput, pValue, pHTMLSelector, pTransactionGUID)
	{
		const tmpRaw = pInput.Macro.RawHTMLID;
		this._mountPicker(pView, pInput, pValue, this.getPickerHostID(tmpRaw), this.getPickerHash(tmpRaw),
			(pNewValue) => this._commit(pView, pInput, pNewValue, pInput.Macro.HTMLSelector));
		return super.onInputInitialize(pView, pGroup, pRow, pInput, pValue, pHTMLSelector, pTransactionGUID);
	}

	onDataMarshalToForm(pView, pGroup, pRow, pInput, pValue, pHTMLSelector, pTransactionGUID)
	{
		const tmpRaw = pInput.Macro.RawHTMLID;
		const tmpPickerHash = this.getPickerHash(tmpRaw);
		// Mount if it isn't already (post-DOM hook), else just re-seed the value.
		if (!this._mountPicker(pView, pInput, pValue, this.getPickerHostID(tmpRaw), tmpPickerHash,
			(pNewValue) => this._commit(pView, pInput, pNewValue, pInput.Macro.HTMLSelector)))
		{
			const tmpView = this.pict.views[tmpPickerHash];
			if (tmpView) { tmpView.setValue(pValue); }
		}
		return super.onDataMarshalToForm(pView, pGroup, pRow, pInput, pValue, pHTMLSelector, pTransactionGUID);
	}

	onDataRequest(pView, pInput, pValue, pHTMLSelector)
	{
		const tmpView = this.pict.views[this.getPickerHash(pInput.Macro.RawHTMLID)];
		const tmpVal = tmpView ? tmpView.getValue() : pValue;
		this._commit(pView, pInput, tmpVal, pHTMLSelector);
		return super.onDataRequest(pView, pInput, tmpVal, pHTMLSelector);
	}

	// --- tabular lifecycle (one picker view instance per (input, row)) ---

	/** Idempotent tabular mount (see _mountPicker). @return {boolean} */
	_mountPickerTabular(pView, pInput, pValue, pRowIndex)
	{
		const tmpRaw = pInput.Macro.RawHTMLID;
		const tmpHostSelector = this.getTabularPickerHostID(tmpRaw, pRowIndex);
		if (!this.pict.ContentAssignment.getElement(tmpHostSelector)?.[0]) { return false; }
		const tmpHiddenID = this.getTabularHiddenID(tmpRaw, pRowIndex);
		const tmpView = this._instantiatePicker(this.getTabularPickerHash(tmpRaw, pRowIndex),
			this._buildPickerConfig(pInput, tmpHostSelector, (pNewValue) => this._commitTabular(pView, pInput, pNewValue, tmpHiddenID, pRowIndex)));
		if (!tmpView) { return false; }
		// setValue builds on the first call and re-seeds targeted once live — no explicit render (see _mountPicker).
		tmpView.setValue(pValue);
		return true;
	}

	onInputInitializeTabular(pView, pGroup, pInput, pValue, pHTMLSelector, pRowIndex, pTransactionGUID)
	{
		this._mountPickerTabular(pView, pInput, pValue, pRowIndex);
		return super.onInputInitializeTabular(pView, pGroup, pInput, pValue, pHTMLSelector, pRowIndex, pTransactionGUID);
	}

	onDataMarshalToFormTabular(pView, pGroup, pInput, pValue, pHTMLSelector, pRowIndex, pTransactionGUID)
	{
		if (!this._mountPickerTabular(pView, pInput, pValue, pRowIndex))
		{
			const tmpView = this.pict.views[this.getTabularPickerHash(pInput.Macro.RawHTMLID, pRowIndex)];
			if (tmpView) { tmpView.setValue(pValue); }
		}
		return super.onDataMarshalToFormTabular(pView, pGroup, pInput, pValue, pHTMLSelector, pRowIndex, pTransactionGUID);
	}

	onDataRequestTabular(pView, pInput, pValue, pHTMLSelector, pRowIndex)
	{
		const tmpView = this.pict.views[this.getTabularPickerHash(pInput.Macro.RawHTMLID, pRowIndex)];
		const tmpVal = tmpView ? tmpView.getValue() : pValue;
		this._commitTabular(pView, pInput, tmpVal, this.getTabularHiddenID(pInput.Macro.RawHTMLID, pRowIndex), pRowIndex);
		return super.onDataRequestTabular(pView, pInput, tmpVal, pHTMLSelector, pRowIndex);
	}
}

/**
 * Register the Picker InputType on a pict instance: the input-extension provider + its metatemplate(s).
 * Idempotent. Requires `pict-section-form` loaded (PictFormSectionDefaultTemplateProvider present) and
 * the `Pict-Section-Picker` provider registered.
 *
 * @param {any} pPict - the pict instance.
 * @param {Record<string, any>} [pOptions]
 *   - InputTypeName {string} - the InputType string (default 'Picker').
 *   - ProviderHash {string} - the input-extension provider service hash (default 'Pict-Input-Picker').
 *   - ProviderClass {Function} - provider class to register (default PictInputTypePicker; a host
 *     passes a subclass that overrides getContextualSearchFilters for its scoping).
 *   - TemplatePrefix {string|Array<string>} - the form template prefix(es) to inject the metatemplate
 *     under (default 'Pict-MT-Base'; Headlight uses its theme prefixes).
 * @return {boolean} true if registered.
 */
const registerPickerInputType = (pPict, pOptions) =>
{
	const tmpOptions = pOptions || {};
	const tmpInputTypeName = tmpOptions.InputTypeName || 'Picker';
	const tmpProviderHash = tmpOptions.ProviderHash || 'Pict-Input-Picker';
	const tmpProviderClass = tmpOptions.ProviderClass || PictInputTypePicker;
	const tmpPrefixes = Array.isArray(tmpOptions.TemplatePrefix) ? tmpOptions.TemplatePrefix : [ tmpOptions.TemplatePrefix || 'Pict-MT-Base' ];

	if (!pPict.providers[tmpProviderHash])
	{
		pPict.addProvider(tmpProviderHash, Object.assign({}, _DEFAULT_CONFIGURATION, { ProviderIdentifier: tmpProviderHash }), tmpProviderClass);
	}

	const tmpTemplateProvider = pPict.providers.PictFormSectionDefaultTemplateProvider;
	if (!tmpTemplateProvider || typeof tmpTemplateProvider.injectTemplateSet !== 'function')
	{
		pPict.log.warn('Pict-Input-Picker: PictFormSectionDefaultTemplateProvider not available; cannot register the Picker metatemplate (is pict-section-form loaded?).');
		return false;
	}
	const tmpTemplates = buildPickerInputTemplates(tmpInputTypeName, tmpProviderHash);
	tmpPrefixes.forEach((pPrefix) => tmpTemplateProvider.injectTemplateSet({ TemplatePrefix: pPrefix, Templates: tmpTemplates }));
	return true;
};

module.exports = PictInputTypePicker;

module.exports.PictInputTypePicker = PictInputTypePicker;
module.exports.registerPickerInputType = registerPickerInputType;
module.exports.buildPickerInputTemplates = buildPickerInputTemplates;
module.exports.default_configuration = _DEFAULT_CONFIGURATION;
