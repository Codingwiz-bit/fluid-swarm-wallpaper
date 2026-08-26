const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height;

let particles = [];
const numParticles = 12000; // Massive swarm for high fidelity

let mouse = { x: -1000, y: -1000, isDown: false };
let globalHue = 0;

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => mouse.isDown = true);
window.addEventListener('mouseup', () => mouse.isDown = false);
window.addEventListener('mouseout', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 0.5;
        this.friction = 0.94; // Slide smoothly
        this.speed = Math.random() * 0.15 + 0.05;
        this.colorOffset = Math.random() * 40; // Slight variance in color
    }

    update() {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distSq = dx * dx + dy * dy;
        
        // Ambient Flow Field (creates organic wind/liquid patterns)
        let angle = (Math.sin(this.x * 0.003) + Math.cos(this.y * 0.003)) * Math.PI * 2;
        let ambientVx = Math.cos(angle) * this.speed;
        let ambientVy = Math.sin(angle) * this.speed;

        this.vx += ambientVx;
        this.vy += ambientVy;

        // Mouse Interaction
        if (distSq < 200000) { // Large radius
            let dist = Math.sqrt(distSq);
            let force = (400 - dist) / 400; // Strength based on proximity
            
            if (mouse.isDown) {
                // Repel violently on click (Explosion)
                this.vx -= (dx / dist) * force * 15;
                this.vy -= (dy / dist) * force * 15;
            } else {
                // Attract and swirl (Vortex)
                let swirlForceX = (dy / dist) * force * 3;
                let swirlForceY = -(dx / dist) * force * 3;
                
                this.vx += (dx / dist) * force * 1.5 + swirlForceX;
                this.vy += (dy / dist) * force * 1.5 + swirlForceY;
            }
        }
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        let prevX = this.x;
        let prevY = this.y;
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Wrap around screen boundaries seamlessly
        let wrapped = false;
        if (this.x > width) { this.x = 0; wrapped = true; }
        else if (this.x < 0) { this.x = width; wrapped = true; }
        if (this.y > height) { this.y = 0; wrapped = true; }
        else if (this.y < 0) { this.y = height; wrapped = true; }
        
        // If it didn't teleport across the screen, draw a trailing line
        if (!wrapped) {
            this.draw(prevX, prevY);
        }
    }

    draw(prevX, prevY) {
        let speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // Faster particles are brighter and more opaque
        let alpha = Math.min(speed * 0.08 + 0.1, 0.9);
        
        // Shift colors based on global time and individual speed
        let hue = globalHue + this.colorOffset + (speed * 8);
        
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
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
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    init();
}

window.addEventListener('resize', resize);
resize();

function animate() {
    // Clear with a translucent black to leave smooth fading trails
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5, 5, 8, 0.15)'; 
    ctx.fillRect(0, 0, width, height);
    
    // Additive blending creates intense glowing where particles overlap
    ctx.globalCompositeOperation = 'lighter';
    
    // Slowly cycle through the color spectrum
    globalHue += 0.2;
    if (globalHue > 360) globalHue = 0;
    
    // Update and draw all particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
    }
    
    requestAnimationFrame(animate);
}

animate();
