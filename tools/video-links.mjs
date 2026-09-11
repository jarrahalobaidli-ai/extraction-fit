// video-links.mjs
//
// Mirrors dashboard.html's CURATED_VIDEO_LINKS / ytSearchUrl so the PDF pipeline links the
// same curated videos the coach dashboard does. KEEP IN SYNC with dashboard.html by hand.

export const CURATED_VIDEO_LINKS = {
  "DB or KB goblet squat / landmine squat": "https://www.youtube.com/watch?v=MeIiIdhvXT4",
  "DB or KB Romanian deadlift / sandbag deadlift": "https://www.youtube.com/watch?v=Uc5rP5xs7qQ",
  "DB, KB, or landmine press": "https://www.youtube.com/watch?v=6c7WxPIEdLU",
  "DB or KB single-arm row / sandbag row": "https://www.youtube.com/watch?v=uQZZdGF16KQ",
  "DB, KB, or sandbag farmer's / suitcase carry": "https://www.youtube.com/watch?v=m7iiTYfRy9A",
  "Weighted plank / DB deadbug / sandbag hold": "https://www.youtube.com/watch?v=fbfJ_FfxwKo",
  "Steel mace 10-to-2 swings / steel club mills and swipes": "https://www.youtube.com/watch?v=oeBLReo9nYE",
  "KB swings at a steady, sustainable pace": "https://www.youtube.com/watch?v=B_x0tp3HIbk",
  "KB swing sprints (20s on / 40s off)": "https://www.youtube.com/watch?v=B_x0tp3HIbk",
};

export const videoUrlFor = (exerciseName) =>
  CURATED_VIDEO_LINKS[exerciseName] ||
  `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + " exercise proper form tutorial")}`;
