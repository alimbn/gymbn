const WEIGHT_CLARIFICATION_RE = /^\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*kg$|^\d+(?:\.\d+)?\s*kg$/i;
const WEIGHT_RE = /(\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*kg|\d+(?:\.\d+)?\s*kg)(?:\s+(dumbell|dumbbell))?(?:\s*\(([^)]*)\))?/i;
const RIR_RE = /rir\s*(\d+(?:-\d+)?)/i;
const UNTIL_RIR_PHRASE_RE = /olana kadar tekrar/i;
const TIME_RE = /(\d+)\s*sn/i;
const UNTIL_FAILURE_RE = /tükenene kadar/i;
const REPS_RE = /(\d+(?:-\d+)?)\s*tekrar/i;
const SET_RE = /(\d+)\s*set/i;

function collapseSpaces(str) {
  return str.replace(/\s+/g, ' ').trim();
}

export function parseExerciseLine(rawLine) {
  let line = rawLine;
  let note = '';

  // 1. Parenthetical content: weight-clarification (e.g. "(15x15kg)") stays in the
  // line for the weight regex to absorb; anything else becomes a free-text note.
  line = line.replace(/\(([^)]*)\)/g, (match, inner) => {
    if (WEIGHT_CLARIFICATION_RE.test(inner.trim())) return match;
    note = note ? note + '; ' + inner.trim() : inner.trim();
    return ' ';
  });

  // 2. Weight: number(+xnumber)kg, optional "dumbell/dumbbell" word, optional clarification paren.
  let weight = '';
  const weightMatch = line.match(WEIGHT_RE);
  if (weightMatch) {
    weight = collapseSpaces(weightMatch[0]);
    line = line.slice(0, weightMatch.index) + ' ' + line.slice(weightMatch.index + weightMatch[0].length);
  }

  // 3. RIR ("rir 1" or "rir 1-2").
  let rir = '';
  const rirMatch = line.match(RIR_RE);
  if (rirMatch) {
    rir = rirMatch[1];
    line = line.replace(rirMatch[0], ' ');
  }

  // 4. "olana kadar tekrar" (reps-until-RIR phrase) — target already captured by rir above.
  line = line.replace(UNTIL_RIR_PHRASE_RE, ' ');

  // 5. Time-based reps ("75sn").
  let reps = '';
  const timeMatch = line.match(TIME_RE);
  if (timeMatch) {
    reps = timeMatch[1] + 'sn';
    line = line.replace(timeMatch[0], ' ');
  }

  // 6. "tükenene kadar" (until failure).
  if (!reps && UNTIL_FAILURE_RE.test(line)) {
    reps = 'tükenene kadar';
    line = line.replace(UNTIL_FAILURE_RE, ' ');
  }

  // 7. Numeric reps ("8-9 tekrar" / "6 tekrar").
  if (!reps) {
    const repsMatch = line.match(REPS_RE);
    if (repsMatch) {
      reps = repsMatch[1];
      line = line.replace(repsMatch[0], ' ');
    }
  }

  // 8. Set count ("3 set"). Left blank if absent (e.g. "Hyper extansion 75sn") —
  // buildActualSetsFromPrescribed in storage.js already defaults a blank/NaN count to 1.
  let setCount = '';
  const setMatch = line.match(SET_RE);
  if (setMatch) {
    setCount = Number(setMatch[1]);
    line = line.replace(setMatch[0], ' ');
  }

  // 9. Whatever remains is the exercise name.
  const name = collapseSpaces(line);

  return { name, setCount, reps, rir, weight, note };
}

export function parseWeeklyProgramText(text) {
  const blocks = text
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const [headerRaw, ...exerciseLines] = lines;
    return {
      dayTypeRaw: headerRaw || '',
      exercises: exerciseLines.map(parseExerciseLine).filter((ex) => ex.name),
    };
  });
}
