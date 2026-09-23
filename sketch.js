/* =========================================================
   MIDNIGHT DINER — EXTRA AUDIO (JS-ONLY, NO HTML CHANGES)

   Put these MP3 files in assets/:
     restaurant_ambience.mp3  menu_open.mp3  menu_select.mp3
     steam.mp3  dish_serve.mp3  eating.mp3
     receipt_open.mp3  receipt_close.mp3  receipt_save.mp3
     answer_hover.mp3  answer_select.mp3

   The five original sounds are preserved unchanged.
   Sounds missing from assets/ never block a scene transition.
   ========================================================= */
const DINER_EXTRA_SOUND_FILES = Object.freeze({
  restaurant: { file: 'restaurant_ambience.mp3', volume: 0.24, loop: true },
  menuOpen:   { file: 'menu_open.mp3',          volume: 0.48 },
  menuPick:   { file: 'menu_select.mp3',        volume: 0.39 },
  steam:      { file: 'steam.mp3',              volume: 0.13, loop: true },
  dishServe:  { file: 'dish_serve.mp3',         volume: 0.48 },
  bite:       { file: 'eating.mp3',             volume: 0.32 },
  paperOpen:  { file: 'receipt_open.mp3',      volume: 0.33 },
  paperClose: { file: 'receipt_close.mp3',     volume: 0.28 },
  paperSave:  { file: 'receipt_save.mp3',      volume: 0.42 },
  questionHover:  { file: 'answer_hover.mp3',   volume: 0.18 },
  questionSelect: { file: 'answer_select.mp3',  volume: 0.37 }
});
const dinerExtraSoundCache = Object.create(null);

function dinerExtraSound(name) {
  const settings = DINER_EXTRA_SOUND_FILES[name];
  if (!settings) return null;
  if (dinerExtraSoundCache[name]) return dinerExtraSoundCache[name];

  // Prefer an <audio> element if the project already defines one; creating
  // an Audio object also works with the unchanged existing index.html.
  const audioId = settings.file.replace(/\.mp3$/i, '').replace(/_/g, '-') + '-audio';
  const existing = document.getElementById(audioId);
  const audio = existing || new Audio('assets/' + settings.file);
  audio.loop = !!settings.loop;
  audio.preload = 'auto';
  audio.volume = settings.volume;
  // Audio created after the visitor muted the game must start muted too.
  audio.muted = dinerSoundMuted;
  dinerExtraSoundCache[name] = audio;
  return audio;
}

function dinerPlayExtraSound(name, restart = true) {
  const audio = dinerExtraSound(name);
  if (!audio) return null;
  try {
    // Keep the user's sound preference even when a delayed scene cue plays.
    audio.muted = dinerSoundMuted;
    if (restart) audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      // Missing files or browser sound permissions must never interrupt play.
      playPromise.catch(() => {});
    }
  } catch (error) {
    // Do not allow an audio error to affect the storytelling state machine.
  }
  return audio;
}

// Hover sounds are subtle and should not stutter while the bubbles move.
let dinerLastQuestionHoverCueAt = -Infinity;
function dinerPlayQuestionHoverSound() {
  const now = performance.now();
  if (now - dinerLastQuestionHoverCueAt < 140) return;
  dinerLastQuestionHoverCueAt = now;
  dinerPlayExtraSound('questionHover');
}

function dinerStopExtraSound(name) {
  const audio = dinerExtraSoundCache[name];
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (error) {}
}

function dinerStartRestaurantAmbience() {
  // Begin the media stream directly inside the user's Enter click: browsers
  // may block a new .play() if it first runs in the delayed scene callback.
  const audio = dinerExtraSound('restaurant');
  if (!audio || !audio.paused) return;
  audio.volume = 0.012;
  dinerPlayExtraSound('restaurant', false);
}

/* Lower ONLY the restaurant ambience while the five question prompts are
   visible; restore the original indoor level once questions finish.
   Keep the audio playing continuously and preserve the sound-toggle mute. */
let dinerQuestionAmbienceIsQuiet = false;
function dinerSetQuestionAmbienceQuiet(quiet) {
  if (dinerQuestionAmbienceIsQuiet === quiet) return;
  dinerQuestionAmbienceIsQuiet = quiet;
  const roomAudio = dinerExtraSoundCache.restaurant;
  if (!roomAudio) return; // Never create / auto-play new audio here.
  fadeAudio(roomAudio, quiet ? 0.065 : DINER_EXTRA_SOUND_FILES.restaurant.volume,
    quiet ? 650 : 950);
}

/* =========================================================
   MIDNIGHT DINER

   LANDING
   +
   INTERIOR RESTAURANT
   +
   DIALOGUE
   +
   LIGHT FLICKER
   ========================================================= */

const BASE_W = 1920;
const BASE_H = 1080;

/* =========================================================
   LANDING DOM
   ========================================================= */

let scene;

let lampHolder;
let lampLight;

let enterButton;
let transitionScreen;

let ambienceAudio;
let windAudio;
let bellAudio;

/* =========================================================
   INTERIOR DOM
   ========================================================= */

let interiorScene;

let interiorReflect;

let dialogueBox;

let dialogueText;

/* =========================================================
   LAMP
   ========================================================= */

let lampHovered = false;

let lampAngle = 0;

let lightOpacity = 0.44;

/* =========================================================
   DUST
   ========================================================= */

let dustParticles = [];

const DUST_COUNT = 200;

/* =========================================================
   AUDIO
   ========================================================= */

let audioStarted = false;

/* =========================================================
   TRANSITION / SCENE
   ========================================================= */

let transitioning = false;

let insideRestaurant = false;

/* =========================================================
   OWNER DIALOGUE
   ========================================================= */

const ownerDialogue = [

  "Welcome. It's late... take a seat.",

  "Not many people come through that door at this hour.",

  "But somehow, the ones who do always seem to be carrying something with them.",

  "You don't have to tell me everything.",

  "Sometimes a warm meal is enough to make things a little easier to understand.",

  "Take your time. When you're ready, have a look at tonight's menu."

];

let dialogueIndex = 0;

/* =========================================================
   TYPEWRITER
   ========================================================= */

let dialogueTyping = false;

let typedCharacters = 0;

let lastCharacterTime = 0;

const TYPE_SPEED = 28;

/* =========================================================
   INTERIOR LIGHT FLICKER
   ========================================================= */

let reflectionOpacity = 0.64;

let nextFlickerTime = 0;

let flickerActive = false;

let flickerStarted = 0;

let flickerDuration = 0;

/* =========================================================
   SETUP
   ========================================================= */

function setup() {

  /* =======================================================
     LANDING DOM
     ======================================================= */

  scene =
    document.getElementById(
      "scene"
    );

  lampHolder =
    document.getElementById(
      "lamp-holder"
    );

  lampLight =
    document.getElementById(
      "lamp-light"
    );

  enterButton =
    document.getElementById(
      "enter-button"
    );

  transitionScreen =
    document.getElementById(
      "transition"
    );

  /* =======================================================
     INTERIOR DOM
     ======================================================= */

  interiorScene =
    document.getElementById(
      "interior-scene"
    );

  interiorReflect =
    document.getElementById(
      "interior-reflect"
    );

  dialogueBox =
    document.getElementById(
      "dialogue-box"
    );

  dialogueText =
    document.getElementById(
      "dialogue-text"
    );

  /* =======================================================
     AUDIO DOM
     ======================================================= */

  ambienceAudio =
    document.getElementById(
      "ambience-audio"
    );

  windAudio =
    document.getElementById(
      "wind-audio"
    );

  bellAudio =
    document.getElementById(
      "bell-audio"
    );

  /* =======================================================
     RESPONSIVE
     ======================================================= */

  fitSceneToScreen();

  /* =======================================================
     P5 CANVAS
     ======================================================= */

  const canvas =
    createCanvas(
      BASE_W,
      BASE_H
    );

  canvas.parent(
    "scene"
  );

  pixelDensity(
    1
  );

  clear();

  /* =======================================================
     DUST
     ======================================================= */

  createDust();

  /* =======================================================
     LANDING LAMP
     ======================================================= */

  lampHolder.addEventListener(

    "mouseenter",

    function () {

      lampHovered =
        true;

    }

  );

  lampHolder.addEventListener(

    "mouseleave",

    function () {

      lampHovered =
        false;

    }

  );

  /* =======================================================
     ENTER BUTTON
     ======================================================= */

  enterButton.addEventListener(

    "click",

    enterRestaurant

  );

  /* =======================================================
     DIALOGUE CLICK
     ======================================================= */

  dialogueBox.addEventListener(

    "click",

    function (event) {

      event.stopPropagation();

      advanceDialogue();

    }

  );

  /* =======================================================
     AUDIO UNLOCK
     ======================================================= */

  window.addEventListener(

    "pointerdown",

    startAudio,

    {
      once: true
    }

  );

  /* =======================================================
     KEYBOARD
     ======================================================= */

  window.addEventListener(

    "keydown",

    handleKeyboard

  );

}

/* =========================================================
   DRAW LOOP
   ========================================================= */

function draw() {

  clear();

  /* =======================================================
     LANDING
     ======================================================= */

  if (
    !insideRestaurant
  ) {

    animateLamp();

    animateLampLight();

    drawDust();

  }

  /* =======================================================
     INTERIOR
     ======================================================= */

  else {

    updateInteriorFlicker();

    updateDialogueTypewriter();

  }

}

/* =========================================================
   RESPONSIVE FIT
   ========================================================= */

function fitSceneToScreen() {

  const scaleX =

    window.innerWidth /
    BASE_W;

  const scaleY =

    window.innerHeight /
    BASE_H;

  const finalScale =

    Math.min(
      scaleX,
      scaleY
    );

  scene.style.setProperty(

    "--scene-scale",

    finalScale

  );

}

/* =========================================================
   LANDING LAMP MOVEMENT
   ========================================================= */

function animateLamp() {

  const sineMotion =

    sin(
      frameCount *
      0.015
    ) *

    0.65;

  const noiseMotion =

    map(

      noise(
        frameCount *
        0.003
      ),

      0,
      1,

      -0.32,
      0.32

    );

  let targetAngle =

    sineMotion +
    noiseMotion;

  if (
    lampHovered
  ) {

    targetAngle *=
      1.4;

  }

  lampAngle =

    lerp(

      lampAngle,

      targetAngle,

      0.06

    );

  lampHolder.style.transform =

    `rotate(${lampAngle}deg)`;

}

/* =========================================================
   LANDING LIGHT FLICKER
   ========================================================= */

function animateLampLight() {

  let targetOpacity;

  /* normal */

  if (
    !lampHovered
  ) {

    targetOpacity =

      0.44 +

      sin(
        frameCount *
        0.025
      ) *

      0.025;

  }

  /* hover */

  else {

    targetOpacity =

      random(
        0.48,
        0.82
      );

    /* random dark dip */

    if (

      random() <
      0.10

    ) {

      targetOpacity =

        random(
          0.18,
          0.35
        );

    }

    /* random bright flash */

    if (

      random() <
      0.025

    ) {

      targetOpacity =

        random(
          0.85,
          1
        );

    }

  }

  lightOpacity =

    lerp(

      lightOpacity,

      targetOpacity,

      lampHovered
        ? 0.28
        : 0.05

    );

  lampLight.style.opacity =
    lightOpacity;

}

/* =========================================================
   DUST
   ========================================================= */

function createDust() {

  dustParticles =
    [];

  for (

    let i = 0;

    i < DUST_COUNT;

    i++

  ) {

    dustParticles.push(

      new DustParticle(
        true
      )

    );

  }

}

/* =========================================================
   DRAW DUST
   ========================================================= */

function drawDust() {

  push();

  blendMode(
    SCREEN
  );

  for (

    const particle
    of dustParticles

  ) {

    particle.update();

    particle.display();

  }

  blendMode(
    BLEND
  );

  pop();

}

/* =========================================================
   DUST CLASS
   ========================================================= */

class DustParticle {

  constructor(
    initial
  ) {

    this.noiseSeed =

      random(
        10000
      );

    this.phase =

      random(
        TWO_PI
      );

    this.reset(
      initial
    );

  }

  /* =======================================================
     RESET
     ======================================================= */

  reset(
    initial = false
  ) {

    this.x =

      random(
        BASE_W
      );

    if (
      initial
    ) {

      this.y =

        random(
          BASE_H
        );

    }

    else {

      this.y =

        BASE_H +

        random(
          10,
          100
        );

    }

    this.size =

      random(
        1.1,
        3.2
      );

    this.speedY =

      random(
        0.06,
        0.22
      );

    this.speedX =

      random(
        0.02,
        0.14
      );

    this.alpha =

      random(
        20,
        55
      );

  }

  /* =======================================================
     UPDATE
     ======================================================= */

  update() {

    const wind =

      map(

        noise(

          this.noiseSeed +

          frameCount *
          0.0025

        ),

        0,
        1,

        -0.12,
        0.28

      );

    this.x +=

      this.speedX +
      wind;

    this.y -=

      this.speedY;

    this.x +=

      sin(

        frameCount *
        0.006 +

        this.phase

      ) *

      0.06;

    this.y +=

      cos(

        frameCount *
        0.004 +

        this.phase

      ) *

      0.025;

    if (

      this.y < -20

      ||

      this.x >
      BASE_W + 30

    ) {

      this.x =

        random(
          -40,
          BASE_W
        );

      this.y =

        BASE_H +

        random(
          20,
          100
        );

    }

  }

  /* =======================================================
     DISPLAY
     ======================================================= */

  display() {

    const pulse =

      sin(

        frameCount *
        0.012 +

        this.phase

      );

    const currentAlpha =

      this.alpha +

      pulse *
      8;

    /* soft glow */

    if (

      this.size >
      2.4

    ) {

      noStroke();

      fill(

        235,
        215,
        180,

        currentAlpha *
        0.18

      );

      circle(

        this.x,
        this.y,

        this.size *
        4

      );

    }

    /* main particle */

    noStroke();

    fill(

      236,
      219,
      190,

      currentAlpha

    );

    circle(

      this.x,
      this.y,

      this.size

    );

  }

}

/* =========================================================
   AUDIO
   ========================================================= */

function startAudio() {

  if (
    audioStarted
  ) {

    return;

  }

  audioStarted =
    true;

  /* ambience */

  if (
    ambienceAudio
  ) {

    ambienceAudio.volume =
      0.22;

    ambienceAudio
      .play()
      .catch(
        () => {}
      );

  }

  /* wind */

  if (
    windAudio
  ) {

    windAudio.volume =
      0.07;

    windAudio
      .play()
      .catch(
        () => {}
      );

  }

}

/* =========================================================
   ENTER RESTAURANT
   ========================================================= */

function enterRestaurant() {

  if (
    transitioning
  ) {

    return;

  }

  transitioning =
    true;

  startAudio();
  dinerStartRestaurantAmbience();

  /* The entrance bell now waits until the black transition is underway.
     This keeps the bell in sync with the moment the restaurant door opens,
     instead of sounding immediately when the Enter button is clicked. */

  /* =======================================================
     FADE OUT WIND
     ======================================================= */

  if (
    windAudio
  ) {

    fadeAudio(

      windAudio,

      0,

      1000

    );

  }

  /* =======================================================
     FADE OUT OUTDOOR NIGHT AMBIENCE

     Night ambience and wind belong ONLY to the landing scene.
     Use the separate restaurant_ambience.mp3 indoors instead.
     ======================================================= */

  if (
    ambienceAudio
  ) {

    fadeAudio(

      ambienceAudio,

      0,

      1000

    );

  }

  /* =======================================================
     BLACK SCREEN
     ======================================================= */

  transitionScreen
    .classList
    .add(
      "active"
    );

  /* The fade to black takes 1.35s. Ring the bell 0.7s into it.
     It begins over the transition, then fades as the room appears. */
  setTimeout(function () {
    if (!transitioning || insideRestaurant || !bellAudio) return;
    try {
      bellAudio.currentTime = 0;
      bellAudio.volume = 0.65;
      const bellPromise = bellAudio.play();
      if (bellPromise && typeof bellPromise.catch === 'function') {
        bellPromise.catch(() => {});
      }
    } catch (error) {
      // An unavailable MP3 must not interrupt the entrance animation.
    }
  }, 700);

  /*
    CSS black transition = 1.35s
  */

  setTimeout(

    function () {

      /* ===================================================
         SHOW INTERIOR WHILE SCREEN IS BLACK
         =================================================== */

      interiorScene
        .classList
        .add(
          "active"
        );

      insideRestaurant =
        true;

      // Night ambience and wind belong only to the exterior: stop both
      // as soon as the interior appears beneath the transition.
      for (const outdoorSound of [ambienceAudio, windAudio]) {
        if (!outdoorSound) continue;
        try {
          outdoorSound.pause();
          outdoorSound.currentTime = 0;
        } catch (error) {}
      }

      // Let the entrance bell overlap the door-opening transition, but
      // fade and stop it before the owner's first dialogue appears.
      if (bellAudio) {
        fadeAudio(bellAudio, 0, 600);
        setTimeout(function () {
          try { bellAudio.pause(); bellAudio.currentTime = 0; } catch (error) {}
        }, 650);
      }

      const roomAmbience = dinerExtraSoundCache.restaurant;
      if (roomAmbience) fadeAudio(roomAmbience, 0.24, 1600);

      /* ===================================================
         START DIALOGUE
         =================================================== */

      dialogueIndex =
        0;

      startDialogue();

      /* ===================================================
         START INTERIOR FLICKER TIMER
         =================================================== */

      scheduleNextFlicker();

      /*
        Hold full black for a short moment.
      */

      setTimeout(

        function () {

          /* ===============================================
             REVEAL INTERIOR
             =============================================== */

          transitionScreen
            .classList
            .remove(
              "active"
            );

          /* ===============================================
             SHOW DIALOGUE AFTER ROOM APPEARS
             =============================================== */

          setTimeout(

            function () {

              dialogueBox
                .classList
                .add(
                  "show"
                );

            },

            400

          );

          /*
            Transition fully finished.
          */

          setTimeout(

            function () {

              transitioning =
                false;

            },

            1400

          );

        },

        300

      );

    },

    1400

  );

}

/* =========================================================
   OWNER DIALOGUE
   ========================================================= */

function startDialogue() {

  typedCharacters =
    0;

  dialogueTyping =
    true;

  lastCharacterTime =
    performance.now();

  dialogueText.textContent =
    "";

}

/* =========================================================
   TYPEWRITER
   ========================================================= */

function updateDialogueTypewriter() {

  if (
    !dialogueTyping
  ) {

    return;

  }

  const currentDialogue =

    ownerDialogue[
      dialogueIndex
    ];

  const now =

    performance.now();

  if (

    now -
    lastCharacterTime

    >=

    TYPE_SPEED

  ) {

    typedCharacters++;

    dialogueText.textContent =

      currentDialogue.substring(

        0,

        typedCharacters

      );

    lastCharacterTime =
      now;

    if (

      typedCharacters >=
      currentDialogue.length

    ) {

      dialogueTyping =
        false;

    }

  }

}

/* =========================================================
   ADVANCE DIALOGUE
   ========================================================= */

function advanceDialogue() {

  if (

    !insideRestaurant

    ||

    transitioning

  ) {

    return;

  }

  const currentDialogue =

    ownerDialogue[
      dialogueIndex
    ];

  /* =======================================================
     TEXT STILL TYPING

     First click completes current sentence.
     ======================================================= */

  if (
    dialogueTyping
  ) {

    dialogueTyping =
      false;

    typedCharacters =
      currentDialogue.length;

    dialogueText.textContent =
      currentDialogue;

    return;

  }

  /* =======================================================
     NEXT DIALOGUE
     ======================================================= */

  if (

    dialogueIndex <

    ownerDialogue.length - 1

  ) {

    dialogueIndex++;

    startDialogue();

    return;

  }

  /* =======================================================
     END OF INTRO DIALOGUE

     Later this can open the menu.
     ======================================================= */

  dialogueText.textContent =

    "Take your time. The menu will be ready when you are.";

}

/* =========================================================
   RESPECT WRITING IN RECEIPT / ANY TEXT FIELD
   ========================================================= */
function dinerKeyboardTargetIsEditable(event) {
  const target = event && event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    'textarea, input, select, [contenteditable], [role="textbox"]'
  ));
}

/* =========================================================
   KEYBOARD
   ========================================================= */

function handleKeyboard(
  event
) {

  // When someone writes on their receipt, Space inserts a space and
  // Enter starts a new line. Do not use those keys to advance dialogue.
  if (dinerKeyboardTargetIsEditable(event)) return;

  /*
    Any keyboard interaction can unlock audio.
  */

  startAudio();

  if (
    !insideRestaurant
  ) {

    return;

  }

  if (

    event.code === "Space"

    ||

    event.code === "Enter"

    ||

    event.code === "ArrowRight"

  ) {

    event.preventDefault();

    advanceDialogue();

  }

}

/* =========================================================
   INTERIOR LIGHT FLICKER
   ========================================================= */

function scheduleNextFlicker() {

  /*
    Flicker roughly every
    2.8 – 6 seconds.
  */

  nextFlickerTime =

    millis() +

    random(
      2800,
      6000
    );

}

/* =========================================================
   UPDATE INTERIOR REFLECTION
   ========================================================= */

