const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height;

// The Black Hole (follows the mouse)
let blackHole = { x: window.innerWidth / 2, y: window.innerHeight / 2, mass: 1500, radius: 40 };
let targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// Particles
let particles = [];
const numParticles = 8000;

window.addEventListener('mousemove', (e) => {
    targetMouse.x = e.clientX;
    targetMouse.y = e.clientY;
});

class Particle {
    constructor() {
        this.reset(true);
    }
    
    reset(randomRadius = false) {
        const angle = Math.random() * Math.PI * 2;
        const distance = randomRadius ? 
            Math.random() * (width / 1.5) + blackHole.radius : 
            width / 1.5 + Math.random() * 200;
            
        this.x = targetMouse.x + Math.cos(angle) * distance;
        this.y = targetMouse.y + Math.sin(angle) * distance;
        
        const speed = Math.sqrt(blackHole.mass / distance) * 1.5;
        this.vx = Math.sin(angle) * speed;
        this.vy = -Math.cos(angle) * speed;
        
        this.size = Math.random() * 1.5 + 0.1;
        this.hue = Math.random() * 40 + 10;
        if (Math.random() > 0.9) this.hue = Math.random() * 40 + 200;
    }
    
    update() {
        const dx = blackHole.x - this.x;
        const dy = blackHole.y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        
        if (dist < blackHole.radius - 5) {
            this.reset(false);
            return;
        }
        
        const force = blackHole.mass / distSq;
        const ax = (dx / dist) * force;
        const ay = (dy / dist) * force;
        
        this.vx += ax;
        this.vy += ay;
        
        this.vx *= 0.999;
        this.vy *= 0.999;
        
        this.x += this.vx;
        this.y += this.vy;
    }
    
    draw() {
        const dx = blackHole.x - this.x;
        const dy = blackHole.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        let intensity = Math.max(0, 1 - (dist / (width/2)));
        let brightness = 50 + (intensity * 50);
        let alpha = intensity * 0.8 + 0.2;
        
        if (dist < blackHole.radius * 3) {
            brightness = 100;
            alpha = 1.0;
        }

        ctx.fillStyle = `hsla(${this.hue}, 100%, ${brightness}%, ${alpha})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    if (particles.length === 0) {
        initParticles();
    }
}

window.addEventListener('resize', resize);
// Call resize AFTER everything is defined
resize();

function animate() {
    blackHole.x += (targetMouse.x - blackHole.x) * 0.05;
    blackHole.y += (targetMouse.y - blackHole.y) * 0.05;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 2, 5, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }
    
    ctx.globalCompositeOperation = 'source-over';
    
    let gradient = ctx.createRadialGradient(blackHole.x, blackHole.y, blackHole.radius - 10, blackHole.x, blackHole.y, blackHole.radius * 3);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.1, 'rgba(255, 200, 100, 0.4)');
    gradient.addColorStop(0.5, 'rgba(100, 50, 20, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(blackHole.x, blackHole.y, blackHole.radius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(blackHole.x, blackHole.y, blackHole.radius, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(animate);
}

animate();
