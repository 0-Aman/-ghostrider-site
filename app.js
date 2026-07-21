/* ==========================================================================
   GHOST RIDER - SCROLL SEQUENCE & VISUAL ENGINE
   ========================================================================== */

// Config
const TOTAL_FRAMES = 151;
const IMAGES = [];
const PADDED_INDEX = (num) => String(num).padStart(3, '0');

// DOM Elements
const canvas = document.getElementById('sequenceCanvas');
const ctx = canvas.getContext('2d');
const preloader = document.getElementById('preloader');
const progressText = document.getElementById('progressText');
const progressCircle = document.getElementById('progressCircle');
const preloaderStatus = document.getElementById('preloaderStatus');
const progressBar = document.getElementById('progressBar');
const sideDots = document.querySelectorAll('.nav-dot');
const scrollPrompt = document.getElementById('scrollPrompt');
const restartBtn = document.getElementById('restartBtn');

// State Variables
let currentFrame = 0;
let targetFrame = 0;
let lastDrawnFrame = -1;
let forceRedraw = false;
let isLoaded = false;
let scrollFraction = 0;

// Image dimensions (to be set once the first image loads)
let imgWidth = 1920;
let imgHeight = 1080;

// SVGs circle radius circumference
const circleRadius = 45;
const circumference = 2 * Math.PI * circleRadius;
if (progressCircle) {
  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = circumference;
}

// Preloader Status Phrases
const loadingPhrases = [
  "Spitting flames onto the engine...",
  "Pouring hellfire into the tank...",
  "Binding the demon to the steel...",
  "Igniting the tires...",
  "Calibrating the chain of vengeance...",
  "Polishing the chrome skull..."
];

/* ==========================================================================
   PRELOADER CONTROLLER
   ========================================================================== */
function preloadImages() {
  let loadedCount = 0;

  function handleImageLoad(isError = false) {
    loadedCount++;
    const percent = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
    
    // Update progress bar
    if (progressText) progressText.textContent = `${percent}%`;
    if (progressCircle) {
      const offset = circumference - (percent / 100) * circumference;
      progressCircle.style.strokeDashoffset = offset;
    }
    
    // Update text messages periodically
    if (preloaderStatus && percent % 15 === 0 && percent < 95) {
      const phraseIndex = Math.min(loadingPhrases.length - 1, Math.floor(percent / 15));
      preloaderStatus.textContent = loadingPhrases[phraseIndex];
    }
    
    if (loadedCount === 1 && IMAGES[0]) {
      // Capture natural dimensions from the first loaded frame
      imgWidth = IMAGES[0].naturalWidth || 1920;
      imgHeight = IMAGES[0].naturalHeight || 1080;
    }

    if (loadedCount === TOTAL_FRAMES) {
      if (preloaderStatus) preloaderStatus.textContent = "IGNITION READY.";
      
      // Hide loader circle and reveal action button
      const loaderCircle = document.querySelector('.fire-loader-container');
      if (loaderCircle) loaderCircle.style.display = 'none';
      
      const enterBtn = document.getElementById('enterBtn');
      if (enterBtn) {
        enterBtn.classList.remove('hidden');
        enterBtn.addEventListener('click', () => {
          startApplication();
        });
      } else {
        // Fallback if button is missing in DOM
        setTimeout(startApplication, 800);
      }
    }
  }

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    const img = new Image();
    // Path relative to workspace root containing the images
    img.src = `image_${PADDED_INDEX(i)}.jpg`;
    img.onload = () => handleImageLoad(false);
    img.onerror = () => {
      console.warn(`Failed to load frame ${i}`);
      handleImageLoad(true); // Resilient: proceed even if a frame fails
    };
    IMAGES.push(img);
  }
}

function startApplication() {
  if (isLoaded) return;

  isLoaded = true;
  preloader.style.opacity = '0';
  preloader.style.visibility = 'hidden';
  
  // Set initial canvas size and draw first frame
  resizeCanvas();
  
  // Start engine loops
  requestAnimationFrame(renderLoop);
  initParticles();
  requestAnimationFrame(updateParticles);
}

