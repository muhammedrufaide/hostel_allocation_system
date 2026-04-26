import * as THREE from 'three';
import gsap from 'gsap';

export function initCanvas(lenis) {
  const container = document.getElementById('canvas-container');
  
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 10;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Enable physically correct lighting for the glass material
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const blueLight = new THREE.PointLight(0x00d4ff, 50, 15);
  blueLight.position.set(-2, -2, 2);
  scene.add(blueLight);

  const purpleLight = new THREE.PointLight(0x9d00ff, 50, 15);
  purpleLight.position.set(2, 2, -2);
  scene.add(purpleLight);

  // --- The 3D Organic Object (Jellyfish/Flower shape) ---
  const objectGroup = new THREE.Group();
  scene.add(objectGroup);

  // 1. The Core (Glowing Purple/Cyan energy)
  const coreGeometry = new THREE.IcosahedronGeometry(1.2, 16);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d00ff,
    emissive: 0x9d00ff,
    emissiveIntensity: 2.0,
    wireframe: true,
    transparent: true,
    opacity: 0.6
  });
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  objectGroup.add(coreMesh);

  // 2. The Glass Outer Shell (Translucent petals/membrane)
  // We use a high-end MeshPhysicalMaterial to simulate thick glass refraction
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.15,
    transmission: 1.0, // glass effect
    thickness: 1.5, // volume for refraction
    ior: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    transparent: true
  });

  // Create a complex overlapping geometry mimicking a flower/jellyfish
  // We'll merge several deformed spheres or use a customized parametric shape
  const shellGeometry = new THREE.SphereGeometry(2.5, 64, 64);
  
  // Save original vertices for displacement animation
  const positionAttribute = shellGeometry.attributes.position;
  const vertex = new THREE.Vector3();
  const originalVertices = [];
  for (let i = 0; i < positionAttribute.count; i++) {
    vertex.fromBufferAttribute(positionAttribute, i);
    originalVertices.push(vertex.clone());
  }

  const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
  objectGroup.add(shellMesh);

  // --- Background Particles ---
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 800;
  const posArray = new Float32Array(particlesCount * 3);
  for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 25;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.03,
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });
  const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particlesMesh);

  // --- Animation & Parallax ---
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
  });

  // Scroll Parallax linked to Lenis
  lenis.on('scroll', (e) => {
    const scrollY = window.scrollY;
    
    // Scale and rotate object dynamically on scroll
    const scale = 1 + (scrollY * 0.0005);
    objectGroup.scale.set(scale, scale, scale);
    
    objectGroup.rotation.x = scrollY * 0.001;
    objectGroup.position.y = -scrollY * 0.003;
    
    particlesMesh.position.y = scrollY * 0.002;
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();

    // 1. Organic Breathing Animation on the Glass Shell
    const positions = shellMesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const v = originalVertices[i];
      // Complex noise displacement formula to make it look like an organic folding flower
      const noise = Math.sin(v.x * 2.0 + time) * Math.cos(v.y * 2.0 + time) * Math.sin(v.z * 2.0 + time) * 0.4;
      const stretch = Math.sin(v.y * 3.0 - time * 2.0) * 0.2;
      
      positions.setXYZ(
        i, 
        v.x + (v.x * noise) + stretch, 
        v.y + (v.y * noise), 
        v.z + (v.z * noise) - stretch
      );
    }
    shellMesh.geometry.computeVertexNormals();
    positions.needsUpdate = true;

    // 2. Core pulsing and rotation
    coreMesh.rotation.y = time * 0.5;
    coreMesh.rotation.z = time * 0.3;
    const pulse = Math.sin(time * 2.0) * 0.2 + 1.0;
    coreMesh.scale.set(pulse, pulse, pulse);

    // 3. Mouse Interaction Parallax
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;
    
    objectGroup.rotation.y += 0.02 * (targetX - objectGroup.rotation.y);
    objectGroup.rotation.x += 0.02 * (targetY - objectGroup.rotation.x);
    
    particlesMesh.rotation.y = -time * 0.02;

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
