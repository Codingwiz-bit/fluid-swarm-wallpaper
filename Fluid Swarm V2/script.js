const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const uiBtn = document.getElementById('ui');
let width, height;

let particles = [];
const numParticles = 16000;

let mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
let lastMouse = { x: -1000, y: -1000 };
let shockwaves = [];
let wanderingOrbs = [];
let globalTime = 0;

const modes = ['Vortex', 'Repulsor', 'Black Hole', 'Freeze'];
let currentModeIndex = 0;
let currentMode = modes[currentModeIndex];

function cycleMode() {
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    currentMode = modes[currentModeIndex];
    uiBtn.innerText = `Mode: ${currentMode}`;
}

uiBtn.addEventListener('click', cycleMode);
window.addEventListener('contextmenu', (e) => {
    e.preventDefault(); 
    cycleMode();
});

window.addEventListener('mousemove', (e) => {
    lastMouse.x = mouse.x;
    lastMouse.y = mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    mouse.vx = mouse.x - lastMouse.x;
    mouse.vy = mouse.y - lastMouse.y;
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target !== uiBtn) {
        shockwaves.push({
            x: e.clientX,
            y: e.clientY,
            radius: 10,
            force: 60,
            maxRadius: 1200
        });
    }
});

window.addEventListener('mouseout', () => {
    mouse.x = -1000;
    mouse.y = -1000;
    mouse.vx = 0;
    mouse.vy = 0;
});

for(let i = 0; i < 5; i++) {
    wanderingOrbs.push({
        x: Math.random() * window.screen.width,
        y: Math.random() * window.screen.height,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        radius: Math.random() * 250 + 150,
        type: Math.random() > 0.5 ? 'attract' : 'repel'
    });
}

class Particle {
    constructor() {
        this.reset();
        this.life = Math.random() * 500; 
    }
    
    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 0.5;
        this.friction = 0.91; 
        this.mass = Math.random() * 1.5 + 0.5; 
        this.life = Math.random() * 300 + 200; 
    }

    update() {
        this.life--;
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        let angle = (Math.sin(this.x * 0.002 + globalTime * 0.005) + Math.cos(this.y * 0.002 + globalTime * 0.005)) * Math.PI * 2;
        this.vx += Math.cos(angle) * 0.25;
        this.vy += Math.sin(angle) * 0.25;

        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distSq = dx * dx + dy * dy;
        
        let interactionRadius = currentMode === 'Freeze' ? 40000 : 80000;
        
        if (distSq < interactionRadius) {
            let dist = Math.sqrt(distSq);
            let force = (Math.sqrt(interactionRadius) - dist) / Math.sqrt(interactionRadius);
            
            if (currentMode === 'Vortex') {
                this.vx += (mouse.vx * force * 0.15) / this.mass;
                this.vy += (mouse.vy * force * 0.15) / this.mass;
                this.vx += (dy / dist) * force * 2.5;
                this.vy -= (dx / dist) * force * 2.5;
                this.vx += (dx / dist) * force * 1.0;
                this.vy += (dy / dist) * force * 1.0;
            } 
            else if (currentMode === 'Repulsor') {
                this.vx -= (dx / dist) * force * 5.0;
                this.vy -= (dy / dist) * force * 5.0;
            }
            else if (currentMode === 'Black Hole') {
                this.vx += (dx / dist) * force * 8.0;
                this.vy += (dy / dist) * force * 8.0;
                if (dist < 15) {
                    this.life = 0; 
                }
            }
            else if (currentMode === 'Freeze') {
                this.vx *= 0.5;
                this.vy *= 0.5;
                this.vx += (dx / dist) * force * 0.5;
                this.vy += (dy / dist) * force * 0.5;
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
                    this.vx -= (odx / oDist) * oForce * 0.8;
                    this.vy -= (ody / oDist) * oForce * 0.8;
                } else {
                    this.vx += (odx / oDist) * oForce * 0.6;
                    this.vy += (ody / oDist) * oForce * 0.6;
                }
            }
        }

        for (let wave of shockwaves) {
            let wdx = wave.x - this.x;
            let wdy = wave.y - this.y;
            let wDistSq = wdx * wdx + wdy * wdy;
            let wDist = Math.sqrt(wDistSq);
            
            if (Math.abs(wDist - wave.radius) < 40) {
                let wForce = (40 - Math.abs(wDist - wave.radius)) / 40;
                this.vx -= (wdx / wDist) * wForce * (wave.force / this.mass);
                this.vy -= (wdy / wDist) * wForce * (wave.force / this.mass);
            }
        }
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        let prevX = this.x;
        let prevY = this.y;
        
        this.x += this.vx;
        this.y += this.vy;
        
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
        
        let lifeAlpha = 1.0;
        if (this.life < 50) lifeAlpha = this.life / 50; 
        
        let alpha = Math.min(speed * 0.05 + 0.1, 0.95) * lifeAlpha;
        
        let hue = ((this.x / width) * 180) + ((this.y / height) * 180) + globalTime + (speed * 3);
        
        if (currentMode === 'Freeze' && Math.sqrt((mouse.x - this.x)**2 + (mouse.y - this.y)**2) < 200) {
            hue = 200 + (speed * 10); 
        }
        
        let lightness = Math.min(50 + speed * 2.5, 95);
        
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
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }
}

function resize() {
    // Using screen width/height ensures we never fall short if Plash reports innerHeight incorrectly
    width = Math.max(window.innerWidth, window.screen.width);
    height = Math.max(window.innerHeight, window.screen.height);
    canvas.width = width;
    canvas.height = height;
    init();
}

window.addEventListener('resize', resize);
resize();

function animate() {
    globalTime += 0.5;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 2, 4, 0.22)'; 
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalCompositeOperation = 'lighter';
    
    for (let orb of wanderingOrbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x > width || orb.x < 0) orb.vx *= -1;
        if (orb.y > height || orb.y < 0) orb.vy *= -1;
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let wave = shockwaves[i];
        wave.radius += 20; 
        wave.force *= 0.94; 
        if (wave.radius > wave.maxRadius || wave.force < 0.1) {
            shockwaves.splice(i, 1);
        }
    }
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
    }
    
    mouse.vx *= 0.8;
    mouse.vy *= 0.8;
    
    requestAnimationFrame(animate);
}

animate();
