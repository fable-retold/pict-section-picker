export = PictInputTypePicker;
declare const PictInputTypePicker_base: typeof import("pict-section-form/types/source/providers/Pict-Provider-InputExtension");
declare class PictInputTypePicker extends PictInputTypePicker_base {
    constructor(pFable: any, pOptions: any, pServiceHash: any);
    getPickerHostID(pRawHTMLID: any): string;
    getPickerHash(pRawHTMLID: any): string;
    getTabularPickerHostID(pRawHTMLID: any, pRowIndex: any): string;
    getTabularPickerHash(pRawHTMLID: any, pRowIndex: any): string;
    getTabularHiddenID(pRawHTMLID: any, pRowIndex: any): string;
    /**
     * Overridable: extra FoxHound scope stanza(s) AND-applied to the entity search. Default reads the
     * descriptor's `GetContextScopeFilter()` hook (set by the host / recordset filter base), else its
     * static `BaseFilter`. Host subclasses override this to read app state (project / spec-year / …).
     *
     * @param {Record<string, any>} pInput @return {string|Array<string>}
     */
    getContextualSearchFilters(pInput: Record<string, any>): string | Array<string>;
    /** Build the picker config from a form input descriptor. */
    _buildPickerConfig(pInput: any, pHostSelector: any, fOnChange: any): {
        DestinationAddress: any;
        Mode: string;
        Placeholder: any;
        Searchable: boolean;
        ReadOnly: boolean;
        Entity: any;
        SearchFields: any;
        ValueField: any;
        TextField: any;
        TextTemplate: any;
        PageSize: any;
        Options: any;
        JoinEntity: any;
        JoinField: any;
        JoinEntityValueField: any;
        JoinEntityDisplayField: any;
        JoinEntityFirst: any;
        JoinSeparator: any;
        EntityTag: any;
        TagLast: any;
        BaseFilter: () => string | string[];
        OnChange: any;
    };
    /** Instantiate (or reuse) the picker view for a config — entity-backed when Entity is set. */
    _instantiatePicker(pPickerHash: any, pConfig: any): any;
    /**
     * Write a picker value into the form: csv to the hidden informary input (+ dataChanged), plus the
     * raw array to `PictForm.ValueArrayAddress` when set (the recordset filter reads Values as an
     * array). The csv-vs-array bridge lives HERE (generic) instead of in each host.
     */
    _commit(pView: any, pInput: any, pValue: any, pHTMLSelector: any): void;
    _commitTabular(pView: any, pInput: any, pValue: any, pHiddenID: any, pRowIndex: any): void;
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
    _mountPicker(pView: any, pInput: any, pValue: any, pHostSelector: any, pPickerHash: any, fOnChange: any): boolean;
    onInputInitialize(pView: any, pGroup: any, pRow: any, pInput: any, pValue: any, pHTMLSelector: any, pTransactionGUID: any): boolean;
    onDataMarshalToForm(pView: any, pGroup: any, pRow: any, pInput: any, pValue: any, pHTMLSelector: any, pTransactionGUID: any): boolean;
    onDataRequest(pView: any, pInput: any, pValue: any, pHTMLSelector: any): boolean;
    /** Idempotent tabular mount (see _mountPicker). @return {boolean} */
    _mountPickerTabular(pView: any, pInput: any, pValue: any, pRowIndex: any): boolean;
    onInputInitializeTabular(pView: any, pGroup: any, pInput: any, pValue: any, pHTMLSelector: any, pRowIndex: any, pTransactionGUID: any): boolean;
    onDataMarshalToFormTabular(pView: any, pGroup: any, pInput: any, pValue: any, pHTMLSelector: any, pRowIndex: any, pTransactionGUID: any): boolean;
    onDataRequestTabular(pView: any, pInput: any, pValue: any, pHTMLSelector: any, pRowIndex: any): boolean;
}
declare namespace PictInputTypePicker {
    export { PictInputTypePicker, registerPickerInputType, buildPickerInputTemplates, _DEFAULT_CONFIGURATION as default_configuration };
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
declare function registerPickerInputType(pPict: any, pOptions?: Record<string, any>): boolean;
/**
 * Build the InputType metatemplate entries (a hidden informary input + a host element the picker
 * renders into) for a given InputType name + provider hash. Injected via injectTemplateSet.
 *
 * @param {string} pInputTypeName - e.g. 'Picker'.
 * @param {string} pProviderHash - the input-extension provider service hash to auto-attach.
 * @return {Array<Record<string, any>>}
 */
declare function buildPickerInputTemplates(pInputTypeName: string, pProviderHash: string): Array<Record<string, any>>;
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION: Record<string, any>;
//# sourceMappingURL=Pict-Section-Picker-FormInput.d.ts.map