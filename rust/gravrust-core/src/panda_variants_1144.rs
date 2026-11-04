// Panda.Gene.getVariantFromGenes, indexed by main/hidden gene IDs in the pinned jar.
// Ported from client/js/game/panda-variants-1.14.4.js

/// The 7 possible panda gene variants, each is a 7-element array matching the JS PANDA_VARIANTS.
/// Index corresponds to gene position: [gene0, gene1, gene2, gene3, gene4, gene5, gene6]
pub const PANDA_VARIANTS: [&'static str; 7][7] = [
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
/// `gene_index` is the position (0-6), `gene_id` is the gene identifier.
/// Returns the variant string at that position.
pub fn get_variant_from_genes(gene_index: usize, gene_id: usize) -> &'static str {
    // The JS array PANDA_VARIANTS is indexed by [main, hidden] gene IDs.
    // In the pinned jar, main genes are IDs 0-3 (normal) or 4 (brown), 
    // and hidden genes are IDs 0-3 (normal) or 5 (weak).
    // The mapping from JS to Rust:
    // - gene_index 0-3: main gene position
    // - gene_index 4: main gene brown vs normal
    // - gene_index 5: hidden gene normal vs weak
    // - gene_index 6: not directly used in the JS variant selection but part of the array
    
    // Based on the JS structure, the variant at position gene_index 
    // depends on the gene_id for that position.
    // The JS PANDA_VARIANTS[main_id][hidden_id] gives the full 7-variant array.
    // We need to reverse-lookup: given a gene position and gene_id, return the variant.
    
    // Actually, looking at the JS more carefully:
    // PANDA_VARIANTS is a 7x7 array where:
    // - First index: main gene type (0=normal, 1=lazy, 2=worried, 3=playful, 4=brown, 5=weak, 6=aggressive)
    // - Second index: hidden gene type (same mapping)
    // Each cell contains a 7-element array of variant names for each of the 7 gene positions.
    
    // So get_variant_from_genes(gene_index, gene_id) returns PANDA_VARIANTS[gene_id][gene_index]
    // But we need to be careful about the indexing.
    
    // Looking at the JS: PANDA_VARIANTS = [
    //   ["normal","normal",...],  // main=normal, hidden=normal
    //   ["lazy","lazy",...],    // main=lazy, hidden=normal  
    //   ["worried",...],        // main=worried, hidden=normal
    //   ["playful",...],        // main=playful, hidden=normal
    //   ["normal",...,"brown",...], // main=brown, hidden=normal
    //   ["normal",...,"weak",...],  // main=normal, hidden=weak
    //   ["aggressive",...],     // main=aggressive, hidden=normal
    // ]
    // 
    // Each inner array has 7 entries, one per gene position.
    // Position 4 is brown (if main=brown), position 5 is weak (if hidden=weak).
    
    // So the function should be:
    // PANDA_VARIANTS[gene_id][gene_index]
    
    let variants = &PANDA_VARIANTS[gene_id];
    variants[gene_index]
}