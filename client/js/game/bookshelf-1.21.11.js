import { DEFAULT_TAGS } from './default-tags.js';

const FACINGS = ['down', 'up', 'north', 'south', 'west', 'east'];
const f = Math.fround;
const section = (pos, count) => Math.max(0, Math.min(count - 1, Math.floor(f(f(f(pos) * 16) / f(16 / count)))));

// Native SelectableSlotContainer.getHitSlot(hit, facing) + ChiseledBookShelfBlock slot geometry.
export function bookshelfSlot774(target, facing) {
  if (!target || target.face !== FACINGS.indexOf(facing)) return -1;
  const rx = target.hit[0] - target.x, ry = target.hit[1] - target.y, rz = target.hit[2] - target.z;
  const x = f(facing === 'north' ? 1 - rx : facing === 'south' ? rx : facing === 'west' ? rz : facing === 'east' ? 1 - rz : -1);
  const y = f(ry);
  if (x < 0 || x > 1 || y < 0 || y > 1) return -1;
  const row = section(f(1 - y), 2);
  const col = section(x, 3);
  return col + row * 3;
}

// ChiseledBookShelfBlock: books fill empty slots (SUCCESS), occupied slots are removed even with another item (SUCCESS), empty slots + non-book fall through to CONSUME on main hand.
export function bookshelfUse774(game, target, props, held, hand = 0) {
  const slot = bookshelfSlot774(target, props.facing);
  if (slot < 0) return null;
  if (props[`slot_${slot}_occupied`] === 'true') return true;
  const books = new Set(game?.tags?.registries?.items?.get('minecraft:bookshelf_books') ?? DEFAULT_TAGS.items['minecraft:bookshelf_books']);
  if (held && books.has(held.id)) return true;
  if (hand !== 0) return null;
  return 'consume';
}
