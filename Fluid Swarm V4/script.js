const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const uiModeBtn = document.getElementById('ui-mode');
let width, height;

// Dual-Engine Ecosystem
let particles = [];
const numParticles = 12000;

let mouse = { x: -1000, y: -1000, vx: 0, vy: 0, down: false };
let lastMouse = { x: -1000, y: -1000 };
let globalTime = 0;
let timeScale = 1.0; 
let targetTimeScale = 1.0;

// 4 Cosmic Physics Modes
const modes = [
    'Curl Noise Fluid', 
    'Ecosystem (Predator/Prey)', 
    'Gravity Well', 
    'Boids (Flocking)'
];
let currentModeIndex = 0;
let currentMode = modes[currentModeIndex];

// Wormhole data
let wormholeA = { x: 500, y: 500, active: false };
let wormholeB = { x: 1500, y: 500, active: false };

function cycleMode() {
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    currentMode = modes[currentModeIndex];
    uiModeBtn.innerText = `Physics: ${currentMode}`;
}

uiModeBtn.addEventListener('click', cycleMode);
window.addEventListener('contextmenu', (e) => { e.preventDefault(); cycleMode(); });
window.addEventListener('dblclick', (e) => {
    e.preventDefault();
    timeScale = 0.05; // Cinematic scatter
    targetTimeScale = 1.0;
    triggerShockwave(mouse.x, mouse.y, Math.max(width, height) * 0.7, 25);
    particles.forEach(p => {
        let dx = p.x - mouse.x;
        let dy = p.y - mouse.y;
        let dist = Math.sqrt(dx*dx + dy*dy) || 1;
        p.vx += (dx / dist) * 150;
        p.vy += (dy / dist) * 150;
    });
});

window.addEventListener('mousemove', (e) => {
    lastMouse.x = mouse.x;
    lastMouse.y = mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.vx = (mouse.x - lastMouse.x);
    mouse.vy = (mouse.y - lastMouse.y);
    idleTimer = 0;
    isIdle = false;
});
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);
window.addEventListener('mouseout', () => { mouse.x = -1000; mouse.y = -1000; mouse.vx = 0; mouse.vy = 0; });

// Idle Geometry Logic
let idleTimer = 0;
let isIdle = false;
let currentShape = 0; // 0-8 shapes
let currentStyle = 0; // 0: Rigid & Sharp, 1: Fluidic & Soft

// --- Color Palette System ---
const palettes = [
    { name: 'Rainbow',       hueBase: null, hueRange: 360, sat: 100, lightBase: 65 },
    { name: 'Cyberpunk',     hueBase: 300, hueRange: 60,  sat: 100, lightBase: 65 },
    { name: 'Deep Ocean',    hueBase: 170, hueRange: 50,  sat: 90,  lightBase: 55 },
    { name: 'Ember',         hueBase: 15,  hueRange: 40,  sat: 100, lightBase: 60 },
    { name: 'Aurora',        hueBase: 120, hueRange: 80,  sat: 85,  lightBase: 60 },
    { name: 'Frost',         hueBase: 200, hueRange: 30,  sat: 70,  lightBase: 75 },
    { name: 'Lava',          hueBase: 0,   hueRange: 25,  sat: 100, lightBase: 55 },
    { name: 'Toxic',         hueBase: 90,  hueRange: 35,  sat: 100, lightBase: 55 },
    { name: 'Ultraviolet',   hueBase: 270, hueRange: 40,  sat: 90,  lightBase: 60 },
    { name: 'Sunset',        hueBase: 25,  hueRange: 55,  sat: 95,  lightBase: 62 },
    { name: 'Sakura',        hueBase: 330, hueRange: 30,  sat: 75,  lightBase: 72 },
    { name: 'Electric Blue', hueBase: 220, hueRange: 25,  sat: 100, lightBase: 65 },
];
let currentPalette = 0;
let prevPalette = 0;
let paletteBlend = 1.0; // 0 = fully prevPalette, 1 = fully currentPalette

// --- Breathing Effect ---
let breathPhase = 0;

// --- Vignette ---
let vignettePhase = 0;

// --- Gravitational Shockwave System ---
let shockwaves = [];

function triggerShockwave(x = width / 2, y = height / 2, maxRadius = Math.max(width, height) * 0.75, strength = 14) {
    shockwaves.push({
        x: x,
        y: y,
        radius: 0,
        maxRadius: maxRadius,
        speed: 15,
        strength: strength,
        width: 45,
        alpha: 0.85,
        paletteIndex: currentPalette
    });
}

// --- Shooting Stars / Meteors System ---
let meteors = [];
let meteorTimer = Math.random() * 200 + 200; // First meteor in 4-8s

