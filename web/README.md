# StudyFlow

**KZ:** Студенттерге арналған оқу жоспарлаушы. Тапсырманы өз сөзіңмен жазасың, ассистент түрін, мерзімін, қиындығын (1–10) және уақытын өзі бағалап, жұмысты мерзімге дейінгі күндерге бөліп береді. Тіл: қазақша және ағылшынша.

**EN:** A study planner for university students. Describe a task in your own words; the assistant works out its type, deadline, difficulty (1-10) and time, then spreads the work over the days before the deadline. Languages: Kazakh and English.

## Run

No build step and no dependencies. Open `index.html`, or serve the folder:

```
python3 -m http.server 8000 -d web
```

then open http://localhost:8000. Data stays in the browser (`localStorage`).

## What is inside

| File | Job |
| --- | --- |
| `js/assistant.js` | Reads a task text (Kazakh/English): type, subject, deadline, size, then difficulty with reasons. |
| `js/planner.js` | Splits tasks into steps and places them on days, balancing the daily load. Points and streak. |
| `js/music.js` | Generates the lo-fi radio live (Web Audio): chords, bass, swung beat, vinyl crackle, rain. |
| `js/scene.js` | The animated rainy-window scene. |
| `js/data.js` | Universities and faculties. |
| `js/i18n.js` | Interface text (kk, en). |
| `js/app.js` | The interface. |

Tests for the assistant and planner:

```
node --test web/test/logic.test.js
```

## Honest notes

- **The assistant is rule-based, not an AI model.** It runs in the browser, needs no internet and no API key. Its scores are explained and the student can change them. A real language model could be added later through a small backend.
- **The music is generated, not a recording.** It is original, so there are no licensing problems, but it is not the same as a produced album. To use your own royalty-free tracks, play them with an `<audio>` element instead of `music.js`.
- **University data needs checking.** Faculty lists were collected from public pages and may be outdated; the KBTU list is incomplete and Satbayev University is missing. Edit `js/data.js` to fix or extend them.
- The task parser understands common phrases (dates, weekdays, "in 3 days", pages, slides, words). It is not perfect, and the student can always correct the result before adding it.
