# Neurix

Neurix starts as a familiar Scratch-style editor: drag blocks, run them on a stage, work with sprites, sounds, costumes, variables, and lists.

The point of the project is to make block programming useful past beginner demos. A creator should eventually be able to build richer games and interactive projects without starting from a blank code editor every time: physics, 3D scenes, audio systems, AI-generated assets, multiplayer, and blocks backed by real JavaScript libraries.

This is still early. A lot of the current functionality is foundations: save/load, block conversion, runtime behavior, Scratch project import, and making sure the editor does not lose state.

## What works right now

- Projects can be created, saved, duplicated, renamed, and deleted from the dashboard.
- The editor has a stage, sprites, costumes, backdrops, sounds, variables, lists, and watchers.
- Blocks are built with Blockly and run through Neurix's own compiler/runtime path.
- A growing set of blocks work across motion, looks, sound, control, sensing, events, variables, lists, and custom blocks.
- Event scripts can run from the green flag, broadcasts, backdrop changes, clone starts, key presses, sprite clicks, and stage clicks.
- AI can generate blocks, explain blocks, and answer questions about selected scripts.
- Scratch `.sb3` files can be imported and exported, with Neurix project data preserved on export.

## What makes it different from Scratch

Scratch is the starting point because the model is good: blocks, sprites, immediate feedback, and a simple stage. Neurix keeps that shape, but the ceiling should be much higher.

The biggest difference is library-backed blocks. Instead of being limited to a small set of built-in blocks or simple extensions, Neurix should eventually let creators pull in real JavaScript libraries and use them visually. Three.js for 3D, Matter.js or Rapier for physics, Tone.js for audio, PixiJS or Phaser for games, AI/ML libraries for camera input or smarter behavior, and so on.

AI is another difference, but not as a gimmick. The goal is for AI to understand the project well enough to edit scripts, create assets, explain behavior, fix broken logic, and help remix existing projects.

## Soon to be developed

- Finish the remaining important Scratch-style behavior and compatibility gaps.
- Keep tightening save/load, watchers, events, and `.sb3` import/export.
- Make AI block generation more reliable.
- Add better tests around block parsing, runtime behavior, and project persistence.
- Start designing the library/extension system.
- Add object handles so blocks can pass around richer things than strings and numbers.
- Improve the dashboard, onboarding, templates, and publishing flow.

## Long term

- 3D stage mode.
- More serious 2D and 3D game tools.
- AI-generated sprites, backdrops, sounds, animations, and project scaffolds.
- Support for many library-backed block packs, covering physics, AI, computer vision, audio, networking, procedural generation, 3D rendering, and other areas where blocks can sit on top of real JS tools.
- Multiplayer and collaboration primitives.
- Public project pages, stars, comments, profiles, and remix trees.

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run Convex locally in a separate terminal when working on persisted projects:

```bash
npm run convex:dev
```

Check the project before shipping changes:

```bash
npm run lint
npm run build
```