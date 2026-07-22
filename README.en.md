# Tab Sorter

A Yandex Browser extension for keeping open tabs organized: sort them, group them by domain, and save a working session for later.

## Features

- sort by title, domain, last access time, favicon, or protocol;
- group tabs by domain into separate windows;
- save tabs to history and optionally close the originals;
- keep important tabs in a separate memory/favorites list;
- export history and favorites as HTML or CSV;
- light theme by default with an optional dark theme.

## Development Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/hdworker/browser-awesome-tab-organizer.git
   cd browser-awesome-tab-organizer
   ```

2. Open the Yandex Browser extensions page: `browser://extensions`.
3. Enable developer mode.
4. Choose “Load unpacked” and select the project root.

## Usage

Open the extension popup from the browser toolbar. Choose a sorting method and an action. Settings and the selected theme are stored in browser sync storage.

## Project Structure

- `popup.html`, `popup.js` — popup UI and actions;
- `history.html`, `history.js` — history and favorites views;
- `background.js` — toolbar-click sorting handler;
- `src/utils/database.js` — IndexedDB storage layer.

## License

This project is released under the [MIT License](LICENSE).

Russian documentation: [README.md](README.md).
