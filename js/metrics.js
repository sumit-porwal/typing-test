/**
 * Metrics & Performance Tracking Module for KeyVibe Touch Typing Studio
 * Manages keystroke metrics, WPM calculation, consistency scores, and ergonomic finger stats.
 */

export class MetricsTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = null;
    this.totalKeyStrokes = 0;
    this.correctKeyStrokes = 0;
    this.streak = 0;
    this.maxStreak = 0;

    // Timeline Graph & Rhythm Metrics
    this.wpmHistory = []; // [ { time, wpm, rawWpm, errors } ]
    this.keystrokeIntervals = []; // ms between consecutive keystrokes
    this.lastKeystrokeTime = null;
    this.currentSecondErrors = 0;

    // Ergonomic Finger Distribution
    this.fingerStats = {
      LP: { total: 0, errors: 0 },
      LR: { total: 0, errors: 0 },
      LM: { total: 0, errors: 0 },
      LI: { total: 0, errors: 0 },
      LT: { total: 0, errors: 0 },
      RT: { total: 0, errors: 0 },
      RI: { total: 0, errors: 0 },
      RM: { total: 0, errors: 0 },
      RR: { total: 0, errors: 0 },
      RP: { total: 0, errors: 0 }
    };

    // Frequency map of missed characters
    this.missedKeys = {};
  }

  start(timestamp = Date.now()) {
    this.startTime = timestamp;
    this.lastKeystrokeTime = timestamp;
  }

  recordInterval(now = Date.now()) {
    if (this.lastKeystrokeTime) {
      const interval = now - this.lastKeystrokeTime;
      if (interval < 2500) {
        this.keystrokeIntervals.push(interval);
      }
    }
    this.lastKeystrokeTime = now;
  }

  recordKeystroke(expectedChar, isCorrect, fingerId) {
    this.totalKeyStrokes++;

    if (fingerId && this.fingerStats[fingerId]) {
      this.fingerStats[fingerId].total++;
    }

    if (isCorrect) {
      this.correctKeyStrokes++;
      this.streak++;
      if (this.streak > this.maxStreak) {
        this.maxStreak = this.streak;
      }
    } else {
      this.streak = 0;
      this.currentSecondErrors++;
      if (fingerId && this.fingerStats[fingerId]) {
        this.fingerStats[fingerId].errors++;
      }
      this.missedKeys[expectedChar] = (this.missedKeys[expectedChar] || 0) + 1;
    }
  }

  recordSecondPoint(secFloor, elapsedSeconds) {
    if (secFloor <= 0) return;
    if (this.wpmHistory.length && this.wpmHistory[this.wpmHistory.length - 1].time === secFloor) return;

    const elapsedMin = elapsedSeconds / 60;
    const gross = Math.round((this.totalKeyStrokes / 5) / elapsedMin);
    const acc = this.totalKeyStrokes > 0 ? (this.correctKeyStrokes / this.totalKeyStrokes) : 1;
    const net = Math.max(0, Math.round(gross * acc));

    this.wpmHistory.push({
      time: secFloor,
      wpm: isNaN(net) ? 0 : net,
      rawWpm: isNaN(gross) ? 0 : gross,
      errors: this.currentSecondErrors
    });
    this.currentSecondErrors = 0;
  }

  getLiveStats() {
    if (!this.startTime) {
      return { grossWpm: 0, accuracy: 100, streak: 0 };
    }
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const grossWpm = elapsedMinutes > 0 ? Math.round((this.totalKeyStrokes / 5) / elapsedMinutes) : 0;
    const accuracy = this.totalKeyStrokes > 0
      ? Math.round((this.correctKeyStrokes / this.totalKeyStrokes) * 100)
      : 100;

    return {
      grossWpm: isNaN(grossWpm) ? 0 : grossWpm,
      accuracy,
      streak: this.streak
    };
  }

  getFinalStats() {
    const elapsedSeconds = Math.max(1, (Date.now() - (this.startTime || Date.now())) / 1000);
    const elapsedMinutes = elapsedSeconds / 60;
    const grossWpm = Math.round((this.totalKeyStrokes / 5) / elapsedMinutes);
    const accuracy = this.totalKeyStrokes > 0
      ? Math.round((this.correctKeyStrokes / this.totalKeyStrokes) * 1000) / 10
      : 100;
    const netWpm = Math.max(0, Math.round(grossWpm * (accuracy / 100)));

    // Calculate Consistency % based on rhythm variance (coefficient of variation of intervals)
    let consistency = 95;
    if (this.keystrokeIntervals.length > 5) {
      const mean = this.keystrokeIntervals.reduce((a, b) => a + b, 0) / this.keystrokeIntervals.length;
      const variance = this.keystrokeIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.keystrokeIntervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? (stdDev / mean) : 0;
      consistency = Math.max(40, Math.min(100, Math.round(100 * (1 - Math.min(0.85, cv * 0.7)))));
    }

    return {
      grossWpm,
      netWpm,
      accuracy,
      consistency,
      streak: this.maxStreak,
      totalKeys: this.totalKeyStrokes,
      correctKeys: this.correctKeyStrokes,
      errors: this.totalKeyStrokes - this.correctKeyStrokes,
      elapsedSeconds
    };
  }
}