function updateInteriorFlicker() {

  if (
    !interiorReflect
  ) {

    return;

  }

  /* =======================================================
     NORMAL LIGHT
     ======================================================= */

  if (
    !flickerActive
  ) {

    /*
      Very slight warm breathing.
    */

    reflectionOpacity =

      0.64 +

      sin(

        frameCount *
        0.017

      ) *

      0.025;

    /* start random flicker */

    if (

      millis() >
      nextFlickerTime

    ) {

      flickerActive =
        true;

      flickerStarted =
        millis();

      flickerDuration =

        random(
          260,
          620
        );

    }

  }

  /* =======================================================
     FLICKERING
     ======================================================= */

  else {

    let targetOpacity =

      random(
        0.28,
        0.78
      );

    /* occasional near-off */

    if (

      random() <
      0.16

    ) {

      targetOpacity =

        random(
          0.08,
          0.20
        );

    }

    /* occasional bright flash */

    if (

      random() <
      0.07

    ) {

      targetOpacity =

        random(
          0.82,
          0.95
        );

    }

    reflectionOpacity =

      lerp(

        reflectionOpacity,

        targetOpacity,

        0.48

      );

    /* =====================================================
       END FLICKER
       ===================================================== */

    if (

      millis() -
      flickerStarted

      >

      flickerDuration

    ) {

      flickerActive =
        false;

      reflectionOpacity =
        0.64;

      scheduleNextFlicker();

    }

  }

  interiorReflect.style.opacity =
    reflectionOpacity;

}

/* =========================================================
   AUDIO FADE
   ========================================================= */

function fadeAudio(

  audio,

  targetVolume,

  duration

) {

  if (
    !audio
  ) {

    return;

  }

  const startVolume =

    audio.volume;

  const startTime =

    performance.now();

  function update(
    now
  ) {

    const progress =

      Math.min(

        (

          now -
          startTime

        ) /

        duration,

        1

      );

    audio.volume =

      constrain(

        lerp(

          startVolume,

          targetVolume,

          progress

        ),

        0,

        1

      );

    if (

      progress <
      1

    ) {

      requestAnimationFrame(
        update
      );

    }

  }

  requestAnimationFrame(
    update
  );

}

/* =========================================================
   RESIZE
   ========================================================= */

function windowResized() {

  /*
    Keep your original responsive system.
  */

  fitSceneToScreen();

}

/* =========================================================
   =========================================================
   NEW: MENU + DISH SELECTION + CONFIRMATION + COOKING

   Flow:
   final owner dialogue
   -> mini menu
   -> big menu
   -> choose dish
   -> return to normal interior
   -> short owner confirmation
   -> utensil sound
   -> BLACK SCREEN
   -> cooking scene
   -> interactive P5 smoke
   =========================================================
   ========================================================= */

/* =========================================================
   MENU / COOKING DOM
   ========================================================= */

let miniMenuButtonNew;
let menuOverlayNew;
let foodChoiceButtonsNew;

let cookingBackgroundNew;
let interiorBackgroundNew;
let ownerCharacterNew;

let cookingAudioNew;
let utensilAudioNew;

/* =========================================================
   MENU / COOKING STATE
   ========================================================= */

let selectedDish = null;

let menuSequenceStartedNew = false;

let bigMenuOpenNew = false;

let cookingModeNew = false;

/* =========================================================
   POST-SELECTION OWNER DIALOGUE
   ========================================================= */

let postSelectionDialogueNew = [];

let postSelectionDialogueActiveNew = false;

let postSelectionDialogueIndexNew = 0;

let postSelectionTypingNew = false;

let postSelectionTypedCharactersNew = 0;

let postSelectionLastCharacterTimeNew = 0;

const POST_SELECTION_TYPE_SPEED_NEW = 28;

let utensilSoundPlayedNew = false;

let cookingTransitionScheduledNew = false;

/* =========================================================
   COOKING SMOKE
   ========================================================= */

let cookingSmokeParticlesNew = [];

/*
  Wider and denser smoke.
*/

const COOKING_SMOKE_COUNT_NEW = 70;

/* =========================================================
   MOUSE POSITION FOR SMOKE
   ========================================================= */

let smokeMouseXNew = 0;

let smokeMouseYNew = 0;

let smokeMouseInsideSceneNew = false;

/* =========================================================
   SAVE ORIGINAL FUNCTIONS
   ========================================================= */

const originalSetupBeforeMenuNew =
  setup;

const originalDrawBeforeMenuNew =
  draw;

const originalAdvanceDialogueBeforeMenuNew =
  advanceDialogue;

const originalUpdateDialogueTypewriterBeforeMenuNew =
  updateDialogueTypewriter;

const originalHandleKeyboardBeforeMenuNew =
  handleKeyboard;

/* =========================================================
   EXTENDED SETUP
   ========================================================= */

setup = function () {

  originalSetupBeforeMenuNew();

  /* =======================================================
     NEW DOM
     ======================================================= */

  miniMenuButtonNew =
    document.getElementById(
      "mini-menu-button"
    );

  menuOverlayNew =
    document.getElementById(
      "menu-overlay"
    );

  foodChoiceButtonsNew =
    document.querySelectorAll(
      ".food-choice"
    );

  cookingBackgroundNew =
    document.getElementById(
      "cooking-background"
    );

  interiorBackgroundNew =
    document.getElementById(
      "interior-bg"
    );

  ownerCharacterNew =
    document.getElementById(
      "owner-character"
    );

  cookingAudioNew =
    document.getElementById(
      "cooking-audio"
    );

  utensilAudioNew =
    document.getElementById(
      "utensil-audio"
    );

  /* =======================================================
     AUDIO FALLBACK
     ======================================================= */

  if (!cookingAudioNew) {

    cookingAudioNew =
      new Audio(
        "assets/cooking.mp3"
      );

    cookingAudioNew.loop =
      true;

    cookingAudioNew.preload =
      "auto";

  }

  if (!utensilAudioNew) {

    utensilAudioNew =
      new Audio(
        "assets/utensil.mp3"
      );

    utensilAudioNew.preload =
      "auto";

  }

  /* =======================================================
     MINI MENU CLICK
     ======================================================= */

  if (
    miniMenuButtonNew
  ) {

    miniMenuButtonNew
      .addEventListener(

        "click",

        function (event) {

          event.stopPropagation();

          openBigMenuNew();

        }

      );

  }

  /* =======================================================
     FOOD BUTTONS
     ======================================================= */

  foodChoiceButtonsNew
    .forEach(

      function (button) {

        button.addEventListener(

          "click",

          function (event) {

            event.stopPropagation();

            const dish =
              button.dataset.dish;

            selectDishNew(
              dish
            );

          }

        );

      }

    );

  /* =======================================================
     MOUSE TRACKING FOR SMOKE
     ======================================================= */

  window.addEventListener(

    "mousemove",

    updateSmokeMousePositionNew

  );

  window.addEventListener(

    "mouseleave",

    function () {

      smokeMouseInsideSceneNew =
        false;

    }

  );

};

/* =========================================================
   EXTENDED DRAW
   ========================================================= */

draw = function () {

  originalDrawBeforeMenuNew();

  /* =======================================================
     CONFIRMATION DIALOGUE
     ======================================================= */

  if (
    postSelectionDialogueActiveNew
  ) {

    updatePostSelectionTypewriterNew();

  }

  /* =======================================================
     COOKING SMOKE
     ======================================================= */

  if (

    insideRestaurant

    &&

    cookingModeNew

  ) {

    updateCookingSmokeNew();

  }

};

/* =========================================================
   EXTEND ORIGINAL TYPEWRITER
   ========================================================= */

updateDialogueTypewriter =
  function () {

    const wasTyping =
      dialogueTyping;

    originalUpdateDialogueTypewriterBeforeMenuNew();

    if (

      insideRestaurant

      &&

      wasTyping

      &&

      !dialogueTyping

      &&

      dialogueIndex ===
      ownerDialogue.length - 1

      &&

      !menuSequenceStartedNew

    ) {

      scheduleMiniMenuRevealNew();

    }

  };

/* =========================================================
   EXTEND ORIGINAL DIALOGUE
   ========================================================= */

advanceDialogue =
  function () {

    if (
      postSelectionDialogueActiveNew
    ) {

      advancePostSelectionDialogueNew();

      return;

    }

    if (

      menuSequenceStartedNew

      ||

      bigMenuOpenNew

      ||

      cookingModeNew

    ) {

      return;

    }

    const wasLastDialogue =

      dialogueIndex ===
      ownerDialogue.length - 1;

    const wasTyping =
      dialogueTyping;

    if (

      wasLastDialogue

      &&

      !wasTyping

    ) {

      scheduleMiniMenuRevealNew();

      return;

    }

    originalAdvanceDialogueBeforeMenuNew();

    if (

      wasLastDialogue

      &&

      wasTyping

      &&

      !dialogueTyping

      &&

      !menuSequenceStartedNew

    ) {

      scheduleMiniMenuRevealNew();

    }

  };

/* =========================================================
   EXTEND KEYBOARD
   ========================================================= */

handleKeyboard =
  function (event) {

    // Preserve normal text entry in the receipt and other form fields.
    if (dinerKeyboardTargetIsEditable(event)) return;

    if (
      postSelectionDialogueActiveNew
    ) {

      if (

        event.code === "Space"

        ||

        event.code === "Enter"

        ||

        event.code === "ArrowRight"

      ) {

        event.preventDefault();

        advancePostSelectionDialogueNew();

        return;

      }

    }

    originalHandleKeyboardBeforeMenuNew(
      event
    );

  };

/* =========================================================
   MINI MENU REVEAL
   ========================================================= */

function scheduleMiniMenuRevealNew() {

  if (
    menuSequenceStartedNew
  ) {

    return;

  }

  menuSequenceStartedNew =
    true;

  setTimeout(

    function () {

      if (
        dialogueBox
      ) {

        dialogueBox
          .classList
          .add(
            "hide"
          );

      }

      setTimeout(

        function () {

          if (
            miniMenuButtonNew
          ) {

            miniMenuButtonNew
              .classList
              .add(
                "show"
              );

          }

        },

        420

      );

    },

    850

  );

}

/* =========================================================
   OPEN BIG MENU
   ========================================================= */

function openBigMenuNew() {

  if (

    bigMenuOpenNew

    ||

    cookingModeNew

  ) {

    return;

  }

  bigMenuOpenNew =
    true;
  dinerPlayExtraSound('menuOpen');

  if (
    miniMenuButtonNew
  ) {

    miniMenuButtonNew
      .classList
      .remove(
        "show"
      );

  }

  if (
    menuOverlayNew
  ) {

    menuOverlayNew
      .classList
      .add(
        "open"
      );

  }

}

/* =========================================================
   SELECT DISH
   ========================================================= */

function selectDishNew(
  dish
) {

  if (
    !bigMenuOpenNew
  ) {

    return;

  }

  selectedDish =
    dish;
  dinerPlayExtraSound('menuPick');

  window.selectedDish =
    selectedDish;

  console.log(
    "Selected dish:",
    selectedDish
  );

  bigMenuOpenNew =
    false;

  if (
    menuOverlayNew
  ) {

    menuOverlayNew
      .classList
      .remove(
        "open"
      );

  }

  /*
    Return to the normal interior first.
  */

  setTimeout(

    function () {

      startPostSelectionDialogueNew();

    },

    520

  );

}

/* =========================================================
   DISH DISPLAY NAME
   ========================================================= */

function getDishDisplayNameNew(
  dish
) {

  const names = {

    tamago:
      "Tamagoyaki",

    ramen:
      "Ramen",

    oden:
      "Oden",

    omurice:
      "Omurice",

    ochazuke:
      "Ochazuke"

  };

  return (
    names[dish]
    ||
    dish
  );

}

/* =========================================================
   POST-SELECTION DIALOGUE
   ========================================================= */

function startPostSelectionDialogueNew() {

  const dishName =

    getDishDisplayNameNew(
      selectedDish
    );

  postSelectionDialogueNew = [

    `${dishName}?`,

    "Alright.",

    "It’ll take a little while."

  ];

  postSelectionDialogueIndexNew =
    0;

  postSelectionDialogueActiveNew =
    true;

  utensilSoundPlayedNew =
    false;

  cookingTransitionScheduledNew =
    false;

  if (
    dialogueBox
  ) {

    dialogueBox
      .classList
      .remove(
        "hide"
      );

    dialogueBox
      .classList
      .add(
        "show"
      );

  }

  startPostSelectionLineNew();

}

/* =========================================================
   START CURRENT LINE
   ========================================================= */

function startPostSelectionLineNew() {

  postSelectionTypedCharactersNew =
    0;

  postSelectionTypingNew =
    true;

  postSelectionLastCharacterTimeNew =
    performance.now();

  if (
    dialogueText
  ) {

    dialogueText.textContent =
      "";

  }

}

/* =========================================================
   POST-SELECTION TYPEWRITER
   ========================================================= */

function updatePostSelectionTypewriterNew() {

  if (

    !postSelectionTypingNew

    ||

    !dialogueText

  ) {

    return;

  }

  const currentText =

    postSelectionDialogueNew[
      postSelectionDialogueIndexNew
    ];

  const now =
    performance.now();

  if (

    now -
    postSelectionLastCharacterTimeNew

    >=

    POST_SELECTION_TYPE_SPEED_NEW

  ) {

    postSelectionTypedCharactersNew++;

    dialogueText.textContent =

      currentText.substring(

        0,

        postSelectionTypedCharactersNew

      );

    postSelectionLastCharacterTimeNew =
      now;

    if (

      postSelectionTypedCharactersNew >=
      currentText.length

    ) {

      postSelectionTypingNew =
        false;

      onPostSelectionLineFinishedNew();

    }

  }

}

/* =========================================================
   WHEN CONFIRMATION LINE FINISHES
   ========================================================= */

function onPostSelectionLineFinishedNew() {

  /*
    After "Alright."
    play utensil sound.
  */

  if (

    postSelectionDialogueIndexNew === 1

    &&

    !utensilSoundPlayedNew

  ) {

    utensilSoundPlayedNew =
      true;

    setTimeout(

      function () {

        playUtensilSoundNew();

      },

      380

    );

  }

  /*
    After final line schedule cooking.
  */

  if (

    postSelectionDialogueIndexNew ===
    postSelectionDialogueNew.length - 1

  ) {

    scheduleCookingAfterDialogueNew();

  }

}

/* =========================================================
   ADVANCE CONFIRMATION DIALOGUE
   ========================================================= */

function advancePostSelectionDialogueNew() {

  if (
    !postSelectionDialogueActiveNew
  ) {

    return;

  }

  const currentText =

    postSelectionDialogueNew[
      postSelectionDialogueIndexNew
    ];

  if (
    postSelectionTypingNew
  ) {

    postSelectionTypingNew =
      false;

    postSelectionTypedCharactersNew =
      currentText.length;

    if (
      dialogueText
    ) {

      dialogueText.textContent =
        currentText;

    }

    onPostSelectionLineFinishedNew();

    return;

  }

  if (

    postSelectionDialogueIndexNew <
    postSelectionDialogueNew.length - 1

  ) {

    postSelectionDialogueIndexNew++;

    startPostSelectionLineNew();

    return;

  }

  startCookingAfterConfirmationNew();

}

/* =========================================================
   UTENSIL SOUND
   ========================================================= */

function playUtensilSoundNew() {

  if (
    !utensilAudioNew
  ) {

    return;

  }

  utensilAudioNew.currentTime =
    0;

  utensilAudioNew.volume =
    0.32;

  utensilAudioNew
    .play()
    .catch(
      function () {}
    );

}

/* =========================================================
   WAIT AFTER FINAL LINE
   ========================================================= */

function scheduleCookingAfterDialogueNew() {

  if (
    cookingTransitionScheduledNew
  ) {

    return;

  }

  cookingTransitionScheduledNew =
    true;

  setTimeout(

    function () {

      startCookingAfterConfirmationNew();

    },

    1200

  );

}

/* =========================================================
   FINAL DIALOGUE
   → BLACK SCREEN
   → COOKING
   ========================================================= */

function startCookingAfterConfirmationNew() {

  if (
    cookingModeNew
  ) {

    return;

  }

  postSelectionDialogueActiveNew =
    false;

  /* =======================================================
     FADE DIALOGUE OUT
     ======================================================= */

  if (
    dialogueBox
  ) {

    dialogueBox
      .classList
      .add(
        "hide"
      );

  }

  /* =======================================================
     FIRST: FADE TO BLACK
     ======================================================= */

  setTimeout(

    function () {

      if (
        transitionScreen
      ) {

        transitionScreen
          .classList
          .add(
            "active"
          );

      }

      /*
        CSS transition = 1.35 sec.
        Wait until the screen is completely black.
      */

      setTimeout(

        function () {

          /* =================================================
             CHANGE TO COOKING WHILE SCREEN IS BLACK
             ================================================= */

          startCookingSceneNew();

          /*
            Hold black briefly so no background
            underneath can flash into view.
          */

          setTimeout(

            function () {

              if (
                transitionScreen
              ) {

                transitionScreen
                  .classList
                  .remove(
                    "active"
                  );

              }

            },

            250

          );

        },

        1400

      );

    },

    450

  );

}

/* =========================================================
   START COOKING
   ========================================================= */

function startCookingSceneNew() {

  if (
    cookingModeNew
  ) {

    return;

  }

  cookingModeNew =
    true;


  /* =======================================================
     NORMAL BACKGROUND
     ======================================================= */

  if (
    interiorBackgroundNew
  ) {

    interiorBackgroundNew
      .classList
      .add(
        "cooking-hidden"
      );

  }

  /* =======================================================
     NORMAL OWNER
     ======================================================= */

  if (
    ownerCharacterNew
  ) {

    ownerCharacterNew
      .classList
      .add(
        "cooking-hidden"
      );

  }

  /* =======================================================
     COOKING IMAGE
     ======================================================= */

  if (
    cookingBackgroundNew
  ) {

    cookingBackgroundNew
      .classList
      .add(
        "active"
      );

  }

  /*
    Bulbs + reflect are left untouched.
    Flicker keeps running.
  */

  /* =======================================================
     MOVE P5 CANVAS INTO INTERIOR
     ======================================================= */

  const p5CanvasNew =

    document.querySelector(
      "#scene canvas"
    );

  if (

    p5CanvasNew

    &&

    interiorScene

  ) {

    interiorScene
      .appendChild(
        p5CanvasNew
      );

    p5CanvasNew.style.zIndex =
      "3";

  }

  /* =======================================================
     SMOKE
     ======================================================= */

  createCookingSmokeNew();
  dinerStartCookingSmokeLayer();
  dinerPlayExtraSound('steam');

  /* =======================================================
     COOKING SOUND
     ======================================================= */

  if (
    cookingAudioNew
  ) {

    cookingAudioNew.currentTime =
      0;

    cookingAudioNew.loop =
      true;

    cookingAudioNew.volume =
      0.18;

    cookingAudioNew
      .play()
      .catch(
        function () {}
      );

  }

}

/* =========================================================
   MOUSE POSITION
   ========================================================= */

function updateSmokeMousePositionNew(
  event
) {

  if (
    !scene
  ) {

    return;

  }

  const rect =

    scene
      .getBoundingClientRect();

  if (

    event.clientX >=
    rect.left

    &&

    event.clientX <=
    rect.right

    &&

    event.clientY >=
    rect.top

    &&

    event.clientY <=
    rect.bottom

  ) {

    smokeMouseInsideSceneNew =
      true;

    smokeMouseXNew =

      (
        event.clientX -
        rect.left
      )

      *

      (
        BASE_W /
        rect.width
      );

    smokeMouseYNew =

      (
        event.clientY -
        rect.top
      )

      *

      (
        BASE_H /
        rect.height
      );

  }

  else {

    smokeMouseInsideSceneNew =
      false;

  }

}

/* =========================================================
   CREATE COOKING SMOKE
   ========================================================= */

function createCookingSmokeNew() {

  cookingSmokeParticlesNew =
    [];

  for (

    let i = 0;

    i <
    COOKING_SMOKE_COUNT_NEW;

    i++

  ) {

    const particle =

      new CookingSmokeParticleNew();

    particle.life =

      random(
        0,
        1
      );

    cookingSmokeParticlesNew
      .push(
        particle
      );

  }

}

/* =========================================================
   DRAW SMOKE
   ========================================================= */

function updateCookingSmokeNew() {

  push();

  blendMode(
    SCREEN
  );

  for (

    const particle
    of cookingSmokeParticlesNew

  ) {

    particle.update();

    particle.display();

  }

  blendMode(
    BLEND
  );

  pop();

}

/* =========================================================
   INTERACTIVE SMOKE PARTICLE
   ========================================================= */

class CookingSmokeParticleNew {

  constructor() {

    this.noiseOffset =
      random(
        10000
      );

    this.phase =
      random(
        TWO_PI
      );

    this.reset();

  }

  /* =======================================================
     RESET
     ======================================================= */

  reset() {

    /* =====================================================
       EXTRA-WIDE KITCHEN SMOKE AREA
       ===================================================== */

    this.x =

      random(
        500,
        1420
      );

    this.y =

      random(
        500,
        670
      );

    this.velocityX =

      random(
        -0.38,
        0.40
      );

    this.velocityY =

      random(
        -0.78,
        -0.28
      );

    /* mouse scatter */

    this.scatterX =
      0;

    this.scatterY =
      0;

    this.size =

      random(
        26,
        68
      );

    this.life =
      0;

    this.lifeSpeed =

      random(
        0.0032,
        0.007
      );

    this.alpha =

      random(
        11,
        27
      );

  }

  /* =======================================================
     UPDATE
     ======================================================= */

  update() {

    /* =====================================================
       STRONGER / WIDER AIR FLOW
       ===================================================== */

    const airflow =

      map(

        noise(

          this.noiseOffset +

          frameCount *
          0.0032

        ),

        0,
        1,

        -0.60,
        0.60

      );

    /* =====================================================
       MOUSE DISPERSION
       ===================================================== */

    if (

      smokeMouseInsideSceneNew

      &&

      cookingModeNew

    ) {

      const dx =

        this.x -
        smokeMouseXNew;

      const dy =

        this.y -
        smokeMouseYNew;

      const distance =

        sqrt(

          dx * dx +

          dy * dy

        );

      /*
        Wider hover radius.
      */

      const interactionRadius =
        270;

      if (

        distance <
        interactionRadius

        &&

        distance >
        0.001

      ) {

        const force =

          map(

            distance,

            0,
            interactionRadius,

            2.8,
            0

          );

        this.scatterX +=

          (
            dx /
            distance
          )

          *

          force;

        this.scatterY +=

          (
            dy /
            distance
          )

          *

          force

          *

          0.65;

        /*
          Smoke dissolves slightly faster
          while cursor passes through.
        */

        this.life +=
          0.006;

      }

    }

    /* =====================================================
       MOVE
       ===================================================== */

    this.x +=

      this.velocityX +

      airflow +

      this.scatterX;

    this.y +=

      this.velocityY +

      this.scatterY;

    /* =====================================================
       SCATTER FRICTION
       ===================================================== */

    this.scatterX *=
      0.90;

    this.scatterY *=
      0.90;

    /* natural wave */

    this.x +=

      sin(

        frameCount *
        0.005 +

        this.phase

      )

      *

      0.10;

    /* expand */

    this.size +=
      0.13;

    /* age */

    this.life +=
      this.lifeSpeed;

    if (
      this.life >= 1
    ) {

      this.reset();

    }

  }

