const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const uiModeBtn = document.getElementById('ui-mode');
const uiThemeBtn = document.getElementById('ui-theme');
let width, height;

let particles = [];
let sparks = [];
const numParticles = 14000;

let mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
let lastMouse = { x: -1000, y: -1000 };
let shockwaves = [];
let wanderingOrbs = [];
let globalTime = 0;

let timeScale = 1.0; 
let targetTimeScale = 1.0;

const modes = ['Vortex', 'Repulsor', 'Black Hole', 'Freeze'];
let currentModeIndex = 0;
let currentMode = modes[currentModeIndex];

const themes = [
    { name: 'Cyberpunk', getHue: (x, y, speed, t) => (x / width * 60) + 280 + (speed * 10) }, 
    { name: 'Fire & Ice', getHue: (x, y, speed, t) => speed > 3 ? 15 + (speed * 5) : 220 + (speed * 2) }, 
    { name: 'Toxic', getHue: (x, y, speed, t) => (y / height * 80) + 90 + (speed * 5) }, 
    { name: 'Ghost', getHue: (x, y, speed, t) => 200 }, 
    { name: 'Rainbow', getHue: (x, y, speed, t) => (x / width * 180) + (y / height * 180) + t + (speed * 3) } 
];
let currentThemeIndex = 0;
let currentTheme = themes[currentThemeIndex];

function cycleMode() {
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    currentMode = modes[currentModeIndex];
    uiModeBtn.innerText = `Physics: ${currentMode}`;
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    currentTheme = themes[currentThemeIndex];
    uiThemeBtn.innerText = `Theme: ${currentTheme.name}`;
}

uiModeBtn.addEventListener('click', cycleMode);
uiThemeBtn.addEventListener('click', cycleTheme);

// Right-click to cycle physics
window.addEventListener('contextmenu', (e) => {
    e.preventDefault(); 
    cycleMode();
});

// Double-click to cycle themes (Better for Mac users than middle-click)
window.addEventListener('dblclick', (e) => {
    e.preventDefault();
    cycleTheme();
});

window.addEventListener('mousemove', (e) => {
    lastMouse.x = mouse.x;
    lastMouse.y = mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    mouse.vx = (mouse.x - lastMouse.x);
    mouse.vy = (mouse.y - lastMouse.y);
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.tagName !== 'DIV') {
        timeScale = 0.05; 
        targetTimeScale = 1.0;
        
        shockwaves.push({
            x: e.clientX,
            y: e.clientY,
            radius: 10,
            force: 80,
            maxRadius: 1500
        });
    }
});

window.addEventListener('mouseout', () => {
    mouse.x = -1000;
    mouse.y = -1000;
    mouse.vx = 0;
    mouse.vy = 0;
});

for(let i = 0; i < 6; i++) {
    wanderingOrbs.push({
        x: Math.random() * window.screen.width,
        y: Math.random() * window.screen.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: Math.random() * 300 + 100,
        type: Math.random() > 0.5 ? 'attract' : 'repel'
    });
}

