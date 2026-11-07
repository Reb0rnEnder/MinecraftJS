fn main() {
    // web-sys gates the WebGPU bindings behind this cfg flag (see
    // https://rustwasm.github.io/wasm-bindgen/web-sys/unstable-apis.html).
    // Without it the `Gpu*` types do not exist even when their features are
    // enabled, and the browser-glue modules in this crate fail to compile.
    println!("cargo:rustc-check-cfg=cfg(web_sys_unstable_apis)");
    println!("cargo:rustc-cfg=web_sys_unstable_apis");
}