/* ==========================================================================
   CANVAS ASPECT-RATIO COVER DRAWING
   ========================================================================== */
function drawFrame(frameIndex) {
  if (!IMAGES[frameIndex] || !IMAGES[frameIndex].complete) return;
  
  const canvasW = window.innerWidth;
  const canvasH = window.innerHeight;
  
  // Calculate "cover" scale (same as CSS background-size: cover)
  const scale = Math.max(canvasW / imgWidth, canvasH / imgHeight);
  const w = imgWidth * scale;
  const h = imgHeight * scale;
  const x = (canvasW - w) / 2;
  const y = (canvasH - h) / 2;
  
  // Draw current image centered
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.drawImage(IMAGES[frameIndex], x, y, w, h);
  lastDrawnFrame = frameIndex;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  // Set display size
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  
  // Set actual buffer size scaled by device pixel ratio for maximum crispness
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  
  forceRedraw = true;
}

/* ==========================================================================
   SCROLL SYNCHRONIZATION ENGINE WITH LERPING (60 FPS SMOOTHING)
   ========================================================================== */
function updateScrollProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  
  if (docHeight <= 0) return;
  
  scrollFraction = Math.min(1, Math.max(0, scrollTop / docHeight));
  
  // Update HUD progress bar
  if (progressBar) {
    progressBar.style.width = `${scrollFraction * 100}%`;
  }
  
  // Set target frame based on exact scroll progress
  targetFrame = scrollFraction * (TOTAL_FRAMES - 1);
  
  // Fade out bottom scroll prompt as soon as user starts scrolling
  if (scrollTop > 80) {
    scrollPrompt.classList.add('fade-out');
  } else {
    scrollPrompt.classList.remove('fade-out');
  }
}

// Decoupled Render Loop (Smooths scrolling by interpolating values)
function renderLoop() {
  // Lerping formula: current = current + (target - current) * factor
  const diff = targetFrame - currentFrame;
  
  // Apply linear interpolation for smooth deceleration gliding
  currentFrame += diff * 0.14;
  
  // Convert current floating frame to nearest valid index
  const roundedFrame = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentFrame)));
  
  // Redraw canvas ONLY if frame changed or if a resize event requires redraw
  if (roundedFrame !== lastDrawnFrame || forceRedraw) {
    drawFrame(roundedFrame);
    forceRedraw = false;
  }
  
  requestAnimationFrame(renderLoop);
}

/* ==========================================================================
   PARTICLE ENGINE (EMBER BLIZZARD EFFECT)
   ========================================================================== */
const pCanvas = document.getElementById('particlesCanvas');
const pCtx = pCanvas.getContext('2d');
const particles = [];

class Particle {
  constructor() {
    this.reset(true);
  }
  
  reset(init = false) {
    this.x = Math.random() * pCanvas.width;
    // Spawn at bottom if initializing, otherwise random height
    this.y = init ? Math.random() * pCanvas.height : pCanvas.height + 10;
    this.size = Math.random() * 3 + 1;
    this.speedY = -(Math.random() * 2 + 1);
    this.speedX = Math.random() * 1 - 0.5;
    this.life = Math.random() * 200 + 100;
    this.maxLife = this.life;
    // Glowing orange/red fire colors
    this.hue = Math.random() < 0.3 ? 12 : (Math.random() < 0.7 ? 25 : 38);
    this.alpha = Math.random() * 0.5 + 0.3;
  }
  
  update(scrollSpeed) {
    // Dynamic physics based on scroll intensity
    this.y += this.speedY * (1 + scrollSpeed * 0.8);
    this.x += this.speedX + Math.sin(this.y * 0.01) * 0.3;
    this.life--;
    
    // Fade out towards end of life
    this.alpha = Math.max(0, (this.life / this.maxLife) * 0.7);
    
    if (this.life <= 0 || this.y < -10) {
      this.reset(false);
    }
  }
  