function spawnMeteor() {
    let angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.4; // Realistic ~45 deg diagonal
    let speed = Math.random() * 14 + 18; // High speed
    let startX = Math.random() * (width * 1.2) - (width * 0.2);
    let startY = -40;
    
    let p = palettes[currentPalette] || palettes[0];
    let hue = p.hueBase !== null ? p.hueBase + Math.random() * p.hueRange : (Math.random() * 360);
    
    meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: Math.random() * 140 + 100,
        size: Math.random() * 2 + 1.8,
        life: 1.0,
        decay: Math.random() * 0.007 + 0.007,
        hue: hue,
        sat: p.sat,
        lightness: p.lightBase + 20,
        sparks: []
    });
}

// --- Particle Clock Logic ---
let clockTargets = [];
let lastMinuteText = "";
const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

function updateClockTargets() {
    let now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes().toString().padStart(2, '0');
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // 12-hour format
    
    let timeText = `${hours}:${minutes} ${ampm}`;
    
    if (timeText === lastMinuteText && clockTargets.length > 0) return;
    lastMinuteText = timeText;
    
    // Use a smaller canvas for scanning to save performance, then scale up
    let scanWidth = 800;
    let scanHeight = 400;
    offscreenCanvas.width = scanWidth;
    offscreenCanvas.height = scanHeight;
    
    offCtx.fillStyle = 'black';
    offCtx.fillRect(0, 0, scanWidth, scanHeight);
    
    offCtx.fillStyle = 'white';
    offCtx.font = 'bold 180px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(timeText, scanWidth / 2, scanHeight / 2);
    
    let imageData = offCtx.getImageData(0, 0, scanWidth, scanHeight).data;
    clockTargets = [];
    
    let offsetX = (width / 2) - (scanWidth / 2);
    let offsetY = (height / 2) - (scanHeight / 2);
    
    // Scan every 2nd pixel instead of 3rd for much higher resolution text
    for (let y = 0; y < scanHeight; y += 2) { 
        for (let x = 0; x < scanWidth; x += 2) {
            let index = (y * scanWidth + x) * 4;
            if (imageData[index] > 128) {
                clockTargets.push({ 
                    x: x + offsetX, 
                    y: y + offsetY 
                });
            }
        }
    }
    
    // If text is empty/fails, fallback to center
    if (clockTargets.length === 0) clockTargets.push({x: width/2, y: height/2});
}

// --- Symbol Scanner ---
let symbolTargets = [];
let currentSymbol = "";
const symbolPool = [
    '☆', '♫', '✦', '◈', '⚡', '☯', '✿', '♕', 
    '⟐', '△', '⬡', '✧', '♾', '⊕', '☾', '♠',
    '❖', '⟁', '✶', '☄', '♦', '⊗', '◎', '⬢',
    '🪐', '🚀', '🛸', '⚛', '⚜', '⚔', '⚓', '♟',
    '♚', '☘', '❂', '✵', '✹', '✺', '❄', '❅',
    '❇', '❈', '☬', '۞', '🜂', '🜄', '🜁', '🜃'
];

function updateSymbolTargets() {
    if (symbolTargets.length > 0) return; // Already scanned
    
    currentSymbol = symbolPool[Math.floor(Math.random() * symbolPool.length)];
    
    let scanWidth = 600;
    let scanHeight = 600;
    offscreenCanvas.width = scanWidth;
    offscreenCanvas.height = scanHeight;
    
    offCtx.fillStyle = 'black';
    offCtx.fillRect(0, 0, scanWidth, scanHeight);
    
    offCtx.fillStyle = 'white';
    offCtx.font = '400px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(currentSymbol, scanWidth / 2, scanHeight / 2);
    
    let imageData = offCtx.getImageData(0, 0, scanWidth, scanHeight).data;
    symbolTargets = [];
    
    let offsetX = (width / 2) - (scanWidth / 2);
    let offsetY = (height / 2) - (scanHeight / 2);
    
    for (let y = 0; y < scanHeight; y += 2) {
        for (let x = 0; x < scanWidth; x += 2) {
            let index = (y * scanWidth + x) * 4;
            if (imageData[index] > 128) {
                symbolTargets.push({ x: x + offsetX, y: y + offsetY });
            }
        }
    }
    
    if (symbolTargets.length === 0) symbolTargets.push({x: width/2, y: height/2});
}


