const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height;

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let particles = [];
const numParticles = 100;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// A particle that follows the mouse with spring physics
class Particle {
    constructor(id) {
        this.id = id;
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        // Each particle follows a slightly offset target around the mouse
        this.angle = Math.random() * Math.PI * 2;
        this.radius = Math.random() * 150 + 50;
        this.speed = Math.random() * 0.05 + 0.02;
        this.friction = 0.92; // smooth trailing
        this.spring = 0.02;
        this.history = [];
        this.maxHistory = 40;
        this.hue = Math.random() * 360;
    }
    
    update() {
        this.angle += this.speed;
        
        // Target revolves around mouse
        let targetX = mouse.x + Math.cos(this.angle) * this.radius;
        let targetY = mouse.y + Math.sin(this.angle) * this.radius;
        
        // Spring physics towards target
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        
        this.vx += dx * this.spring;
        this.vy += dy * this.spring;
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.hue += 0.5;
        
        this.history.unshift({ x: this.x, y: this.y });
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    }
    
    draw() {
        if (this.history.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        
        for (let i = 1; i < this.history.length - 1; i++) {
            let xc = (this.history[i].x + this.history[i + 1].x) / 2;
            let yc = (this.history[i].y + this.history[i + 1].y) / 2;
            ctx.quadraticCurveTo(this.history[i].x, this.history[i].y, xc, yc);
        }
        
        ctx.strokeStyle = `hsla(${this.hue}, 100%, 60%, 0.5)`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(i));
}

function animate() {
    // Fade out previous frames for a smooth trail effect
    ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    
    requestAnimationFrame(animate);
}
animate();
