# Playto

A little practice. A lot of music.

**[playto.madebyfavor.com](https://playto.madebyfavor.com)** is a free, static, offline-first music learning site, and a sister to [Langto](https://langto.madebyfavor.com). No accounts, ads, lives, or leaderboards.

## Learn and practise

**60 lessons across four independent courses:** keyboard, acoustic guitar, bass guitar and alto saxophone. Each path includes five beginner, five intermediate and five advanced-foundation lessons, with a checkpoint/level test at every stage. The courses move from first sounds and posture to notation/tab, scales, chord harmony, rhythm, ear training, original pieces, improvisation and arranging.

- Sequential lesson paths, playing goals and short knowledge checks.
- On-screen keyboard, guitar and bass fretboard/tab, guitar chord shapes, alto sax main-key fingering charts with extra-key instructions, and staff pitch guides. Alto sax lessons/charts use written pitch; microphone matching accounts for the nine-semitone Eb transposition and the tuner shows concert pitch. Guitar/bass fretboards use sounding pitch; their staff guides use the conventional one-octave-higher written pitch.
- Randomized, replayable ear-training challenges for unison, major second/third, fourth, fifth and octave, with instant feedback and no penalties.
- Optional microphone tuner and single-note practice using local YIN pitch detection. Tap **Connect microphone** to request permission directly. No recording or audio upload; headphones avoid feedback. Polyphonic chords and rhythm use explicit self-assessment, not pretend automated grading.
- Optional Web MIDI keyboard input (Chrome/Edge over HTTPS), metronome, original synthesized backing, adjustable tempo and selected-note pitch loops at half/full speed. Pattern playback uses equal-duration notes; written lesson counts specify actual musical rhythm.
- XP, levels, badges, daily streaks with an automatic one-day freeze, and spaced reviews. Every seven streak days earns a freeze (maximum two). Reviews begin after one day, double when confident (maximum 60 days), and return tomorrow when difficult.
- Actual saved practice minutes, matched notes, learned chords and self-assessed tempo milestones (minimum 30-second session).
- System-default dark/light theme, sepia, high contrast, serif and bundled OpenDyslexic reading fonts. Replay the welcome tour in Settings.

Progress is stored only in this browser's `localStorage`, separately per instrument. **Export progress JSON** in Settings to back it up or move it to another device. Import validates the entire backup and asks before replacing data. Clearing browser storage removes progress. A failed storage read is reported and the original data is not overwritten.

## Offline and install

Visit online once and let the service worker finish caching. It precaches the app, lesson JSON compiled into the app, icons and local fonts. All audio is synthesized on the device. Install with the browser's Install app option, or Safari → Share → Add to Home Screen on iOS/iPadOS. Microphone/MIDI support varies by browser; on-screen practice and self-assessment always remain available.

Updates wait until you choose **Update & reload**; save your current practice first. Microphone tracks and MIDI listeners are released when disconnecting or leaving practice.
Active practice sessions save automatically when navigating away or switching instruments. Save explicitly before closing/reloading the browser; suggested lesson durations are never counted as actual practice.

## Development

Requires Node 22 and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The production preview is used by Playwright. Tests cover audio detection (including low bass, harmonics, silence and noise), progress/backup/streak/review logic, curriculum validity, lesson completion, themes and fonts, mocked microphone success/denial and sax transposition, audio controls, MIDI input, import/export, ear training, offline reload, and overflow at 390px, 768px and 1440px.
Raster PWA icons are generated from the source SVG with `node scripts/generate-icons.mjs` (requires Playwright Chromium).

## Deployment and DNS

GitHub Actions validates the app and deploys `dist` via `actions/deploy-pages` on each push to `main`. Pages is configured for a workflow build and custom domain; Vite uses **base `/`** and `public/CNAME` contains `playto.madebyfavor.com`.

**DNS action required:** create a **CNAME** record named **`playto`** pointing to **`adamsdenniskariuki.github.io`** at the DNS provider for `madebyfavor.com`. Enable HTTPS in GitHub Pages when the domain certificate is ready.

The CNAME was verified during initial deployment. Keep this record if changing DNS providers.

## Curriculum and licences

Content lives in `content/<instrument>/course.json`; `src/types.ts` defines the schema and `src/courses.ts` registers each course. Lessons specify goals, practical steps, note patterns, assessments and quizzes. All pieces and backing patterns are original exercises, not copyrighted songs. The staff is a labelled pitch guide rather than a full rhythmic engraving engine.

OpenDyslexic is distributed through `@fontsource/opendyslexic` with its bundled licence. React, Vite, TypeScript, Vitest and Playwright retain their respective upstream licences.

Playto is a practice companion, not a substitute for an instrument teacher. Rest regularly and stop if playing hurts; a teacher can assess posture, technique and instrument setup.
The advanced stage is a structured introduction to advanced techniques and musical decisions, not an exhaustive conservatory curriculum or a claim of mastery. Keyboard covers inversions, pedal, independent syncopation and arranging; guitar covers partial barre, fingerstyle, triads and improvisation; bass covers arpeggios, walking, sixteenth subdivisions and fills; sax covers chromatic/extra-key work, arpeggios, expression, transposition and improvisation.