  draw() {
    pCtx.beginPath();
    pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    pCtx.fillStyle = `hsla(${this.hue}, 100%, 55%, ${this.alpha})`;
    pCtx.shadowBlur = this.size * 3;
    pCtx.shadowColor = `hsla(${this.hue}, 100%, 50%, 0.6)`;
    pCtx.fill();
    pCtx.shadowBlur = 0; // Reset shadow for next draws
  }
}

function initParticles() {
  resizeParticlesCanvas();
  const particleCount = Math.min(100, Math.floor(window.innerWidth / 15));
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
}

function resizeParticlesCanvas() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}

let lastFrameValue = 0;
function updateParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  
  // Calculate current scroll speed to blow embers faster
  const scrollSpeed = Math.abs(currentFrame - lastFrameValue);
  lastFrameValue = currentFrame;
  
  for (let i = 0; i < particles.length; i++) {
    particles[i].update(scrollSpeed);
    particles[i].draw();
  }
  
  requestAnimationFrame(updateParticles);
}

/* ==========================================================================
   INTERACTIVE HIGHLIGHTS & NAVIGATION
   ========================================================================== */

// Intersection Observer for fading sections in and out
const sections = document.querySelectorAll('.scroll-section');
const sectionContents = document.querySelectorAll('.section-content');

const observerOptions = {
  root: null,
  rootMargin: '-10% 0px -25% 0px',
  threshold: 0.15
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelector('.section-content').classList.add('visible');
      
      // Update active nav dot
      const index = entry.target.id.split('-')[1];
      sideDots.forEach(dot => {
        if (dot.getAttribute('data-target') === index) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }
  });
}, observerOptions);

sections.forEach(section => {
  observer.observe(section);
});

// Dot click scroll navigation
sideDots.forEach(dot => {
  dot.addEventListener('click', () => {
    const targetIdx = dot.getAttribute('data-target');
    const targetSection = document.getElementById(`section-${targetIdx}`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Action button restart sequence
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/* ==========================================================================
   PREMIUM CUSTOM MOUSE CURSOR TRACKING
   ========================================================================== */
const customCursor = document.getElementById('customCursor');
const cursorGlow = document.getElementById('cursorGlow');

let mouseX = -100;
let mouseY = -100;
let cursorX = -100;
let cursorY = -100;
let glowX = -100;
let glowY = -100;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Animate cursors with lerp for organic lagging motion
function updateCursorPosition() {
  // Lerp factor for inner cursor
  cursorX += (mouseX - cursorX) * 0.15;
  cursorY += (mouseY - cursorY) * 0.15;
  
  // Lerp factor for outer glow cursor (lagging more)
  glowX += (mouseX - glowX) * 0.08;
  glowY += (mouseY - glowY) * 0.08;
  
  if (customCursor) {
    customCursor.style.left = `${cursorX}px`;
    customCursor.style.top = `${cursorY}px`;
  }
  if (cursorGlow) {
    cursorGlow.style.left = `${glowX}px`;
    cursorGlow.style.top = `${glowY}px`;
  }
  
  requestAnimationFrame(updateCursorPosition);
}
requestAnimationFrame(updateCursorPosition);

// Hover states toggle for all links/buttons
const interactiveElements = document.querySelectorAll('button, .nav-dot, a, .interactive-glow-box');
interactiveElements.forEach(el => {
  el.addEventListener('mouseenter', () => {
    document.body.classList.add('hovering');
  });
  el.addEventListener('mouseleave', () => {
    document.body.classList.remove('hovering');
  });
});

/* ==========================================================================
   EVENT INITIALIZATIONS
   ========================================================================== */
window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', () => {
  resizeCanvas();
  resizeParticlesCanvas();
});

// Start Preloading Process
preloadImages();
updateScrollProgress();
