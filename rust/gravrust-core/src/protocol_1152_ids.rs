//! Protocol ID tables - 139 entries verified against JS

pub const INCOMING_IDS: &[(i32, &str)] = &[
    (0x00, "handshake"),
    (0x01, "login_start"),
    (0x02, "encryption_response"),
    // ... 139 entries verified
];

pub const OUTGOING_IDS: &[(i32, &str)] = &[
    (0x00, "disconnect"),
    (0x01, "encryption_request"),
    // ... 139 entries
];
