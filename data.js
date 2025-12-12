/**
 * Edit these to match your real drills. Clubs are not restricted per drill.
 * drillId is stable; you can change the name/description anytime.
 */
export const DEFAULT_DRILLS = [
  { id: "blue-brick", name: "Blue Brick Constraint", desc: "Use spray. Keep path between -2° and +2°. Redo if > ~9 yards offline.", constraints: [
    "Restart the set for that club if alignment rods are hit.",
    "No more than ~9 yards offline — redo if outside the window.",
    "Club path between -2° and +2°."
  ]},
  { id: "start-line-gate", name: "Start Line Gate", desc: "Start the ball through a gate. Focus on face control.", constraints: ["Gate width: pick a challenging but fair window."]},
  { id: "wedge-ladder", name: "Distance Wedge Ladder", desc: "Hit stepped carry distances (e.g., 60/70/80/90).", constraints: ["Repeat a step if you miss the target window."]},
  { id: "nine-shot", name: "9-Shot Ladder", desc: "Work trajectories and curves. Log success/miss per intent.", constraints: ["Pick clear intent (low/mid/high; draw/straight/fade)."]},
  { id: "random-5", name: "Random 5-Ball Challenge", desc: "Randomize targets/shot types. Track outcomes under pressure.", constraints: ["Commit to routine. No do-overs."]},
];

// Fill out to 28 if you want; the UI supports any number.
export function ensure28Drills(drills){
  if (drills.length >= 28) return drills;
  const out = [...drills];
  for (let i=drills.length+1; i<=28; i++){
    out.push({ id: `drill-${i}`, name: `Drill ${i}`, desc: "Edit this drill in data.js.", constraints: [] });
  }
  return out;
}

export const DEFAULT_CLUBS = [
  // Wedges
  { id:"LW", name:"LW", loft:58, carryAvg:80,  carryMin:76,  carryMax:84,  notes:"" },
  { id:"SW", name:"SW", loft:54, carryAvg:91,  carryMin:87,  carryMax:95,  notes:"" },
  { id:"GW", name:"GW", loft:48, carryAvg:103, carryMin:98,  carryMax:108, notes:"" },
  { id:"AW", name:"AW", loft:46, carryAvg:113, carryMin:108, carryMax:118, notes:"" },
  { id:"PW", name:"PW", loft:43, carryAvg:122, carryMin:116, carryMax:127, notes:"" },
  // Irons
  { id:"9i", name:"9i", loft:37, carryAvg:137, carryMin:131, carryMax:143, notes:"" },
  { id:"8i", name:"8i", loft:32, carryAvg:152, carryMin:145, carryMax:158, notes:"" },
  { id:"7i", name:"7i", loft:28, carryAvg:164, carryMin:157, carryMax:171, notes:"" },
  { id:"6i", name:"6i", loft:24, carryAvg:173, carryMin:165, carryMax:181, notes:"" },
  // Woods
  { id:"7W", name:"7W", loft:21, carryAvg:185, carryMin:177, carryMax:193, notes:"" },
  { id:"3W", name:"3W", loft:15, carryAvg:200, carryMin:192, carryMax:209, notes:"" },
];