  /* =======================================================
     DISPLAY
     ======================================================= */

  display() {

    let fade;

    if (
      this.life <
      0.16
    ) {

      fade =

        map(

          this.life,

          0,
          0.16,

          0,
          1

        );

    }

    else {

      fade =

        map(

          this.life,

          0.16,
          1,

          1,
          0

        );

    }

    const currentAlpha =

      this.alpha *
      fade;

    noStroke();

    /* =====================================================
       LARGE HAZE
       ===================================================== */

    fill(

      238,
      230,
      216,

      currentAlpha *
      0.14

    );

    circle(

      this.x,

      this.y,

      this.size *
      3.4

    );

    /* =====================================================
       MIDDLE HAZE
       ===================================================== */

    fill(

      241,
      233,
      219,

      currentAlpha *
      0.25

    );

    circle(

      this.x,

      this.y,

      this.size *
      2

    );

    /* =====================================================
       MAIN SMOKE
       ===================================================== */

    fill(

      246,
      239,
      226,

      currentAlpha *
      0.46

    );

    circle(

      this.x,

      this.y,

      this.size

    );

  }

}

/* =========================================================
   =========================================================

   COOKING WAIT CONVERSATION
   +
   DISH QUESTION SYSTEM

   cooking
   ↓
   wait
   ↓
   "Mind if I ask..."
   ↓
   Sure
   ↓
   "Nothing serious."
   ↓
   "Just something to pass the time."
   ↓
   5 questions

   =========================================================
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

let cookingSureButtonNew;

let questionScreenNew;
let questionTextNew;
let questionChoicesContainerNew;
let questionProgressNew;
let questionResponseNew;


/* =========================================================
   COOKING CONVERSATION STATE
   ========================================================= */

let cookingConversationScheduledNew =
  false;

let cookingConversationActiveNew =
  false;


let waitingDialogueTypingNew =
  false;

let waitingDialogueTextNew =
  "";

let waitingDialogueTypedCharactersNew =
  0;

let waitingDialogueLastCharacterTimeNew =
  0;

let waitingDialogueFinishedCallbackNew =
  null;


const WAITING_DIALOGUE_TYPE_SPEED_NEW =
  28;


/*
  Time cooking stays alone on screen
  before owner speaks.
*/

const COOKING_WAIT_BEFORE_PROMPT_NEW =
  5200;


/* =========================================================
   QUESTION STATE
   ========================================================= */

let questionScreenActiveNew =
  false;

let currentQuestionIndexNew =
  0;

let currentQuestionDataNew =
  null;

let currentQuestionChoicesNew =
  [];

let questionAnswersNew =
  [];

let questionChangingNew =
  false;



/* =========================================================
   QUESTION BANK
   ========================================================= */

const QUESTION_BANK_NEW = {


  /* =======================================================
     TAMAGOYAKI
     NOSTALGIA
     ======================================================= */

  tamago: [

    {

      prompt: [

        "When things get quiet…",

        "What from the past tends to come back first?"

      ],

      choices: [

        "A person",

        "A place",

        "An ordinary moment",

        "A version of myself",

        "Nothing specific"

      ],

      response: [

        "Mm."

      ]

    },


    {

      prompt: [

        "Suppose you could go back somewhere for ten minutes.",

        "Where would you go?"

      ],

      choices: [

        "My childhood home",

        "School or university",

        "An old neighbourhood",

        "Somewhere connected to someone",

        "One completely ordinary day"

      ],

      response: [

        "Funny.",

        "Sometimes it’s the ordinary days we remember."

      ]

    },


    {

      prompt: [

        "When you think about that time…",

        "What do you actually miss?"

      ],

      choices: [

        "The people",

        "The place",

        "The routine",

        "Who I was back then",

        "I can’t separate them"

      ],

      response: [

        "I see."

      ]

    },


    {

      prompt: [

        "If you went back now…",

        "Do you think it would still feel the same?"

      ],

      choices: [

        "Yes",

        "Probably not",

        "I’m not sure",

        "I think I miss the feeling more than the place"

      ],

      response: [

        "Places change.",

        "People do too."

      ]

    },


    {

      prompt: [

        "Then maybe this is the harder question.",

        "What would you want from the past now?"

      ],

      choices: [

        "To have it back",

        "To experience it once more",

        "To understand why I miss it",

        "To remember it without returning",

        "I don’t know"

      ],

      response: [

        "Mm.",

        "That makes sense."

      ]

    }

  ],



  /* =======================================================
     OMURICE
     REGRET / UNFINISHED POSSIBILITIES
     ======================================================= */

  omurice: [

    {

      prompt: [

        "When your mind goes backward…",

        "What tends to return?"

      ],

      choices: [

        "Something I did",

        "Something I didn’t do",

        "Something I said",

        "Something I never said",

        "A decision I still question"

      ],

      response: [

        "Ah.",

        "Those have a way of coming back."

      ]

    },


    {

      prompt: [

        "If the past could give you one thing tonight…",

        "What would you ask for?"

      ],

      choices: [

        "Another chance",

        "An explanation",

        "An apology",

        "Forgiveness",

        "An answer"

      ],

      response: [

        "Just one thing.",

        "That’s usually enough."

      ]

    },


    {

      prompt: [

        "And if you could change only one part of what happened?"

      ],

      choices: [

        "What I did",

        "What I said",

        "The timing",

        "Who I was then",

        "The outcome"

      ],

      response: [

        "Mm."

      ]

    },


    {

      prompt: [

        "Which part is harder to live with?"

      ],

      choices: [

        "I may have chosen wrongly",

        "I’ll never know what could have happened",

        "Someone else has already moved on",

        "Nothing can change it now",

        "I didn’t know then what I know now"

      ],

      response: [

        "Knowing more now can make the past look simple.",

        "It usually wasn’t."

      ]

    },


    {

      prompt: [

        "Do you think every unfinished story needs an ending?"

      ],

      choices: [

        "Yes",

        "No",

        "Sometimes",

        "Maybe we have to make our own ending",

        "I don’t know yet"

      ],

      response: [

        "Maybe some endings happen long after the story does."

      ]

    }

  ],



  /* =======================================================
     ODEN
     ABSENCE
     ======================================================= */

  oden: [

    {

      prompt: [

        "When something leaves your life…",

        "What tends to stay the longest?"

      ],

      choices: [

        "Their belongings",

        "Their routines",

        "Certain places",

        "Things they said",

        "The empty space itself"

      ],

      response: [

        "Mm."

      ]

    },


    {

      prompt: [

        "There are different ways for something to be gone.",

        "Which feels closest to you?"

      ],

      choices: [

        "Someone physically gone",

        "Someone still here but no longer in my life",

        "A place I can’t return to",

        "A relationship that changed",

        "A version of myself that disappeared"

      ],

      response: [

        "I see.",

        "Not everything disappears all at once."

      ]

    },


    {

      prompt: [

        "When something reminds you of it…",

        "What do you usually do?"

      ],

      choices: [

        "Stay with the memory",

        "Try not to think about it",

        "Tell someone",

        "Keep it to myself",

        "It depends"

      ],

      response: [

        "Memories have their own timing."

      ]

    },


    {

      prompt: [

        "Do you think something can leave…",

        "without completely disappearing?"

      ],

      choices: [

        "Yes",

        "No",

        "Sometimes",

        "I’m still figuring that out"

      ],

      response: [

        "Mm."

      ]

    },


    {

      prompt: [

        "Then what do you think remains?"

      ],

      choices: [

        "Memories",

        "Habits",

        "Feelings",

        "Part of who I became",

        "The space it left behind"

      ],

      response: [

        "Maybe that’s enough."

      ]

    }

  ],



  /* =======================================================
     OCHAZUKE
     EXHAUSTION
     ======================================================= */

  ochazuke: [

    {

      prompt: [

        "What do you usually do when there’s finally nothing you have to do?"

      ],

      choices: [

        "Find something else to do",

        "Scroll until time disappears",

        "Think about what I should be doing",

        "Sleep",

        "Feel strangely uncomfortable"

      ],

      response: [

        "So even an empty evening gets filled."

      ]

    },


    {

      prompt: [

        "When was the last time you rested…",

        "without feeling guilty about it?"

      ],

      choices: [

        "Today",

        "This week",

        "A while ago",

        "I can’t remember",

        "I’m not sure I know how"

      ],

      response: [

        "Mm."

      ]

    },


    {

      prompt: [

        "What makes stopping difficult?"

      ],

      choices: [

        "Falling behind",

        "Disappointing people",

        "Feeling unproductive",

        "Losing control",

        "I don’t really know"

      ],

      response: [

        "Funny thing about stopping.",

        "Sometimes it takes more effort than continuing."

      ]

    },


    {

      prompt: [

        "What feels harder tonight?"

      ],

      choices: [

        "Continuing",

        "Stopping",

        "Asking for help",

        "Admitting I’m tired",

        "Knowing what I actually want"

      ],

      response: [

        "I see."

      ]

    },


    {

      prompt: [

        "Suppose tomorrow expected absolutely nothing from you.",

        "What would you do?"

      ],

      choices: [

        "Sleep",

        "Go somewhere",

        "See someone",

        "Do absolutely nothing",

        "I honestly don’t know"

      ],

      response: [

        "Maybe you don’t need an answer tonight."

      ]

    }

  ],



  /* =======================================================
     RAMEN
     LONELINESS
     ======================================================= */

  ramen: [

    {

      prompt: [

        "When do you feel most alone?"

      ],

      choices: [

        "When nobody is around",

        "When I’m surrounded by people",

        "When something happens and I don’t know who to tell",

        "Late at night",

        "When everyone else seems to be moving forward"

      ],

      response: [

        "Mm."

      ]

    },


    {

      prompt: [

        "What do you miss most when you feel disconnected?"

      ],

      choices: [

        "Someone listening",

        "Someone understanding",

        "Someone being there",

        "Feeling needed",

        "Feeling like I belong somewhere"

      ],

      response: [

        "Those aren’t always the same thing, are they?"

      ]

    },


    {

      prompt: [

        "When something important happens…",

        "Who do you want to tell first?"

      ],

      choices: [

        "One specific person",

        "Whoever is available",

        "Someone who would really understand",

        "Nobody",

        "I don’t know anymore"

      ],

      response: [

        "Sometimes knowing who to tell is its own kind of comfort."

      ]

    },


    {

      prompt: [

        "If someone sat beside you right now…",

        "What would you want from them?"

      ],

      choices: [

        "Conversation",

        "Advice",

        "A distraction",

        "Silence",

        "Just for them to stay"

      ],

      response: [

        "Mm.",

        "Company doesn’t always need words."

      ]

    },


    {

      prompt: [

        "Which feels harder?"

      ],

      choices: [

        "Being physically alone",

        "Feeling unseen around other people",

        "Feeling like nobody really knows me",

        "They’re different kinds of loneliness",

        "I’m not sure"

      ],

      response: [

        "I suppose there are many ways to be alone."

      ]

    }

  ]

};



/* =========================================================
   GET NEW DOM AFTER ALL OLD SETUP
   ========================================================= */

const setupBeforeCookingConversationNew =
  setup;


setup = function () {


  setupBeforeCookingConversationNew();


  cookingSureButtonNew =

    document.getElementById(
      "cooking-sure-button"
    );


  questionScreenNew =

    document.getElementById(
      "question-screen"
    );


  questionTextNew =

    document.getElementById(
      "question-text"
    );


  questionChoicesContainerNew =

    document.getElementById(
      "question-choices"
    );


  questionProgressNew =

    document.getElementById(
      "question-progress"
    );


  questionResponseNew =

    document.getElementById(
      "question-response"
    );


  /* =======================================================
     SURE BUTTON EVENT
     ======================================================= */

  if (
    cookingSureButtonNew
  ) {


    cookingSureButtonNew
      .addEventListener(

        "click",

        function (event) {


          event.stopPropagation();


          confirmCookingConversationNew();


        }

      );


  }


};



/* =========================================================
   EXTEND DRAW
   ========================================================= */

const drawBeforeCookingConversationNew =
  draw;


draw = function () {


  /*
    Run every existing animation first.
  */

  drawBeforeCookingConversationNew();


  /* cooking conversation typewriter */

  if (
    waitingDialogueTypingNew
  ) {


    updateWaitingDialogueTypewriterNew();


  }


  /* floating question choices */

  if (
    questionScreenActiveNew
  ) {


    animateQuestionChoicesNew();


  }


};



/* =========================================================
   HOOK INTO CURRENT COOKING FUNCTION
   ========================================================= */

const startCookingSceneBeforeConversationNew =
  startCookingSceneNew;


startCookingSceneNew =
  function () {


    /*
      Save whether cooking was already active.
    */

    const wasAlreadyCooking =
      cookingModeNew;


    /*
      Run your original cooking scene first.
    */

    startCookingSceneBeforeConversationNew();


    /*
      Only schedule once.
    */

    if (

      !wasAlreadyCooking

      &&

      cookingModeNew

    ) {


      scheduleCookingConversationNew();


    }


  };



/* =========================================================
   WAIT BEFORE OWNER SPEAKS
   ========================================================= */

function scheduleCookingConversationNew() {


  if (
    cookingConversationScheduledNew
  ) {


    return;


  }


  cookingConversationScheduledNew =
    true;


  setTimeout(

    function () {


      showCookingQuestionPromptNew();


    },

    COOKING_WAIT_BEFORE_PROMPT_NEW

  );


}



/* =========================================================
   OWNER:
   "Mind if I ask..."
   ========================================================= */

function showCookingQuestionPromptNew() {


  if (

    !cookingModeNew

    ||

    cookingConversationActiveNew

    ||

    questionScreenActiveNew

  ) {


    return;


  }


  cookingConversationActiveNew =
    true;


  /* =======================================================
     SHOW DIALOGUE ABOVE COOKING
     ======================================================= */

  if (
    dialogueBox
  ) {


    dialogueBox
      .classList
      .remove(
        "hide"
      );


    dialogueBox
      .classList
      .add(
        "show"
      );


    dialogueBox
      .classList
      .add(
        "cooking-prompt-mode"
      );


  }


  /* =======================================================
     HIDE SURE UNTIL LINE FINISHED
     ======================================================= */

  if (
    cookingSureButtonNew
  ) {


    cookingSureButtonNew
      .classList
      .remove(
        "show"
      );


    cookingSureButtonNew.disabled =
      true;


  }


  /* =======================================================
     TYPE FIRST QUESTION
     ======================================================= */

  startWaitingDialogueLineNew(

    "Mind if I ask you something while you wait?",

    function () {


      if (
        cookingSureButtonNew
      ) {


        cookingSureButtonNew.disabled =
          false;


        cookingSureButtonNew
          .classList
          .add(
            "show"
          );


      }


    }

  );


}



/* =========================================================
   USER CLICK SURE
   ========================================================= */

function confirmCookingConversationNew() {


  if (

    !cookingConversationActiveNew

    ||

    waitingDialogueTypingNew

  ) {


    return;


  }


  if (
    cookingSureButtonNew
  ) {


    cookingSureButtonNew.disabled =
      true;


    cookingSureButtonNew
      .classList
      .remove(
        "show"
      );


  }


  /* =======================================================
     "Nothing serious."
     ======================================================= */

  startWaitingDialogueLineNew(

    "Nothing serious.",

    function () {


      setTimeout(

        function () {


          /* =================================================
             "Just something..."
             ================================================= */

          startWaitingDialogueLineNew(

            "Just something to pass the time.",

            function () {


              setTimeout(

                function () {


                  finishCookingConversationAndStartQuestionsNew();


                },

                950

              );


            }

          );


        },

        700

      );


    }

  );


}



/* =========================================================
   START TYPEWRITER LINE
   ========================================================= */

function startWaitingDialogueLineNew(
  text,
  onFinished
) {


  waitingDialogueTextNew =
    text;


  waitingDialogueTypedCharactersNew =
    0;


  waitingDialogueTypingNew =
    true;


  waitingDialogueLastCharacterTimeNew =
    performance.now();


  waitingDialogueFinishedCallbackNew =

    typeof onFinished === "function"

      ? onFinished

      : null;


  if (
    dialogueText
  ) {


    dialogueText.textContent =
      "";


  }


}



/* =========================================================
   UPDATE COOKING DIALOGUE TYPEWRITER
   ========================================================= */

function updateWaitingDialogueTypewriterNew() {


  if (

    !waitingDialogueTypingNew

    ||

    !dialogueText

  ) {


    return;


  }


  const now =
    performance.now();


  if (

    now -
    waitingDialogueLastCharacterTimeNew

    <

    WAITING_DIALOGUE_TYPE_SPEED_NEW

  ) {


    return;


  }


  waitingDialogueTypedCharactersNew++;


  dialogueText.textContent =

    waitingDialogueTextNew.substring(

      0,

      waitingDialogueTypedCharactersNew

    );


  waitingDialogueLastCharacterTimeNew =
    now;


  if (

    waitingDialogueTypedCharactersNew >=
    waitingDialogueTextNew.length

  ) {


    waitingDialogueTypingNew =
      false;


    const callback =
      waitingDialogueFinishedCallbackNew;


    waitingDialogueFinishedCallbackNew =
      null;


    if (
      callback
    ) {


      callback();


    }


  }


}



/* =========================================================
   COOKING DIALOGUE
   →
   QUESTION SCREEN
   ========================================================= */

function finishCookingConversationAndStartQuestionsNew() {


  cookingConversationActiveNew =
    false;


  if (
    cookingSureButtonNew
  ) {


    cookingSureButtonNew
      .classList
      .remove(
        "show"
      );


  }


  /*
    Fade dialogue away.
  */

  if (
    dialogueBox
  ) {


    dialogueBox
      .classList
      .add(
        "hide"
      );


  }


  setTimeout(

    function () {


      if (
        dialogueBox
      ) {


        dialogueBox
          .classList
          .remove(
            "cooking-prompt-mode"
          );


      }


      startQuestionSequenceNew();


    },

    650

  );


}



/* =========================================================
   START QUESTIONS
   ========================================================= */

function startQuestionSequenceNew() {


  if (

    !selectedDish

    ||

    !QUESTION_BANK_NEW[
      selectedDish
    ]

  ) {


    console.warn(

      "Question system: invalid selectedDish:",

      selectedDish

    );


    return;


  }


  if (

    !questionScreenNew

    ||

    !questionTextNew

    ||

    !questionChoicesContainerNew

    ||

    !questionProgressNew

    ||

    !questionResponseNew

  ) {


    console.warn(

      "Question HTML is missing."

    );


    return;


  }


  questionAnswersNew =
    [];


  currentQuestionIndexNew =
    0;


  questionChangingNew =
    false;


  questionScreenActiveNew =
    true;

  // When the question screen appears, lower the indoor background smoothly.
  dinerSetQuestionAmbienceQuiet(true);

  /*
    Hide cooking dialogue completely.
  */

  if (
    dialogueBox
  ) {


    dialogueBox
      .classList
      .remove(
        "show"
      );


  }


  questionScreenNew
    .setAttribute(
      "aria-hidden",
      "false"
    );


  questionScreenNew
    .classList
    .add(
      "show"
    );


  showCurrentQuestionNew();


}



/* =========================================================
   SHOW QUESTION
   ========================================================= */

function showCurrentQuestionNew() {


  questionChangingNew =
    false;


  const questions =

    QUESTION_BANK_NEW[
      selectedDish
    ];


  currentQuestionDataNew =

    questions[
      currentQuestionIndexNew
    ];


  if (
    !currentQuestionDataNew
  ) {


    finishQuestionSequenceNew();


    return;


  }


  /* =======================================================
     PROGRESS
     ======================================================= */

  questionProgressNew.textContent =

    String(
      currentQuestionIndexNew + 1
    )
      .padStart(
        2,
        "0"
      )

    +

    " / "

    +

    String(
      questions.length
    )
      .padStart(
        2,
        "0"
      );


  /* =======================================================
     QUESTION
     ======================================================= */

  questionTextNew.innerHTML =

    currentQuestionDataNew
      .prompt
      .join(
        "<br>"
      );


  /* =======================================================
     CLEAR RESPONSE
     ======================================================= */

  questionResponseNew
    .classList
    .remove(
      "show"
    );


  questionResponseNew.textContent =
    "";


  createQuestionChoicesNew();


}



/* =========================================================
   ANSWER STARTING POSITIONS
   ========================================================= */

const QUESTION_ANCHORS_NEW = [

  {
    x: 8,
    y: 44
  },

  {
    x: 39,
    y: 37
  },

  {
    x: 72,
    y: 45
  },

  {
    x: 18,
    y: 70
  },

  {
    x: 60,
    y: 70
  }

];



/* =========================================================
   SHUFFLE ANCHORS
   ========================================================= */

function shuffleQuestionAnchorsNew() {


  const anchors =

    QUESTION_ANCHORS_NEW
      .map(

        function (position) {


          return {

            x:
              position.x,

            y:
              position.y

          };


        }

      );


  for (

    let i =
      anchors.length - 1;

    i > 0;

    i--

  ) {


    const j =

      Math.floor(

        Math.random()

        *

        (
          i + 1
        )

      );


    const temporary =
      anchors[i];


    anchors[i] =
      anchors[j];


    anchors[j] =
      temporary;


  }


  return anchors;


}



