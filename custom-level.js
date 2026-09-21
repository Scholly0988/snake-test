"use strict";

// Loader for files exported by "The Snake Editor". GitHub Pages cannot list a
// repository directory, so a level is loaded either by its exact JSON filename
// in the repository root or from the device's file picker.
const SnakeCustomLevel = (() => {
  const MAX_FILE_SIZE = 2 * 1024 * 1024;

  function finite(value, label, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum)
      throw new Error(label + " muss zwischen " + minimum + " und " + maximum + " liegen.");
    return number;
  }

  function integer(value, label, minimum, maximum) {
    const number = finite(value, label, minimum, maximum);
    if (!Number.isInteger(number)) throw new Error(label + " muss eine ganze Zahl sein.");
    return number;
  }

  function assetName(path, fallback) {
    if (typeof path !== "string" || !path.trim()) return fallback;
    const name = path.trim().split(/[\\/]/).pop();
    if (!name || name === "." || name === "..") return fallback;
    // Only root filenames are supported. This also prevents a JSON file from
    // requesting arbitrary external URLs.
    return name.replace(/[?#].*$/, "");
  }

  function point(value, label, width, height) {
    if (!value || typeof value !== "object") throw new Error(label + " ist ungültig.");
    return {
      x: finite(value.x, label + " X", -width, width * 2),
      y: finite(value.y, label + " Y", -height, height * 2)
    };
  }

  function validateDifficultySet(raw, width, height, hpSource, label) {
    if (!raw || !Array.isArray(raw.snakes) || !raw.snakes.length || raw.snakes.length > 50)
      throw new Error(label + " muss 1 bis 50 Schlangen enthalten.");
    const snakes = raw.snakes.map((snake, index) => {
      if (!snake || typeof snake !== "object") throw new Error("Schlange " + (index + 1) + " ist ungültig.");
      const waypoints = Array.isArray(snake.waypoints)
        ? snake.waypoints.map((entry, pointIndex) => point(entry, "Wegpunkt " + (pointIndex + 1), width, height))
        : [];
      return {
        id: String(snake.id || "snake-" + (index + 1)),
        name: String(snake.name || "Schlange " + (index + 1)).slice(0, 80),
        headPng: assetName(snake.headPng, "snake-head.png"),
        bodyPng: assetName(snake.bodyPng, "snake-body.png"),
        segments: integer(snake.segments, "Segmente von Schlange " + (index + 1), 1, 500),
        speed: finite(snake.speed, "Geschwindigkeit von Schlange " + (index + 1), 1, 1000),
        waypoints
      };
    });

    const obstacles = (Array.isArray(raw.obstacles) ? raw.obstacles : []).map((obstacle, index) => {
      if (!obstacle || typeof obstacle !== "object") throw new Error("Hindernis " + (index + 1) + " ist ungültig.");
      return {
        id: String(obstacle.id || "obstacle-" + (index + 1)),
        name: String(obstacle.name || "Hindernis " + (index + 1)).slice(0, 80),
        png: assetName(obstacle.png, ""),
        x: finite(obstacle.x, "Hindernis X", -width, width * 2),
        y: finite(obstacle.y, "Hindernis Y", -height, height * 2),
        width: finite(obstacle.width, "Hindernisbreite", 1, width * 2),
        height: finite(obstacle.height, "Hindernishöhe", 1, height * 2)
      };
    });

    const firstHp = integer(raw.firstHp ?? raw.hp?.first ?? hpSource.firstHp ?? hpSource.hp?.first ?? 5, "Erste Segment-HP", 1, 1000000000);
    const lastHp = integer(raw.lastHp ?? raw.hp?.last ?? hpSource.lastHp ?? hpSource.hp?.last ?? 5500, "Letzte Segment-HP", firstHp, 1000000000);
    return {
      firstHp,
      lastHp,
      hpFallback: raw.firstHp == null && raw.lastHp == null && raw.hp == null && hpSource.firstHp == null && hpSource.lastHp == null && hpSource.hp == null,
      snakes,
      obstacles
    };
  }

  function validate(raw) {
    if (!raw || raw.format !== "the-snake-level" || ![1,2].includes(raw.version))
      throw new Error("Die Datei ist kein unterstütztes The-Snake-Level (Format 1 oder 2).");
    const width = finite(raw.width, "Levelbreite", 100, 10000);
    const height = finite(raw.height, "Levelhöhe", 200, 30000);
    const name = String(raw.name || "Eigenes Level").slice(0, 100);
    if(raw.version===1){
      const set=validateDifficultySet(raw,width,height,raw,"Das Level");
      return {format:raw.format,version:1,name,width,height,...set,difficulties:null};
    }
    if(!raw.difficulties||typeof raw.difficulties!=="object")throw new Error("Format 2 benötigt die Schwierigkeiten easy, normal und hard.");
    const difficulties={};
    for(const [key,label] of [["easy","Leicht"],["normal","Mittel"],["hard","Schwer"]]){
      difficulties[key]=validateDifficultySet(raw.difficulties[key],width,height,raw,label);
    }
    return {format:raw.format,version:2,name,width,height,difficulties};
  }

  function difficultyKey(value) {
    if(value==="hard"||value===.20||value===0.20)return "hard";
    if(value==="normal"||value===.15||value===0.15)return "normal";
    return "easy";
  }

  function selectDifficulty(level,value) {
    const key=difficultyKey(value);
    if(level.version===1||!level.difficulties)return {...level,difficultyKey:key};
    return {...level,...level.difficulties[key],difficultyKey:key};
  }

  function parse(text) {
    if (typeof text !== "string" || text.length > MAX_FILE_SIZE) throw new Error("Die Leveldatei ist zu groß.");
    try { return validate(JSON.parse(text)); }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error("Die Leveldatei enthält kein gültiges JSON.");
      throw error;
    }
  }

  async function fromFile(file) {
    if (!file) throw new Error("Bitte wähle zuerst eine JSON-Datei.");
    if (file.size > MAX_FILE_SIZE) throw new Error("Die Leveldatei ist zu groß.");
    return parse(await file.text());
  }

  async function fromRepository(filename) {
    const safeName = assetName(filename, "");
    if (!safeName || !safeName.toLowerCase().endsWith(".json"))
      throw new Error("Bitte gib den genauen Namen einer JSON-Datei im Hauptordner ein.");
    const response = await fetch(encodeURIComponent(safeName), {cache: "no-store"});
    if (!response.ok) throw new Error("„" + safeName + "“ wurde im GitHub-Hauptordner nicht gefunden.");
    const text = await response.text();
    return {level: parse(text), filename: safeName};
  }

  return {validate, parse, fromFile, fromRepository, assetName, difficultyKey, selectDifficulty};
})();
