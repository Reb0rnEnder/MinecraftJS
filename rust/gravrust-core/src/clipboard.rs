// Port of `client/js/platform/clipboard.js`.
//
// Clipboard API requires a secure context. Canvas text fields also need to
// work on ordinary HTTP/LAN hosting, using the browser's copy command when
// necessary.
//
// Every step here touches the DOM or the async Clipboard API, so the flow
// runs behind the [`ClipboardNav`] / [`ClipboardDoc`] contracts with the JS
// call order preserved: async `navigator.clipboard.writeText` first, then
// the hidden-textarea + `document.execCommand('copy')` fallback with the
// focus save/restore.

/// JS: `nav = globalThis.navigator` — the async Clipboard API path.
pub trait ClipboardNav {
    /// JS: `nav?.clipboard?.writeText` — `None` when the API is unavailable
    /// (insecure context, older browsers).
    fn clipboard_write_text(&self) -> Option<&dyn Fn(&str) -> Result<(), String>>;
}

/// JS: `doc = globalThis.document` — the execCommand fallback path.
pub trait ClipboardDoc {
    /// JS: `doc?.body` — `None` when the document has no body.
    fn body(&self) -> Option<()>;
    /// JS: `doc.execCommand` — `None` when unsupported.
    fn exec_command(&self) -> Option<&dyn Fn(&str) -> bool>;
    /// JS: `doc.activeElement`.
    fn active_element(&self) -> Option<()>;
    /// JS: `previous?.focus?.({ preventScroll: true })`.
    fn restore_focus(&mut self);
    /// JS: `doc.createElement('textarea')` + the style assignment +
    /// `doc.body.appendChild(field)`. Returns the field handle.
    fn append_hidden_textarea(&mut self, value: &str) -> Option<()>;
    /// JS: `field.focus({ preventScroll: true }); field.select();`.
    fn focus_and_select(&mut self) -> bool;
    /// JS: `field.remove()`.
    fn remove_field(&mut self);
}

/// JS: `export async function writeClipboard(text,nav=globalThis.navigator,doc=globalThis.document)`.
///
/// Returns `true` on success, `false` on failure — the JS return values.
pub fn write_clipboard(text: &str, nav: &dyn ClipboardNav, doc: &mut dyn ClipboardDoc) -> bool {
    // JS: text = String(text);
    let text = text.to_string();
    // JS: if(nav?.clipboard?.writeText)try{await nav.clipboard.writeText(text);return true;}catch{}
    if let Some(write) = nav.clipboard_write_text() {
        if write(&text).is_ok() {
            return true;
        }
    }
    // JS: if(!doc?.body||!doc.execCommand)return false;
    if doc.body().is_none() {
        return false;
    }
    if doc.exec_command().is_none() {
        return false;
    }
    // JS: const previous=doc.activeElement,field=doc.createElement('textarea');
    //     field.value=text;field.readOnly=true;field.tabIndex=-1;
    //     Object.assign(field.style,{position:'fixed',left:'-10000px',top:'0',opacity:'0'});
    //     doc.body.appendChild(field);
    let _previous = doc.active_element();
    if doc.append_hidden_textarea(&text).is_none() {
        return false;
    }
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        // JS: try{field.focus({preventScroll:true});field.select();return !!doc.execCommand('copy');}
        // JS: catch{return false;}
        // JS: finally{field.remove();previous?.focus?.({preventScroll:true});}
        let ok = doc.focus_and_select() && doc.exec_command().map(|cmd| cmd("copy")).unwrap_or(false);
        doc.remove_field();
        doc.restore_focus();
        ok
    }));
    result.unwrap_or(false)
}
