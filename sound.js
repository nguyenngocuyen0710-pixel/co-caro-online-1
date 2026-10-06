/**
 * =========================================================
 * 🎀 CỜ CARO - SOUND MANAGER (ÂM THANH & NHẠC NỀN) 🎀
 * =========================================================
 * Hỗ trợ 2 chế độ:
 * 1. Chơi file mp3 từ thư mục public/assets/sounds/
 * 2. Tự động dự phòng (fallback) bằng Web Audio API synthesizer
 *    -> Đảm bảo 100% hoạt động ngay cả khi chưa tải file mp3!
 */

class SoundManager {
  constructor() {
    this.bgmEnabled = true;
    this.sfxEnabled = true;
    this.audioCtx = null;
    this.bgmNode = null;
    this.bgmAudioElement = null;
    this.isBgmPlaying = false;
    this.hasUserInteracted = false;

    // Danh sách đường dẫn file âm thanh thật nếu người dùng thêm vào
    this.audioFiles = {
      bgm: "/assets/sounds/bgm.mp3",
      click: "/assets/sounds/click.mp3",
      win: "/assets/sounds/win.mp3",
      lose: "/assets/sounds/lose.mp3",
      draw: "/assets/sounds/draw.mp3"
    };

    // Cache các Audio elements
    this.audioElements = {};
    this.initAudioElements();

    // Lắng nghe tương tác đầu tiên để kích hoạt AudioContext tuân thủ Autoplay Policy
    const unlockAudio = () => {
      if (!this.hasUserInteracted) {
        this.hasUserInteracted = true;
        this.initAudioContext();
        if (this.bgmEnabled && !this.isBgmPlaying) {
          this.playBGM();
        }
      }
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
  }

  /**
   * Khởi tạo Web Audio Context
   */
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  /**
   * Khởi tạo thử các thẻ Audio
   */
  initAudioElements() {
    for (const [key, path] of Object.entries(this.audioFiles)) {
      const audio = new Audio();
      audio.src = path;
      audio.preload = "auto";
      if (key === "bgm") {
        audio.loop = true;
        this.bgmAudioElement = audio;
      } else {
        this.audioElements[key] = audio;
      }
    }
  }

  /**
   * Bật/Tắt nhạc nền (BGM)
   */
  toggleBGM() {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled) {
      this.playBGM();
    } else {
      this.stopBGM();
    }
    return this.bgmEnabled;
  }

  /**
   * Bật/Tắt hiệu ứng âm thanh (SFX)
   */
  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  /**
   * Bắt đầu phát nhạc nền
   */
  playBGM() {
    if (!this.bgmEnabled) return;
    this.initAudioContext();

    // Thử phát từ file mp3
    if (this.bgmAudioElement) {
      this.bgmAudioElement.volume = 0.35;
      const playPromise = this.bgmAudioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isBgmPlaying = true;
          })
          .catch(() => {
            // Nếu không có file mp3 thật, kích hoạt BGM Synth bằng Web Audio API
            this.startSynthesizedBGM();
          });
      }
    } else {
      this.startSynthesizedBGM();
    }
  }

  /**
   * Dừng nhạc nền
   */
  stopBGM() {
    this.isBgmPlaying = false;
    if (this.bgmAudioElement) {
      this.bgmAudioElement.pause();
    }
    this.stopSynthesizedBGM();
  }

  /**
   * Nhạc nền Synth nhẹ nhàng, dễ thương (Pastel Lofi Arpeggio)
   */
  startSynthesizedBGM() {
    if (!this.bgmEnabled || this.bgmNode || !this.audioCtx) return;
    this.isBgmPlaying = true;

    // Giai điệu pastel êm dịu (Pentatonic C major)
    const melody = [261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 329.63, 293.66];
    let noteIndex = 0;

    const playBgmTick = () => {
      if (!this.isBgmPlaying || !this.bgmEnabled || !this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(melody[noteIndex % melody.length], this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.025, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.85);

      noteIndex++;
      this.bgmTimeout = setTimeout(playBgmTick, 600);
    };

    playBgmTick();
  }

  stopSynthesizedBGM() {
    if (this.bgmTimeout) {
      clearTimeout(this.bgmTimeout);
      this.bgmTimeout = null;
    }
  }

  /**
   * Phát hiệu ứng âm thanh tổng quát
   */
  playSFX(type) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();

    // Thử chạy từ file trước
    const audio = this.audioElements[type];
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 0.6;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // File không tồn tại -> fallback sang Web Audio API
          this.playSynthSFX(type);
        });
      }
    } else {
      this.playSynthSFX(type);
    }
  }

  /**
   * Tạo âm thanh bằng Web Audio API
   */
  playSynthSFX(type) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    switch (type) {
      case "click": {
        // Tiếng đặt quân cờ cute 'pop'
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }

      case "button": {
        // Tiếng click button nhẹ
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.04);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.07);
        break;
      }

      case "win": {
        // Hợp âm chiến thắng vui vẻ (Fanfare)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          const start = now + idx * 0.12;

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.2, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(start);
          osc.stop(start + 0.36);
        });
        break;
      }

      case "lose": {
        // Âm điệu buồn nhẹ nhàng
        const notes = [440.00, 392.00, 349.23, 293.66];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          const start = now + idx * 0.15;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.15, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(start);
          osc.stop(start + 0.32);
        });
        break;
      }

      case "draw": {
        // Âm điệu trung tính khi hòa
        const notes = [440.00, 440.00];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          const start = now + idx * 0.15;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.12, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(start);
          osc.stop(start + 0.22);
        });
        break;
      }
    }
  }
}

// Khởi tạo đối tượng Sound toàn cục
window.soundManager = new SoundManager();
