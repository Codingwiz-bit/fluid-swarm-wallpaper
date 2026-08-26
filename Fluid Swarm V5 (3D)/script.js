// 3D Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
camera.position.z = 1000;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Use additive blending for glow
document.body.appendChild(renderer.domElement);

// Parallax Mouse
let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
let raycaster = new THREE.Raycaster();
let mouse3D = new THREE.Vector3(0, 0, 0);

window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Particles Setup
const numParticles = 50000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(numParticles * 3);
const velocities = new Float32Array(numParticles * 3);
const colors = new Float32Array(numParticles * 3);
const lives = new Float32Array(numParticles);

const color = new THREE.Color();

for (let i = 0; i < numParticles; i++) {
    let i3 = i * 3;
    // Sphere distribution
    let radius = 800 + Math.random() * 800;
    let theta = Math.random() * Math.PI * 2;
    let phi = Math.acos((Math.random() * 2) - 1);
    
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = (radius * Math.sin(phi) * Math.sin(theta)) * 0.3; // Flatten it like a galaxy disc
    positions[i3 + 2] = radius * Math.cos(phi);

    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;

    // Cyberpunk/Nebula Color Mix
    let isCore = radius < 1000;
    if (isCore) {
        color.setHSL(0.55 + Math.random() * 0.1, 1.0, 0.5 + Math.random() * 0.5); // Cyan/Blue
    } else {
        color.setHSL(0.8 + Math.random() * 0.15, 0.8, 0.3 + Math.random() * 0.5); // Magenta/Purple
    }
    
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    lives[i] = Math.random();
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Create a glowing sprite for the particles
const createParticleTexture = () => {
    let canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    let context = canvas.getContext('2d');
    let gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
};

const material = new THREE.PointsMaterial({
    size: 6,
    vertexColors: true,
    map: createParticleTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// UI Logic
const modes = ['Deep Space Parallax', 'Black Hole Gravity'];
let currentMode = 0;
document.getElementById('ui-mode').addEventListener('click', () => {
    currentMode = (currentMode + 1) % modes.length;
    document.getElementById('ui-mode').innerText = `Mode: ${modes[currentMode]}`;
});
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    currentMode = (currentMode + 1) % modes.length;
    document.getElementById('ui-mode').innerText = `Mode: ${modes[currentMode]}`;
});


// Simple 3D Noise approximation
function noise3D(x, y, z, t) {
    return Math.sin(x*0.001 + t) + Math.cos(y*0.001 + t) + Math.sin(z*0.001 + t);
}

// Animation Loop
let clock = new THREE.Clock();
let globalTime = 0;

function animate() {
    requestAnimationFrame(animate);
    let dt = clock.getDelta();
    globalTime += dt;

    // Smooth Mouse Parallax
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    camera.position.x = mouse.x * 400;
    camera.position.y = mouse.y * 400;
    camera.lookAt(scene.position);

    // Map mouse to 3D world space (Z=0 plane)
    raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), camera);
    let planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    raycaster.ray.intersectPlane(planeZ, mouse3D);

    const pos = geometry.attributes.position.array;
    const vel = velocities;
    
    // CPU Physics Loop
    for (let i = 0; i < numParticles; i++) {
        let i3 = i * 3;
        let x = pos[i3];
        let y = pos[i3 + 1];
        let z = pos[i3 + 2];

        // 1. Orbital Galaxy Rotation
        let distFromCenter = Math.sqrt(x*x + z*z);
        let angle = Math.atan2(z, x);
        let orbitalSpeed = 200 / (distFromCenter + 100); 
        
        vel[i3] -= Math.sin(angle) * orbitalSpeed * dt;
        vel[i3 + 2] += Math.cos(angle) * orbitalSpeed * dt;

        // 2. 3D Fluid Noise (Curl-like)
        let n1 = noise3D(x, y, z, globalTime);
        let n2 = noise3D(x+100, y+100, z+100, globalTime);
        let n3 = noise3D(x-100, y-100, z-100, globalTime);
        
        vel[i3] += n2 * 10 * dt;
        vel[i3+1] += n3 * 10 * dt;
        vel[i3+2] += n1 * 10 * dt;

        // 3. Mouse Interaction Mode
        if (currentMode === 1 && mouse3D) { // Black Hole Gravity
            let dx = mouse3D.x - x;
            let dy = mouse3D.y - y;
            let dz = mouse3D.z - z;
            let distSq = dx*dx + dy*dy + dz*dz;
            
            if (distSq < 400000) { // 2000 radius
                let dist = Math.sqrt(distSq);
                let force = 500000 / (distSq + 1000);
                vel[i3] += (dx/dist) * force * dt;
                vel[i3+1] += (dy/dist) * force * dt;
                vel[i3+2] += (dz/dist) * force * dt;
            }
        }

        // Apply velocities
        pos[i3] += vel[i3];
        pos[i3+1] += vel[i3+1];
        pos[i3+2] += vel[i3+2];

        // Friction
        vel[i3] *= 0.95;
        vel[i3+1] *= 0.95;
        vel[i3+2] *= 0.95;
        
        // Gentle bounds pull to keep galaxy together
        if (distFromCenter > 2000) {
            vel[i3] -= x * 0.0001;
            vel[i3+2] -= z * 0.0001;
        }
    }

    geometry.attributes.position.needsUpdate = true;
    
    // Slowly rotate the entire galaxy as well
    particles.rotation.y += 0.05 * dt;

    renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
