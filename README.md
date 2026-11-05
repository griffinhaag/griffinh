# griffinh.me

My personal site and portfolio. **Live at [griffinh.me](https://griffinh.me)**

![The griffinh.me hero: my name over a night mountain scene with a moon, a gondola, and a small skier on the summit](public/og.jpg)

## What's on it

- **A mountain scene you can play with.** The hero is drawn on a canvas. Hover the sky to make it snow, drag the skier anywhere across the range, and bring him all the way down to ride the gondola back up. His tracks fade behind him.
- **Projects you can use on the page.** Small playable versions of the three [GriffinGames](https://griffinhgames.xyz) games, and a working copy of DayONE's video library, filters, and admin tools.
- **Project pages** for GriffinGames and DayONE: how they work, what was tricky, and screenshots.
- **The usual portfolio bits.** Experience, a toolbox that shows where I've used each tool, a bit about me, and a contact form.
- **A hidden terminal.** Press `` ` `` anywhere (or use the link in the footer) and type `help`.

## Built with

[Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), written in TypeScript. There's no UI framework; the interactive pieces are small scripts and one canvas. The site builds to plain static files.

## Running it locally

Requires Node 22 or newer.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run preview   # serve the built site
```

## Contact form

The form sends through [Web3Forms](https://web3forms.com). Put the access key in a `.env` file at the project root:

```
PUBLIC_WEB3FORMS_KEY=your-access-key
```

The key only lets the form deliver messages to my inbox, so it's safe in a public site. Without one, the form opens a pre-filled email instead. `.env` is gitignored, so set the same variable in the hosting provider's settings.

## Editing content

Most of the words live in `src/data/site.ts`: experience, smaller projects, client work, the toolbox, and quick facts. The project pages are in `src/pages/projects/`.

## Layout

```
src/
  components/   Page sections (Hero, Experience, Projects, Toolbox, About, Contact),
                the game and DayONE previews, and the hidden terminal
  scripts/      mountains.ts: the hero scene, skier, snow, and gondola
  data/         Site content, DayONE's video list, trivia questions, and card prompts
  layouts/      The page shell and the project page layout
  pages/        Home, project pages, and the 404
public/         Images, resume PDF, favicon, and the social share image
```

## Branches

`main` is what's live. Work happens on `griffinh-testing` first and moves to `main` once it's been checked.
