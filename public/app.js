// ============================================================================
// ZENFLOW SPACE - CLIENT JS LOGIC
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initParticles();
  initTimer();
  initBreather();
  initTasks();
  initAmbientAudio();
});

// ============================================================================
// 1. CLOCK WIDGET
// ============================================================================
function initClock() {
  const timeDisplay = document.getElementById('current-time');
  const dateDisplay = document.getElementById('current-date');

  function updateClock() {
    const now = new Date();
    
    // Time
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    timeDisplay.textContent = `${hours}:${minutes} ${ampm}`;

    // Date
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateDisplay.textContent = now.toLocaleDateString('en-US', options);
  }

  updateClock();
  setInterval(updateClock, 1000);
}

// ============================================================================
// 2. AMBIENT PARTICLE BACKGROUND
// ============================================================================
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  
  let particles = [];
  const particleCount = 45;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor() {
      this.reset();
      this.y = Math.random() * canvas.height;
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height + 20;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedY = Math.random() * 0.4 + 0.1;
      this.speedX = (Math.random() - 0.5) * 0.2;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.fadeSpeed = Math.random() * 0.005 + 0.002;
    }

    update() {
      this.y -= this.speedY;
      this.x += this.speedX;

      // Gentle drift
      if (this.y < -10 || this.alpha <= 0) {
        this.reset();
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(233, 64, 87, ${this.alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background subtle radial glow
    const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 10, canvas.width/2, canvas.height/2, canvas.width);
    grad.addColorStop(0, '#100b26');
    grad.addColorStop(1, '#06040d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  animate();
}

// ============================================================================
// 3. POMODORO TIMER
// ============================================================================
function initTimer() {
  const timerDisplay = document.getElementById('timer-time-display');
  const progressRing = document.getElementById('timer-progress-circle');
  const startBtn = document.getElementById('timer-start');
  const resetBtn = document.getElementById('timer-reset');
  const skipBtn = document.getElementById('timer-skip');
  const modeBtns = document.querySelectorAll('.mode-btn');
  
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');

  // Stats elements
  const focusTimeStat = document.getElementById('stat-focus-time');
  const sessionsStat = document.getElementById('stat-sessions');
  const goalStat = document.getElementById('stat-daily-goal');

  // Config times (in seconds)
  const MODES = {
    pomodoro: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  };

  let currentMode = 'pomodoro';
  let timeLeft = MODES[currentMode];
  let timerInterval = null;
  let isRunning = false;
  
  // Analytics variables
  let totalFocusMinutes = parseInt(localStorage.getItem('zenflow_focus_minutes') || '0');
  let completedCycles = parseInt(localStorage.getItem('zenflow_cycles') || '0');
  
  updateAnalyticsUI();

  // Progress Ring configuration
  const ringRadius = 85;
  const circumference = 2 * Math.PI * ringRadius; // ~534.07
  progressRing.style.strokeDasharray = circumference;
  
  function updateTimerUI() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Progress
    const totalTime = MODES[currentMode];
    const fraction = timeLeft / totalTime;
    const offset = circumference * (1 - fraction);
    progressRing.style.strokeDashoffset = offset;
  }

  function setMode(mode) {
    currentMode = mode;
    timeLeft = MODES[mode];
    
    modeBtns.forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    pauseTimer();
    updateTimerUI();
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');

    timerInterval = setInterval(() => {
      timeLeft--;
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleTimerCompletion();
      }
      
      updateTimerUI();
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    clearInterval(timerInterval);
  }

  function handleTimerCompletion() {
    triggerBeep();
    
    if (currentMode === 'pomodoro') {
      completedCycles++;
      totalFocusMinutes += 25;
      
      localStorage.setItem('zenflow_cycles', completedCycles);
      localStorage.setItem('zenflow_focus_minutes', totalFocusMinutes);
      
      updateAnalyticsUI();
      
      // Auto-switch to short break
      setMode('shortBreak');
    } else {
      setMode('pomodoro');
    }
    
    alert(`ZenFlow: Session finished! Time to flow.`);
  }

  function updateAnalyticsUI() {
    focusTimeStat.textContent = `${totalFocusMinutes}m`;
    sessionsStat.textContent = completedCycles;
    
    // Target is 4 focus sessions = 100%
    const goalPercent = Math.min(Math.round((completedCycles / 4) * 100), 100);
    goalStat.textContent = `${goalPercent}%`;
  }

  // Event Listeners
  startBtn.addEventListener('click', () => {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener('click', () => {
    pauseTimer();
    timeLeft = MODES[currentMode];
    updateTimerUI();
  });

  skipBtn.addEventListener('click', () => {
    pauseTimer();
    if (currentMode === 'pomodoro') {
      setMode('shortBreak');
    } else if (currentMode === 'shortBreak') {
      setMode('longBreak');
    } else {
      setMode('pomodoro');
    }
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      setMode(e.target.dataset.mode);
    });
  });

  // Synthesize notification sound
  function triggerBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Could not trigger notification sound", e);
    }
  }

  // Init UI
  updateTimerUI();
}

// ============================================================================
// 4. CALM BREATHER
// ============================================================================
function initBreather() {
  const breathCircle = document.getElementById('breath-circle');
  const phaseText = document.getElementById('breath-phase-text');
  const toggleBtn = document.getElementById('breath-toggle-btn');
  
  let isBreathing = false;
  let breathInterval = null;
  let breathStep = 0; // 0: inhale, 1: hold-in, 2: exhale, 3: hold-out
  
  const phases = [
    { text: 'Inhale', class: 'breathing-inhale', duration: 4000 },
    { text: 'Hold', class: 'breathing-hold', duration: 4000 },
    { text: 'Exhale', class: 'breathing-exhale', duration: 4000 },
    { text: 'Hold', class: 'breathing-exhale', duration: 4000 } // Keep exhaled state
  ];

  function runBreathCycle() {
    const current = phases[breathStep];
    
    // Set text
    phaseText.textContent = current.text;
    
    // Clear old state classes
    breathCircle.classList.remove('breathing-inhale', 'breathing-hold', 'breathing-exhale');
    // Add current class
    breathCircle.classList.add(current.class);
    
    // Setup next step timer
    breathInterval = setTimeout(() => {
      breathStep = (breathStep + 1) % 4;
      runBreathCycle();
    }, current.duration);
  }

  function startBreathing() {
    isBreathing = true;
    toggleBtn.textContent = 'Pause Breathing';
    toggleBtn.classList.add('active');
    breathStep = 0;
    runBreathCycle();
  }

  function stopBreathing() {
    isBreathing = false;
    toggleBtn.textContent = 'Start Breathing';
    toggleBtn.classList.remove('active');
    clearTimeout(breathInterval);
    
    // Reset visual circle
    phaseText.textContent = 'Relax';
    breathCircle.classList.remove('breathing-inhale', 'breathing-hold', 'breathing-exhale');
  }

  toggleBtn.addEventListener('click', () => {
    if (isBreathing) {
      stopBreathing();
    } else {
      startBreathing();
    }
  });
}

// ============================================================================
// 5. TASK CHECKLIST
// ============================================================================
function initTasks() {
  const taskInput = document.getElementById('task-input');
  const addTaskBtn = document.getElementById('add-task-btn');
  const taskList = document.getElementById('task-list-items');
  const taskCounter = document.getElementById('task-count');

  let tasks = JSON.parse(localStorage.getItem('zenflow_tasks') || '[]');

  function saveTasks() {
    localStorage.setItem('zenflow_tasks', JSON.stringify(tasks));
    updateTaskCounter();
  }

  function updateTaskCounter() {
    const completed = tasks.filter(t => t.completed).length;
    taskCounter.textContent = `${completed} completed`;
  }

  function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach((task, index) => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      
      li.innerHTML = `
        <div class="task-check-wrapper">
          <div class="custom-checkbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span class="task-text">${escapeHTML(task.text)}</span>
        </div>
        <button class="delete-task-btn" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      // Checkbox click listener
      li.querySelector('.task-check-wrapper').addEventListener('click', () => {
        tasks[index].completed = !tasks[index].completed;
        saveTasks();
        renderTasks();
      });

      // Delete click listener
      li.querySelector('.delete-task-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        tasks.splice(index, 1);
        saveTasks();
        renderTasks();
      });

      taskList.appendChild(li);
    });
    updateTaskCounter();
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function handleAddTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    
    tasks.push({ text, completed: false });
    taskInput.value = '';
    saveTasks();
    renderTasks();
  }

  addTaskBtn.addEventListener('click', handleAddTask);
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddTask();
  });

  renderTasks();
}

// ============================================================================
// 6. AMBIENT AUDIO SYNTHESIZERS (WEB AUDIO API)
// ============================================================================
function initAmbientAudio() {
  const masterBtn = document.getElementById('audio-master');
  
  let audioCtx = null;
  let masterGain = null;
  let isAudioContextActive = false;

  // Sound channels setup
  const channels = {
    'sound-rain': {
      active: false,
      volume: 0.5,
      nodes: null,
      setup: createRainSynth
    },
    'sound-ocean': {
      active: false,
      volume: 0.3,
      nodes: null,
      setup: createOceanSynth
    },
    'sound-noise': {
      active: false,
      volume: 0.25,
      nodes: null,
      setup: createBrownNoiseSynth
    },
    'sound-beats': {
      active: false,
      volume: 0.2,
      nodes: null,
      setup: createBinauralBeatsSynth
    }
  };

  // Master switch
  masterBtn.addEventListener('click', async () => {
    if (!audioCtx) {
      // Lazy init AudioContext on user interaction (browsers security rule)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    isAudioContextActive = !isAudioContextActive;
    if (isAudioContextActive) {
      masterBtn.textContent = 'Audio On';
      masterBtn.classList.add('active');
      
      // Start any channels that were marked as active
      Object.keys(channels).forEach(id => {
        if (channels[id].active) {
          startChannel(id);
        }
      });
    } else {
      masterBtn.textContent = 'Audio Off';
      masterBtn.classList.remove('active');
      
      // Stop nodes but keep active state
      Object.keys(channels).forEach(id => {
        if (channels[id].nodes) {
          stopChannelNodes(id);
        }
      });
    }
  });

  // Setup separate sound rows
  Object.keys(channels).forEach(id => {
    const row = document.getElementById(id);
    const playBtn = row.querySelector('.sound-toggle-btn');
    const volumeSlider = row.querySelector('.sound-volume');
    const statusText = row.querySelector('.sound-status');

    playBtn.addEventListener('click', async () => {
      // Automatically prompt to enable master if it's disabled
      if (!isAudioContextActive) {
        masterBtn.click();
      }

      const chan = channels[id];
      chan.active = !chan.active;

      if (chan.active) {
        row.classList.add('playing');
        playBtn.textContent = 'Stop';
        statusText.textContent = 'Playing';
        startChannel(id);
      } else {
        row.classList.remove('playing');
        playBtn.textContent = 'Play';
        statusText.textContent = 'Idle';
        stopChannelNodes(id);
      }
    });

    volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      channels[id].volume = vol;
      
      if (channels[id].nodes && channels[id].nodes.gainNode) {
        channels[id].nodes.gainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
      }
    });
  });

  function startChannel(id) {
    if (!isAudioContextActive || !audioCtx) return;
    const chan = channels[id];
    
    // Stop if already running
    stopChannelNodes(id);
    
    // Create synthesizer nodes
    chan.nodes = chan.setup(audioCtx, masterGain, chan.volume);
  }

  function stopChannelNodes(id) {
    const chan = channels[id];
    if (chan.nodes) {
      try {
        if (chan.nodes.sources) {
          chan.nodes.sources.forEach(src => src.stop());
        } else if (chan.nodes.source) {
          chan.nodes.source.stop();
        }
      } catch (e) {
        // Source might not have started yet
      }
      chan.nodes = null;
    }
  }

  // ==========================================================================
  // SYNTHESIZER BUILDERS
  // ==========================================================================

  // Helper: Generates a buffer of brown noise
  function getBrownNoiseBuffer(ctx, seconds = 5) {
    const bufferSize = ctx.sampleRate * seconds;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise formula: accumulate and decay slightly
      output[i] = (lastOut + (0.02 * white)) / 1.002;
      lastOut = output[i];
      output[i] *= 3.5; // Compensate volume loss
    }
    
    return noiseBuffer;
  }

  // Helper: Generates white noise buffer
  function getWhiteNoiseBuffer(ctx, seconds = 2) {
    const bufferSize = ctx.sampleRate * seconds;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // Rain: Lowpass-filtered white/pink/brown noise with volume fluctuations
  function createRainSynth(ctx, dest, volume) {
    const source = ctx.createBufferSource();
    source.buffer = getBrownNoiseBuffer(ctx, 4);
    source.loop = true;

    // Filter to make it sound like rain (attenuate high frequencies, slight mid cut)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);

    // Dynamic amplitude modulator (LFO) to simulate gusts / shifts
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // very slow shift

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.15, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    // Connections
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain); // Modulate gain
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    lfo.start();
    source.start();

    return {
      source,
      gainNode,
      sources: [source, lfo]
    };
  }

  // Ocean: Slow LFO modulating a bandpass-filtered brown noise generator
  function createOceanSynth(ctx, dest, volume) {
    const source = ctx.createBufferSource();
    source.buffer = getBrownNoiseBuffer(ctx, 6);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.Q.setValueAtTime(1.0, ctx.currentTime);

    // Wave modulator
    const waveLfo = ctx.createOscillator();
    waveLfo.type = 'sine';
    waveLfo.frequency.setValueAtTime(0.08, ctx.currentTime); // ~12s wave cycles

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.25, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    // Modulate both filter frequency and volume for wave crashing effect
    waveLfo.connect(waveGain);
    waveGain.connect(gainNode.gain);

    const filterMod = ctx.createGain();
    filterMod.gain.setValueAtTime(150, ctx.currentTime);
    waveLfo.connect(filterMod);
    filterMod.connect(filter.frequency);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    waveLfo.start();
    source.start();

    return {
      source,
      gainNode,
      sources: [source, waveLfo]
    };
  }

  // Brown Noise: Plain brown noise filtered slightly to make it super dark and cozy
  function createBrownNoiseSynth(ctx, dest, volume) {
    const source = ctx.createBufferSource();
    source.buffer = getBrownNoiseBuffer(ctx, 5);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    source.start();

    return {
      source,
      gainNode
    };
  }

  // Binaural Beats: Focus frequency 15Hz (Beta focus). Carrier is 180Hz
  function createBinauralBeatsSynth(ctx, dest, volume) {
    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    
    leftOsc.type = 'sine';
    leftOsc.frequency.setValueAtTime(180, ctx.currentTime); // 180Hz Left Channel
    
    rightOsc.type = 'sine';
    rightOsc.frequency.setValueAtTime(195, ctx.currentTime); // 195Hz Right Channel (15Hz beat)

    // Stereo Panning
    const pannerLeft = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const pannerRight = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    if (pannerLeft && pannerRight) {
      pannerLeft.pan.setValueAtTime(-1, ctx.currentTime);
      pannerRight.pan.setValueAtTime(1, ctx.currentTime);

      leftOsc.connect(pannerLeft);
      pannerLeft.connect(gainNode);

      rightOsc.connect(pannerRight);
      pannerRight.connect(gainNode);
    } else {
      // Fallback if Panner is not supported
      leftOsc.connect(gainNode);
      rightOsc.connect(gainNode);
    }

    gainNode.connect(dest);

    leftOsc.start();
    rightOsc.start();

    return {
      gainNode,
      sources: [leftOsc, rightOsc]
    };
  }
}