function getIdleTarget(i, total, shapeIndex) {
    let tx = width / 2;
    let ty = height / 2;
    let t = (i / total);
    let angle = t * Math.PI * 2;
    
    // Pseudo-random offset based on index (so it's perfectly stable every frame)
    let fixedJitterX = Math.sin(i * 123.456) * 15; // Halved jitter for crisper lines
    let fixedJitterY = Math.cos(i * 789.123) * 15;
    
    if (shapeIndex === 0) { // Infinity Symbol
        tx += Math.sin(angle) * 350; // Scaled down from 600
        ty += Math.sin(angle * 2) * 150; // Scaled down from 300
    } else if (shapeIndex === 1) { // Massive Ring
        let radius = 250 + Math.sin(i * 555.55) * 20; // Scaled down from 400
        tx += Math.cos(angle) * radius;
        ty += Math.sin(angle) * radius;
        fixedJitterX = 0; fixedJitterY = 0; // Handled by radius
    } else if (shapeIndex === 2) { // Triforce/Triangle
        let side = Math.floor(t * 3);
        let progress = (t * 3) - side;
        let size = 250; // Scaled down from 400
        let p1, p2;
        if (side === 0) { p1 = {x: 0, y: -size}; p2 = {x: size, y: size}; }
        else if (side === 1) { p1 = {x: size, y: size}; p2 = {x: -size, y: size}; }
        else { p1 = {x: -size, y: size}; p2 = {x: 0, y: -size}; }
        
        tx += p1.x + (p2.x - p1.x) * progress;
        ty += p1.y + (p2.y - p1.y) * progress;
    } else if (shapeIndex === 3) { // Double Helix (DNA)
        let yPos = (t * height * 0.8) - (height * 0.4) + (height / 2); 
        let wave = Math.sin(t * Math.PI * 8);
        let strand = i % 2 === 0 ? 1 : -1;
        tx += wave * 150 * strand; 
        ty = yPos;
    } else if (shapeIndex === 4) { // Golden Spiral
        let loops = 4;
        let spiralAngle = t * Math.PI * 2 * loops;
        let spiralRadius = (spiralAngle / (Math.PI * 2 * loops)) * 400; 
        tx += Math.cos(spiralAngle) * spiralRadius;
        ty += Math.sin(spiralAngle) * spiralRadius;
    } else if (shapeIndex === 5) { // Hourglass
        tx += Math.sin(angle * 2) * 200;
        ty += Math.sin(angle) * 350;
    } else if (shapeIndex === 6) { // 5-Point Star
        let p = Math.floor(t * 5);
        let pNext = (p + 1) % 5;
        let prog = (t * 5) - p;
        let a1 = (p * 144 - 90) * (Math.PI / 180);
        let a2 = (pNext * 144 - 90) * (Math.PI / 180);
        let r = 300;
        let x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
        let x2 = Math.cos(a2) * r, y2 = Math.sin(a2) * r;
        tx += x1 + (x2 - x1) * prog;
        ty += y1 + (y2 - y1) * prog;
    } else if (shapeIndex === 7) { // Diamond
        let side = Math.floor(t * 4);
        let prog = (t * 4) - side;
        let s = 250;
        let p1, p2;
        if (side === 0) { p1 = {x: 0, y: -s}; p2 = {x: s, y: 0}; }
        else if (side === 1) { p1 = {x: s, y: 0}; p2 = {x: 0, y: s}; }
        else if (side === 2) { p1 = {x: 0, y: s}; p2 = {x: -s, y: 0}; }
        else { p1 = {x: -s, y: 0}; p2 = {x: 0, y: -s}; }
        tx += p1.x + (p2.x - p1.x) * prog;
        ty += p1.y + (p2.y - p1.y) * prog;
    } else if (shapeIndex === 8) { // Particle Clock
        updateClockTargets(); 
        let cTarget = clockTargets[i % clockTargets.length];
        tx = cTarget.x;
        ty = cTarget.y;
        fixedJitterX = Math.sin(i * 999.99) * 3; 
        fixedJitterY = Math.cos(i * 888.88) * 3;
    } else if (shapeIndex === 9) { // Heart
        let ht = angle;
        tx += 16 * Math.pow(Math.sin(ht), 3) * 18;
        ty += -(13 * Math.cos(ht) - 5 * Math.cos(2*ht) - 2 * Math.cos(3*ht) - Math.cos(4*ht)) * 18;
    } else if (shapeIndex === 10) { // Butterfly Curve
        let bt = t * Math.PI * 4;
        let r2 = Math.exp(Math.cos(bt)) - 2*Math.cos(4*bt) + Math.pow(Math.sin(bt/12), 5);
        tx += Math.sin(bt) * r2 * 100;
        ty += -Math.cos(bt) * r2 * 100;
    } else if (shapeIndex === 11) { // Rose / Flower (k=5 petals)
        let k = 5;
        let roseR = 280 * Math.cos(k * angle);
        tx += roseR * Math.cos(angle);
        ty += roseR * Math.sin(angle);
    } else if (shapeIndex === 12) { // Atom (3 elliptical orbits)
        let orbit = i % 3;
        let orbitAngle = angle + (orbit * Math.PI / 3);
        let rx = 300, ry = 100;
        let cosR = Math.cos(orbit * Math.PI / 3);
        let sinR = Math.sin(orbit * Math.PI / 3);
        let ox = Math.cos(orbitAngle) * rx;
        let oy = Math.sin(orbitAngle) * ry;
        tx += ox * cosR - oy * sinR;
        ty += ox * sinR + oy * cosR;
    } else if (shapeIndex === 13) { // Crescent Moon
        let moonR = 250;
        let moonAngle = angle;
        if (i % 2 === 0) {
            tx += Math.cos(moonAngle) * moonR;
            ty += Math.sin(moonAngle) * moonR;
        } else {
            tx += Math.cos(moonAngle) * moonR + 100;
            ty += Math.sin(moonAngle) * moonR;
        }
    } else if (shapeIndex === 14) { // Sine Wave
        let waveX = (t * width * 0.7) - (width * 0.35) + (width / 2);
        let waveY = Math.sin(t * Math.PI * 6) * 200;
        tx = waveX;
        ty = (height / 2) + waveY;
        fixedJitterX = Math.sin(i * 456.78) * 8;
        fixedJitterY = Math.cos(i * 321.09) * 8;
    } else if (shapeIndex === 15) { // Cross / Plus
        let arm = i % 4;
        let prog = (t * 4) - Math.floor(t * 4);
        let len = 280;
        let thickness = 60;
        if (arm === 0) { tx += (prog - 0.5) * 2 * len; ty += (Math.sin(i * 111.11) * thickness); }
        else if (arm === 1) { tx += (Math.sin(i * 222.22) * thickness); ty += (prog - 0.5) * 2 * len; }
        else if (arm === 2) { tx += (prog - 0.5) * 2 * len; ty += (Math.cos(i * 333.33) * thickness); }
        else { tx += (Math.cos(i * 444.44) * thickness); ty += (prog - 0.5) * 2 * len; }
    } else if (shapeIndex === 16) { // Hexagon
        let hexSide = Math.floor(t * 6);
        let hexProg = (t * 6) - hexSide;
        let hexR = 280;
        let a1h = (hexSide * 60 - 90) * (Math.PI / 180);
        let a2h = ((hexSide + 1) * 60 - 90) * (Math.PI / 180);
        tx += Math.cos(a1h) * hexR + (Math.cos(a2h) * hexR - Math.cos(a1h) * hexR) * hexProg;
        ty += Math.sin(a1h) * hexR + (Math.sin(a2h) * hexR - Math.sin(a1h) * hexR) * hexProg;
    } else if (shapeIndex === 17) { // Symbol Scanner
        updateSymbolTargets();
        let sTarget = symbolTargets[i % symbolTargets.length];
        tx = sTarget.x;
        ty = sTarget.y;
        fixedJitterX = Math.sin(i * 777.77) * 3;
        fixedJitterY = Math.cos(i * 666.66) * 3;

    } else if (shapeIndex === 19) { // Saturn & Planetary Ring System
        if (i % 3 === 0) {
            // Planet Sphere
            let pR = 120 + Math.sin(i * 333.33) * 10;
            tx += Math.cos(angle) * pR;
            ty += Math.sin(angle) * pR;
        } else {
            // Tilted Elliptical Rings
            let ringR = 210 + (t * 140);
            let tilt = 0.38;
            let rx = Math.cos(angle) * ringR;
            let ry = Math.sin(angle) * ringR * tilt;
            // Rotate ring plane by 25 deg
            let cosRot = Math.cos(0.44), sinRot = Math.sin(0.44);
            tx += rx * cosRot - ry * sinRot;
            ty += rx * sinRot + ry * cosRot;
        }
    } else if (shapeIndex === 20) { // 4D Hypercube / Tesseract Projection
        let part = i % 3;
        if (part === 0) {
            // Outer Square (size 320)
            let s = Math.floor(t * 4);
            let prog = (t * 4) - s;
            let sz = 240;
            let p1, p2;
            if (s === 0) { p1 = {x: -sz, y: -sz}; p2 = {x: sz, y: -sz}; }
            else if (s === 1) { p1 = {x: sz, y: -sz}; p2 = {x: sz, y: sz}; }
            else if (s === 2) { p1 = {x: sz, y: sz}; p2 = {x: -sz, y: sz}; }
            else { p1 = {x: -sz, y: sz}; p2 = {x: -sz, y: -sz}; }
            tx += p1.x + (p2.x - p1.x) * prog;
            ty += p1.y + (p2.y - p1.y) * prog;
        } else if (part === 1) {
            // Inner Square (size 120)
            let s = Math.floor(t * 4);
            let prog = (t * 4) - s;
            let sz = 120;
            let p1, p2;
            if (s === 0) { p1 = {x: -sz, y: -sz}; p2 = {x: sz, y: -sz}; }
            else if (s === 1) { p1 = {x: sz, y: -sz}; p2 = {x: sz, y: sz}; }
            else if (s === 2) { p1 = {x: sz, y: sz}; p2 = {x: -sz, y: sz}; }
            else { p1 = {x: -sz, y: sz}; p2 = {x: -sz, y: -sz}; }
            tx += p1.x + (p2.x - p1.x) * prog;
            ty += p1.y + (p2.y - p1.y) * prog;
        } else {
            // Diagonal Connecting Corner Struts
            let corner = Math.floor(t * 4);
            let prog = (t * 4) - corner;
            let cSigns = [{x:-1, y:-1}, {x:1, y:-1}, {x:1, y:1}, {x:-1, y:1}][corner];
            tx += cSigns.x * (120 + prog * 120);
            ty += cSigns.y * (120 + prog * 120);
        }
    } else if (shapeIndex === 21) { // Astroid / 4-Point Cosmic Star Nebula
        tx += Math.pow(Math.cos(angle), 3) * 320;
        ty += Math.pow(Math.sin(angle), 3) * 320;
    } else if (shapeIndex === 22) { // Lissajous Torus Knot (3D Trefoil)
        tx += (Math.sin(2 * angle) + 2 * Math.sin(angle)) * 95;
        ty += (Math.cos(2 * angle) - 2 * Math.cos(angle)) * 95;
    } else if (shapeIndex === 23) { // Fibonacci Sunflower Galaxy (Vogel Model)
        let r = Math.sqrt(i) * 3.4;
        let theta = i * 2.3999632; // Golden angle
        tx += Math.cos(theta) * r;
        ty += Math.sin(theta) * r;
        fixedJitterX = 0; fixedJitterY = 0;
    } else if (shapeIndex === 24) { // Lotus 8-Petal Mandala
        let lotusR = 250 * (Math.cos(4 * angle) + 0.35 * Math.cos(8 * angle));
        tx += Math.cos(angle) * lotusR;
        ty += Math.sin(angle) * lotusR;
    } else if (shapeIndex === 25) { // Twin Spiral Galaxy (Yin-Yang Arms)
        let arm = i % 2;
        let spiralAngle = angle * 2.8;
        let r = (t * 330);
        tx += Math.cos(spiralAngle + arm * Math.PI) * r;
        ty += Math.sin(spiralAngle + arm * Math.PI) * r;
    } else if (shapeIndex === 26) { // Octagram (8-Point Star of Ishtar)
        let pt = Math.floor(t * 8);
        let prog = (t * 8) - pt;
        let rA = pt % 2 === 0 ? 320 : 130;
        let rB = pt % 2 === 0 ? 130 : 320;
        let aA = (pt * 45 - 90) * (Math.PI / 180);
        let aB = ((pt + 1) * 45 - 90) * (Math.PI / 180);
        tx += Math.cos(aA)*rA + (Math.cos(aB)*rB - Math.cos(aA)*rA) * prog;
        ty += Math.sin(aA)*rA + (Math.sin(aB)*rB - Math.sin(aA)*rA) * prog;
    } else if (shapeIndex === 27) { // Cardioid / Apple Curve
        let cardR = 150 * (1 - Math.cos(angle));
        tx += Math.cos(angle) * cardR;
        ty += Math.sin(angle) * cardR - 60;
    } else if (shapeIndex === 28) { // Nested Pulsar Radar Rings
        let ringLevel = i % 4;
        let r = 80 + ringLevel * 75 + Math.sin(i * 444.44) * 8;
        tx += Math.cos(angle) * r;
        ty += Math.sin(angle) * r;
    } else if (shapeIndex === 29) { // Interlocking Cassini Circles
        let ringChoice = i % 2 === 0 ? -1 : 1;
        let r = 180 + Math.sin(i * 777.77) * 12;
        tx += Math.cos(angle) * r + (ringChoice * 110);
        ty += Math.sin(angle) * r;
    } else if (shapeIndex === 30) { // Superformula Alien Geometry
        let m = 7;
        let part1 = Math.pow(Math.abs(Math.cos(m * angle / 4)), 1.7);
        let part2 = Math.pow(Math.abs(Math.sin(m * angle / 4)), 1.7);
        let sfR = Math.pow(part1 + part2, -1 / 0.25) * 220;
        tx += Math.cos(angle) * sfR;
        ty += Math.sin(angle) * sfR;
    }
    
    return { x: tx + fixedJitterX, y: ty + fixedJitterY };
}