/* =========================================================
   CREATE ANSWERS
   ========================================================= */

function createQuestionChoicesNew() {


  questionChoicesContainerNew.innerHTML =
    "";


  currentQuestionChoicesNew =
    [];


  const anchors =
    shuffleQuestionAnchorsNew();


  currentQuestionDataNew
    .choices
    .forEach(

      function (
        choiceText,
        index
      ) {


        const button =

          document.createElement(
            "button"
          );


        button.type =
          "button";


        button.className =
          "question-choice";


        button.textContent =
          choiceText;


        const anchor =

          anchors[
            index %
            anchors.length
          ];


        button.style.left =
          `${anchor.x}%`;


        button.style.top =
          `${anchor.y}%`;


        /* =================================================
           LIQUID HOVER
           ================================================= */

        button.addEventListener(

          "mouseenter",

          function () {


            if (
              !button.disabled
            ) {


              button
                .classList
                .add(
                  "liquid-hover"
                );


            }


          }

        );


        button.addEventListener(

          "mouseleave",

          function () {


            button
              .classList
              .remove(
                "liquid-hover"
              );


          }

        );


        /* =================================================
           ANSWER
           ================================================= */

        button.addEventListener(

          "click",

          function (event) {


            event.stopPropagation();


            selectQuestionAnswerNew(

              choiceText,

              button

            );


          }

        );


        questionChoicesContainerNew
          .appendChild(
            button
          );


        currentQuestionChoicesNew.push({

          element:
            button,

          noiseX:
            random(
              1000
            ),

          noiseY:
            random(
              1000
            ),

          phase:
            random(
              TWO_PI
            ),

          speed:
            random(
              0.0017,
              0.0035
            ),

          amplitudeX:
            random(
              14,
              29
            ),

          amplitudeY:
            random(
              10,
              21
            )

        });


      }

    );


}



/* =========================================================
   FLOAT ANSWERS
   ========================================================= */

function animateQuestionChoicesNew() {


  for (

    const choice
    of currentQuestionChoicesNew

  ) {


    const button =
      choice.element;


    if (

      !button

      ||

      button.disabled

    ) {


      continue;


    }


    const hovering =

      button
        .classList
        .contains(
          "liquid-hover"
        );


    /*
      More movement when hovered.
    */

    const hoverMultiplier =

      hovering

        ? 1.95

        : 1;


    const noiseMoveX =

      map(

        noise(

          choice.noiseX +

          frameCount *
          choice.speed

        ),

        0,

        1,

        -choice.amplitudeX,

        choice.amplitudeX

      )

      *

      hoverMultiplier;


    const noiseMoveY =

      map(

        noise(

          choice.noiseY +

          frameCount *
          choice.speed

        ),

        0,

        1,

        -choice.amplitudeY,

        choice.amplitudeY

      )

      *

      hoverMultiplier;


    const waveX =

      sin(

        frameCount *
        0.011

        +

        choice.phase

      )

      *

      8

      *

      hoverMultiplier;


    const waveY =

      cos(

        frameCount *
        0.008

        +

        choice.phase

      )

      *

      6

      *

      hoverMultiplier;


    const rotation =

      sin(

        frameCount *
        0.006

        +

        choice.phase

      )

      *

      (

        hovering

          ? 2.6

          : 1

      );


    const scaleValue =

      hovering

        ? 1.075

        : 1;


    button.style.transform =

      `translate(
        ${noiseMoveX + waveX}px,
        ${noiseMoveY + waveY}px
      )
      rotate(${rotation}deg)
      scale(${scaleValue})`;


  }


}



/* =========================================================
   SELECT ANSWER
   ========================================================= */

function selectQuestionAnswerNew(
  answer,
  selectedButton
) {


  if (
    questionChangingNew
  ) {


    return;


  }


  questionChangingNew =
    true;


  /* =======================================================
     SAVE
     ======================================================= */

  questionAnswersNew.push({

    dish:
      selectedDish,

    question:

      currentQuestionDataNew
        .prompt
        .join(
          " "
        ),

    answer:
      answer

  });


  /*
    Available for receipt later.
  */

  window.dinerAnswers =
    questionAnswersNew;


  /* =======================================================
     BUTTON SELECTED
     ======================================================= */

  if (
    selectedButton
  ) {


    selectedButton
      .classList
      .add(
        "selected"
      );


  }


  /* =======================================================
     DISABLE ALL ANSWERS
     ======================================================= */

  for (

    const choice
    of currentQuestionChoicesNew

  ) {


    const button =
      choice.element;


    button.disabled =
      true;


    button
      .classList
      .remove(
        "liquid-hover"
      );


    if (
      button !== selectedButton
    ) {


      button.style.opacity =
        "0.18";


    }


  }


  /* =======================================================
     OWNER RESPONSE
     ======================================================= */

  questionResponseNew.innerHTML =

    currentQuestionDataNew
      .response
      .join(
        "<br>"
      );


  questionResponseNew
    .classList
    .add(
      "show"
    );


  /* =======================================================
     NEXT
     ======================================================= */

  setTimeout(

    function () {


      currentQuestionIndexNew++;


      const questions =

        QUESTION_BANK_NEW[
          selectedDish
        ];


      if (

        currentQuestionIndexNew <
        questions.length

      ) {


        showCurrentQuestionNew();


      }

      else {


        finishQuestionSequenceNew();


      }


    },

    1700

  );


}



/* =========================================================
   FINISH 5 QUESTIONS
   ========================================================= */

function finishQuestionSequenceNew() {


  questionScreenActiveNew =
    false;

  // Questions are over: gently return restaurant ambience to normal level.
  dinerSetQuestionAmbienceQuiet(false);

  if (
    questionScreenNew
  ) {


    questionScreenNew
      .classList
      .remove(
        "show"
      );


    questionScreenNew
      .setAttribute(
        "aria-hidden",
        "true"
      );


  }


  console.log(

    "Diner answers:",

    questionAnswersNew

  );


  /*
    The user's complete answers are now stored at:

    window.dinerAnswers

    Next stage can use these for:
    - dish reveal
    - emotional meaning
    - receipt
    - generative visuals
  */


}

/* =========================================================
   =========================================================

   QUESTION INTERACTION V3

   - centred + balanced anchors
   - single warm colour
   - freer organic floating
   - safe screen boundary
   - cursor attraction
   - neighbour repulsion
   - smooth transition

   =========================================================
   ========================================================= */


const QUESTION_FLOAT_ENTER_DURATION_V3 =
  1050;


const QUESTION_FLOAT_EXIT_DURATION_V3 =
  720;


const QUESTION_NEIGHBOUR_RADIUS_V3 =
  500;


/*
  Softer than old version so nearby bubbles
  don't get thrown out of the screen.
*/

const QUESTION_NEIGHBOUR_FORCE_V3 =
  58;


let hoveredQuestionChoiceV3 =
  null;

// A new question is queued only while the previous bubbles are fading.
let questionExitPendingV3 = false;



/* =========================================================
   HELPERS
   ========================================================= */

function questionClampV3(
  value,
  minimum,
  maximum
) {

  return Math.max(

    minimum,

    Math.min(
      maximum,
      value
    )

  );

}



function questionEaseV3(
  value
) {

  const t =

    questionClampV3(
      value,
      0,
      1
    );


  return (

    t *
    t *
    (
      3 -
      2 * t
    )

  );

}



/* =========================================================
   BALANCED ANCHORS

   Different layouts depending on
   how many answers that question has.
   ========================================================= */

function getQuestionAnchorsV3(
  count
) {


  /* 4 answers */

  if (
    count === 4
  ) {

    return [

      {
        x: 32,
        y: 47
      },

      {
        x: 68,
        y: 47
      },

      {
        x: 32,
        y: 71
      },

      {
        x: 68,
        y: 71
      }

    ];

  }


  /* 3 answers */

  if (
    count === 3
  ) {

    return [

      {
        x: 28,
        y: 56
      },

      {
        x: 50,
        y: 45
      },

      {
        x: 72,
        y: 56
      }

    ];

  }


  /* 2 answers */

  if (
    count === 2
  ) {

    return [

      {
        x: 35,
        y: 58
      },

      {
        x: 65,
        y: 58
      }

    ];

  }


  /*
    DEFAULT:
    5 answers

    Pulled toward centre compared
    with previous version.
  */

  return [

    {
      x: 22,
      y: 47
    },

    {
      x: 50,
      y: 42
    },

    {
      x: 78,
      y: 47
    },

    {
      x: 35,
      y: 71
    },

    {
      x: 65,
      y: 71
    }

  ];

}



/* =========================================================
   SHUFFLE POSITIONS
   ========================================================= */

function shuffleQuestionAnchorsV3(
  count
) {


  const anchors =

    getQuestionAnchorsV3(
      count
    )
      .map(

        function (
          position
        ) {

          return {

            x:
              position.x,

            y:
              position.y

          };

        }

      );


  for (

    let i =
      anchors.length - 1;

    i > 0;

    i--

  ) {


    const j =

      Math.floor(

        Math.random()

        *

        (
          i + 1
        )

      );


    const temporary =
      anchors[i];


    anchors[i] =
      anchors[j];


    anchors[j] =
      temporary;


  }


  return anchors;

}



/* =========================================================
   QUESTION ENTER
   ========================================================= */

function setQuestionHeaderEnteringV3() {


  if (
    !questionScreenNew
  ) {

    return;

  }


  questionScreenNew
    .classList
    .remove(
      "question-switching"
    );


  questionScreenNew
    .classList
    .remove(
      "question-entering"
    );


  /*
    restart CSS animation
  */

  void questionScreenNew.offsetWidth;


  questionScreenNew
    .classList
    .add(
      "question-entering"
    );


  setTimeout(

    function () {


      if (
        questionScreenNew
      ) {

        questionScreenNew
          .classList
          .remove(
            "question-entering"
          );

      }


    },

    QUESTION_FLOAT_ENTER_DURATION_V3 +
    80

  );

}



/* =========================================================
   QUESTION EXIT
   ========================================================= */

function setQuestionHeaderExitingV3() {


  if (
    !questionScreenNew
  ) {

    return;

  }


  questionScreenNew
    .classList
    .remove(
      "question-entering"
    );


  questionScreenNew
    .classList
    .add(
      "question-switching"
    );

}



/* =========================================================
   OVERRIDE SHOW QUESTION
   ========================================================= */

showCurrentQuestionNew =
  function () {


    const questions =

      QUESTION_BANK_NEW[
        selectedDish
      ];


    currentQuestionDataNew =

      questions[
        currentQuestionIndexNew
      ];


    if (
      !currentQuestionDataNew
    ) {

      finishQuestionSequenceNew();

      return;

    }


    questionChangingNew =
      true;


    /* progress */

    questionProgressNew.textContent =

      String(
        currentQuestionIndexNew + 1
      )
        .padStart(
          2,
          "0"
        )

      +

      " / "

      +

      String(
        questions.length
      )
        .padStart(
          2,
          "0"
        );


    /* text */

    questionTextNew.innerHTML =

      currentQuestionDataNew
        .prompt
        .join(
          "<br>"
        );


    /* clear old response */

    questionResponseNew
      .classList
      .remove(
        "show"
      );


    questionResponseNew.textContent =
      "";


    setQuestionHeaderEnteringV3();


    createQuestionChoicesNew();


    /*
      interaction unlocked after
      bubbles finish entering
    */

    setTimeout(

      function () {


        if (
          !questionScreenActiveNew
        ) {

          return;

        }


        questionChangingNew =
          false;


        for (

          const choice
          of currentQuestionChoicesNew

        ) {


          choice.element.disabled =
            false;


        }


      },

      QUESTION_FLOAT_ENTER_DURATION_V3

    );


  };



/* =========================================================
   CREATE ANSWER BUBBLES
   ========================================================= */

createQuestionChoicesNew =
  function () {


    questionChoicesContainerNew.innerHTML =
      "";


    currentQuestionChoicesNew =
      [];


    hoveredQuestionChoiceV3 =
      null;


    const anchors =

      shuffleQuestionAnchorsV3(

        currentQuestionDataNew
          .choices
          .length

      );


    const now =
      performance.now();


    currentQuestionDataNew
      .choices
      .forEach(

        function (
          choiceText,
          index
        ) {


          const button =

            document.createElement(
              "button"
            );


          button.type =
            "button";


          /*
            ONE COLOUR ONLY.
            No question-tone classes.
          */

          button.className =
            "question-choice";


          button.textContent =
            choiceText;


          button.disabled =
            true;


          const anchor =

            anchors[
              index %
              anchors.length
            ];


          button.style.left =
            `${anchor.x}%`;


          button.style.top =
            `${anchor.y}%`;


          // Fly in from outside the frame, converging on the existing anchor.
          // Stagger is handled by the same existing enter animation clock.
          const enterFromLeft =
            anchor.x < 50 || (anchor.x === 50 && index % 2 === 0);

          const enterFromX = enterFromLeft
            ? -(anchor.x / 100 * BASE_W + 480)
            : BASE_W - (anchor.x / 100 * BASE_W) + 480;

          const enterFromY = random(-90, 90);
          button.style.opacity = "0";

          const choice = {


            element:
              button,


            /* anchor centre */

            anchorX:

              (
                anchor.x /
                100
              )

              *

              BASE_W,


            anchorY:

              (
                anchor.y /
                100
              )

              *

              BASE_H,


            /* physics */

            offsetX:

              random(
                -20,
                20
              ),


            offsetY:

              random(
                -14,
                14
              ),


            velocityX:
              0,


            velocityY:
              0,


            /* p5 noise */

            noiseX:

              random(
                1000
              ),


            noiseY:

              random(
                1000
              ),


            phase:

              random(
                TWO_PI
              ),


            speed:

              random(
                0.0012,
                0.0022
              ),


            /*
              Wider movement than before.
            */

            amplitudeX:

              random(
                42,
                72
              ),


            amplitudeY:

              random(
                28,
                50
              ),


            /*
              Extra orbit makes bubbles
              actually wander around.
            */

            orbitRadiusX:

              random(
                26,
                48
              ),


            orbitRadiusY:

              random(
                18,
                36
              ),


            orbitSpeed:

              random(
                0.0022,
                0.004
              ),


            scale:
              0.76,


            opacity:
              0,


            rotation:

              random(
                -0.6,
                0.6
              ),


            hovered:
              false,


            selected:
              false,


            enterStart:
              now,

            enterFromX,
            enterFromY,


            /* exit */

            exiting:
              false,


            exitStart:
              0,


            exitFromX:
              0,


            exitFromY:
              0,


            exitTargetX:
              0,


            exitTargetY:
              0,


            exitRotation:
              0


          };


          /* =================================================
             HOVER
             ================================================= */

          button.addEventListener(

            "mouseenter",

            function () {


              if (

                button.disabled

                ||

                choice.exiting

              ) {

                return;

              }

              // Soft cue only when an enabled answer is entered.
              // Throttle quick jumps between floating bubbles.
              dinerPlayQuestionHoverSound();

              choice.hovered =
                true;


              hoveredQuestionChoiceV3 =
                choice;


              button
                .classList
                .add(
                  "liquid-hover"
                );


            }

          );


          button.addEventListener(

            "mouseleave",

            function () {


              choice.hovered =
                false;


              if (

                hoveredQuestionChoiceV3 ===
                choice

              ) {

                hoveredQuestionChoiceV3 =
                  null;

              }


              button
                .classList
                .remove(
                  "liquid-hover"
                );


            }

          );


          /* =================================================
             CLICK
             ================================================= */

          button.addEventListener(

            "click",

            function (
              event
            ) {


              event.stopPropagation();


              selectQuestionAnswerNew(

                choiceText,

                choice

              );


            }

          );


          questionChoicesContainerNew
            .appendChild(
              button
            );


          currentQuestionChoicesNew
            .push(
              choice
            );


        }

      );


  };



/* =========================================================
   FLOATING + LIQUID INTERACTION
   ========================================================= */

