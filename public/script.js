import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// env
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Skyblue background

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// ground
const planeGeometry = new THREE.PlaneGeometry(200, 200);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 }); // green thing
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

const gridHelper = new THREE.GridHelper(200, 50, 0x000000, 0x000000);
scene.add(gridHelper);

// varibles
let model;
let mixer;
let idleAction;
let runAction;
let currentAction = null; // track the active animation

const moveSpeed = 0.1;
const rotationSpeed = 0.05;
const worldBoundary = 50;
const keys = { w: false, s: false, a: false, d: false };

const loader = new FBXLoader();

// idle model
loader.load(
  "Idle.fbx", 
  (fbx) => {
    model = fbx;
    model.scale.set(0.01, 0.01, 0.01);
    model.position.set(0, 0, 0);
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);

    if (fbx.animations.length > 0) {
      const idleClip = fbx.animations[0];
      idleAction = mixer.clipAction(idleClip);
      idleAction.play(); // Start with idle
      currentAction = idleAction;
    }

    // runnning model
    loader.load(
      "Running.fbx", 
      (runFbx) => {
        if (runFbx.animations.length > 0) {
          const runClip = runFbx.animations[0];
          const filteredTracks = runClip.tracks.filter(
            (track) => !track.name.endsWith(".position")
          );
          const filteredRunClip = new THREE.AnimationClip(
            runClip.name, runClip.duration, filteredTracks
          );
          runAction = mixer.clipAction(filteredRunClip);
        }
      },
      undefined,
      (err) => console.error("Error loading Running.fbx:", err)
    );
  },
  undefined,
  (error) => console.error("Error loading Idle.fbx:", error)
);

// keyboard events
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (keys[key] !== undefined) {
    keys[key] = true;
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (keys[key] !== undefined) {
    keys[key] = false;
  }
});

// smoothfade
function crossFadeTo(newAction, duration = 0.4) {
  if (!newAction || !currentAction || newAction === currentAction) return;
  
  newAction.reset();
  newAction.crossFadeFrom(currentAction, duration, false);
  newAction.play();
  currentAction = newAction;
}

// camera follow
function updateCamera() {
  if (!model) return;
  const offset = new THREE.Vector3(0, 2, -4);
  offset.applyQuaternion(model.quaternion);
  const desiredPosition = model.position.clone().add(offset);
  camera.position.lerp(desiredPosition, 0.1);
  
  const target = model.position.clone();
  target.y += 1;
  camera.lookAt(target);
}

// loop animation
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  if (model) {
    // forward and backward
    const movingForward = keys.w;
    const movingBackward = keys.s;
    const moving = movingForward || movingBackward;

    if (moving) {
      if (runAction && currentAction !== runAction) {
        crossFadeTo(runAction, 0.5);
      }
      if (movingBackward && !movingForward) {
        runAction.timeScale = 0.5;
      } else {
        runAction.timeScale = 1.0;
      }
      
    } else {
      if (idleAction && currentAction !== idleAction) {
        crossFadeTo(idleAction, 0.5);
      }
    }

    // movement and orientation 
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(model.quaternion);
    
    if (movingForward) {
      model.position.add(forward.clone().multiplyScalar(moveSpeed));
    }
    if (movingBackward) {
      model.position.add(forward.clone().multiplyScalar(-moveSpeed));
    }
    if (keys.a) {
      model.rotation.y += rotationSpeed;
    }
    if (keys.d) {
      model.rotation.y -= rotationSpeed;
    }

    // world boundary
    model.position.x = Math.max(-worldBoundary, Math.min(worldBoundary, model.position.x));
    model.position.z = Math.max(-worldBoundary, Math.min(worldBoundary, model.position.z));

    updateCamera();
  }

  renderer.render(scene, camera);
}
animate();

// resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