class Spark {
    constructor(x, y, vx, vy, hue) {
        this.x = x;
        this.y = y;
        this.vx = vx * (Math.random() * 0.5 + 0.5) + (Math.random() - 0.5) * 5;
        this.vy = vy * (Math.random() * 0.5 + 0.5) + (Math.random() - 0.5) * 5;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.02;
        this.hue = hue;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.95; 
        this.vy *= 0.95;
        this.life -= this.decay * dt;
    }
    draw() {
        if (this.life <= 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.random() * 2 + 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, ${this.life})`;
        ctx.fill();
    }
}

class Particle {
    constructor() {
        this.reset();
        this.life = Math.random() * 600; 
    }
    
    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 0.5;
        this.friction = 0.92; 
        this.mass = Math.random() * 1.5 + 0.5; 
        this.life = Math.random() * 400 + 200; 
    }

    update(dt) {
        this.life -= dt;
        this.vx += (Math.random() - 0.5) * 0.1 * dt;
        this.vy += (Math.random() - 0.5) * 0.1 * dt;

        let angle = (Math.sin(this.x * 0.003 + globalTime * 0.002) + Math.cos(this.y * 0.003 + globalTime * 0.002)) * Math.PI * 2;
        this.vx += Math.cos(angle) * 0.3 * dt;
        this.vy += Math.sin(angle) * 0.3 * dt;

        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distSq = dx * dx + dy * dy;
        
        let interactionRadius = currentMode === 'Freeze' ? 40000 : 90000;
        
        if (distSq < interactionRadius) {
            let dist = Math.sqrt(distSq);
            let force = (Math.sqrt(interactionRadius) - dist) / Math.sqrt(interactionRadius);
            
            if (currentMode === 'Vortex') {
                this.vx += (mouse.vx * force * 0.2) / this.mass * dt;
                this.vy += (mouse.vy * force * 0.2) / this.mass * dt;
                
                let crossProduct = (mouse.vx * dy - mouse.vy * dx);
                let swirlDirection = crossProduct > 0 ? 1 : -1;
                
                this.vx += (dy / dist) * force * 3.5 * swirlDirection * dt;
                this.vy -= (dx / dist) * force * 3.5 * swirlDirection * dt;
                
                this.vx += (dx / dist) * force * 1.5 * dt;
                this.vy += (dy / dist) * force * 1.5 * dt;
            } 
            else if (currentMode === 'Repulsor') {
                this.vx -= (dx / dist) * force * 7.0 * dt;
                this.vy -= (dy / dist) * force * 7.0 * dt;
            }
            else if (currentMode === 'Black Hole') {
                this.vx += (dx / dist) * force * 10.0 * dt;
                this.vy += (dy / dist) * force * 10.0 * dt;
                if (dist < 20) {
                    this.life = 0; 
                }
            }
            else if (currentMode === 'Freeze') {
                this.vx *= (1 - (0.1 * dt));
                this.vy *= (1 - (0.1 * dt));
                this.vx += (dx / dist) * force * 0.8 * dt;
                this.vy += (dy / dist) * force * 0.8 * dt;
            }
        }

        for (let orb of wanderingOrbs) {
            let odx = orb.x - this.x;
            let ody = orb.y - this.y;
            let oDistSq = odx * odx + ody * ody;
            if (oDistSq < orb.radius * orb.radius) {
                let oDist = Math.sqrt(oDistSq);
                let oForce = (orb.radius - oDist) / orb.radius;
                if (orb.type === 'repel') {
                    this.vx -= (odx / oDist) * oForce * 1.0 * dt;
                    this.vy -= (ody / oDist) * oForce * 1.0 * dt;
                } else {
                    this.vx += (odx / oDist) * oForce * 0.8 * dt;
                    this.vy += (ody / oDist) * oForce * 0.8 * dt;
                }
            }
        }

        for (let wave of shockwaves) {
            let wdx = wave.x - this.x;
            let wdy = wave.y - this.y;
            let wDistSq = wdx * wdx + wdy * wdy;
            let wDist = Math.sqrt(wDistSq);
            
            if (Math.abs(wDist - wave.radius) < 60) {
                let wForce = (60 - Math.abs(wDist - wave.radius)) / 60;
                this.vx -= (wdx / wDist) * wForce * (wave.force / this.mass) * dt;
                this.vy -= (wdy / wDist) * wForce * (wave.force / this.mass) * dt;
            }
        }
        
        let speedSq = this.vx * this.vx + this.vy * this.vy;
        
        if (speedSq > 80 && Math.random() > 0.8 && sparks.length < 500) {
            let speed = Math.sqrt(speedSq);
            sparks.push(new Spark(this.x, this.y, this.vx, this.vy, currentTheme.getHue(this.x, this.y, speed, globalTime)));
        }
        
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
            this.draw(prevX, prevY, Math.sqrt(speedSq));
        }
    }

    draw(prevX, prevY, speed) {
        let lifeAlpha = 1.0;
        if (this.life < 50) lifeAlpha = this.life / 50; 
        
        let alpha = Math.min(speed * 0.05 + 0.1, 0.95) * lifeAlpha;
        
        let hue = currentTheme.getHue(this.x, this.y, speed, globalTime);
        let lightness = Math.min(50 + speed * 2.5, 95);
        
        if (currentTheme.name === 'Ghost') {
            lightness = Math.min(20 + speed * 5, 100);
            if (speed > 5) hue = 180; 
        }
        
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

function init() {
    particles = [];
    sparks = [];
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
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

function animate() {
    timeScale += (targetTimeScale - timeScale) * 0.02;
    let dt = timeScale;

    globalTime += 0.5 * dt;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${0.22 * dt})`; 
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalCompositeOperation = 'lighter';
    
    for (let orb of wanderingOrbs) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        if (orb.x > width || orb.x < 0) orb.vx *= -1;
        if (orb.y > height || orb.y < 0) orb.vy *= -1;
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let wave = shockwaves[i];
        wave.radius += 25 * dt; 
        wave.force *= Math.pow(0.92, dt); 
        
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${wave.force * 0.01})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (wave.radius > wave.maxRadius || wave.force < 0.1) {
            shockwaves.splice(i, 1);
        }
    }
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(dt);
    }
    
    for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i].update(dt);
        sparks[i].draw();
        if (sparks[i].life <= 0) sparks.splice(i, 1);
    }
    
    mouse.vx *= Math.pow(0.8, dt);
    mouse.vy *= Math.pow(0.8, dt);
    
    requestAnimationFrame(animate);
}

animate();
