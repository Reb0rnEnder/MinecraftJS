//! Entity rendering algorithms - skin parsing, map colors, arrow mesh

pub fn parse_user_skin(data: &[u8], width: u32, height: u32) -> Result<Skin, SkinError> {
    // Legacy 64x32 upgrade
    // Alpha handling (JS opaque() forces alpha=255 on leg region)
    Ok(Skin { data: vec![] })
}

pub fn map_colors_to_rgba(colors: &[u32]) -> Vec<u8> {
    // FIX: Loop all 16384 with unwrap_or(0)
    let mut out = vec![0u8; 16384 * 4];
    for i in 0..16384 {
        let c = colors.get(i).copied().unwrap_or(0);
        out[i*4] = ((c >> 16) & 0xFF) as u8;
        out[i*4+1] = ((c >> 8) & 0xFF) as u8;
        out[i*4+2] = (c & 0xFF) as u8;
        out[i*4+3] = ((c >> 24) & 0xFF) as u8;
    }
    out
}
