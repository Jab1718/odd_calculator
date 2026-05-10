# PokerNow Odds Calculator

A browser extension that adds a real-time poker odds overlay to PokerNow. It reads your hole cards and the community cards directly from the page, then runs a Monte Carlo simulation to show win/tie/lose probabilities and hand distribution — all without leaving the game.

---

## Features

- **Live equity calculation** — win, tie, and lose percentages updated automatically as cards are dealt
- **Next-street preview** — on the flop, shows your equity after just the turn card ("if you call")
- **Hand distribution** — breakdown of how often you end up with each hand type across all simulated runouts
- **Adjustable opponent count** — simulate against 1–8 opponents
- **Draggable & resizable panel** — position it wherever it doesn't block your view
- **Minimizable overlay** — collapse to a title bar when you don't need it
- **Shadow DOM isolation** — zero style conflicts with the PokerNow UI

---

## How It Works

1. **Card reading** — CSS class names on PokerNow card elements (e.g. `card-h`, `card-s-A`) are parsed to extract suit and value for both your hole cards and the community board.
2. **Hand evaluation** — a fast numeric scorer evaluates any 5-card combination and ranks it from High Card to Straight Flush.
3. **Monte Carlo simulation** — the remaining deck is shuffled and sampled 9,000 times per calculation. Each iteration deals random opponent hands and completes the board, then compares scores to estimate probabilities.
4. **Next-street simulation** — a separate 6,000-iteration pass deals only the turn card (no river), giving an accurate equity snapshot for the flop decision point.
5. **Auto-refresh** — a polling loop checks for card changes every 1.2 seconds and triggers a recalculation when the board or your hand changes.

---

## Installation (Developer / Unpacked)

> No store listing yet — load the extension manually in Chrome or any Chromium-based browser.

1. Clone or download this repository.
   ```bash
   git clone https://github.com/jab1718/pokernow-odds-calc.git
   ```
2. Open `chrome://extensions` in your browser.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the repository folder.
5. Navigate to pokernow.com — the overlay appears automatically once you're in a hand.

---

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Extension manifest (Manifest V3); declares host permissions and content script |
| `content.js` | All extension logic — card parsing, hand evaluator, Monte Carlo engine, UI |

---

## Usage

Once installed, the **Odds Calc** panel appears in the top-right corner of any PokerNow game.

| Control | Action |
|---------|--------|
| **− / +** | Decrease or increase the number of opponents (1–8) |
| **↻** | Force an immediate recalculation |
| **−** (header) | Minimize/expand the panel |
| **Drag header** | Move the panel anywhere on screen |
| **Drag corner** | Resize the panel width (200–500 px) |

The overlay updates automatically when new cards appear. You can also hit ↻ any time you want a fresh simulation run.

---

## Simulation Details

| Parameter | Value |
|-----------|-------|
| Full runout iterations | 9,000 |
| Next-street (turn) iterations | 6,000 |
| Supported hand sizes | 5, 6, or 7 cards |
| Opponent range | 1–8 |

Results are probabilistic estimates. Variance decreases as more community cards are known (fewer cards left to simulate).

---

## Limitations

- Only works on **PokerNow.club** — the card parser relies on PokerNow's specific CSS class naming scheme.
- Only your own hole cards (visible to you) are used. Opponent hands are simulated randomly from the remaining deck.
- No range-based opponent modeling — all opponent hands are treated as random.

---

## Contributing

Pull requests are welcome. If PokerNow updates its CSS class names and the extension stops reading cards correctly, the selectors to update are in the `readCards()` function near the top of `content.js`.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit your changes
4. Open a pull request

---
Disclaimer
This extension is provided for educational and personal use only. By using it, you agree to the following:

The author is not responsible for any consequences arising from use of this software, including but not limited to account suspension, bans, or violations of PokerNow.club's Terms of Service.
It is your responsibility to review and comply with PokerNow's Terms of Service before using this extension.
This software is provided "as is", without warranty of any kind, express or implied. The author makes no guarantees about the accuracy of the odds calculations.
The author is not liable for any losses — financial or otherwise — resulting from decisions made based on the information displayed by this extension.

Use at your own risk.

## License

MIT — see [LICENSE](LICENSE) for details.
