// Port of `client/js/world/section-key.js`.
//
// 22 bits per horizontal chunk coordinate cover the entire Java world border;
// eight vertical bits cover every native 1.17 section, including light
// borders. The result fits exactly in a JavaScript Number (52 bits).
//
// NOTE: this is the *native* key layout, distinct from the in-memory
// `crate::culling::section_key` (21-bit coordinates, 4-bit vertical), whose
// keys index the renderer's live section map rather than native sections.

/// JS: `export const sectionKey=(x,y,z)=>((x+0x200000)*0x400000+(z+0x200000))*256+y+128;`
pub fn section_key(x: i64, y: i64, z: i64) -> i64 {
    ((x + 0x200000) * 0x400000 + (z + 0x200000)) * 256 + y + 128
}

/// JS: `export function sectionCoords(key){const column=Math.floor(key/256);
/// return[Math.floor(column/0x400000)-0x200000,key%256-128,column%0x400000-0x200000];}`
pub fn section_coords(key: i64) -> (i64, i64, i64) {
    let column = key.div_euclid(256);
    (
        column.div_euclid(0x400000) - 0x200000,
        column.rem_euclid(256) - 128,
        column.rem_euclid(0x400000) - 0x200000,
    )
}