// Pseudo-random noise for Curl Noise simulation
function noise(x, y, t) {
    return Math.sin(x * 0.002 + t) + Math.cos(y * 0.002 + t);
}

class Particle {
    constructor(index) {
        this.index = index;
        this.reset();
        this.life = Math.random() * 500; 
        // Species: 0 (Prey - Blue/Cyan), 1 (Predator - Red/Orange)
        this.species = Math.random() > 0.15 ? 0 : 1; 
    }
    
    reset() {
        if (typeof isIdle !== 'undefined' && isIdle && typeof currentShape !== 'undefined') {
            let target = getIdleTarget(this.index, numParticles, currentShape);
            this.x = target.x + (Math.random() - 0.5) * 100;
            this.y = target.y + (Math.random() - 0.5) * 100;
        } else {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
        }
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 0.5;
        this.friction = 0.92; 
        this.mass = Math.random() * 1.5 + 0.5; 
        this.life = Math.random() * 300 + 300; 
    }

    update(dt) {
        this.life -= dt;
        
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distSq = dx * dx + dy * dy;
        let dist = Math.sqrt(distSq) || 1;

        if (isIdle) {
            let target = getIdleTarget(this.index, numParticles, currentShape);
            
            // Breathing effect: gently pulse the shape in and out
            let breathScale = 1.0 + Math.sin(breathPhase) * 0.06; // ±6% scale
            let cx = width / 2;
            let cy = height / 2;
            target.x = cx + (target.x - cx) * breathScale;
            target.y = cy + (target.y - cy) * breathScale;
            
            let tdx = target.x - this.x;
            let tdy = target.y - this.y;
            
            if (currentStyle === 0) {
                // RIGID AND SHARP
                this.vx += tdx * 0.02 * dt;
                this.vy += tdy * 0.02 * dt;
                this.friction = 0.70; // High friction, locks into place quickly
            } else {
                // FLUIDIC AND SOFT
                this.vx += tdx * 0.003 * dt;
                this.vy += tdy * 0.003 * dt;
                
                // Very gentle ambient floating when they reach the shape
                let noiseAngle = noise(this.x, this.y, globalTime * 0.001) * Math.PI * 2;
                this.vx += Math.cos(noiseAngle) * 0.2 * dt;
                this.vy += Math.sin(noiseAngle) * 0.2 * dt;
                
                this.friction = 0.88; // Smooth, floaty friction
            }
        } else {
            this.friction = 0.92; // Normal fluid friction
            
            if (currentMode === 'Curl Noise Fluid') {
            // True Curl Noise Approximation
            let n1 = noise(this.x, this.y, globalTime * 0.001);
            let n2 = noise(this.x + 100, this.y + 100, globalTime * 0.001);
            this.vx += n2 * 0.5 * dt;
            this.vy -= n1 * 0.5 * dt;

            if (dist < 400) {
                let force = (400 - dist) / 400;
                this.vx += (mouse.vx * force * 0.2) * dt;
                this.vy += (mouse.vy * force * 0.2) * dt;
                this.vx += (dy / dist) * force * 3.5 * dt;
                this.vy -= (dx / dist) * force * 3.5 * dt;
            }
        } 
        else if (currentMode === 'Ecosystem (Predator/Prey)') {
            // Prey (Blue) vs Predators (Red)
            let angle = noise(this.x, this.y, globalTime * 0.002) * Math.PI * 2;
            this.vx += Math.cos(angle) * 0.2 * dt;
            this.vy += Math.sin(angle) * 0.2 * dt;

            // Simple attraction/repulsion based on species
            if (dist < 300) {
                let force = (300 - dist) / 300;
                if (this.species === 0) { // Prey flee mouse
                    this.vx -= (dx / dist) * force * 2 * dt;
                    this.vy -= (dy / dist) * force * 2 * dt;
                } else { // Predators attack mouse
                    this.vx += (dx / dist) * force * 3 * dt;
                    this.vy += (dy / dist) * force * 3 * dt;
                }
            }
        }
        else if (currentMode === 'Gravity Well') {
            if (dist < 800) {
                let force = 2000 / (distSq + 1000); // Inverse square law
                this.vx += dx * force * dt;
                this.vy += dy * force * dt;
                // Add orbital velocity
                this.vx += (dy / dist) * force * 50 * dt;
                this.vy -= (dx / dist) * force * 50 * dt;
            }
            if (dist < 10) this.life = 0; // crushed
        }
        else if (currentMode === 'Boids (Flocking)') {
            // Simplified flocking: align with general noise flow, avoid mouse strongly
            let angle = noise(this.x, this.y, globalTime * 0.005) * Math.PI;
            this.vx += Math.cos(angle) * 0.5 * dt;
            this.vy += Math.sin(angle) * 0.5 * dt;

            if (dist < 200) {
                let force = (200 - dist) / 200;
                this.vx -= (dx / dist) * force * 10 * dt;
                this.vy -= (dy / dist) * force * 10 * dt;
            }
        }
        } // End of !isIdle block
        // Gravitational Shockwave physical impulse
        for (let s = 0; s < shockwaves.length; s++) {
            let sw = shockwaves[s];
            let sdx = this.x - sw.x;
            let sdy = this.y - sw.y;
            let sDist = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
            let diff = Math.abs(sDist - sw.radius);
            if (diff < sw.width) {
                let force = (1 - diff / sw.width) * sw.strength * (1 - sw.radius / sw.maxRadius);
                this.vx += (sdx / sDist) * force * dt;
                this.vy += (sdy / sDist) * force * dt;
            }
        }

        // Random jitter to prevent overlapping
        this.vx += (Math.random() - 0.5) * 0.1 * dt;
        this.vy += (Math.random() - 0.5) * 0.1 * dt;

        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
        
        let prevX = this.x;
        let prevY = this.y;
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        let wrapped = false;
        
        if (this.life <= 0) {
            this.reset();
            wrapped = true; 
        } else {
            if (this.x > width) { this.x = 0; wrapped = true; }
            else if (this.x < 0) { this.x = width; wrapped = true; }
            if (this.y > height) { this.y = 0; wrapped = true; }
            else if (this.y < 0) { this.y = height; wrapped = true; }
        }
        
        if (!wrapped) {
            this.draw(prevX, prevY);
        }
    }

