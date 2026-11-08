//! Port of `client/js/render/painting.js` (upstream MinecraftJS 1.8.9).
//!
//! Native paintings consist of 16-pixel tiles, including repeated backing and
//! one-pixel edge strips. Each tile samples the light at its own world
//! position.

#[derive(Debug, Clone)]
pub struct PaintingTile {
    pub x: f64,
    pub y: f64,
    pub front: Vec<f64>,
    pub back: Vec<f64>,
}

/// JS: `quad(out, points, rect, size, n)` — position + uv/size + normal + 1,1,1.
fn quad(out: &mut Vec<f64>, points: &[[f64; 3]], rect: &[f64; 4], size: &[f64; 2], n: [f64; 3]) {
    let uv = [[rect[0], rect[1]], [rect[0], rect[3]], [rect[2], rect[3]], [rect[2], rect[1]]];
    for (i, p) in points.iter().enumerate() {
        out.push(p[0]);
        out.push(p[1]);
        out.push(p[2]);
        out.push(uv[i][0] / size[0]);
        out.push(uv[i][1] / size[1]);
        out.push(n[0]);
        out.push(n[1]);
        out.push(n[2]);
        out.push(1.0);
        out.push(1.0);
        out.push(1.0);
    }
}

/// JS: `paintingTiles(width, height, front, frontSize, back, backSize)`.
pub fn painting_tiles(
    width: i64,
    height: i64,
    front: [f64; 4],
    front_size: [f64; 2],
    back: [f64; 4],
    back_size: [f64; 2],
) -> Vec<PaintingTile> {
    let columns = width / 16;
    let rows = height / 16;
    let mut tiles = Vec::new();
    for column in 0..columns {
        for row in 0..rows {
            let x0 = -(width as f64) / 32.0 + column as f64;
            let x1 = x0 + 1.0;
            let y0 = -(height as f64) / 32.0 + row as f64;
            let y1 = y0 + 1.0;
            let z0 = -1.0 / 32.0;
            let z1 = 1.0 / 32.0;
            let mut f: Vec<f64> = Vec::new();
            let mut b: Vec<f64> = Vec::new();

            let du = (front[2] - front[0]) / columns as f64;
            let dv = (front[3] - front[1]) / rows as f64;
            let front_rect = [
                front[0] + column as f64 * du,
                front[1] + (rows - row - 1) as f64 * dv,
                front[0] + (column + 1) as f64 * du,
                front[1] + (rows - row) as f64 * dv,
            ];
            quad(
                &mut f,
                &[[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]],
                &front_rect,
                &front_size,
                [0.0, 0.0, 1.0],
            );
            quad(&mut b, &[[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0]], &back, &back_size, [0.0, 0.0, -1.0]);
            let vertical = [back[0], back[1], back[0] + 1.0, back[3]];
            let horizontal = [back[0], back[1], back[2], back[1] + 1.0];
            quad(&mut b, &[[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]], &vertical, &back_size, [1.0, 0.0, 0.0]);
            quad(&mut b, &[[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], &vertical, &back_size, [-1.0, 0.0, 0.0]);
            quad(&mut b, &[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], &horizontal, &back_size, [0.0, 1.0, 0.0]);
            quad(&mut b, &[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], &horizontal, &back_size, [0.0, -1.0, 0.0]);

            tiles.push(PaintingTile { x: (x0 + x1) / 2.0, y: (y0 + y1) / 2.0, front: f, back: b });
        }
    }
    tiles
}

/// JS: `paintingTileLight(sample, x, y, z, facing, tile)` — per-tile world
/// position light sample; facing rotates the tile offset.
pub fn painting_tile_light(
    sample: impl Fn(f64, f64, f64) -> f64,
    x: f64,
    y: f64,
    z: f64,
    facing: i64,
    tile: &PaintingTile,
) -> f64 {
    let angle = match facing {
        0 => 0.0,
        1 => -std::f64::consts::FRAC_PI_2,
        2 => std::f64::consts::PI,
        3 => std::f64::consts::FRAC_PI_2,
        _ => 0.0,
    };
    sample(x + angle.cos() * tile.x, y + tile.y, z - angle.sin() * tile.x)
}