animateQuestionChoicesNew =
  function () {


    const now =
      performance.now();


    let hoveredCenterX =
      0;


    let hoveredCenterY =
      0;


    /* hovered bubble position */

    if (

      hoveredQuestionChoiceV3

      &&

      !hoveredQuestionChoiceV3.exiting

    ) {


      hoveredCenterX =

        hoveredQuestionChoiceV3.anchorX

        +

        hoveredQuestionChoiceV3.offsetX;


      hoveredCenterY =

        hoveredQuestionChoiceV3.anchorY

        +

        hoveredQuestionChoiceV3.offsetY;


    }


    for (

      const choice
      of currentQuestionChoicesNew

    ) {


      const button =
        choice.element;


      if (
        !button
      ) {

        continue;

      }


      /* ===================================================
         EXIT ANIMATION
         =================================================== */

      if (
        choice.exiting
      ) {


        // Keep the old smooth drift, but fade at a steady pace all the way
        // to zero (the eased curve made the last part look like a pause).
        const exitTimeProgress = questionClampV3(
          (now - choice.exitStart) / QUESTION_FLOAT_EXIT_DURATION_V3,
          0,
          1
        );
        const exitProgress = questionEaseV3(exitTimeProgress);


        const currentExitX =

          choice.exitFromX

          +

          (

            choice.exitTargetX -
            choice.exitFromX

          )

          *

          exitProgress;


        const currentExitY =

          choice.exitFromY

          +

          (

            choice.exitTargetY -
            choice.exitFromY

          )

          *

          exitProgress;


        const exitScale =

          choice.selected

            ?

            1

            +

            0.16

            *

            Math.sin(

              exitProgress *
              Math.PI

            )

            :

            1

            -

            0.24 *
            exitProgress;


        // Do not linger at low opacity: fade continuously to invisible.
        const exitOpacity = 1 - exitTimeProgress;


        const exitRotation =

          choice.rotation

          +

          choice.exitRotation *
          exitProgress;


        button.style.transform =

          `translate(-50%, -50%)

           translate(
             ${currentExitX}px,
             ${currentExitY}px
           )

           rotate(
             ${exitRotation}deg
           )

           scale(
             ${exitScale}
           )`;


        button.style.opacity =

          String(

            questionClampV3(

              exitOpacity,

              0,

              1

            )

          );


        button.style.filter =
          `blur(${exitProgress * 7}px)`;

        // As soon as a bubble reaches 0 opacity, remove it from the DOM;
        // there is no invisible/half-faded element left waiting on screen.
        if (exitTimeProgress >= 1) {
          button.style.opacity = "0";
          button.style.visibility = "hidden";
          button.remove();
          choice.exitFinished = true;
        }

        continue;

      }


      /* ===================================================
         FREE ORGANIC FLOAT
         =================================================== */

      const noiseMoveX =

        map(

          noise(

            choice.noiseX

            +

            frameCount *
            choice.speed

          ),

          0,

          1,

          -choice.amplitudeX,

          choice.amplitudeX

        );


      const noiseMoveY =

        map(

          noise(

            choice.noiseY

            +

            frameCount *
            choice.speed

          ),

          0,

          1,

          -choice.amplitudeY,

          choice.amplitudeY

        );


      const waveX =

        sin(

          frameCount *
          0.0055

          +

          choice.phase

        )

        *

        18;


      const waveY =

        cos(

          frameCount *
          0.0044

          +

          choice.phase

        )

        *

        13;


      /*
        Large slow orbit.
      */

      const orbitX =

        cos(

          frameCount *
          choice.orbitSpeed

          +

          choice.phase *
          1.35

        )

        *

        choice.orbitRadiusX;


      const orbitY =

        sin(

          frameCount *
          choice.orbitSpeed *
          0.82

          +

          choice.phase *
          1.8

        )

        *

        choice.orbitRadiusY;


      let targetOffsetX =

        noiseMoveX

        +

        waveX

        +

        orbitX;


      let targetOffsetY =

        noiseMoveY

        +

        waveY

        +

        orbitY;



      /* ===================================================
         HOVERED BLOB FOLLOWS CURSOR
         =================================================== */

      if (

        choice.hovered

        &&

        smokeMouseInsideSceneNew

      ) {


        const currentCenterX =

          choice.anchorX

          +

          choice.offsetX;


        const currentCenterY =

          choice.anchorY

          +

          choice.offsetY;


        const cursorDeltaX =

          smokeMouseXNew

          -

          currentCenterX;


        const cursorDeltaY =

          smokeMouseYNew

          -

          currentCenterY;


        targetOffsetX +=

          questionClampV3(

            cursorDeltaX *
            0.16,

            -48,

            48

          );


        targetOffsetY +=

          questionClampV3(

            cursorDeltaY *
            0.14,

            -38,

            38

          );


        /*
          Move liquid highlight
          toward cursor.
        */

        const liquidX =

          questionClampV3(

            50

            +

            (

              cursorDeltaX /
              175

            )

            *

            42,

            8,

            92

          );


        const liquidY =

          questionClampV3(

            50

            +

            (

              cursorDeltaY /
              90

            )

            *

            38,

            10,

            90

          );


        button.style.setProperty(

          "--liquid-x",

          `${liquidX}%`

        );


        button.style.setProperty(

          "--liquid-y",

          `${liquidY}%`

        );


      }



      /* ===================================================
         NEARBY BUBBLES MOVE AWAY
         =================================================== */

      if (

        hoveredQuestionChoiceV3

        &&

        hoveredQuestionChoiceV3 !==
        choice

      ) {


        const choiceCenterX =

          choice.anchorX

          +

          choice.offsetX;


        const choiceCenterY =

          choice.anchorY

          +

          choice.offsetY;


        const differenceX =

          choiceCenterX

          -

          hoveredCenterX;


        const differenceY =

          choiceCenterY

          -

          hoveredCenterY;


        const distance =

          Math.sqrt(

            differenceX *
            differenceX

            +

            differenceY *
            differenceY

          );


        if (

          distance <
          QUESTION_NEIGHBOUR_RADIUS_V3

          &&

          distance >
          0.001

        ) {


          const force =

            (

              1

              -

              distance /
              QUESTION_NEIGHBOUR_RADIUS_V3

            )

            *

            QUESTION_NEIGHBOUR_FORCE_V3;


          targetOffsetX +=

            (

              differenceX /
              distance

            )

            *

            force;


          targetOffsetY +=

            (

              differenceY /
              distance

            )

            *

            force

            *

            0.72;


        }


      }



      /* ===================================================
         SAFE INVISIBLE BOUNDARY

         Bubble can move freely
         but cannot leave screen.
         =================================================== */

      const safeLeft =
        260;


      const safeRight =
        BASE_W - 260;


      const safeTop =
        340;


      const safeBottom =
        BASE_H - 155;


      let desiredCenterX =

        choice.anchorX

        +

        targetOffsetX;


      let desiredCenterY =

        choice.anchorY

        +

        targetOffsetY;


      desiredCenterX =

        questionClampV3(

          desiredCenterX,

          safeLeft,

          safeRight

        );


      desiredCenterY =

        questionClampV3(

          desiredCenterY,

          safeTop,

          safeBottom

        );


      targetOffsetX =

        desiredCenterX

        -

        choice.anchorX;


      targetOffsetY =

        desiredCenterY

        -

        choice.anchorY;



      /* ===================================================
         SPRING PHYSICS
         =================================================== */

      choice.velocityX +=

        (

          targetOffsetX

          -

          choice.offsetX

        )

        *

        0.019;


      choice.velocityY +=

        (

          targetOffsetY

          -

          choice.offsetY

        )

        *

        0.019;


      /*
        Friction.
      */

      choice.velocityX *=
        0.895;


      choice.velocityY *=
        0.895;


      choice.offsetX +=
        choice.velocityX;


      choice.offsetY +=
        choice.velocityY;



      /* ===================================================
         ENTER + HOVER SCALE
         =================================================== */

      const enterProgress =

        questionEaseV3(

          (

            now

            -

            choice.enterStart

          )

          /

          QUESTION_FLOAT_ENTER_DURATION_V3

        );


      const hoverScale =

        choice.hovered

          ? 1.085

          : 1;


      const enterScale =

        0.76

        +

        0.24 *
        enterProgress;


      const targetScale =

        hoverScale

        *

        enterScale;


      choice.scale +=

        (

          targetScale

          -

          choice.scale

        )

        *

        0.14;


      choice.opacity +=

        (

          enterProgress

          -

          choice.opacity

        )

        *

        0.18;


      const rotationTarget =

        sin(

          frameCount *
          0.0045

          +

          choice.phase

        )

        *

        (

          choice.hovered

            ? 2.2

            : 0.75

        );


      choice.rotation +=

        (

          rotationTarget

          -

          choice.rotation

        )

        *

        0.08;


      /* ===================================================
         LIQUID MOTION — RESTORED
         Works alongside the existing continuous fade-out and
         fly-in. Each bubble breathes at a different phase;
         cursor pull + velocity deform it with a soft return.
         =================================================== */

      if (choice.liquidStretchX === undefined) {
        choice.liquidStretchX = 0;
        choice.liquidStretchY = 0;
        choice.liquidSkew = 0;
      }

      let cursorPullX = 0;
      let cursorPullY = 0;

      if (choice.hovered && smokeMouseInsideSceneNew) {
        const currentCenterX = choice.anchorX + choice.offsetX;
        const currentCenterY = choice.anchorY + choice.offsetY;

        cursorPullX = questionClampV3(
          (smokeMouseXNew - currentCenterX) / 190, -1, 1
        );
        cursorPullY = questionClampV3(
          (smokeMouseYNew - currentCenterY) / 100, -1, 1
        );
      }

      // Opposing X/Y expansion feels like soft, incompressible gel.
      const liquidBreath = Math.sin(
        frameCount * 0.022 + choice.phase
      ) * (choice.hovered ? 0.026 : 0.018);

      const targetStretchX = questionClampV3(
        choice.velocityX * 0.011 + cursorPullX * 0.075 + liquidBreath,
        -0.125, 0.125
      );
      const targetStretchY = questionClampV3(
        choice.velocityY * 0.011 + cursorPullY * 0.075 - liquidBreath,
        -0.125, 0.125
      );
      const targetSkew = questionClampV3(
        choice.velocityX * 0.30 + cursorPullX * 3.1,
        -4.8, 4.8
      );

      // More inertia: a bubble keeps wobbling as the pointer leaves.
      choice.liquidStretchX +=
        (targetStretchX - choice.liquidStretchX) * 0.10;
      choice.liquidStretchY +=
        (targetStretchY - choice.liquidStretchY) * 0.10;
      choice.liquidSkew +=
        (targetSkew - choice.liquidSkew) * 0.085;

      const liquidScaleX = choice.scale * (1 + choice.liquidStretchX);
      const liquidScaleY = choice.scale * (1 + choice.liquidStretchY);

      // Preserve the fly-in: new bubbles start off-screen only after
      // the previous bubbles have completely faded and been removed.
      const enterFlyX = choice.enterFromX * (1 - enterProgress);
      const enterFlyY = choice.enterFromY * (1 - enterProgress);

      button.style.transform =
        `translate(-50%, -50%)
         translate(${choice.offsetX + enterFlyX}px,
                   ${choice.offsetY + enterFlyY}px)
         rotate(${choice.rotation}deg)
         skewX(${choice.liquidSkew}deg)
         scale(${liquidScaleX}, ${liquidScaleY})`;

      button.style.opacity =

        String(

          questionClampV3(

            choice.opacity,

            0,

            1

          )

        );


      button.style.filter =
        "none";


    }

    // Load the next set in the SAME frame the last old bubble disappears.
    // No extra timeout or empty pause between the outgoing and incoming set.
    if (
      questionExitPendingV3 &&
      currentQuestionChoicesNew.length > 0 &&
      currentQuestionChoicesNew.every(choice => choice.exitFinished)
    ) {
      questionExitPendingV3 = false;
      currentQuestionIndexNew++;
      const questions = QUESTION_BANK_NEW[selectedDish];

      if (currentQuestionIndexNew < questions.length) {
        showCurrentQuestionNew();
      } else {
        if (questionScreenNew) {
          questionScreenNew.classList.remove("question-switching");
        }
        finishQuestionSequenceNew();
      }
    }

  };



/* =========================================================
   SMOOTH QUESTION EXIT
   ========================================================= */

function beginQuestionExitV3(
  selectedChoice
) {


  setQuestionHeaderExitingV3();

  questionExitPendingV3 = true;

  const now =
    performance.now();


  const selectedCenterX =

    selectedChoice.anchorX

    +

    selectedChoice.offsetX;


  const selectedCenterY =

    selectedChoice.anchorY

    +

    selectedChoice.offsetY;


  for (

    const choice
    of currentQuestionChoicesNew

  ) {


    choice.exiting =
      true;


    choice.exitStart =
      now;


    choice.exitFromX =
      choice.offsetX;


    choice.exitFromY =
      choice.offsetY;


    choice.element.disabled =
      true;


    choice.element.style.pointerEvents =
      "none";


    /* =====================================================
       SELECTED ANSWER
       ===================================================== */

    if (
      choice === selectedChoice
    ) {


      const goLeft =

        selectedCenterX <
        BASE_W / 2;


      const goUp =

        selectedCenterY <
        BASE_H / 2;


      /*
        Keep selected bubble inside screen
        during exit too.
      */

      const targetCenterX =

        goLeft

          ? 270

          : BASE_W - 270;


      const targetCenterY =

        goUp

          ? 260

          : BASE_H - 180;


      choice.exitTargetX =

        targetCenterX

        -

        choice.anchorX;


      choice.exitTargetY =

        targetCenterY

        -

        choice.anchorY;


      choice.exitRotation =

        goLeft

          ? -7

          : 7;


    }


    /* =====================================================
       OTHER ANSWERS DRIFT AWAY
       ===================================================== */

    else {


      const currentCenterX =

        choice.anchorX

        +

        choice.offsetX;


      const currentCenterY =

        choice.anchorY

        +

        choice.offsetY;


      let awayX =

        currentCenterX

        -

        selectedCenterX;


      let awayY =

        currentCenterY

        -

        selectedCenterY;


      const distance =

        Math.max(

          1,

          Math.sqrt(

            awayX *
            awayX

            +

            awayY *
            awayY

          )

        );


      awayX /=
        distance;


      awayY /=
        distance;


      choice.exitTargetX =

        choice.offsetX

        +

        awayX

        *

        random(
          120,
          200
        );


      choice.exitTargetY =

        choice.offsetY

        +

        awayY

        *

        random(
          90,
          155
        );


      choice.exitRotation =

        random(
          -6,
          6
        );


    }


  }



  // The draw loop advances as soon as every old bubble has fully faded.
  // See questionExitPendingV3 in animateQuestionChoicesNew().

}


/* =========================================================
   SELECT ANSWER
   ========================================================= */

selectQuestionAnswerNew =
  function (
    answer,
    selectedChoice
  ) {


    if (

      questionChangingNew

      ||

      !selectedChoice

    ) {

      return;

    }

    // Exactly one click sound for a valid answer, including question 5.
    dinerPlayExtraSound('questionSelect');

    questionChangingNew =
      true;



    /* =====================================================
       SAVE ANSWER
       ===================================================== */

    questionAnswersNew.push({

      dish:
        selectedDish,


      questionIndex:
        currentQuestionIndexNew,


      question:

        currentQuestionDataNew
          .prompt
          .join(
            " "
          ),


      answer:
        answer

    });


    window.dinerAnswers =
      questionAnswersNew;


    /* =====================================================
       LAST ANSWER -> BLACKOUT -> DISH REVEAL
       Answers 1–4 keep their liquid motion and normal fade.
       ===================================================== */

    const isFinalAnswerNew =
      currentQuestionIndexNew ===
      QUESTION_BANK_NEW[selectedDish].length - 1;

    if (isFinalAnswerNew) {
      selectedChoice.selected = true;
      selectedChoice.hovered = false;
      hoveredQuestionChoiceV3 = null;

      selectedChoice.element.classList.remove("liquid-hover");
      selectedChoice.element.classList.add("selected");

      for (const choice of currentQuestionChoicesNew) {
        choice.element.disabled = true;
        choice.element.style.pointerEvents = "none";
      }

      beginDishRevealTransitionNew();
      return;
    }



    /* =====================================================
       SELECTED VISUAL
       ===================================================== */

    selectedChoice.selected =
      true;


    selectedChoice.hovered =
      false;


    hoveredQuestionChoiceV3 =
      null;


    selectedChoice.element
      .classList
      .remove(
        "liquid-hover"
      );


    selectedChoice.element
      .classList
      .add(
        "selected"
      );



    /* =====================================================
       CLICK IMPULSE
       ===================================================== */

    const selectedCenterX =

      selectedChoice.anchorX

      +

      selectedChoice.offsetX;


    const selectedCenterY =

      selectedChoice.anchorY

      +

      selectedChoice.offsetY;


    for (

      const choice
      of currentQuestionChoicesNew

    ) {


      choice.element.disabled =
        true;


      if (
        choice === selectedChoice
      ) {

        continue;

      }


      choice.element
        .classList
        .remove(
          "liquid-hover"
        );


      const centerX =

        choice.anchorX

        +

        choice.offsetX;


      const centerY =

        choice.anchorY

        +

        choice.offsetY;


      const differenceX =

        centerX

        -

        selectedCenterX;


      const differenceY =

        centerY

        -

        selectedCenterY;


      const distance =

        Math.max(

          1,

          Math.sqrt(

            differenceX *
            differenceX

            +

            differenceY *
            differenceY

          )

        );


      const burst =

        Math.max(

          0,

          1

          -

          distance /
          800

        );


      choice.velocityX +=

        (

          differenceX /
          distance

        )

        *

        burst

        *

        12;


      choice.velocityY +=

        (

          differenceY /
          distance

        )

        *

        burst

        *

        9;


    }



    /* =====================================================
       OWNER RESPONSE
       ===================================================== */

    questionResponseNew.innerHTML =

      currentQuestionDataNew
        .response
        .join(
          "<br>"
        );


    questionResponseNew
      .classList
      .add(
        "show"
      );


    /*
      Longer response gets
      slightly longer reading time.
    */

    const responseCharacters =

      currentQuestionDataNew
        .response
        .join(
          " "
        )
        .length;


    const responseHold =

      questionClampV3(

        1050

        +

        responseCharacters *
        9,

        1150,

        1900

      );



    /* =====================================================
       RESPONSE → NEXT QUESTION
       ===================================================== */

    setTimeout(

      function () {


        questionResponseNew
          .classList
          .remove(
            "show"
          );


        beginQuestionExitV3(
          selectedChoice
        );


      },

      responseHold

    );


  };

  /* =========================================================
   DISH REVEAL SYSTEM
   Add this at the VERY END of current sketch.js
   ========================================================= */

const DISH_REVEAL_DATA_NEW = {
  tamago: {
    asset: "assets/tamago.png",
    ownerLines: [
      "Here.",
      "Eat while it's warm."
    ],
    name: "TAMAGOYAKI",
    tagline:
      "For those who keep a place at the table for the past.",
    reflection:
      "Sometimes we don't only miss a person or a place. We miss the version of ourselves that existed beside them."
  },

  omurice: {
    asset: "assets/omurice.png",
    ownerLines: [
      "Here you are."
    ],
    name: "OMURICE",
    tagline:
      "For those still rewriting something that has already happened.",
    reflection:
      "Some experiences stay with us because they never gave us the ending we expected."
  },

  oden: {
    asset: "assets/oden.png",
    ownerLines: [
      "Here."
    ],
    name: "ODEN",
    tagline:
      "For empty spaces that somehow remain occupied.",
    reflection:
      "People, places and relationships can leave while continuing to exist through what they changed in us."
  },

  ochazuke: {
    asset: "assets/ochazuke.png",
    ownerLines: [
      "Here.",
      "Something simple."
    ],
    name: "OCHAZUKE",
    tagline:
      "For those who have forgotten how to stop without feeling left behind.",
    reflection:
      "Sometimes what traps us isn't what we have to do, but the feeling that we must always continue."
  },

  ramen: {
    asset: "assets/ramen.png",
    ownerLines: [
      "Here.",
      "Careful. It's hot."
    ],
    name: "RAMEN",
    tagline:
      "For nights when company and connection don't quite mean the same thing.",
    reflection:
      "Loneliness isn't always an empty room. Sometimes it is having nowhere for your inner life to go."
  }
};


let dishRevealScreenNew = null;
let dishRevealOwnerTextNew = null;
let dishRevealImageNew = null;
let dishRevealDishWrapNew = null;
let dishRevealCopyNew = null;
let dishRevealNameNew = null;
let dishRevealTaglineNew = null;
let dishRevealReflectionNew = null;

let dishRevealTimersNew = [];
let dishRevealHasStartedNew = false;


/* =========================================================
   TIMER HELPERS
   ========================================================= */

function clearDishRevealTimersNew() {
  for (const timer of dishRevealTimersNew) {
    clearTimeout(timer);
  }

  dishRevealTimersNew = [];
}


function scheduleDishRevealNew(callback, delay) {
  const timer = setTimeout(callback, delay);
  dishRevealTimersNew.push(timer);
  return timer;
}


/* =========================================================
   CREATE REVEAL DOM
   ========================================================= */

function ensureDishRevealDomNew() {

  if (dishRevealScreenNew) {
    return;
  }

  const interiorScene =
    document.getElementById("interior-scene");

  if (!interiorScene) {
    return;
  }

  dishRevealScreenNew =
    document.createElement("section");

  dishRevealScreenNew.id =
    "dish-reveal-screen";

  dishRevealScreenNew.setAttribute(
    "aria-hidden",
    "true"
  );

  dishRevealScreenNew.innerHTML = `
    <div id="dish-reveal-dimmer"></div>
    <div id="dish-reveal-light-cone"></div>
    <div id="dish-reveal-spotlight"></div>

    <div id="dish-reveal-owner-box">
      <div id="dish-reveal-owner-label">OWNER</div>
      <div id="dish-reveal-owner-text"></div>
    </div>

    <div id="dish-reveal-dish-wrap">
      <img id="dish-reveal-image" alt="">
    </div>

    <div id="dish-reveal-copy">
      <div id="dish-reveal-name"></div>
      <div id="dish-reveal-tagline"></div>
      <div id="dish-reveal-reflection"></div>
    </div>
  `;

  interiorScene.appendChild(
    dishRevealScreenNew
  );

  dishRevealOwnerTextNew =
    document.getElementById(
      "dish-reveal-owner-text"
    );

  dishRevealImageNew =
    document.getElementById(
      "dish-reveal-image"
    );

  dishRevealDishWrapNew =
    document.getElementById(
      "dish-reveal-dish-wrap"
    );

  dishRevealCopyNew =
    document.getElementById(
      "dish-reveal-copy"
    );

  dishRevealNameNew =
    document.getElementById(
      "dish-reveal-name"
    );

  dishRevealTaglineNew =
    document.getElementById(
      "dish-reveal-tagline"
    );

  dishRevealReflectionNew =
    document.getElementById(
      "dish-reveal-reflection"
    );

}


/* =========================================================
   FINAL ANSWER -> BLACK SCREEN -> READY DISH

   Scene changes only while the blackout is fully opaque.
   Smoke and cooking audio are stopped before revealing food.
   ========================================================= */

let dishRevealTransitionStartedNew = false;

function beginDishRevealTransitionNew() {
  if (dishRevealTransitionStartedNew ||
      !DISH_REVEAL_DATA_NEW[selectedDish]) {
    return;
  }
  dishRevealTransitionStartedNew = true;

  const blackScreen = document.getElementById("transition");

  if (blackScreen) {
    // Blackout covers the dish reveal layer (z-index 260).
    blackScreen.style.zIndex = "9999";
    blackScreen.classList.add("dish-reveal-cut");
    blackScreen.style.transition = "opacity 0.62s ease";
    blackScreen.classList.add("active");
  }

  window.setTimeout(function () {
    // End the question instantly while covered by black: no ghost text
    // from the 0.75s fade can appear when the room is revealed.
    questionExitPendingV3 = false;
    finishQuestionSequenceNew();
    if (questionScreenNew) {
      questionScreenNew.style.transition = "none";
      questionScreenNew.style.opacity = "0";
      questionScreenNew.style.visibility = "hidden";
      questionScreenNew.style.pointerEvents = "none";
    }

    // Stop both smoke layers and cooking sound entirely.
    dinerStopCookingSmokeLayer();
    dinerStopExtraSound('steam');
    cookingModeNew = false;
    cookingSmokeParticlesNew = [];
    if (cookingAudioNew) {
      cookingAudioNew.pause();
    }

    const room = document.getElementById("interior-scene");
    const interiorBg = document.getElementById("interior-bg");
    const owner = document.getElementById("owner-character");
    const kitchen = document.getElementById("cooking-background");
    const dialogue = document.getElementById("dialogue-box");

    if (room) {
      room.classList.add("dish-reveal-room-ready");
    }
    if (interiorBg) {
      interiorBg.classList.remove("cooking-hidden");
      interiorBg.style.transition = "none";
      interiorBg.style.opacity = "1";
    }
    if (owner) {
      owner.classList.remove("cooking-hidden");
      owner.style.transition = "none";
      owner.style.opacity = "1";
    }
    if (kitchen) {
      kitchen.classList.remove("active");
      kitchen.style.transition = "none";
      kitchen.style.opacity = "0";
      kitchen.style.visibility = "hidden";
    }
    if (dialogue) {
      dialogue.classList.add("hide");
    }

    // The p5 canvas was moved into the interior for smoke. Hide it,
    // so no old particle pixels remain after cooking has stopped.
    const smokeCanvas = room && room.querySelector("canvas");
    if (smokeCanvas) {
      smokeCanvas.style.opacity = "0";
      smokeCanvas.style.visibility = "hidden";
    }

    // Construct and start the existing reveal beneath the blackout.
    startDishRevealNew();

    // Two paint frames allow the new scene to settle before revealing it.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!blackScreen) return;
        blackScreen.classList.remove("active");
        window.setTimeout(function () {
          blackScreen.classList.remove("dish-reveal-cut");
          blackScreen.style.transition = "";
          blackScreen.style.zIndex = "";
        }, 700);
      });
    });
  }, blackScreen ? 680 : 0);
}


/* =========================================================
   START REVEAL
   ========================================================= */

