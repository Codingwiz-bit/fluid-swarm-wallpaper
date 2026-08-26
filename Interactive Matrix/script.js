const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height;

// Matrix characters (Katakana + Latin + Numerals)
const characters = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const fontSize = 16;
let columns = [];
let drops = [];

let mouse = { x: -1000, y: -1000, radius: 100 };

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    let numColumns = Math.floor(width / fontSize) + 1;
    drops = [];
    for (let x = 0; x < numColumns; x++) {
        drops[x] = Math.random() * -100; // start offscreen randomly
    }
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mouseout', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});

function draw() {
    // Translucent black background creates the fading trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = fontSize + 'px monospace';
    
    for (let i = 0; i < drops.length; i++) {
        // Random character
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        
        let charX = i * fontSize;
        let charY = drops[i] * fontSize;
        
        // Interactive distance check
        let dx = mouse.x - charX;
        let dy = mouse.y - charY;
        let distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < mouse.radius) {
            // Mouse interaction: bright white and scrambled
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            // Pushes drops down slightly if mouse hits them
            drops[i] += 0.5;
        } else {
            // Normal matrix green
            ctx.fillStyle = '#0F0';
            ctx.shadowBlur = 0;
            // The leading character is lighter
            if (Math.random() > 0.98) {
                ctx.fillStyle = '#cfc';
            }
        }
        
        ctx.fillText(text, charX, charY);
        
        // Reset drop to top randomly
        if (charY > height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        
        // Move drop down
        drops[i]++;
    }
}

function animate() {
    draw();
    // Use timeout to control Matrix speed (it usually shouldn't run at 60fps)
    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 33); // ~30 fps
}
animate();
