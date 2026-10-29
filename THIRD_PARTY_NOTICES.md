# Third-party notices

Rezepttabellen is licensed under the GNU AGPL v3 or later (see [`LICENSE`](LICENSE)). It is
built with the following open-source software, all under licences compatible with the AGPL.
Versions are the ones resolved in `package-lock.json` at the time of writing; transitive
dependencies are listed there.

## Web app and Android app

| Package | Version | Licence |
|---|---|---|
| [Svelte](https://svelte.dev) (compiled into the app) | 5.57.2 | MIT |
| [Capacitor](https://capacitorjs.com) core and plugins (app, camera, filesystem, local-notifications, share) | 7.x | MIT |
| [marked](https://marked.js.org) | 18.1.1 | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 | MPL-2.0 or Apache-2.0 (used under Apache-2.0) |
| [qrcode](https://github.com/soldair/node-qrcode) | 1.5.4 | MIT |
| [yaml](https://eemeli.org/yaml/) | 2.9.1 | ISC |
| [zod](https://zod.dev) | 4.6.7 | MIT |
| AndroidX libraries (via Capacitor) | — | Apache-2.0 |

## Server (Docker image)

| Package | Version | Licence |
|---|---|---|
| [Fastify](https://fastify.dev) and [@fastify/static](https://github.com/fastify/fastify-static) | 5.12.5 / 10.1.6 | MIT |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (bundles SQLite, public domain) | 12.11.1 | MIT |
| [chokidar](https://github.com/paulmillr/chokidar) | 5.0.0 | MIT |
| [archiver](https://github.com/archiverjs/node-archiver) | 7.0.1 | MIT |
| [sharp](https://sharp.pixelplumbing.com) (bundles libvips, LGPL-3.0-or-later, dynamically linked) | 0.35.5 | Apache-2.0 |
| [playwright-core](https://playwright.dev) | 1.64.0 | Apache-2.0 |
| Chromium (installed in the image for the PDF export) | — | BSD-3-Clause and others, see `chrome://credits` |
| [tsx](https://tsx.is) | 4.23.15 | MIT |
| [Node.js](https://nodejs.org) | — | MIT |