    draw(prevX, prevY) {
        let speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        let lifeAlpha = Math.min(1.0, this.life / 50); 
        
        let baseAlpha = isIdle ? 0.6 : 0.3;
        let alpha = Math.min(speed * 0.05 + baseAlpha, 0.95) * lifeAlpha;
        
        let hue, lightness, sat;
        
        if (currentMode === 'Ecosystem (Predator/Prey)') {
            hue = this.species === 0 ? 200 + speed * 10 : 0 + speed * 10;
            lightness = this.species === 0 ? 70 : 60;
            sat = 100;
        } else {
            // Compute hue for both palettes and blend
            let hueA = this._getHueForPalette(palettes[prevPalette], speed);
            let hueB = this._getHueForPalette(palettes[currentPalette], speed);
            let pA = palettes[prevPalette];
            let pB = palettes[currentPalette];
            
            hue = hueA + (hueB - hueA) * paletteBlend;
            lightness = Math.min(
                (pA.lightBase + (pB.lightBase - pA.lightBase) * paletteBlend) + speed * 2.5, 
                95
            );
            sat = pA.sat + (pB.sat - pA.sat) * paletteBlend;
        }
        
        // --- Sparkle Effect ---
        if (Math.random() < 0.0015) {
            lightness = 98;
            alpha = 0.95;
        }
        
        // --- Depth Glow (idle shapes only) ---
        let renderSize = this.size;
        if (isIdle) {
            let dxc = this.x - (width / 2);
            let dyc = this.y - (height / 2);
            let distFromCenter = Math.sqrt(dxc * dxc + dyc * dyc);
            let maxDist = 400;
            let depthFactor = 1.0 - Math.min(distFromCenter / maxDist, 1.0); // 1 at center, 0 at edges
            renderSize = this.size * (0.6 + depthFactor * 1.4); // 0.6x at edge, 2x at center
            alpha *= (0.5 + depthFactor * 0.5); // Dimmer at edges
            lightness = Math.min(lightness + depthFactor * 15, 98); // Brighter at center
        }
        
        ctx.beginPath();
        if (isIdle && currentStyle === 0) {
            ctx.arc(this.x, this.y, renderSize * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lightness}%, ${alpha})`;
            ctx.fill();
        } else {
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lightness}%, ${alpha})`;
            ctx.lineWidth = renderSize;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }
    
