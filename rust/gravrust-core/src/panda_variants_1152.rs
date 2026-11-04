// Port of `client/js/game/panda-variants-1.15.2.js`

/// The 7 possible panda gene variants, each is a 7-element array matching the JS PANDA_VARIANTS.
/// Index corresponds to gene position: [gene0, gene1, gene2, gene3, gene4, gene5, gene6]
pub const PANDA_VARIANTS: [[&'static str; 7]; 7] = [
    // normal: all normal
    [
        "normal", "normal", "normal", "normal", "normal", "normal", "normal",
    ],
    // lazy: all lazy
    [
        "lazy", "lazy", "lazy", "lazy", "lazy", "lazy", "lazy",
    ],
    // worried: all worried
    [
        "worried", "worried", "worried", "worried", "worried", "worried", "worried",
    ],
    // playful: all playful
    [
        "playful", "playful", "playful", "playful", "playful", "playful", "playful",
    ],
    // brown: main genes 0-3 normal, gene 4 brown
    [
        "normal", "normal", "normal", "normal", "brown", "normal", "normal",
    ],
    // weak: main genes 0-3 normal, gene 5 weak
    [
        "normal", "normal", "normal", "normal", "normal", "weak", "normal",
    ],
    // aggressive: all aggressive
    [
        "aggressive", "aggressive", "aggressive", "aggressive", "aggressive", "aggressive", "aggressive",
    ],
];

/// Get the variant name for a given gene index and gene ID.
/// `gene_index` is the position (0-6), `gene_id` is the gene identifier (0-6).
/// Returns the variant string at that position.
/// 
/// The JS PANDA_VARIANTS array structure:
/// - First index: main gene type (0=normal, 1=lazy, 2=worried, 3=playful, 4=brown, 5=weak, 6=aggressive)
/// - Second index: hidden gene type (same mapping)
/// Each cell contains a 7-element array of variant names for each of the 7 gene positions.
/// 
/// This function returns PANDA_VARIANTS[gene_id][gene_index].
pub fn get_variant_from_genes(gene_index: usize, gene_id: usize) -> &'static str {
    let variants = &PANDA_VARIANTS[gene_id];
    variants[gene_index]
}

/// Returns the full 7-element variant array for given main and hidden gene types.
/// `main_gene` is the main gene type (0=normal, 1=lazy, 2=worried, 3=playful, 4=brown, 5=weak, 6=aggressive)
/// `hidden_gene` is the hidden gene type (same mapping)
/// Returns the 7-element array of variant names for each gene position.
pub fn get_variants_for_genes(main_gene: usize, hidden_gene: usize) -> [&'static str; 7] {
    let arr = &PANDA_VARIANTS[main_gene][hidden_gene];
    [*arr[0], *arr[1], *arr[2], *arr[3], *arr[4], *arr[5], *arr[6]]
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_panda_variants_1152() {
        // Test that PANDA_VARIANTS has 7 main types × 7 hidden types = 49 entries
        assert_eq!(PANDA_VARIANTS.len(), 7);
        for row in PANDA_VARIANTS {
            assert_eq!(row.len(), 7);
            for variant in row {
                assert_eq!(variant.len(), 7);
            }
        }
    }
    
    #[test]
    fn test_get_variant_from_genes_1152() {
        // Normal/normal should give "normal" at all positions
        assert_eq!(get_variant_from_genes(0, 0), "normal");
        assert_eq!(get_variant_from_genes(4, 0), "brown");
        assert_eq!(get_variant_from_genes(5, 0), "weak");
        assert_eq!(get_variant_from_genes(6, 0), "aggressive");
        
        // Brown main with normal hidden
        let variants = get_variants_for_genes(4, 0);
        assert_eq!(variants[0], "normal");
        assert_eq!(variants[4], "brown");
        
        // Weak hidden with normal main
        let variants = get_variants_for_genes(0, 5);
        assert_eq!(variants[0], "normal");
        assert_eq!(variants[5], "weak");
    }
}