function startDishRevealNew() {

  if (dishRevealHasStartedNew) {
    return;
  }

  if (!selectedDish) {
    return;
  }

  ensureDishRevealDomNew();

  if (!dishRevealScreenNew) {
    return;
  }

  const revealData =
    DISH_REVEAL_DATA_NEW[selectedDish];

  if (!revealData) {
    return;
  }

  dishRevealHasStartedNew =
    true;

  clearDishRevealTimersNew();

  /* hide old dialogue box if still visible */
  const dialogueBox =
    document.getElementById(
      "dialogue-box"
    );

  if (dialogueBox) {
    dialogueBox.classList.add("hide");
  }

  /* pause cooking audio once dish is ready */
  if (typeof cookingAudioNew !== "undefined" && cookingAudioNew) {
    try {
      cookingAudioNew.pause();
    } catch (error) {}
  }

  /* reset visual state */
  dishRevealScreenNew.classList.remove("show");

  if (dishRevealDishWrapNew) {
    dishRevealDishWrapNew.classList.remove("show");
    // Ramen sits slightly higher on the counter; move its entire wrap
    // so the food image, eating canvas, shadow and hit area stay aligned.
    dishRevealDishWrapNew.classList.toggle(
      "ramen-on-table",
      selectedDish === "ramen"
    );
  }

  if (dishRevealCopyNew) {
    dishRevealCopyNew.classList.remove("show");
  }

  if (dishRevealOwnerTextNew) {
    dishRevealOwnerTextNew.innerHTML = "";
  }

  if (dishRevealImageNew) {
    const menuDishImage = document.querySelector(
      `.food-choice[data-dish="${selectedDish}"] img`
    );
    dishRevealImageNew.src = menuDishImage
      ? menuDishImage.getAttribute("src")
      : revealData.asset;
    dishRevealImageNew.alt = revealData.name;
  }

  if (dishRevealNameNew) {
    dishRevealNameNew.textContent =
      revealData.name;
  }

  if (dishRevealTaglineNew) {
    dishRevealTaglineNew.textContent =
      revealData.tagline;
  }

  if (dishRevealReflectionNew) {
    dishRevealReflectionNew.textContent =
      revealData.reflection;
  }

  dishRevealScreenNew.setAttribute(
    "aria-hidden",
    "false"
  );

  requestAnimationFrame(function () {
    dishRevealScreenNew.classList.add("show");
  });

  /* =======================================================
     STAGING
     1) first owner line
     2) dish appears
     3) optional second owner line
     4) reveal meaning text
     ======================================================= */

  const ownerLines =
    revealData.ownerLines || [];

  if (dishRevealOwnerTextNew && ownerLines.length > 0) {
    dishRevealOwnerTextNew.innerHTML =
      ownerLines[0];
  }

  /* dish appears */
  scheduleDishRevealNew(function () {

    if (dishRevealDishWrapNew) {
      dishRevealDishWrapNew.classList.add("show");
      dinerPlayExtraSound('dishServe');
    }

  }, 180);

  /* second line, if any */
  if (ownerLines.length > 1) {

    scheduleDishRevealNew(function () {

      if (dishRevealOwnerTextNew) {
        dishRevealOwnerTextNew.innerHTML =
          ownerLines.join("<br>");
      }

    }, 450);

  }

  /* Show the dish's emotional meaning as soon as the dish appears.
     The readable card is below the food and stays visible before eating. */
  scheduleDishRevealNew(function () {

    if (dishRevealCopyNew) {
      dishRevealCopyNew.classList.add("show");
    }

  }, 650);

}

/* =========================================================
   INTERACTIVE EATING — five illustrated bites, no extra food assets

   - Reuses the selected menu image (already shown during dish reveal).
   - A Canvas paints dish-coloured, organically shaped patches over food.
   - The bowl / plate and the surrounding restaurant remain untouched.
   - A tiny food morsel follows an animated utensil on each click.
   ========================================================= */

const DINER_EATING_MAX_BITES = 5;
const dinerEatingState = {
  count: 0,
  enabled: false,
  busy: false,
  canvas: null,
  context: null,
  image: null,
  hint: null,
  hit: null,
  tool: null,
  foodRect: null,
  spots: [],
  seed: 0
};

/* Positions are fractions of the ACTUAL transparent food PNG, not the
   320 x 320 on-screen wrapper. Colours match each illustration's
   plate / broth: this makes a missing bite reveal a believable surface. */
const DINER_EATING_DISHES = {
  tamago: {
    surface: ["#e7e4d9", "#c9c6bb"],
    tool: "chopsticks",
    clip: [0.50, 0.46, 0.36, 0.31],
    bites: [
      [0.27, 0.37, 0.18, 0.25], [0.46, 0.32, 0.19, 0.23],
      [0.68, 0.39, 0.17, 0.24], [0.35, 0.57, 0.22, 0.20],
      [0.61, 0.58, 0.23, 0.23]
    ]
  },
  omurice: {
    surface: ["#f8f8f1", "#d6d5ca"],
    tool: "spoon",
    clip: [0.50, 0.49, 0.39, 0.36],
    bites: [
      [0.30, 0.36, 0.20, 0.23], [0.52, 0.35, 0.21, 0.24],
      [0.70, 0.45, 0.18, 0.24], [0.34, 0.61, 0.21, 0.23],
      [0.55, 0.59, 0.23, 0.25]
    ]
  },
  oden: {
    surface: ["#61432d", "#3a221b"],
    tool: "chopsticks",
    clip: [0.50, 0.48, 0.38, 0.30],
    bites: [
      [0.28, 0.42, 0.19, 0.23], [0.50, 0.34, 0.19, 0.24],
      [0.70, 0.42, 0.19, 0.24], [0.37, 0.57, 0.21, 0.23],
      [0.61, 0.56, 0.21, 0.24]
    ]
  },
  ochazuke: {
    surface: ["#cad3a8", "#a9b58a"],
    tool: "spoon",
    clip: [0.50, 0.38, 0.34, 0.27],
    bites: [
      [0.31, 0.34, 0.19, 0.21], [0.53, 0.25, 0.21, 0.20],
      [0.69, 0.36, 0.18, 0.21], [0.39, 0.48, 0.20, 0.20],
      [0.58, 0.47, 0.20, 0.20]
    ]
  },
  ramen: {
    surface: ["#f7ce91", "#e6b66f"],
    tool: "chopsticks",
    clip: [0.50, 0.32, 0.40, 0.29],
    bites: [
      [0.30, 0.25, 0.18, 0.20], [0.51, 0.19, 0.20, 0.21],
      [0.69, 0.30, 0.18, 0.22], [0.37, 0.42, 0.20, 0.21],
      [0.59, 0.43, 0.22, 0.21]
    ]
  }
};

/* Keep the current dish reveal untouched and install the extra
   interaction once its real image and text are ready. */
const dinerStartRevealBeforeEating = startDishRevealNew;
startDishRevealNew = function (...args) {
  const result = dinerStartRevealBeforeEating.apply(this, args);
  dinerPrepareEating();
  return result;
};

/* =========================================================
   REVEAL FIRST -> LIGHT AND INTRO FADE OUT -> EATING

   Keep the ORIGINAL dish image visible at all times. The separate
   320px canvas draws the partially eaten version OVER that image;
   a missing / slow-loading canvas can never make the dish disappear.
   ========================================================= */

function dinerPrepareEating() {
  const wrap = document.getElementById("dish-reveal-dish-wrap");
  const screen = document.getElementById("dish-reveal-screen");
  const source = document.getElementById("dish-reveal-image");
  const settings = DINER_EATING_DISHES[selectedDish];
  if (!wrap || !screen || !source || !settings) return;

  const state = dinerEatingState;
  state.count = 0;
  state.enabled = false;
  state.busy = false;
  state.spots = [];
  state.image = source;
  state.foodRect = null;
  state.canvasReady = false;
  state.lightGone = false;
  state.phaseStarted = false;

  // A repeated reveal should never inherit the previous eating scene.
  screen.classList.remove("eating-mode");
  source.classList.remove("dish-eating-source-hidden");
  source.style.opacity = "";

  let canvas = document.getElementById("dish-eating-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "dish-eating-canvas";
    canvas.width = 320;
    canvas.height = 320;
    canvas.setAttribute("aria-hidden", "true");
    wrap.appendChild(canvas);
  }
  canvas.classList.remove("ready", "just-bitten");
  state.canvas = canvas;
  state.context = canvas.getContext("2d");

  let hit = document.getElementById("dish-eating-hit");
  if (!hit) {
    hit = document.createElement("button");
    hit.type = "button";
    hit.id = "dish-eating-hit";
    hit.setAttribute("aria-label", "Take a bite of the food");
    wrap.appendChild(hit);
    hit.addEventListener("click", dinerTakeBite);
  }
  state.hit = hit;
  hit.disabled = true;
  hit.classList.remove("finished");

  let tool = document.getElementById("dish-eating-utensil");
  if (!tool) {
    tool = document.createElement("span");
    tool.id = "dish-eating-utensil";
    tool.setAttribute("aria-hidden", "true");
    wrap.appendChild(tool);
  }
  state.tool = tool;
  tool.className = "dish-eating-utensil " + settings.tool;

  let hint = document.getElementById("dish-eating-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "dish-eating-hint";
    hint.setAttribute("role", "status");
    hint.setAttribute("aria-live", "polite");
    screen.appendChild(hint);
  }
  state.hint = hint;
  hint.classList.remove("show", "done");
  hint.textContent = "Click the dish to take a bite · 0 / 5";

  // Prepare a full-size matching canvas, but DO NOT replace or hide the PNG.
  function imageReady() {
    if (state.image !== source || !source.naturalWidth || !source.naturalHeight)
      return;
    const scale = Math.min(320 / source.naturalWidth, 320 / source.naturalHeight);
    state.foodRect = {
      x: (320 - source.naturalWidth * scale) / 2,
      y: (320 - source.naturalHeight * scale) / 2,
      w: source.naturalWidth * scale,
      h: source.naturalHeight * scale
    };
    state.canvasReady = dinerRenderEatenDish() === true;
    // If the image loads late, let eating start only once it is ready.
    if (state.lightGone) dinerEnableEatingNew();
  }

  if (source.complete && source.naturalWidth > 0) imageReady();
  else source.addEventListener("load", imageReady, { once: true });

  // The dish appears at 180ms and its meaning at 650ms. Keep the
  // larger meaning card visible for OVER SIX SECONDS before the reveal
  // fades into the eating interaction. Neither the food nor its click
  // target moves during the transition.
  const introDuration = 7250;

  scheduleDishRevealNew(() => {
    if (state.image !== source || state.phaseStarted) return;
    state.phaseStarted = true;
    // CSS fades the spotlight, owner's words and dish description together.
    // The actual food image stays in the same place the entire time.
    screen.classList.add("eating-mode");

    scheduleDishRevealNew(() => {
      if (state.image !== source) return;
      state.lightGone = true;
      dinerEnableEatingNew();
    }, 1050); // wait for the 0.85s light/text fade to FINISH
  }, introDuration);
}

function dinerEnableEatingNew() {
  const state = dinerEatingState;
  if (!state.lightGone || !state.canvasReady || state.enabled) return;
  // CSS scopes the canvas to the 320x320 wrapper, not the full p5 scene.
  // Keep the original PNG underneath as a permanent visual fallback.
  state.canvas.classList.add("ready");
  state.enabled = true;
  state.hit.disabled = false;
  state.hint.classList.add("show");
}

function dinerTakeBite(event) {
  const state = dinerEatingState;
  if (!state.enabled || state.busy || state.count >= DINER_EATING_MAX_BITES) return;
  const settings = DINER_EATING_DISHES[selectedDish];
  if (!settings || !state.foodRect || !state.image) return;

  state.busy = true;
  state.hit.disabled = true;
  const bite = dinerFindBiteLocation(event, settings);
  dinerPlayExtraSound('bite');
  const { x, y, w, h } = state.foodRect;
  const centerX = x + bite[0] * w;
  const centerY = y + bite[1] * h;
  const radiusX = bite[2] * w;
  const radiusY = bite[3] * h;

  state.tool.style.setProperty("--bite-x", `${centerX}px`);
  state.tool.style.setProperty("--bite-y", `${centerY}px`);
  state.tool.classList.remove("taking-bite");
  void state.tool.offsetWidth; // replay the utensil gesture each bite
  state.tool.classList.add("taking-bite");
  dinerAnimateMorsel(centerX, centerY, radiusX, radiusY);

  window.setTimeout(() => {
    state.spots.push(bite);
    state.count += 1;
    dinerRenderEatenDish();
    if (state.canvas) {
      state.canvas.classList.remove("just-bitten");
      void state.canvas.offsetWidth;
      state.canvas.classList.add("just-bitten");
    }
    if (state.hint) {
      state.hint.textContent = state.count < DINER_EATING_MAX_BITES
        ? `Click the dish to take another bite · ${state.count} / 5`
        : "The last bite. Ready to pay?";
    }
  }, 340);

  window.setTimeout(() => {
    state.busy = false;
    state.tool.classList.remove("taking-bite");
    if (state.count < DINER_EATING_MAX_BITES) {
      state.hit.disabled = false;
    } else {
      state.enabled = false;
      state.hit.disabled = true;
      state.hit.classList.add("finished");
      state.hint.classList.add("done");
      // Continue from the fifth bite to the owner's payment dialogue.
      window.setTimeout(dinerShowReadyToPay, 650);
    }
  }, 860);
}


/* Where users tap affects the illustration. For clicks on the rim,
   a safe next edible spot is used instead; repeated clicks at exactly
   the same place still remove a new portion of food. */
function dinerFindBiteLocation(event, settings) {
  const fallback = settings.bites[dinerEatingState.count];
  const wrap = document.getElementById("dish-reveal-dish-wrap");
  if (!wrap || !event || !dinerEatingState.foodRect) return fallback;
  const bounds = wrap.getBoundingClientRect();
  const localX = (event.clientX - bounds.left) / bounds.width * 320;
  const localY = (event.clientY - bounds.top) / bounds.height * 320;
  const f = dinerEatingState.foodRect;
  const nx = (localX - f.x) / f.w;
  const ny = (localY - f.y) / f.h;
  const c = settings.clip;
  const ellipseDistance = ((nx - c[0]) / c[2]) ** 2 +
                          ((ny - c[1]) / c[3]) ** 2;
  if (ellipseDistance > .8) return fallback;
  const tooClose = dinerEatingState.spots.some(previous =>
    ((nx - previous[0]) / .16) ** 2 +
    ((ny - previous[1]) / .15) ** 2 < 1
  );
  return tooClose ? fallback : [nx, ny, fallback[2], fallback[3]];
}

/* A tiny clipping of the SAME food image rises out with the utensil.
   This makes each click look like a bite being carried away, rather than
   merely fading the entire plate or bowl. */
function dinerAnimateMorsel(cx, cy, rx, ry) {
  const state = dinerEatingState;
  const wrap = document.getElementById("dish-reveal-dish-wrap");
  if (!wrap || !state.image || !state.foodRect) return;
  const morsel = document.createElement("canvas");
  morsel.className = "dish-eating-morsel";
  morsel.width = 66;
  morsel.height = 50;
  // CSS uses these local coordinates; the global p5 canvas styles do not
  // override the position of a bite and move it to the top-left of the scene.
  morsel.style.setProperty("--morsel-x", `${cx}px`);
  morsel.style.setProperty("--morsel-y", `${cy}px`);
  const ctx = morsel.getContext("2d");
  ctx.beginPath();
  ctx.ellipse(33, 25, 31, 21, -0.12, 0, Math.PI * 2);
  ctx.clip();
  const img = state.image;
  const f = state.foodRect;
  const sx = Math.max(0, (cx - 30 - f.x) / f.w * img.naturalWidth);
  const sy = Math.max(0, (cy - 23 - f.y) / f.h * img.naturalHeight);
  const sw = Math.min(img.naturalWidth - sx, 60 / f.w * img.naturalWidth);
  const sh = Math.min(img.naturalHeight - sy, 46 / f.h * img.naturalHeight);
  if (sw > 0 && sh > 0) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 66, 50);
  }
  wrap.appendChild(morsel);
  window.setTimeout(() => morsel.remove(), 860);
}

/* The plate/bowl is redrawn from the original PNG on EVERY bite.
   Only the five organic patches inside the food surface are repainted
   as empty ceramic / broth; no part of the dish exterior scales away. */
function dinerRenderEatenDish() {
  const state = dinerEatingState;
  const ctx = state.context;
  const img = state.image;
  const f = state.foodRect;
  const settings = DINER_EATING_DISHES[selectedDish];
  if (!ctx || !img || !f || !settings || !img.naturalWidth) return false;

  try {
    ctx.clearRect(0, 0, 320, 320);
    ctx.drawImage(img, f.x, f.y, f.w, f.h);
  } catch (error) {
    // If the food asset cannot be drawn, retain the original visible PNG.
    console.warn("Diner eating: could not draw the dish image", error);
    return false;
  }
  const c = settings.clip;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(f.x + c[0] * f.w, f.y + c[1] * f.h,
              c[2] * f.w, c[3] * f.h, 0, 0, Math.PI * 2);
  ctx.clip();

  state.spots.forEach((bite, biteIndex) => {
    const px = f.x + bite[0] * f.w;
    const py = f.y + bite[1] * f.h;
    const rx = bite[2] * f.w;
    const ry = bite[3] * f.h;
    // Slightly scalloped, hand-painted edge rather than five hard circles.
    ctx.save();
    ctx.beginPath();
    const steps = 54;
    for (let i = 0; i <= steps; i++) {
      const a = 2 * Math.PI * i / steps;
      const irregular = 1 + 0.043 * Math.sin(7 * a + biteIndex * 2.1)
                          + 0.03 * Math.cos(11 * a - biteIndex);
      const bx = px + Math.cos(a) * rx * irregular;
      const by = py + Math.sin(a) * ry * irregular;
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    const gradient = ctx.createRadialGradient(px - rx * .23, py - ry * .27,
      1, px, py, Math.max(rx, ry) * 1.14);
    gradient.addColorStop(0, settings.surface[0]);
    gradient.addColorStop(1, settings.surface[1]);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(57, 37, 25, 0.16)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
  return true;
}


/* =========================================================
   THE RECEIPT ARCHIVE — integrated after the eating sequence

   Complete flow:
   last bite -> Ready to pay? -> owner's introduction ->
   floating receipts -> read three stories -> your own receipt ->
   your message becomes a new connected node.

   All needed markup is created automatically if the HTML does
   not already contain the pay/archive/your-receipt sections.
   The supplied archive stories are fictional examples. Messages
   entered by this browser are kept locally only; sharing them
   across visitors would require a database and moderation.
   ========================================================= */

const DINER_RECEIPT_STORIES = {
  tamago: [
    { id: '#031', time: '1:12 AM', message: "I thought I missed a person. Maybe I just miss who I was when they were around." },
    { id: '#102', time: '2:52 AM', message: "The house I grew up in looks different now. I still remember the sound of the kitchen in the morning." },
    { id: '#167', time: '12:58 AM', message: "Sometimes I play a song from that year just to remember an ordinary afternoon." },
    { id: '#208', time: '3:06 AM', message: "I keep an old photo in my wallet. It reminds me of a version of myself I want to be kind to." },
    { id: '#241', time: '1:47 AM', message: "I went back, and everything had changed. I think the part I wanted to visit was inside me." }
  ],
  omurice: [
    { id: '#044', time: '1:41 AM', message: "I replay the same moment, changing what I wish I'd said. Tonight I let it end where it did." },
    { id: '#119', time: '2:11 AM', message: "Some endings arrive without an explanation. I am learning to live without writing one for them." },
    { id: '#178', time: '3:19 AM', message: "I waited a long time for a second chance. Maybe I can give myself a first chance at something else." },
    { id: '#203', time: '12:32 AM', message: "If I knew then what I know now, I still might have been scared. That person did the best they could." },
    { id: '#249', time: '2:44 AM', message: "I can't change that day. I can stop making every new day answer for it." }
  ],
  oden: [
    { id: '#024', time: '2:13 AM', message: "My sister moved overseas eight years ago. We speak every week. Somehow the house still feels quieter.\n\nThank you." },
    { id: '#071', time: '2:31 AM', message: "I pass the old neighbourhood sometimes. Not because I have to. Part of me still lives there." },
    { id: '#152', time: '1:58 AM', message: "When someone leaves, they don't always leave completely. Sometimes they stay in the shape of your routines." },
    { id: '#196', time: '3:12 AM', message: "I still set out two cups before remembering. Then I make tea in just one." },
    { id: '#231', time: '12:49 AM', message: "A room can be empty and still carry a voice. I am grateful I got to hear it." }
  ],
  ochazuke: [
    { id: '#027', time: '12:38 AM', message: "I took a day off and still made a list of what I should accomplish. Tonight I simply sat down." },
    { id: '#094', time: '2:03 AM', message: "The hardest thing wasn't finishing the work. It was believing I could stop." },
    { id: '#160', time: '1:47 AM', message: "I sat down for five minutes and felt guilty. That's when I realised how tired I really was." },
    { id: '#207', time: '3:27 AM', message: "For once, I didn't reply to every message right away. Nothing terrible happened." },
    { id: '#238', time: '12:56 AM', message: "I hope tomorrow has a quiet hour in it. I hope I let myself have it." }
  ],
  ramen: [
    { id: '#019', time: '12:44 AM', message: "I was surrounded by people all night. Still, I went home feeling unseen." },
    { id: '#088', time: '3:07 AM', message: "Company isn't always the same as connection. I wish I'd said what I was really thinking." },
    { id: '#143', time: '2:26 AM', message: "There are nights when the room is full, but your inner life has nowhere to go." },
    { id: '#201', time: '1:50 AM', message: "A friend sat with me without trying to solve anything. I didn't know how much I needed that." },
    { id: '#246', time: '3:33 AM', message: "Maybe I can tell someone a small true thing tomorrow, and start there." }
  ]
};

const dinerReceiptArchive = {
  active: false,
  started: false,
  step: 'waiting',
  nodes: [],
  readIds: new Set(),
  frame: null,
  startedAt: 0,
  selected: null,
  finalPending: false,
  written: false,
  localKey: 'midnight-diner-local-receipts-v1',
  timers: []
};

/* Receipts form one balanced constellation around the middle of the
   fixed 1920 x 1080 scene. The sixth/new receipt takes the central spot. */
const DINER_RECEIPT_POSITIONS = [
  [610, 500],  // left of the constellation
  [960, 392],  // top centre: clear of the archive header
  [1310, 500], // right
  [758, 770],  // bottom left
  [1162, 770], // bottom right
  [960, 590],  // the visitor's receipt joins at the heart of the web
  [570, 700],
  [1350, 700]
];

function dinerReceiptAfter(callback, ms) {
  const id = window.setTimeout(callback, ms);
  dinerReceiptArchive.timers.push(id);
  return id;
}

/* Work with the complete HTML supplied earlier, but also let the
   user replace just sketch.js/style.css if they're still on old HTML. */
function dinerEnsureReceiptHTML() {
  const room = document.getElementById('interior-scene');
  if (!room) return;

  if (!document.getElementById('pay-overlay')) {
    const section = document.createElement('section');
    section.id = 'pay-overlay';
    section.setAttribute('aria-label', 'Ready to pay');
    section.innerHTML = `
      <div id="pay-dialogue-box">
        <div id="pay-dialogue-speaker">OWNER</div>
        <div id="pay-dialogue-text">Ready to pay?</div>
        <div id="pay-buttons">
          <button id="pay-yes" type="button">Yes</button>
          <button id="pay-no" type="button">No</button>
        </div>
      </div>`;
    room.appendChild(section);
  }

  if (!document.getElementById('receipt-archive-screen')) {
    const section = document.createElement('section');
    section.id = 'receipt-archive-screen';
    section.setAttribute('aria-label', 'Stories from previous customers');
    section.innerHTML = `
      <div id="receipt-archive-bg-dim"></div>
      <header id="receipt-archive-header">
        <div id="receipt-archive-title">SAME ORDER,<br>DIFFERENT STORIES.</div>
        <div id="receipt-archive-instruction">Click on a receipt to read their story.</div>
      </header>
      <canvas id="receipt-network-canvas" width="1920" height="1080" aria-hidden="true"></canvas>
      <div id="receipt-cloud"></div>
      <div id="receipt-detail-modal" role="dialog" aria-modal="true" aria-label="Customer receipt">
        <div id="receipt-detail-card">
          <div id="receipt-detail-content"></div>
          <div id="receipt-detail-close">Click anywhere to close.</div>
        </div>
      </div>
      <div id="receipt-final-message">
        <p>Different people.<br>Different paths.<br>Somehow, the same kind of feeling<br>
        always finds its way here.<br><br>You're not alone.</p>
      </div>`;
    room.appendChild(section);
  }

  if (!document.getElementById('user-receipt-screen')) {
    const section = document.createElement('section');
    section.id = 'user-receipt-screen';
    section.setAttribute('aria-label', 'Write your own receipt');
    section.innerHTML = `
      <div id="user-receipt-card">
        <div class="receipt-top-title">MIDNIGHT DINER</div>
        <div class="receipt-id-line">#257</div>
        <div class="receipt-time-line">2:13 AM</div>
        <div class="receipt-dish-line" id="user-receipt-dish">ODEN</div>
        <hr>
        <div id="user-receipt-prompt">Now it's your turn.</div>
        <label class="receipt-input-label" for="user-receipt-input">Leave a message for the next person.</label>
        <textarea id="user-receipt-input" maxlength="500" placeholder="Write your story here..."></textarea>
        <div id="user-receipt-actions">
          <button type="button" id="save-user-receipt">Save message</button>
          <button type="button" id="skip-user-receipt">Skip</button>
        </div>
      </div>`;
    room.appendChild(section);
  }
}

/* The archive HTML can be JS-generated or pre-existing in index.html.
   Build any missing sections so partial older HTML works too. */
function dinerRepairReceiptMarkup() {
  const room = document.getElementById('interior-scene');
  const archive = document.getElementById('receipt-archive-screen');
  if (!room || !archive) return;
  if (!archive.querySelector('#receipt-cloud')) {
    const cloud = document.createElement('div');
    cloud.id = 'receipt-cloud';
    archive.appendChild(cloud);
  }
  if (!archive.querySelector('#receipt-final-message')) {
    const final = document.createElement('div');
    final.id = 'receipt-final-message';
    final.setAttribute('aria-hidden','true');
    const message = document.createElement('p');
    message.innerHTML = 'Different people.<br>Different paths.<br>' +
      'Somehow, the same kind of feeling<br>always finds its way here.' +
      '<br><br>You\'re not alone.';
    final.appendChild(message);
    archive.appendChild(final);
  }
  if (!document.getElementById('user-receipt-screen')) {
    const writer = document.createElement('section');
    writer.id = 'user-receipt-screen';
    writer.innerHTML = `<div id="user-receipt-card">
      <div class="receipt-top-title">MIDNIGHT DINER</div>
      <div class="receipt-id-line">#257</div>
      <div class="receipt-time-line">2:13 AM</div>
      <div class="receipt-dish-line" id="user-receipt-dish"></div><hr>
      <div id="user-receipt-prompt">Now it's your turn.</div>
      <label class="receipt-input-label" for="user-receipt-input">Leave a message for the next person.</label>
      <textarea id="user-receipt-input" maxlength="500" placeholder="Write your story here..."></textarea>
      <div id="user-receipt-actions">
        <button type="button" id="save-user-receipt">Save message</button>
        <button type="button" id="skip-user-receipt">Skip</button>
      </div></div>`;
    room.appendChild(writer);
  }
}

function dinerSetupReceiptArchive() {
  dinerEnsureReceiptHTML();
  // If an earlier HTML copy contains only part of the archive markup,
  // repair missing final/writer sections rather than silently stalling.
  dinerRepairReceiptMarkup();
  dinerEnsureReceiptLightLayer();
  const yes = document.getElementById('pay-yes');
  const no = document.getElementById('pay-no');
  const modal = document.getElementById('receipt-detail-modal');
  const save = document.getElementById('save-user-receipt');
  const skip = document.getElementById('skip-user-receipt');
  const messageInput = document.getElementById('user-receipt-input');
  if (messageInput) {
    // Space, Enter, arrows and Delete edit the receipt, not the diner scene.
    // Crucially, DON'T preventDefault: the browser must insert the characters.
    messageInput.addEventListener('keydown', (event) => event.stopPropagation());
    messageInput.addEventListener('keyup', (event) => event.stopPropagation());
  }
  if (yes) yes.addEventListener('click', dinerBeginReceiptArchive);
  if (no) no.addEventListener('click', () => {
    const text = document.getElementById('pay-dialogue-text');
    if (text) text.textContent = "Take your time. I'll be here.";
  });
  if (modal) {
    // Close only when the visitor clicks OUTSIDE the receipt, or its
    // explicit close instruction. Clicking its message must not advance.
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('#receipt-detail-close')) {
        dinerCloseReceiptDetail();
      }
    });
    const closeHint = document.getElementById('receipt-detail-close');
    if (closeHint) {
      closeHint.textContent = 'Click outside this receipt to close.';
      closeHint.style.pointerEvents = 'auto';
      closeHint.style.cursor = 'pointer';
      closeHint.setAttribute('role', 'button');
      closeHint.setAttribute('tabindex', '0');
      closeHint.setAttribute('aria-label', 'Close this receipt');
      closeHint.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          dinerCloseReceiptDetail();
        }
      });
    }
  }
  if (save) save.addEventListener('click', dinerSaveOwnReceipt);
  if (skip) skip.addEventListener('click', () => dinerFinishOwnReceipt(false));
}

