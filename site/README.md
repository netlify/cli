# Netlify CLI docs site

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

## Architecture

All the command reference pages and the list of commands are automatically generated from the CLI code. This is
automatically inserted into the existing, committed, semi-manually-written pages in `../docs/`. Here's how the flow
works:

1. The `docs.js` script replaces the content between the auto-generation marker comments in the files in `../docs/`; the
   rest you can update manually.
2. The `sync.js` script copies these over to this Astro Starlight site, into `src/content/docs/`. It may also perform
   some minor transformations.
3. From there, it's any old Astro/Starlight docs site, as documented.

## 🚀 Project Structure

Inside of your Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   ├── docs/
│   └── content.config.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on
its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                 | Action                                                                             |
| :---------------------- | :--------------------------------------------------------------------------------- |
| `npm install`           | Installs dependencies                                                              |
| `npm run dev`           | Starts local dev server at `localhost:4321`                                        |
| `npm run build:docs-md` | Generate the Markdown command pages from code                                      |
| `npm run build:docs-md` | Generate the Markdown command pages from code and sync them into this site's pages |
| `npm run build`         | Build your production site to `./dist/`                                            |
| `npm run preview`       | Preview your build locally, before deploying                                       |

## 👀 Want to learn more?

Check out [Starlight’s docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build),
or jump into the [Astro Discord server](https://astro.build/chat).