    _getHueForPalette(p, speed) {
        if (p.hueBase === null) {
            return ((this.x / width) * 180) + ((this.y / height) * 180) + globalTime + (speed * 3);
        } else {
            let spatialHue = ((this.x / width) + (this.y / height)) * p.hueRange;
            return p.hueBase + spatialHue + (speed * 3) + (globalTime * 0.5);
        }
    }
}

function init() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(i));
    }
}

function resize() {
    width = Math.max(window.innerWidth, window.screen.width);
    height = Math.max(window.innerHeight, window.screen.height);
    canvas.width = width;
    canvas.height = height;
    init();
}

window.addEventListener('resize', resize);
resize();

let lastObservedMinute = new Date().getMinutes();

function animate() {
    timeScale += (targetTimeScale - timeScale) * 0.02;
    let dt = timeScale;

    globalTime += 0.5 * dt;

    // Check for Minute Tick Shockwave
    let currentMinute = new Date().getMinutes();
    if (currentMinute !== lastObservedMinute) {
        lastObservedMinute = currentMinute;
        triggerShockwave(width / 2, height / 2, Math.max(width, height) * 0.85, 18);
    }

    // Advance breathing phase when idle
    if (isIdle) {
        breathPhase += 0.015 * dt; // Very slow, hypnotic pulse
    }
    
    // Advance palette crossfade (0 -> 1 over ~3 seconds)
    if (paletteBlend < 1.0) {
        paletteBlend = Math.min(1.0, paletteBlend + 0.006 * dt);
    }
    
    // Advance vignette pulse
    vignettePhase += 0.008 * dt;

    // --- Meteor Timer & Spawning ---
    meteorTimer -= 1 * dt;
    if (meteorTimer <= 0) {
        spawnMeteor();
        meteorTimer = Math.random() * 400 + 400; // Next shooting star in 8-16s
    }

    idleTimer += 1 * dt;
    if (idleTimer > 180) {
        if (!isIdle) {
            isIdle = true;
            window.shapeSequenceCounter = 0;
            symbolTargets = []; // Reset so a new symbol is picked
            currentShape = Math.floor(Math.random() * 31);
            if (currentShape === 8) currentShape = 9;
            currentStyle = Math.floor(Math.random() * 2);
            prevPalette = currentPalette;
            currentPalette = Math.floor(Math.random() * palettes.length);
            paletteBlend = 0.0; // Start crossfade
            triggerShockwave(width / 2, height / 2, Math.max(width, height) * 0.65, 12);
            window.lastShapeShift = idleTimer;
        } else {
            if (idleTimer - window.lastShapeShift > 600) {
                window.shapeSequenceCounter++;
                prevPalette = currentPalette;
                currentPalette = Math.floor(Math.random() * palettes.length);
                paletteBlend = 0.0; // Start crossfade
                symbolTargets = []; // Reset so a new symbol is picked next time
                if (window.shapeSequenceCounter >= 6) {
                    currentShape = 8; // Show Clock
                    window.shapeSequenceCounter = 0; // Reset cycle
                    currentStyle = 0; // Force RIGID for text readability
                } else {
                    currentShape = Math.floor(Math.random() * 31);
                    // Skip clock (8) in random pool
                    if (currentShape === 8) currentShape = 9;
                    currentStyle = Math.floor(Math.random() * 2);
                }
                triggerShockwave(width / 2, height / 2, Math.max(width, height) * 0.65, 12);
                window.lastShapeShift = idleTimer;
            }
        }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${0.25 * dt})`; 
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalCompositeOperation = 'lighter';

    // --- Render & Update Shooting Stars / Meteors ---
    for (let m = meteors.length - 1; m >= 0; m--) {
        let met = meteors[m];
        met.x += met.vx * dt;
        met.y += met.vy * dt;
        met.life -= met.decay * dt;
        
        // Spawn trailing luminous sparks
        if (Math.random() < 0.35 * dt) {
            met.sparks.push({
                x: met.x + (Math.random() - 0.5) * 4,
                y: met.y + (Math.random() - 0.5) * 4,
                vx: -met.vx * 0.08 + (Math.random() - 0.5) * 1.5,
                vy: -met.vy * 0.08 + (Math.random() - 0.5) * 1.5,
                life: 1.0,
                size: Math.random() * 1.5 + 0.5
            });
        }
        
        let velMag = Math.sqrt(met.vx * met.vx + met.vy * met.vy) || 1;
        let tailX = met.x - (met.vx / velMag) * met.len * met.life;
        let tailY = met.y - (met.vy / velMag) * met.len * met.life;
        
        let grad = ctx.createLinearGradient(tailX, tailY, met.x, met.y);
        grad.addColorStop(0, `hsla(${met.hue}, ${met.sat}%, ${met.lightness}%, 0)`);
        grad.addColorStop(0.7, `hsla(${met.hue}, ${met.sat}%, ${met.lightness}%, ${met.life * 0.5})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${met.life * 0.9})`);
        
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(met.x, met.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = met.size;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Meteor glowing nucleus
        ctx.beginPath();
        ctx.arc(met.x, met.y, met.size * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${met.life})`;
        ctx.fill();
        
        // Sparks
        for (let sp = met.sparks.length - 1; sp >= 0; sp--) {
            let s = met.sparks[sp];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= 0.035 * dt;
            if (s.life > 0) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${met.hue}, ${met.sat}%, 90%, ${s.life * met.life * 0.7})`;
                ctx.fill();
            } else {
                met.sparks.splice(sp, 1);
            }
        }
        
        if (met.life <= 0 || met.x > width + 200 || met.y > height + 200) {
            meteors.splice(m, 1);
        }
    }
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(dt);
    }

    // --- Render Gravitational Shockwave Rings ---
    for (let s = shockwaves.length - 1; s >= 0; s--) {
        let sw = shockwaves[s];
        sw.radius += sw.speed * dt;
        sw.alpha = (1 - (sw.radius / sw.maxRadius)) * 0.7;
        
        if (sw.alpha > 0) {
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            let p = palettes[sw.paletteIndex] || palettes[0];
            let hue = p.hueBase !== null ? p.hueBase + p.hueRange * 0.5 : (globalTime * 2) % 360;
            ctx.strokeStyle = `hsla(${hue}, ${p.sat}%, 85%, ${sw.alpha * 0.5})`;
            ctx.lineWidth = Math.max(1, sw.width * (1 - sw.radius / sw.maxRadius));
            ctx.stroke();
        }
        
        if (sw.radius >= sw.maxRadius) {
            shockwaves.splice(s, 1);
        }
    }
    
    // --- Edge Vignette Glow ---
    let vignetteAlpha = 0.3 + Math.sin(vignettePhase) * 0.1; // Pulses between 0.2 and 0.4
    ctx.globalCompositeOperation = 'source-over';
    let vGrad = ctx.createRadialGradient(width/2, height/2, Math.min(width, height) * 0.25, width/2, height/2, Math.max(width, height) * 0.75);
    vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    vGrad.addColorStop(1, `rgba(0, 0, 0, ${vignetteAlpha})`);
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, width, height);
    
    mouse.vx *= Math.pow(0.8, dt);
    mouse.vy *= Math.pow(0.8, dt);
    
    requestAnimationFrame(animate);
}

animate();