// All earlier setup extensions, menus, dialogue and p5 animations still run.
const dinerSetupBeforeReceipts = setup;
setup = function () {
  dinerSetupBeforeReceipts();
  dinerSetupReceiptArchive();
};

/* =========================================================
   LAST BITE -> READY TO PAY
   ========================================================= */
function dinerShowReadyToPay() {
  if (dinerEatingState.count !== DINER_EATING_MAX_BITES ||
      dinerReceiptArchive.started || dinerReceiptArchive.step !== 'waiting') return;
  const overlay = document.getElementById('pay-overlay');
  if (!overlay) return;
  const hint = document.getElementById('dish-eating-hint');
  if (hint) hint.classList.remove('show');
  document.getElementById('pay-dialogue-text').textContent = 'Ready to pay?';
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
}

function dinerBeginReceiptArchive() {
  const archive = dinerReceiptArchive;
  if (archive.started || dinerEatingState.count !== DINER_EATING_MAX_BITES) return;
  archive.started = true;
  archive.step = 'intro';
  const text = document.getElementById('pay-dialogue-text');
  const buttons = document.getElementById('pay-buttons');
  if (buttons) buttons.classList.add('hidden');
  if (text) text.textContent = 'Sure. But before you go...';
  dinerReceiptAfter(() => {
    if (text) text.textContent = "You weren't the first person to order that.";
  }, 1100);
  dinerReceiptAfter(dinerOpenReceiptArchive, 3000);
}

/* =========================================================
   CREATE FLOATING RECEIPTS — SAME DISH ONLY
   ========================================================= */
function dinerLocallySavedReceipts() {
  try {
    const saved = JSON.parse(localStorage.getItem(dinerReceiptArchive.localKey) || '[]');
    return Array.isArray(saved)
      ? saved.filter(r => r && r.dish === selectedDish &&
        typeof r.message === 'string' && r.message.length <= 500).slice(-3)
      : [];
  } catch (error) {
    return [];
  }
}

function dinerAddArchiveReceipt(story, index, options = {}) {
  const archive = dinerReceiptArchive;
  const cloud = document.getElementById('receipt-cloud');
  if (!cloud) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'receipt-node';
  button.setAttribute('aria-label', `Read receipt ${story.id}, ${DISH_REVEAL_DATA_NEW[selectedDish].name}`);
  button.innerHTML = `
    <span class="r-title">MIDNIGHT DINER</span>
    <span class="r-id"></span>
    <span class="r-time"></span>
    <span class="r-dish"></span>
    <span class="r-illustration" aria-hidden="true">✺</span>
    <span class="r-preview">Click to read</span>
    <span class="r-end">THANK YOU</span>`;
  button.querySelector('.r-id').textContent = story.id;
  button.querySelector('.r-time').textContent = story.time;
  button.querySelector('.r-dish').textContent = DISH_REVEAL_DATA_NEW[selectedDish].name;
  const position = DINER_RECEIPT_POSITIONS[index % DINER_RECEIPT_POSITIONS.length];
  const node = {
    story, element: button, id: String(story.id) + '-' + index,
    baseX: position[0], baseY: position[1], x: position[0], y: position[1],
    phase: index * 1.71 + 0.6, speed: 0.23 + (index % 3) * 0.06,
    radiusX: 18 + (index % 3) * 12, radiusY: 17 + (index % 2) * 11,
    hovered: false, read: !!options.read, joined: !!options.joined
  };
  if (node.read) button.classList.add('read');
  if (node.joined) button.classList.add('joined');
  button.addEventListener('mouseenter', () => { node.hovered = true; });
  button.addEventListener('mouseleave', () => { node.hovered = false; });
  button.addEventListener('focus', () => { node.hovered = true; });
  button.addEventListener('blur', () => { node.hovered = false; });
  button.addEventListener('click', () => dinerOpenReceiptDetail(node));
  cloud.appendChild(button);
  archive.nodes.push(node);
  return node;
}

function dinerOpenReceiptArchive() {
  const archive = dinerReceiptArchive;
  if (archive.active) return;
  archive.active = true;
  archive.step = 'archive';
  const pay = document.getElementById('pay-overlay');
  const screen = document.getElementById('receipt-archive-screen');
  const cloud = document.getElementById('receipt-cloud');
  if (!screen || !cloud) return;
  // A fresh archive must never inherit the previous final-message blackout.
  screen.classList.remove('final-message-mode');
  // Reset any inline light-hiding rules if a new archive is opened.
  dinerSetReceiptNetworkVisibility(true);
  cloud.replaceChildren();
  archive.nodes = [];
  archive.readIds.clear();
  const stories = [...(DINER_RECEIPT_STORIES[selectedDish] || []), ...dinerLocallySavedReceipts()];
  stories.forEach((story, index) => dinerAddArchiveReceipt(story, index));
  const instruction = document.getElementById('receipt-archive-instruction');
  if (instruction) instruction.textContent = 'Click on a receipt to read their story.';
  screen.classList.add('show');
  screen.setAttribute('aria-hidden', 'false');
  if (pay) pay.classList.remove('show');
  // The old dining scene can fade away underneath the new archive.
  const dish = document.getElementById('dish-reveal-screen');
  if (dish) dish.classList.remove('show');
  archive.startedAt = performance.now();
  // Exactly one continuous animation loop throughout archive / final /
  // writing / joined. Never stop it just because a receipt opens on top.
  dinerEnsureReceiptNetworkRunning();
}

/* =========================================================
   GENERATIVE FLOAT + VISIBLE CONNECTING THREADS

   The old network used dim lines from the CENTRES of the receipts:
   most of its light was underneath the paper and almost impossible
   to see. This version attaches the lines to the OUTER paper edges,
   draws bright nodes on those edges, and sends little sparks down the
   curves right from the first frame (not only after reading a story).
   ========================================================= */

function dinerReceiptEdgePoint(from, to, paperWidth = 174, paperHeight = 255) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  // A 13px offset keeps the glowing node in front of the dark background,
  // beyond the receipt's actual edge, where it cannot be hidden by paper.
  const limitX = (paperWidth / 2 + 13) / Math.max(Math.abs(ux), 0.0001);
  const limitY = (paperHeight / 2 + 13) / Math.max(Math.abs(uy), 0.0001);
  const advance = Math.min(limitX, limitY);
  return { x: from.x + ux * advance, y: from.y + uy * advance };
}

function dinerReceiptThreadPoint(a, control, b, u) {
  const v = 1 - u;
  return {
    x: v * v * a.x + 2 * v * u * control.x + u * u * b.x,
    y: v * v * a.y + 2 * v * u * control.y + u * u * b.y
  };
}

function dinerReceiptConnectionPairs(nodes) {
  const count = nodes.length;
  if (count < 2) return [];

  // The five illustrated stories form a ring with two shared threads.
  // This keeps the constellation legible rather than drawing every
  // possible pair and creating a mess of lines.
  const pairs = count >= 5
    ? [[0,1], [1,2], [2,4], [4,3], [3,0], [0,4], [1,3]]
    : Array.from({length: count - 1}, (_, i) => [i, i+1]);

  // When a visitor / stored message joins in the middle, connect it to
  // its three nearest existing stories. Each extra receipt adds threads.
  for (let i = 5; i < count; i++) {
    const nearest = [];
    for (let j = 0; j < i; j++) {
      nearest.push({
        j,
        d: Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      });
    }
    nearest.sort((a, b) => a.d - b.d);
    nearest.slice(0, 3).forEach(({j}) => pairs.push([i, j]));
  }
  return pairs;
}

/* =========================================================
   PERSISTENT RECEIPT LIGHT CONSTELLATION — SVG LAYER
   The p5/cooking canvas is no longer used for receipt connections.
   The SVG remains active during archive, reading, final message,
   writing a receipt, and after the user's receipt joins the archive.
   ========================================================= */

const DINER_RECEIPT_SVG_NS = 'http://www.w3.org/2000/svg';

function dinerReceiptSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(DINER_RECEIPT_SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function dinerEnsureReceiptLightLayer() {
  const screen = document.getElementById('receipt-archive-screen');
  if (!screen) return null;
  let svg = document.getElementById('receipt-network-svg');
  if (svg) return svg;

  svg = dinerReceiptSvgElement('svg', {
    id: 'receipt-network-svg', viewBox: '0 0 1920 1080',
    width: BASE_W, height: BASE_H,
    preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false'
  });
  svg.innerHTML = `
    <defs>
      <radialGradient id="diner-receipt-light-halo">
        <stop offset="0%" stop-color="#fff8dd" stop-opacity="1" />
        <stop offset="18%" stop-color="#ffd28e" stop-opacity=".82" />
        <stop offset="52%" stop-color="#ffb66e" stop-opacity=".26" />
        <stop offset="100%" stop-color="#ffb66e" stop-opacity="0" />
      </radialGradient>
      <filter id="diner-receipt-line-glow" x="-100%" y="-250%"
              width="300%" height="600%">
        <feGaussianBlur stdDeviation="4.2" />
      </filter>
    </defs>
    <g id="receipt-network-stars"></g>
    <g id="receipt-network-lines"></g>
    <g id="receipt-network-nodes"></g>`;

  const cloud = screen.querySelector('#receipt-cloud');
  screen.insertBefore(svg, cloud || null);
  const stars = svg.querySelector('#receipt-network-stars');
  for (let i = 0; i < 66; i++) {
    const x = 70 + ((i * 337.37 + 89) % 1780);
    const y = 165 + ((i * 193.11 + 147) % 810);
    const star = dinerReceiptSvgElement('circle', {
      cx: x, cy: y, r: i % 8 === 0 ? 1.6 : 0.85,
      fill: '#f9d2a5', opacity: 0.24 + (i % 4) * 0.08,
      class: 'receipt-dust-star'
    });
    star.style.animationDelay = `${-(i % 7) * .47}s`;
    star.style.animationDuration = `${2.7 + (i % 5) * .65}s`;
    stars.appendChild(star);
  }
  return svg;
}

function dinerBuildReceiptSvgEdge(svg) {
  const lines = svg.querySelector('#receipt-network-lines');
  const dots = svg.querySelector('#receipt-network-nodes');
  const glow = dinerReceiptSvgElement('path', {
    class: 'receipt-thread-glow', fill: 'none'
  });
  const core = dinerReceiptSvgElement('path', {
    class: 'receipt-thread-core', fill: 'none'
  });
  lines.append(glow, core);

  function makeLight(kind, haloR, coreR) {
    const halo = dinerReceiptSvgElement('circle', {
      r: haloR, fill: 'url(#diner-receipt-light-halo)',
      class: `receipt-${kind}-halo`
    });
    const dot = dinerReceiptSvgElement('circle', {
      r: coreR, class: `receipt-${kind}-light`
    });
    dots.append(halo, dot);
    return {halo, dot};
  }
  return {
    glow, core,
    terminals: [makeLight('node', 26, 4.4), makeLight('node', 26, 4.4)],
    sparks: [makeLight('spark', 16, 3), makeLight('spark', 16, 3)]
  };
}

function dinerEnsureReceiptSvgEdges(svg, pairs) {
  const archive = dinerReceiptArchive;
  if (!archive.svgEdges || archive.svgEdges.length !== pairs.length) {
    svg.querySelector('#receipt-network-lines').replaceChildren();
    svg.querySelector('#receipt-network-nodes').replaceChildren();
    archive.svgEdges = pairs.map(() => dinerBuildReceiptSvgEdge(svg));
  }
}

function dinerReceiptPlaceLight(el, x, y, alpha, radius) {
  el.setAttribute('cx', x.toFixed(2));
  el.setAttribute('cy', y.toFixed(2));
  el.setAttribute('opacity', Math.max(.1, Math.min(1, alpha)).toFixed(3));
  if (radius != null) el.setAttribute('r', radius.toFixed(2));
}

function dinerEnsureReceiptNetworkRunning() {
  const archive = dinerReceiptArchive;
  const screen = document.getElementById('receipt-archive-screen');
  // During the farewell transition the archive must stay hidden. Earlier,
  // this animation loop put "show" straight back after the return function
  // removed it, leaving the archive over the restaurant forever.
  if (!archive.active || !screen ||
      archive.step === 'returning' || archive.step === 'farewell') return;
  screen.classList.add('show');
  // No need to redraw an invisible network behind the final words.
  // The animation automatically resumes when the writer is shown.
  if (archive.step === 'final' || archive.step === 'final-pending') return;
  dinerEnsureReceiptLightLayer();
  if (archive.frame == null) {
    archive.frame = requestAnimationFrame(dinerDrawReceiptNetwork);
  }
}

function dinerDrawReceiptNetwork(now) {
  const archive = dinerReceiptArchive;
  archive.frame = null;
  if (!archive.active || archive.step === 'final' ||
      archive.step === 'final-pending' || archive.step === 'returning' ||
      archive.step === 'farewell') return;
  const svg = dinerEnsureReceiptLightLayer();
  if (!svg) return;
  const t = (now - archive.startedAt) / 1000;

  // Preserve each floating receipt's existing animation and hover response.
  for (const node of archive.nodes) {
    const motion = node.hovered ? .12 : 1;
    node.x = node.baseX + Math.sin(t * node.speed + node.phase) * node.radiusX * motion;
    node.y = node.baseY + Math.cos(t * node.speed * .83 + node.phase) * node.radiusY * motion;
    const rotation = Math.sin(t * node.speed * .52 + node.phase) *
      (node.hovered ? .35 : 3.4);
    node.element.style.left = `${node.x}px`;
    node.element.style.top = `${node.y}px`;
    node.element.style.transform =
      `translate(-50%, -50%) rotate(${rotation}deg) scale(${node.hovered ? 1.07 : 1})`;
  }

  const pairs = dinerReceiptConnectionPairs(archive.nodes);
  dinerEnsureReceiptSvgEdges(svg, pairs);
  for (let k = 0; k < pairs.length; k++) {
    const [i, j] = pairs[k];
    const from = archive.nodes[i];
    const to = archive.nodes[j];
    const edge = archive.svgEdges[k];
    if (!from || !to || !edge) continue;

    // Connect OUTSIDE the paper to prevent the cards covering the light dots.
    const a = dinerReceiptEdgePoint(from, to);
    const b = dinerReceiptEdgePoint(to, from);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const bend = (k % 3 - 1) * 18 + Math.sin(t * .37 + k * 1.3) * 8;
    const c = {
      x: (a.x + b.x) / 2 - dy / dist * bend,
      y: (a.y + b.y) / 2 + dx / dist * bend
    };
    const path = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} ` +
      `Q ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    edge.glow.setAttribute('d', path);
    edge.core.setAttribute('d', path);

    // A hovered/focused receipt highlights only its own connected threads.
    const highlighted = from.hovered || to.hovered ||
      archive.selected === from || archive.selected === to ||
      (archive.step === 'writing' && (from.joined || to.joined));
    const pulse = (1 + Math.sin(t * 2.5 + k * 1.61)) / 2;
    const brightness = highlighted ? .91 + .09 * pulse : .72 + .19 * pulse;
    edge.core.setAttribute('stroke-opacity', brightness.toFixed(3));
    edge.core.setAttribute('stroke-width', highlighted ? '3.7' : '2.1');
    edge.glow.setAttribute('stroke-opacity', highlighted ? '.95' :
      (.68 + pulse * .22).toFixed(3));
    edge.glow.setAttribute('stroke-width', highlighted ? '17' : '11');

    [a, b].forEach((p, n) => {
      const light = edge.terminals[n];
      dinerReceiptPlaceLight(light.halo, p.x, p.y,
        highlighted ? 1 : .76 + .16 * pulse, highlighted ? 37 : 26);
      dinerReceiptPlaceLight(light.dot, p.x, p.y,
        highlighted ? 1 : .86 + .14 * pulse,
        highlighted ? 6.8 + 1.5 * pulse : 4.4 + 1.1 * pulse);
    });
    edge.sparks.forEach((spark, n) => {
      const progress = (t * (.105 + n * .028) + k * .193 + n * .48) % 1;
      const p = dinerReceiptThreadPoint(a, c, b, progress);
      dinerReceiptPlaceLight(spark.halo, p.x, p.y,
        highlighted ? .97 : .72, highlighted ? 22 : 16);
      dinerReceiptPlaceLight(spark.dot, p.x, p.y,
        highlighted ? 1 : .86, highlighted ? 4.3 : 3);
    });
  }
  // This remains a single animation loop through all receipt stages.
  dinerEnsureReceiptNetworkRunning();
}

