/**
 * Touch Typing Finger Mapping & Key Metadata
 * Standard ANSI QWERTY layout with opposite-shift coordination
 */

export const FINGERS = {
  LP: { id: 'LP', hand: 'left', name: 'Left Pinky', shortName: 'L. Pinky', color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)', homeKey: 'a' },
  LR: { id: 'LR', hand: 'left', name: 'Left Ring', shortName: 'L. Ring', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.45)', homeKey: 's' },
  LM: { id: 'LM', hand: 'left', name: 'Left Middle', shortName: 'L. Middle', color: '#84cc16', glow: 'rgba(132, 204, 22, 0.45)', homeKey: 'd' },
  LI: { id: 'LI', hand: 'left', name: 'Left Index', shortName: 'L. Index', color: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', homeKey: 'f', bump: true },
  LT: { id: 'LT', hand: 'left', name: 'Left Thumb', shortName: 'L. Thumb', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.45)', homeKey: 'Space' },
  RT: { id: 'RT', hand: 'right', name: 'Right Thumb', shortName: 'R. Thumb', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.45)', homeKey: 'Space' },
  RI: { id: 'RI', hand: 'right', name: 'Right Index', shortName: 'R. Index', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.45)', homeKey: 'j', bump: true },
  RM: { id: 'RM', hand: 'right', name: 'Right Middle', shortName: 'R. Middle', color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.45)', homeKey: 'k' },
  RR: { id: 'RR', hand: 'right', name: 'Right Ring', shortName: 'R. Ring', color: '#d946ef', glow: 'rgba(217, 70, 239, 0.45)', homeKey: 'l' },
  RP: { id: 'RP', hand: 'right', name: 'Right Pinky', shortName: 'R. Pinky', color: '#ec4899', glow: 'rgba(236, 72, 153, 0.45)', homeKey: ';' }
};

// Map each character to its primary finger, required shift finger (if any), and key ID
export const CHAR_MAP = {
  // Home row (Left)
  'a': { finger: 'LP', shift: null, keyId: 'KeyA', display: 'A' },
  'A': { finger: 'LP', shift: 'RP', keyId: 'KeyA', display: 'A' },
  's': { finger: 'LR', shift: null, keyId: 'KeyS', display: 'S' },
  'S': { finger: 'LR', shift: 'RP', keyId: 'KeyS', display: 'S' },
  'd': { finger: 'LM', shift: null, keyId: 'KeyD', display: 'D' },
  'D': { finger: 'LM', shift: 'RP', keyId: 'KeyD', display: 'D' },
  'f': { finger: 'LI', shift: null, keyId: 'KeyF', display: 'F', tip: 'Home row bump key!' },
  'F': { finger: 'LI', shift: 'RP', keyId: 'KeyF', display: 'F' },
  'g': { finger: 'LI', shift: null, keyId: 'KeyG', display: 'G' },
  'G': { finger: 'LI', shift: 'RP', keyId: 'KeyG', display: 'G' },

  // Home row (Right)
  'h': { finger: 'RI', shift: null, keyId: 'KeyH', display: 'H' },
  'H': { finger: 'RI', shift: 'LP', keyId: 'KeyH', display: 'H' },
  'j': { finger: 'RI', shift: null, keyId: 'KeyJ', display: 'J', tip: 'Home row bump key!' },
  'J': { finger: 'RI', shift: 'LP', keyId: 'KeyJ', display: 'J' },
  'k': { finger: 'RM', shift: null, keyId: 'KeyK', display: 'K' },
  'K': { finger: 'RM', shift: 'LP', keyId: 'KeyK', display: 'K' },
  'l': { finger: 'RR', shift: null, keyId: 'KeyL', display: 'L' },
  'L': { finger: 'RR', shift: 'LP', keyId: 'KeyL', display: 'L' },
  ';': { finger: 'RP', shift: null, keyId: 'Semicolon', display: ';' },
  ':': { finger: 'RP', shift: 'LP', keyId: 'Semicolon', display: ':' },
  "'": { finger: 'RP', shift: null, keyId: 'Quote', display: "'" },
  '"': { finger: 'RP', shift: 'LP', keyId: 'Quote', display: '"' },

  // Top row (Left)
  'q': { finger: 'LP', shift: null, keyId: 'KeyQ', display: 'Q' },
  'Q': { finger: 'LP', shift: 'RP', keyId: 'KeyQ', display: 'Q' },
  'w': { finger: 'LR', shift: null, keyId: 'KeyW', display: 'W' },
  'W': { finger: 'LR', shift: 'RP', keyId: 'KeyW', display: 'W' },
  'e': { finger: 'LM', shift: null, keyId: 'KeyE', display: 'E' },
  'E': { finger: 'LM', shift: 'RP', keyId: 'KeyE', display: 'E' },
  'r': { finger: 'LI', shift: null, keyId: 'KeyR', display: 'R' },
  'R': { finger: 'LI', shift: 'RP', keyId: 'KeyR', display: 'R' },
  't': { finger: 'LI', shift: null, keyId: 'KeyT', display: 'T' },
  'T': { finger: 'LI', shift: 'RP', keyId: 'KeyT', display: 'T' },

  // Top row (Right)
  'y': { finger: 'RI', shift: null, keyId: 'KeyY', display: 'Y' },
  'Y': { finger: 'RI', shift: 'LP', keyId: 'KeyY', display: 'Y' },
  'u': { finger: 'RI', shift: null, keyId: 'KeyU', display: 'U' },
  'U': { finger: 'RI', shift: 'LP', keyId: 'KeyU', display: 'U' },
  'i': { finger: 'RM', shift: null, keyId: 'KeyI', display: 'I' },
  'I': { finger: 'RM', shift: 'LP', keyId: 'KeyI', display: 'I' },
  'o': { finger: 'RR', shift: null, keyId: 'KeyO', display: 'O' },
  'O': { finger: 'RR', shift: 'LP', keyId: 'KeyO', display: 'O' },
  'p': { finger: 'RP', shift: null, keyId: 'KeyP', display: 'P' },
  'P': { finger: 'RP', shift: 'LP', keyId: 'KeyP', display: 'P' },
  '[': { finger: 'RP', shift: null, keyId: 'BracketLeft', display: '[' },
  '{': { finger: 'RP', shift: 'LP', keyId: 'BracketLeft', display: '{' },
  ']': { finger: 'RP', shift: null, keyId: 'BracketRight', display: ']' },
  '}': { finger: 'RP', shift: 'LP', keyId: 'BracketRight', display: '}' },
  '\\': { finger: 'RP', shift: null, keyId: 'Backslash', display: '\\' },
  '|': { finger: 'RP', shift: 'LP', keyId: 'Backslash', display: '|' },

  // Bottom row (Left)
  'z': { finger: 'LP', shift: null, keyId: 'KeyZ', display: 'Z' },
  'Z': { finger: 'LP', shift: 'RP', keyId: 'KeyZ', display: 'Z' },
  'x': { finger: 'LR', shift: null, keyId: 'KeyX', display: 'X' },
  'X': { finger: 'LR', shift: 'RP', keyId: 'KeyX', display: 'X' },
  'c': { finger: 'LM', shift: null, keyId: 'KeyC', display: 'C' },
  'C': { finger: 'LM', shift: 'RP', keyId: 'KeyC', display: 'C' },
  'v': { finger: 'LI', shift: null, keyId: 'KeyV', display: 'V' },
  'V': { finger: 'LI', shift: 'RP', keyId: 'KeyV', display: 'V' },
  'b': { finger: 'LI', shift: null, keyId: 'KeyB', display: 'B' },
  'B': { finger: 'LI', shift: 'RP', keyId: 'KeyB', display: 'B' },

  // Bottom row (Right)
  'n': { finger: 'RI', shift: null, keyId: 'KeyN', display: 'N' },
  'N': { finger: 'RI', shift: 'LP', keyId: 'KeyN', display: 'N' },
  'm': { finger: 'RI', shift: null, keyId: 'KeyM', display: 'M' },
  'M': { finger: 'RI', shift: 'LP', keyId: 'KeyM', display: 'M' },
  ',': { finger: 'RM', shift: null, keyId: 'Comma', display: ',' },
  '<': { finger: 'RM', shift: 'LP', keyId: 'Comma', display: '<' },
  '.': { finger: 'RR', shift: null, keyId: 'Period', display: '.' },
  '>': { finger: 'RR', shift: 'LP', keyId: 'Period', display: '>' },
  '/': { finger: 'RP', shift: null, keyId: 'Slash', display: '/' },
  '?': { finger: 'RP', shift: 'LP', keyId: 'Slash', display: '?' },

  // Number row
  '`': { finger: 'LP', shift: null, keyId: 'Backquote', display: '`' },
  '~': { finger: 'LP', shift: 'RP', keyId: 'Backquote', display: '~' },
  '1': { finger: 'LP', shift: null, keyId: 'Digit1', display: '1' },
  '!': { finger: 'LP', shift: 'RP', keyId: 'Digit1', display: '!' },
  '2': { finger: 'LR', shift: null, keyId: 'Digit2', display: '2' },
  '@': { finger: 'LR', shift: 'RP', keyId: 'Digit2', display: '@' },
  '3': { finger: 'LM', shift: null, keyId: 'Digit3', display: '3' },
  '#': { finger: 'LM', shift: 'RP', keyId: 'Digit3', display: '#' },
  '4': { finger: 'LI', shift: null, keyId: 'Digit4', display: '4' },
  '$': { finger: 'LI', shift: 'RP', keyId: 'Digit4', display: '$' },
  '5': { finger: 'LI', shift: null, keyId: 'Digit5', display: '5' },
  '%': { finger: 'LI', shift: 'RP', keyId: 'Digit5', display: '%' },
  '6': { finger: 'RI', shift: null, keyId: 'Digit6', display: '6' },
  '^': { finger: 'RI', shift: 'LP', keyId: 'Digit6', display: '^' },
  '7': { finger: 'RI', shift: null, keyId: 'Digit7', display: '7' },
  '&': { finger: 'RI', shift: 'LP', keyId: 'Digit7', display: '&' },
  '8': { finger: 'RM', shift: null, keyId: 'Digit8', display: '8' },
  '*': { finger: 'RM', shift: 'LP', keyId: 'Digit8', display: '*' },
  '9': { finger: 'RR', shift: null, keyId: 'Digit9', display: '9' },
  '(': { finger: 'RR', shift: 'LP', keyId: 'Digit9', display: '(' },
  '0': { finger: 'RP', shift: null, keyId: 'Digit0', display: '0' },
  ')': { finger: 'RP', shift: 'LP', keyId: 'Digit0', display: ')' },
  '-': { finger: 'RP', shift: null, keyId: 'Minus', display: '-' },
  '_': { finger: 'RP', shift: 'LP', keyId: 'Minus', display: '_' },
  '=': { finger: 'RP', shift: null, keyId: 'Equal', display: '=' },
  '+': { finger: 'RP', shift: 'LP', keyId: 'Equal', display: '+' },

  // Spacebar
  ' ': { finger: 'RT', shift: null, keyId: 'Space', display: 'Space', tip: 'Rest thumbs lightly on the spacebar' },
  '\n': { finger: 'RP', shift: null, keyId: 'Enter', display: 'Enter' }
};

// Keyboard Physical Layout Matrix (Rows of keys with widths & labels)
export const KEYBOARD_LAYOUT = [
  // Number row
  [
    { code: 'Backquote', label: '`', shiftLabel: '~', finger: 'LP', width: 1 },
    { code: 'Digit1', label: '1', shiftLabel: '!', finger: 'LP', width: 1 },
    { code: 'Digit2', label: '2', shiftLabel: '@', finger: 'LR', width: 1 },
    { code: 'Digit3', label: '3', shiftLabel: '#', finger: 'LM', width: 1 },
    { code: 'Digit4', label: '4', shiftLabel: '$', finger: 'LI', width: 1 },
    { code: 'Digit5', label: '5', shiftLabel: '%', finger: 'LI', width: 1 },
    { code: 'Digit6', label: '6', shiftLabel: '^', finger: 'RI', width: 1 },
    { code: 'Digit7', label: '7', shiftLabel: '&', finger: 'RI', width: 1 },
    { code: 'Digit8', label: '8', shiftLabel: '*', finger: 'RM', width: 1 },
    { code: 'Digit9', label: '9', shiftLabel: '(', finger: 'RR', width: 1 },
    { code: 'Digit0', label: '0', shiftLabel: ')', finger: 'RP', width: 1 },
    { code: 'Minus', label: '-', shiftLabel: '_', finger: 'RP', width: 1 },
    { code: 'Equal', label: '=', shiftLabel: '+', finger: 'RP', width: 1 },
    { code: 'Backspace', label: 'Backspace', finger: 'RP', width: 2, isSpecial: true }
  ],
  // Top row
  [
    { code: 'Tab', label: 'Tab', finger: 'LP', width: 1.5, isSpecial: true },
    { code: 'KeyQ', label: 'Q', finger: 'LP', width: 1 },
    { code: 'KeyW', label: 'W', finger: 'LR', width: 1 },
    { code: 'KeyE', label: 'E', finger: 'LM', width: 1 },
    { code: 'KeyR', label: 'R', finger: 'LI', width: 1 },
    { code: 'KeyT', label: 'T', finger: 'LI', width: 1 },
    { code: 'KeyY', label: 'Y', finger: 'RI', width: 1 },
    { code: 'KeyU', label: 'U', finger: 'RI', width: 1 },
    { code: 'KeyI', label: 'I', finger: 'RM', width: 1 },
    { code: 'KeyO', label: 'O', finger: 'RR', width: 1 },
    { code: 'KeyP', label: 'P', finger: 'RP', width: 1 },
    { code: 'BracketLeft', label: '[', shiftLabel: '{', finger: 'RP', width: 1 },
    { code: 'BracketRight', label: ']', shiftLabel: '}', finger: 'RP', width: 1 },
    { code: 'Backslash', label: '\\', shiftLabel: '|', finger: 'RP', width: 1.5 }
  ],
  // Home row
  [
    { code: 'CapsLock', label: 'Caps', finger: 'LP', width: 1.75, isSpecial: true },
    { code: 'KeyA', label: 'A', finger: 'LP', width: 1, isHome: true },
    { code: 'KeyS', label: 'S', finger: 'LR', width: 1, isHome: true },
    { code: 'KeyD', label: 'D', finger: 'LM', width: 1, isHome: true },
    { code: 'KeyF', label: 'F', finger: 'LI', width: 1, isHome: true, hasBump: true },
    { code: 'KeyG', label: 'G', finger: 'LI', width: 1 },
    { code: 'KeyH', label: 'H', finger: 'RI', width: 1 },
    { code: 'KeyJ', label: 'J', finger: 'RI', width: 1, isHome: true, hasBump: true },
    { code: 'KeyK', label: 'K', finger: 'RM', width: 1, isHome: true },
    { code: 'KeyL', label: 'L', finger: 'RR', width: 1, isHome: true },
    { code: 'Semicolon', label: ';', shiftLabel: ':', finger: 'RP', width: 1, isHome: true },
    { code: 'Quote', label: "'", shiftLabel: '"', finger: 'RP', width: 1 },
    { code: 'Enter', label: 'Enter', finger: 'RP', width: 2.25, isSpecial: true }
  ],
  // Bottom row
  [
    { code: 'ShiftLeft', label: 'Shift', finger: 'LP', width: 2.25, isSpecial: true },
    { code: 'KeyZ', label: 'Z', finger: 'LP', width: 1 },
    { code: 'KeyX', label: 'X', finger: 'LR', width: 1 },
    { code: 'KeyC', label: 'C', finger: 'LM', width: 1 },
    { code: 'KeyV', label: 'V', finger: 'LI', width: 1 },
    { code: 'KeyB', label: 'B', finger: 'LI', width: 1 },
    { code: 'KeyN', label: 'N', finger: 'RI', width: 1 },
    { code: 'KeyM', label: 'M', finger: 'RI', width: 1 },
    { code: 'Comma', label: ',', shiftLabel: '<', finger: 'RM', width: 1 },
    { code: 'Period', label: '.', shiftLabel: '>', finger: 'RR', width: 1 },
    { code: 'Slash', label: '/', shiftLabel: '?', finger: 'RP', width: 1 },
    { code: 'ShiftRight', label: 'Shift', finger: 'RP', width: 2.75, isSpecial: true }
  ],
  // Spacebar row
  [
    { code: 'ControlLeft', label: 'Ctrl', finger: 'LP', width: 1.25, isSpecial: true },
    { code: 'MetaLeft', label: 'Win', finger: 'LP', width: 1.25, isSpecial: true },
    { code: 'AltLeft', label: 'Alt', finger: 'LT', width: 1.25, isSpecial: true },
    { code: 'Space', label: 'Space', finger: 'RT', width: 6.25, isSpace: true },
    { code: 'AltRight', label: 'Alt', finger: 'RT', width: 1.25, isSpecial: true },
    { code: 'MetaRight', label: 'Win', finger: 'RP', width: 1.25, isSpecial: true },
    { code: 'ControlRight', label: 'Ctrl', finger: 'RP', width: 1.25, isSpecial: true }
  ]
];
