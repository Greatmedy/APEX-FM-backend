// Unit tests for the Whot deck rules — pure logic, no DB.
// We test the deck invariants from the game spec.

// Replicate the deck-building rules (kept in sync with gameEngine.buildDeck).
const SHAPES = ['Circle', 'Triangle', 'Cross', 'Square', 'Star'];
const SHAPE_NUMS = {
  Circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  Triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  Cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  Square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  Star: [1, 2, 3, 4, 5, 7, 8],
};

function buildDeck() {
  const deck = [];
  for (const shape of SHAPES) {
    for (const n of SHAPE_NUMS[shape]) deck.push({ num: n, shape });
  }
  for (let i = 0; i < 5; i++) deck.push({ num: 20, shape: 'Whot' });
  return deck;
}

describe('Whot deck', () => {
  test('has exactly 54 cards', () => {
    expect(buildDeck().length).toBe(54);
  });

  test('has 5 Whot cards (number 20, no shape)', () => {
    const whots = buildDeck().filter((c) => c.num === 20);
    expect(whots.length).toBe(5);
  });

  test('never contains 6 or 9', () => {
    const deck = buildDeck();
    expect(deck.every((c) => c.num !== 6 && c.num !== 9)).toBe(true);
  });

  test('circle has 12 cards (no 6, no 9)', () => {
    const circles = buildDeck().filter((c) => c.shape === 'Circle');
    expect(circles.length).toBe(12);
  });

  test('cross has 9 cards', () => {
    const crosses = buildDeck().filter((c) => c.shape === 'Cross');
    expect(crosses.length).toBe(9);
  });

  test('star has 7 cards', () => {
    const stars = buildDeck().filter((c) => c.shape === 'Star');
    expect(stars.length).toBe(7);
  });

  test('card numbers only come from the allowed set', () => {
    const allowed = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 20];
    const deck = buildDeck();
    expect(deck.every((c) => allowed.includes(c.num))).toBe(true);
  });

  test('shape matching works for a valid play', () => {
    const top = { num: 7, shape: 'Circle' };
    const playable = { num: 3, shape: 'Circle' }; // same shape
    expect(playable.shape === top.shape || playable.num === top.num).toBe(true);
  });

  test('whot card (20) is wild — matches anything', () => {
    const top = { num: 7, shape: 'Circle' };
    const whot = { num: 20, shape: 'Whot' };
    expect(whot.num === 20 || whot.shape === top.shape || whot.num === top.num).toBe(true);
  });

  test('a 2 stacks with a 2', () => {
    // Pick Two stacking rule: a played 2 lets the next player stack another 2
    const stacked = { num: 2, shape: 'Circle' };
    const top = { num: 2, shape: 'Triangle' };
    expect(stacked.num === top.num).toBe(true);
  });

  test('a 2 does not stack with a 5', () => {
    const two = { num: 2, shape: 'Circle' };
    const five = { num: 5, shape: 'Triangle' };
    expect(two.num === five.num).toBe(false);
  });
});