/* =========================================================
   READ A STORY — then return the receipt to the network
   ========================================================= */
function dinerOpenReceiptDetail(node) {
  const archive = dinerReceiptArchive;
  if (archive.step !== 'archive') return;
  const modal = document.getElementById('receipt-detail-modal');
  const content = document.getElementById('receipt-detail-content');
  if (!modal || !content) return;
  const story = node.story;
  dinerPlayExtraSound('paperOpen');
  const dish = DISH_REVEAL_DATA_NEW[selectedDish].name;
  content.replaceChildren();
  for (const [className, value] of [
    ['receipt-top-title', 'MIDNIGHT DINER'],
    ['receipt-id-line', story.id],
    ['receipt-time-line', story.time],
    ['receipt-dish-line', dish],
    ['receipt-detail-message', story.message],
    ['receipt-detail-thanks', 'Thank you.']
  ]) {
    const block = document.createElement('div');
    block.className = className;
    block.textContent = value; // safe for user-typed messages
    content.appendChild(block);
  }
  archive.selected = node;
  modal.classList.add('show');
  dinerEnsureReceiptNetworkRunning();
  if (!node.read) {
    node.read = true;
    node.element.classList.add('read');
    archive.readIds.add(node.id);
  }
  const instruction = document.getElementById('receipt-archive-instruction');
  if (instruction) instruction.textContent =
    archive.readIds.size >= 3
      ? 'You have read three stories. Click outside this receipt when you are ready.'
      : `Stories read: ${archive.readIds.size} / 3 · Click outside to close.`;
}

function dinerCloseReceiptDetail() {
  const archive = dinerReceiptArchive;
  const modal = document.getElementById('receipt-detail-modal');
  if (!modal || !modal.classList.contains('show')) return;
  dinerPlayExtraSound('paperClose');

  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  archive.selected = null;

  // Enter a one-way "final-pending" state as soon as the last required
  // receipt is CLOSED. This locks out new receipt clicks during the paper's
  // fade-out, so a later click cannot silently cancel the final message.
  if (archive.step === 'archive' && archive.readIds.size >= 3) {
    archive.step = 'final-pending';
    archive.finalPending = true;
    const cloud = document.getElementById('receipt-cloud');
    if (cloud) cloud.classList.add('final-locked');
    const instruction = document.getElementById('receipt-archive-instruction');
    if (instruction) instruction.textContent = 'A moment to reflect...';
    dinerReceiptAfter(dinerShowArchiveFinal, 500);
  }
}

/* =========================================================
   FINAL MESSAGE: HIDE THE ACTUAL LIGHT LAYER
   Inline !important wins over legacy CSS that forces SVG/canvas visible.
   Keep animating in the background so the constellation returns immediately
   when the visitor starts writing their receipt.
   ========================================================= */
function dinerSetReceiptNetworkVisibility(isVisible) {
  const screen = document.getElementById('receipt-archive-screen');
  if (screen) screen.classList.toggle('final-message-mode', !isVisible);
  for (const id of ['receipt-network-svg', 'receipt-network-canvas']) {
    const layer = document.getElementById(id);
    if (!layer) continue;
    // Remove old inline display:none !important from older project versions.
    layer.style.removeProperty('display');
    if (isVisible) {
      layer.style.removeProperty('opacity');
      layer.style.removeProperty('visibility');
    } else {
      layer.style.setProperty('opacity', '0', 'important');
      layer.style.setProperty('visibility', 'hidden', 'important');
    }
  }
}

function dinerShowArchiveFinal() {
  const archive = dinerReceiptArchive;
  // archive is permitted only as an explicit fallback. Normal flow arrives
  // through final-pending after closing the third DIFFERENT receipt.
  if (archive.step !== 'final-pending' && archive.step !== 'archive') return;
  archive.step = 'final';
  archive.finalPending = true;

  const finalMessage = document.getElementById('receipt-final-message');
  const cloud = document.getElementById('receipt-cloud');
  const modal = document.getElementById('receipt-detail-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
  archive.selected = null;

  // First hide papers and ALL ambient receipt lights. The words appear
  // after the outgoing receipt has finished fading, never behind paper/dots.
  if (cloud) cloud.classList.add('under-final', 'final-locked');
  dinerSetReceiptNetworkVisibility(false);
  dinerEnsureReceiptNetworkRunning();

  dinerReceiptAfter(() => {
    if (archive.step === 'final' && finalMessage) {
      finalMessage.classList.add('show');
      finalMessage.setAttribute('aria-hidden', 'false');
    }
  }, 950);

  // This sequence does not depend on any further click, SVG animation or
  // a successful CSS transition. It always continues to the write screen.
  dinerReceiptAfter(() => {
    if (archive.step !== 'final') return;
    if (finalMessage) {
      finalMessage.classList.remove('show');
      finalMessage.setAttribute('aria-hidden', 'true');
    }
    dinerReceiptAfter(() => {
      if (archive.step !== 'final') return;
      if (cloud) cloud.classList.remove('under-final', 'final-locked');
      dinerShowOwnReceipt();
    }, 950);
  }, 6200);
}

/* =========================================================
   WRITE YOUR OWN STORY
   ========================================================= */
function dinerShowOwnReceipt() {
  const archive = dinerReceiptArchive;
  archive.step = 'writing';
  // The reflective message has faded away. Bring the light connections
  // back for the visitor's receipt and keep them through its joining.
  document.getElementById('receipt-archive-screen')
    ?.classList.remove('final-message-mode');
  // Restore the lights only AFTER the final words have faded away.
  dinerSetReceiptNetworkVisibility(true);
  document.getElementById('receipt-cloud')?.classList.remove('under-final', 'final-locked');
  const screen = document.getElementById('user-receipt-screen');
  const name = document.getElementById('user-receipt-dish');
  const input = document.getElementById('user-receipt-input');
  if (name) name.textContent = DISH_REVEAL_DATA_NEW[selectedDish].name;
  if (input) input.value = '';
  if (screen) {
    screen.classList.add('show');
    screen.setAttribute('aria-hidden', 'false');
  }
  dinerEnsureReceiptNetworkRunning();
  if (input) dinerReceiptAfter(() => input.focus(), 650);
}

function dinerSaveOwnReceipt() {
  const archive = dinerReceiptArchive;
  if (archive.step !== 'writing' || archive.written) return;
  const input = document.getElementById('user-receipt-input');
  const message = input ? input.value.trim() : '';
  if (!message) {
    if (input) {
      input.placeholder = 'Please write a message, or choose Skip.';
      input.focus();
    }
    return;
  }
  archive.written = true;
  dinerPlayExtraSound('paperSave');
  const saved = {
    id: '#' + String(257 + Math.floor(Math.random() * 700)).padStart(3, '0'),
    time: 'NOW', dish: selectedDish, message: message.slice(0, 500)
  };
  try {
    const stored = JSON.parse(localStorage.getItem(archive.localKey) || '[]');
    const all = Array.isArray(stored) ? stored : [];
    all.push(saved);
    localStorage.setItem(archive.localKey, JSON.stringify(all.slice(-25)));
  } catch (error) {
    // Browser storage may be blocked. Keep the new receipt for this session.
    console.info('Midnight Diner: local storage unavailable; receipt remains in this session.');
  }
  dinerFinishOwnReceipt(true, saved);
}

function dinerFinishOwnReceipt(didSave, saved = null) {
  const archive = dinerReceiptArchive;
  if (archive.step !== 'writing') return;
  archive.step = 'joined';
  const writingScreen = document.getElementById('user-receipt-screen');
  const instruction = document.getElementById('receipt-archive-instruction');
  if (writingScreen) {
    writingScreen.classList.remove('show');
    writingScreen.setAttribute('aria-hidden', 'true');
  }
  if (didSave && saved) {
    const node = dinerAddArchiveReceipt(saved, archive.nodes.length, { read: true, joined: true });
    if (node) {
      node.baseX = 960;
      node.baseY = 590;
      node.x = node.baseX;
      node.y = node.baseY;
      node.phase = 0.8;
    }
    if (instruction) instruction.textContent = 'A new thread, for whoever comes next.';
  } else {
    if (instruction) instruction.textContent = 'Thank you for visiting. Come again whenever you like.';
  }
  const lastMessage = document.createElement('p');
  lastMessage.className = 'receipt-joined-message';
  lastMessage.textContent = didSave
    ? 'Your story has joined the others. Different people. Same order.'
    : 'You can leave the page without leaving a story. Thank you for coming.';
  const screen = document.getElementById('receipt-archive-screen');
  if (screen) screen.appendChild(lastMessage);
  dinerEnsureReceiptNetworkRunning();
  dinerReceiptAfter(() => lastMessage.classList.add('show'), 180);
  // Let the visitor see their receipt connect to everyone else's first.
  // Then return to the original restaurant for the owner's goodbye.
  dinerReceiptAfter(() => dinerReturnToRestaurant(didSave), 5100);
}

/* =========================================================
   COOKING — RESTORED SMOKE AS ITS OWN 1920 x 1080 LAYER
   The previous smoke used the main p5 canvas, which can be hidden or
   moved by the later dish-reveal styling. This dedicated transparent
   canvas sits above the cooking background and cannot be mistaken for
   the eating canvas or the SVG receipt network.
   ========================================================= */
let dinerSmokeLayer = null;
let dinerSmokeFrame = null;
let dinerSmokeParticles = [];

function dinerStopCookingSmokeLayer() {
  if (dinerSmokeFrame !== null) cancelAnimationFrame(dinerSmokeFrame);
  dinerSmokeFrame = null;
  if (dinerSmokeLayer) dinerSmokeLayer.remove();
  dinerSmokeLayer = null;
  dinerSmokeParticles = [];
}

function dinerStartCookingSmokeLayer() {
  dinerStopCookingSmokeLayer();
  const room = document.getElementById('interior-scene');
  if (!room) return;
  const layer = document.createElement('canvas');
  layer.id = 'diner-cooking-smoke-layer';
  layer.width = BASE_W;
  layer.height = BASE_H;
  layer.setAttribute('aria-hidden', 'true');
  room.appendChild(layer);
  dinerSmokeLayer = layer;
  const ctx = layer.getContext('2d');
  if (!ctx) return;

  function newParticle(anywhere = false) {
    return {
      x: 565 + Math.random() * 780,
      y: anywhere ? 280 + Math.random() * 430 : 570 + Math.random() * 135,
      vx: -.36 + Math.random() * .72,
      vy: -.55 - Math.random() * 1.06,
      r: 19 + Math.random() * 39,
      age: anywhere ? Math.random() * 155 : 0,
      maxAge: 165 + Math.random() * 115,
      phase: Math.random() * Math.PI * 2
    };
  }
  dinerSmokeParticles = Array.from({ length: 82 }, () => newParticle(true));
  let previous = performance.now();

  function render(now) {
    if (dinerSmokeLayer !== layer || !cookingModeNew) {
      dinerStopCookingSmokeLayer();
      return;
    }
    const step = Math.min(2.2, (now - previous) / 16.67 || 1);
    previous = now;
    ctx.clearRect(0, 0, BASE_W, BASE_H);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < dinerSmokeParticles.length; i++) {
      const p = dinerSmokeParticles[i];
      const dx = p.x - smokeMouseXNew;
      const dy = p.y - smokeMouseYNew;
      const distance = Math.hypot(dx, dy);
      if (smokeMouseInsideSceneNew && distance < 170 && distance > 1) {
        const influence = (170 - distance) / 170;
        p.x += dx / distance * influence * 5 * step;
        p.y += dy / distance * influence * 3 * step;
      }
      p.x += (p.vx + Math.sin(now * .0009 + p.phase) * .32) * step;
      p.y += p.vy * step;
      p.age += step;
      p.r += .065 * step;
      const progress = p.age / p.maxAge;
      if (progress >= 1 || p.y < 200) {
        dinerSmokeParticles[i] = newParticle();
        continue;
      }
      const fade = Math.pow(Math.sin(Math.PI * progress), .65);
      const r = p.r * (1 + progress * .85);
      const gradient = ctx.createRadialGradient(p.x, p.y, r * .08, p.x, p.y, r * 1.8);
      gradient.addColorStop(0, `rgba(255,248,228,${(.22 * fade).toFixed(3)})`);
      gradient.addColorStop(.38, `rgba(244,232,213,${(.11 * fade).toFixed(3)})`);
      gradient.addColorStop(1, 'rgba(244,232,213,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    dinerSmokeFrame = requestAnimationFrame(render);
  }
  dinerSmokeFrame = requestAnimationFrame(render);
}

/* =========================================================
   FAREWELL — RETURN FROM RECEIPT ARCHIVE TO RESTAURANT
   ========================================================= */
function dinerReturnToRestaurant(didSave) {
  const archive = dinerReceiptArchive;
  if (archive.step !== 'joined') return;
  archive.step = 'returning';

  // Stop and cancel the constellation BEFORE hiding the archive. Otherwise
  // its next animation frame immediately re-adds the "show" class and masks
  // the restaurant / farewell dialogue beneath it.
  archive.active = false;
  if (archive.frame !== null) cancelAnimationFrame(archive.frame);
  archive.frame = null;

  document.getElementById('receipt-archive-screen')?.classList.remove('show');
  document.getElementById('user-receipt-screen')?.classList.remove('show');
  document.getElementById('pay-overlay')?.classList.remove('show');
  document.getElementById('dish-reveal-screen')?.classList.remove('show');

  dinerReceiptAfter(() => {
    // Defensive cleanup if another handler changed the archive while fading.
    document.getElementById('receipt-archive-screen')?.classList.remove('show');
    document.getElementById('user-receipt-screen')?.classList.remove('show');
    archive.step = 'farewell';
    archive.selected = null;

    // Once the diner reappears after the visitor's receipt/message (or Skip),
    // gently fade the INDOOR restaurant ambience to silence. Do not fade any
    // other SFX or change the user's persistent sound-toggle preference.
    const farewellRoomAmbience = dinerExtraSoundCache.restaurant;
    if (farewellRoomAmbience) {
      fadeAudio(farewellRoomAmbience, 0, 3000);
      setTimeout(() => {
        try {
          farewellRoomAmbience.pause();
          farewellRoomAmbience.currentTime = 0;
          farewellRoomAmbience.volume = 0;
        } catch (error) {}
      }, 3100);
    }

    // The restaurant is ready behind the fading archive. No smoke or
    // dish reveal overlays should cover the owner's last conversation.
    const room = document.getElementById('interior-scene');
    const kitchen = document.getElementById('cooking-background');
    const background = document.getElementById('interior-bg');
    const owner = document.getElementById('owner-character');
    const dialogue = document.getElementById('dialogue-box');
    const text = document.getElementById('dialogue-text');
    const speaker = document.getElementById('dialogue-speaker');
    dinerStopCookingSmokeLayer();
    dinerStopExtraSound('steam');
    cookingModeNew = false;
    if (kitchen) { kitchen.classList.remove('active'); kitchen.style.visibility = 'hidden'; }
    if (background) { background.classList.remove('cooking-hidden'); background.style.opacity = '1'; }
    if (owner) { owner.classList.remove('cooking-hidden'); owner.style.opacity = '1'; }
    if (room) room.classList.add('active', 'diner-farewell-room');
    dialogueTyping = false;
    waitingDialogueTypingNew = false;
    postSelectionDialogueActiveNew = false;
    if (speaker) speaker.textContent = 'OWNER';
    if (text) {
      text.textContent = didSave
        ? "Thank you for leaving a little piece of your story here. It'll be waiting for someone who needs it. Come by again whenever you like."
        : "No need to leave anything behind. I'm glad you stopped by tonight. Come by again whenever you like.";
    }
    if (dialogue) {
      dialogue.classList.remove('hide', 'cooking-prompt-mode');
      dialogue.classList.add('show', 'diner-farewell');
      let restart = document.getElementById('diner-restart-button');
      if (!restart) {
        restart = document.createElement('button');
        restart.id = 'diner-restart-button';
        restart.type = 'button';
        restart.textContent = 'Restart journey ↻';
        restart.addEventListener('click', (event) => {
          event.stopPropagation();
          window.location.reload();
        });
        dialogue.appendChild(restart);
      }
    }
  }, 1100);
}

// Let Space and Enter activate the restart button normally.
const dinerHandleKeyboardBeforeFarewell = handleKeyboard;
handleKeyboard = function(event) {
  // Never let Space/Enter advance the original owner dialogue while a
  // receipt is open, or consume Space/Enter inside the message textarea.
  if (dinerKeyboardTargetIsEditable(event)) return;
  if (dinerReceiptArchive.started && dinerReceiptArchive.step !== 'waiting') return;
  dinerHandleKeyboardBeforeFarewell(event);
};

/* =========================================================
   SOUND ON / OFF — PERSISTENT CORNER BUTTON (JS-ONLY)

   This changes the muted flag rather than changing .volume or pausing.
   Existing fades, the entrance bell, and the restaurant ambience retain
   their intended timing. No HTML/CSS edits are required.
   ========================================================= */
const DINER_SOUND_STORAGE_KEY = 'midnight-diner-sound-muted';
let dinerSoundMuted = false;
try {
  dinerSoundMuted = window.localStorage.getItem(DINER_SOUND_STORAGE_KEY) === 'true';
} catch (error) {
  // Private browsing / disabled storage: the button still works this visit.
}

function dinerSoundSources() {
  const sources = new Set(document.querySelectorAll('audio'));
  for (const audio of Object.values(dinerExtraSoundCache)) {
    if (audio) sources.add(audio);
  }
  // Include the two fallback new Audio(...) instances that are NOT in HTML.
  for (const audio of [
    ambienceAudio, windAudio, bellAudio, cookingAudioNew, utensilAudioNew
  ]) {
    if (audio) sources.add(audio);
  }
  return sources;
}

function dinerSyncSoundPreference() {
  for (const audio of dinerSoundSources()) {
    try { audio.muted = dinerSoundMuted; } catch (error) {}
  }
}

function dinerUpdateSoundButton() {
  const button = document.getElementById('diner-sound-toggle');
  if (!button) return;
  button.textContent = dinerSoundMuted ? '🔇' : '🔊';
  button.setAttribute('aria-pressed', String(dinerSoundMuted));
  button.setAttribute('aria-label', dinerSoundMuted ? 'Bật âm thanh' : 'Tắt âm thanh');
  button.title = dinerSoundMuted ? 'Bật âm thanh' : 'Tắt âm thanh';
}

function dinerSetSoundMuted(muted) {
  dinerSoundMuted = Boolean(muted);
  try {
    window.localStorage.setItem(DINER_SOUND_STORAGE_KEY, String(dinerSoundMuted));
  } catch (error) {}
  dinerSyncSoundPreference();
  dinerUpdateSoundButton();
}

function dinerEnsureSoundButton() {
  if (!document.body || document.getElementById('diner-sound-toggle')) return;

  if (!document.getElementById('diner-sound-toggle-styles')) {
    const styles = document.createElement('style');
    styles.id = 'diner-sound-toggle-styles';
    styles.textContent = `
      #diner-sound-toggle {
        position: fixed !important;
        top: max(14px, env(safe-area-inset-top)) !important;
        right: max(14px, env(safe-area-inset-right)) !important;
        width: 46px !important;
        height: 46px !important;
        padding: 0 !important;
        display: grid !important;
        place-items: center !important;
        z-index: 2147483647 !important;
        border: 1px solid rgba(235,191,140,.52) !important;
        border-radius: 50% !important;
        background: rgba(28,15,11,.83) !important;
        color: #f8e2c2 !important;
        box-shadow: 0 4px 16px rgba(0,0,0,.3) !important;
        font: 20px/1 Arial, sans-serif !important;
        cursor: pointer !important;
        user-select: none !important;
        pointer-events: auto !important;
        -webkit-tap-highlight-color: transparent;
        transition: background .2s ease, border-color .2s ease, transform .2s ease;
      }
      #diner-sound-toggle:hover {
        background: rgba(77,43,26,.95) !important;
        border-color: rgba(245,208,159,.95) !important;
        transform: scale(1.05);
      }
      #diner-sound-toggle:focus-visible {
        outline: 2px solid #f5d09d !important;
        outline-offset: 3px !important;
      }
    `;
    document.head.appendChild(styles);
  }

  const button = document.createElement('button');
  button.id = 'diner-sound-toggle';
  button.type = 'button';
  // The user's first click on this UI should not advance game dialogue.
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    dinerSetSoundMuted(!dinerSoundMuted);
  });
  button.addEventListener('keydown', (event) => event.stopPropagation());
  document.body.appendChild(button); // Outside the scaled 1920x1080 scene.
  dinerUpdateSoundButton();
  dinerSyncSoundPreference();
}

// p5 creates fallback kitchen Audio objects during setup; sync them afterward.
const dinerSetupBeforeSoundButton = setup;
setup = function (...args) {
  const result = dinerSetupBeforeSoundButton.apply(this, args);
  dinerEnsureSoundButton();
  dinerSyncSoundPreference();
  return result;
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', dinerEnsureSoundButton, { once: true });
} else {
  dinerEnsureSoundButton();
}