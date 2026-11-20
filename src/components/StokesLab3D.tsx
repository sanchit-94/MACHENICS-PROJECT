import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import {
  BALL_MATERIAL_PRESETS,
  LIQUID_PRESETS,
  clampMarkPositions,
  computePredictedTimeS,
  evaluateFallKinematics,
  type BallCalculationResult,
  type FallKinematicsState,
  type LabEnvironment,
} from '../physics/stokes';

export type CameraPresetId = 'perspective' | 'front' | 'side' | 'top' | 'follow';

export interface SimulationConfig {
  env: LabEnvironment;
  selectedBall: BallCalculationResult;
  velocitySource: 'live_physics' | 'measured_run';
  activeViscosityPas: number;
  pedagogicalRamp: boolean;
}

export interface GateTimingState {
  active: boolean;
  elapsedS: number;
  completedTransitS: number | null;
}

interface StokesLab3DProps {
  config: SimulationConfig;
  compactPreview?: boolean;
  onKinematicsSample?: (state: FallKinematicsState) => void;
  onGateTimingSample?: (gate: GateTimingState) => void;
  onSimStatusChange?: (status: 'ready' | 'running' | 'paused' | 'completed') => void;
  onMarksChange?: (markAMm: number, markBMm: number) => void;
  externalRunSignal?: number;
  externalStopSignal?: number;
  externalResetSignal?: number;
  className?: string;
}

interface ProjectedLabels {
  fg: { x: number; y: number; visible: boolean; text: string };
  fb: { x: number; y: number; visible: boolean; text: string };
  fd: { x: number; y: number; visible: boolean; text: string };
  markA: { x: number; y: number; visible: boolean; text: string };
  markB: { x: number; y: number; visible: boolean; text: string };
  dimL: { x: number; y: number; visible: boolean; text: string };
  dimH: { x: number; y: number; visible: boolean; text: string };
  dimR: { x: number; y: number; visible: boolean; text: string };
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createRulerCanvasTexture(columnHeightMm: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  const ticks = 40;
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= ticks; i++) {
    const frac = i / ticks;
    const y = 32 + frac * (canvas.height - 64);
    const isMajor = i % 5 === 0;
    const tickLen = isMajor ? 56 : 28;

    ctx.strokeStyle = isMajor ? '#38bdf8' : 'rgba(148, 163, 184, 0.7)';
    ctx.lineWidth = isMajor ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(8 + tickLen, y);
    ctx.stroke();

    if (isMajor) {
      const mmVal = Math.round(frac * columnHeightMm);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`${mmVal} mm`, 74, y);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.28)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createForceArrowMesh(colorHex: number): {
  group: THREE.Group;
  shaft: THREE.Mesh;
  head: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.2,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 14);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, material);

  const headGeo = new THREE.ConeGeometry(0.052, 0.14, 16);
  headGeo.translate(0, 0.07, 0);
  const head = new THREE.Mesh(headGeo, material);

  group.add(shaft, head);
  return { group, shaft, head, material };
}

function computeApparatusMetrics(env: LabEnvironment, radiusMm: number, lengthMm: number) {
  const safeH = Math.max(10, env.columnHeightMm);
  const colHeightWorld = THREE.MathUtils.clamp(safeH / 100, 3.0, 5.8);
  const cylRadiusWorld = THREE.MathUtils.clamp((env.cylinderDiameterMm / 2) / 38, 0.38, 1.25);
  const ballRadiusWorld = THREE.MathUtils.clamp(
    radiusMm / 14,
    0.036,
    Math.min(cylRadiusWorld * 0.85, 0.36),
  );

  const liquidBottomY = 0.23;
  const liquidTopY = liquidBottomY + colHeightWorld;
  const releaseDepthWorld = Math.min(0.14, ballRadiusWorld * 0.75 + 0.04);
  const releaseY = liquidTopY - releaseDepthWorld;
  const bottomRestY = liquidBottomY + ballRadiusWorld + 0.04;
  const usableTravelWorld = Math.max(0.5, releaseY - bottomRestY);

  // Calibrate world units per physical meter so ruler 0..H mm matches world coordinates linearly
  const worldPerMeter = colHeightWorld / (safeH * 1e-3);
  const travelM = Math.max(0.01, usableTravelWorld / worldPerMeter);

  const rawA = typeof env.markAMm === 'number' && Number.isFinite(env.markAMm) ? env.markAMm : 80;
  const rawB =
    typeof env.markBMm === 'number' && Number.isFinite(env.markBMm)
      ? env.markBMm
      : rawA + lengthMm;
  const clamped = clampMarkPositions({
    markAMm: rawA,
    markBMm: rawB,
    columnHeightMm: safeH,
  });

  const minWorldB = bottomRestY + 0.02;
  const maxWorldA = releaseY - 0.03;

  let markAY = liquidTopY - clamped.markAMm * 1e-3 * worldPerMeter;
  let markBY = liquidTopY - clamped.markBMm * 1e-3 * worldPerMeter;

  markAY = Math.min(maxWorldA, Math.max(minWorldB + 0.06, markAY));
  markBY = Math.max(minWorldB, Math.min(markAY - 0.06, markBY));

  return {
    colHeightWorld,
    cylRadiusWorld,
    ballRadiusWorld,
    liquidBottomY,
    liquidTopY,
    releaseY,
    markAY,
    markBY,
    markAMm: clamped.markAMm,
    markBMm: clamped.markBMm,
    bottomRestY,
    usableTravelWorld,
    worldPerMeter,
    travelM,
  };
}

export function StokesLab3D({
  config,
  compactPreview = false,
  onKinematicsSample,
  onGateTimingSample,
  onSimStatusChange,
  onMarksChange,
  externalRunSignal = 0,
  externalStopSignal = 0,
  externalResetSignal = 0,
  className = '',
}: StokesLab3DProps) {
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [simStatus, setSimStatus] = useState<'ready' | 'running' | 'paused' | 'completed'>('ready');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('perspective');
  const [autoRotate, setAutoRotate] = useState<boolean>(compactPreview);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(!compactPreview);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  const [hudState, setHudState] = useState<FallKinematicsState>(() => {
    const initMetrics = computeApparatusMetrics(
      config.env,
      config.selectedBall.radiusMm,
      config.selectedBall.lengthMm,
    );
    return evaluateFallKinematics({
      timeS: 0,
      radiusM: config.selectedBall.radiusM,
      ballDensityKgM3: config.env.ballDensityKgM3,
      liquidDensityKgM3: config.env.liquidDensityKgM3,
      gravityMs2: config.env.gravityMs2,
      terminalObservedVelocityMs: config.selectedBall.observedVelocityMs,
      effectiveViscosityPas: config.activeViscosityPas,
      totalTravelM: initMetrics.travelM,
      pedagogicalRamp: config.pedagogicalRamp,
    });
  });

  // Refs synced for WebGL loop (no canvas teardown on prop updates)
  const configRef = useRef(config);
  configRef.current = config;
  const simStatusRef = useRef(simStatus);
  simStatusRef.current = simStatus;
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;
  const cameraPresetRef = useRef(cameraPreset);
  cameraPresetRef.current = cameraPreset;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const showVectorsRef = useRef(showVectors);
  showVectorsRef.current = showVectors;
  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;
  const onSampleRef = useRef(onKinematicsSample);
  onSampleRef.current = onKinematicsSample;
  const onGateSampleRef = useRef(onGateTimingSample);
  onGateSampleRef.current = onGateTimingSample;
  const onStatusRef = useRef(onSimStatusChange);
  onStatusRef.current = onSimStatusChange;
  const onMarksChangeRef = useRef(onMarksChange);
  onMarksChangeRef.current = onMarksChange;

  // Label DOM refs for zero-React-rerender 3D projection
  const labelRefs = useRef<Record<keyof ProjectedLabels, HTMLDivElement | null>>({
    fg: null,
    fb: null,
    fd: null,
    markA: null,
    markB: null,
    dimL: null,
    dimH: null,
    dimR: null,
  });

  // Mutable simulation controller ref accessible to buttons
  const simApiRef = useRef<{
    reset: () => void;
    zoomBy: (factor: number) => void;
    applyCameraPreset: (preset: CameraPresetId) => void;
    syncApparatusGeometry: (resetTime?: boolean) => void;
    requestRender: () => void;
  } | null>(null);

  const effectivePhysics = useMemo(() => {
    const { env, selectedBall, velocitySource, activeViscosityPas } = config;
    const validRefEta =
      Number.isFinite(activeViscosityPas) && activeViscosityPas > 0
        ? activeViscosityPas
        : env.referenceViscosityPas > 0
          ? env.referenceViscosityPas
          : 0.95;

    const eta =
      velocitySource === 'measured_run' && selectedBall.viscosityPas
        ? selectedBall.viscosityPas
        : validRefEta;

    let terminalObservedMs = 0;
    if (selectedBall.validationErrors.length === 0 && selectedBall.netSettlingPossible) {
      if (velocitySource === 'measured_run') {
        terminalObservedMs = selectedBall.observedVelocityMs;
      } else {
        const predT = computePredictedTimeS(
          selectedBall.radiusMm,
          selectedBall.lengthMm,
          env,
          eta,
        );
        if (predT && predT > 0) {
          terminalObservedMs = selectedBall.lengthM / predT;
        }
      }
    }

    const appMetrics = computeApparatusMetrics(
      env,
      selectedBall.radiusMm,
      selectedBall.lengthMm,
    );
    const travelM = appMetrics.travelM;
    const totalExpectedRunS =
      terminalObservedMs > 0 ? travelM / terminalObservedMs : 0;

    return {
      eta,
      terminalObservedMs,
      travelM,
      totalExpectedRunS,
    };
  }, [config]);

  const effectivePhysicsRef = useRef(effectivePhysics);
  effectivePhysicsRef.current = effectivePhysics;

  const updateSimStatus = useCallback(
    (next: 'ready' | 'running' | 'paused' | 'completed') => {
      simStatusRef.current = next;
      setSimStatus(next);
      onStatusRef.current?.(next);
    },
    [],
  );

  // Mount Three.js scene once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x060b19, 1);

    const width = Math.max(280, mount.clientWidth);
    const height = Math.max(240, mount.clientHeight);
    renderer.setSize(width, height);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b19);
    scene.fog = new THREE.FogExp2(0x060b19, 0.042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(3.4, 3.0, 7.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.2, 2.2, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.0;
    controls.maxDistance = 14.5;
    controls.maxPolarAngle = Math.PI * 0.49;

    // 3-Point Studio + Laboratory Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(4.5, 8.2, 5.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 20;
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 7;
      keyLight.shadow.camera.bottom = -1;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.15);
    rimLight.position.set(-4.8, 5.5, -4.0);
    scene.add(rimLight);

    // Laboratory Optical Table & Calibrated Floor Grid
    const benchGroup = new THREE.Group();
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x0b1224,
      roughness: 0.78,
      metalness: 0.22,
    });
    const tableMesh = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.25, 48), tableMat);
    tableMesh.position.y = -0.125;
    tableMesh.receiveShadow = !isSoftwareGl;
    benchGroup.add(tableMesh);

    const gridHelper = new THREE.GridHelper(12, 24, 0x1e3a5f, 0x0f213d);
    gridHelper.position.y = 0.015;
    const gridMats = Array.isArray(gridHelper.material)
      ? gridHelper.material
      : [gridHelper.material];
    gridMats.forEach((m) => {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
    });
    benchGroup.add(gridHelper);

    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({
        map: createRadialShadowTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.02;
    benchGroup.add(contactShadow);
    scene.add(benchGroup);

    // Composite Apparatus Group (Base, Stand, Glass Jar, Liquid, Marks, Scale, Sphere, Force Vectors)
    const apparatusGroup = new THREE.Group();
    scene.add(apparatusGroup);

    // 1. Machined Anodized Base Pedestal + Brass Leveling Feet
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.38,
      metalness: 0.82,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.22,
      metalness: 0.92,
    });
    const brassMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.26,
      metalness: 0.88,
    });

    const basePlate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.26, 0.14, 48),
      baseMaterial,
    );
    basePlate.position.y = 0.09;
    basePlate.castShadow = !isSoftwareGl;
    basePlate.receiveShadow = !isSoftwareGl;
    apparatusGroup.add(basePlate);

    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.14, 0.024, 14, 48),
      trimMaterial,
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.16;
    apparatusGroup.add(baseRing);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.06, 20),
        brassMaterial,
      );
      foot.position.set(Math.cos(ang) * 1.02, 0.03, Math.sin(ang) * 1.02);
      apparatusGroup.add(foot);
    }

    // 2. Bottom Rubber Cushion inside jar (y top = 0.19, well below liquidBottomY = 0.23)
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.88,
      metalness: 0.05,
    });
    const cushionMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.05, 40),
      cushionMat,
    );
    cushionMesh.position.y = 0.165;
    apparatusGroup.add(cushionMesh);

    // 3. Stainless Retort Stand & Clamp Arms
    const standGroup = new THREE.Group();
    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 5.2, 20),
      trimMaterial,
    );
    rodMesh.castShadow = !isSoftwareGl;
    standGroup.add(rodMesh);

    const clampMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.72,
    });
    const markerRingMatA = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.6,
    });
    const markerRingMatB = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x2563eb,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.6,
    });

    const hitCollarMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const knobMatA = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.75,
    });
    const knobMatB = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.75,
    });

    const markACollarGroup = new THREE.Group();
    const markARing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.018, 12, 48),
      markerRingMatA,
    );
    markARing.rotation.x = Math.PI / 2;
    const markAClamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), clampMat);
    const markAKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 16), knobMatA);
    markAKnob.rotation.z = Math.PI / 2;
    const markAHitMesh = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.09, 10, 32), hitCollarMat);
    markAHitMesh.rotation.x = Math.PI / 2;
    markAHitMesh.name = 'markA';
    markACollarGroup.add(markARing, markAClamp, markAKnob, markAHitMesh);

    const markBCollarGroup = new THREE.Group();
    const markBRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.018, 12, 48),
      markerRingMatB,
    );
    markBRing.rotation.x = Math.PI / 2;
    const markBClamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), clampMat);
    const markBKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 16), knobMatB);
    markBKnob.rotation.z = Math.PI / 2;
    const markBHitMesh = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.09, 10, 32), hitCollarMat);
    markBHitMesh.rotation.x = Math.PI / 2;
    markBHitMesh.name = 'markB';
    markBCollarGroup.add(markBRing, markBClamp, markBKnob, markBHitMesh);

    apparatusGroup.add(standGroup, markACollarGroup, markBCollarGroup);

    // 4. Liquid Column & Meniscus
    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const liquidMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 4.2, 48, 1, false),
      liquidMaterial,
    );
    liquidMesh.renderOrder = 2;
    apparatusGroup.add(liquidMesh);

    const meniscusMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.72,
    });
    const meniscusRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.014, 12, 48),
      meniscusMat,
    );
    meniscusRing.rotation.x = Math.PI / 2;
    meniscusRing.renderOrder = 3;
    apparatusGroup.add(meniscusRing);

    // 5. Outer Borosilicate Glass Cylinder & Top Rim Collar
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      roughness: 0.06,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      ior: 1.5,
      transparent: true,
      opacity: isSoftwareGl ? 0.2 : 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glassCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.66, 4.5, 48, 1, true),
      glassMaterial,
    );
    glassCylinder.renderOrder = 4;
    apparatusGroup.add(glassCylinder);

    const topLipMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.025, 16, 48),
      trimMaterial,
    );
    topLipMesh.rotation.x = Math.PI / 2;
    apparatusGroup.add(topLipMesh);

    // 6. Millimeter Scale Strip along Cylinder (matches 256x1024 = 1:4 canvas aspect)
    let rulerTex = createRulerCanvasTexture(configRef.current.env.columnHeightMm);
    rulerTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const rulerMat = new THREE.MeshStandardMaterial({
      map: rulerTex,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rulerMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 4.2), rulerMat);
    rulerMesh.renderOrder = 3;
    apparatusGroup.add(rulerMesh);

    // 7. Falling Sphere Assembly (Composite Group)
    const ballGroup = new THREE.Group();
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.16,
    });
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 28), sphereMaterial);
    sphereMesh.castShadow = !isSoftwareGl;
    sphereMesh.receiveShadow = !isSoftwareGl;
    ballGroup.add(sphereMesh);

    // Subtle specular equatorial band / machining ring for rotational visibility
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.55,
    });
    const sphereBand = new THREE.Mesh(new THREE.TorusGeometry(1.005, 0.035, 10, 32), bandMat);
    sphereBand.rotation.x = Math.PI / 2;
    ballGroup.add(sphereBand);
    apparatusGroup.add(ballGroup);

    // Wake / Stokes streamlines particles trailing behind sphere
    const wakeCount = 18;
    const wakeGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.45,
    });
    const wakeInstanced = new THREE.InstancedMesh(wakeGeo, wakeMat, wakeCount);
    wakeInstanced.frustumCulled = false;
    wakeInstanced.renderOrder = 3;
    apparatusGroup.add(wakeInstanced);

    // 8. 3D Force Vector Arrows (Fg, Fb, Fd)
    const arrowsGroup = new THREE.Group();
    const fgArrow = createForceArrowMesh(0xf43f5e); // Rose-red downward weight
    fgArrow.group.rotation.z = Math.PI;
    const fbArrow = createForceArrowMesh(0x38bdf8); // Sky-cyan upward buoyancy
    const fdArrow = createForceArrowMesh(0xf59e0b); // Amber-gold upward drag
    arrowsGroup.add(fgArrow.group, fbArrow.group, fdArrow.group);
    apparatusGroup.add(arrowsGroup);

    // Layout metrics computed whenever dimensions change
    const metrics = {
      colHeightWorld: 4.5,
      cylRadiusWorld: 0.66,
      ballRadiusWorld: 0.1,
      liquidBottomY: 0.24,
      liquidTopY: 4.44,
      releaseY: 4.2,
      markAY: 3.4,
      markBY: 1.1,
      markAMm: 80,
      markBMm: 330,
      bottomRestY: 0.34,
      usableTravelWorld: 3.86,
      lastHeightMm: -1,
    };

    const syncApparatusGeometry = () => {
      const { env, selectedBall } = configRef.current;
      const computed = computeApparatusMetrics(
        env,
        selectedBall.radiusMm,
        selectedBall.lengthMm,
      );
      const { colHeightWorld, cylRadiusWorld, ballRadiusWorld } = computed;

      metrics.colHeightWorld = computed.colHeightWorld;
      metrics.cylRadiusWorld = computed.cylRadiusWorld;
      metrics.ballRadiusWorld = computed.ballRadiusWorld;
      metrics.liquidBottomY = computed.liquidBottomY;
      metrics.liquidTopY = computed.liquidTopY;
      metrics.releaseY = computed.releaseY;
      metrics.bottomRestY = computed.bottomRestY;
      metrics.usableTravelWorld = computed.usableTravelWorld;
      metrics.markAY = computed.markAY;
      metrics.markBY = computed.markBY;
      metrics.markAMm = computed.markAMm;
      metrics.markBMm = computed.markBMm;

      // Update base & cushion proportions
      const baseRadius = Math.max(1.05, cylRadiusWorld + 0.42);
      basePlate.scale.set(baseRadius / 1.2, 1, baseRadius / 1.2);
      baseRing.scale.set(baseRadius / 1.2, baseRadius / 1.2, 1);
      cushionMesh.scale.set((cylRadiusWorld * 0.94) / 0.6, 1, (cylRadiusWorld * 0.94) / 0.6);

      // Update Glass Cylinder
      const glassHeight = colHeightWorld + 0.34;
      glassCylinder.scale.set(cylRadiusWorld / 0.66, glassHeight / 4.5, cylRadiusWorld / 0.66);
      glassCylinder.position.y = 0.18 + glassHeight / 2;
      topLipMesh.scale.set(cylRadiusWorld / 0.66, cylRadiusWorld / 0.66, 1);
      topLipMesh.position.y = 0.18 + glassHeight;

      // Update Liquid Column
      const liqRadius = cylRadiusWorld * 0.95;
      liquidMesh.scale.set(liqRadius / 0.62, colHeightWorld / 4.2, liqRadius / 0.62);
      liquidMesh.position.y = metrics.liquidBottomY + colHeightWorld / 2;
      meniscusRing.scale.set(liqRadius / 0.62, liqRadius / 0.62, 1);
      meniscusRing.position.y = metrics.liquidTopY;

      const liquidPreset = LIQUID_PRESETS.find((l) => l.id === env.liquidPreset);
      if (liquidPreset) {
        liquidMaterial.color.set(liquidPreset.colorHex);
        // Modulate opacity slightly with density if user edits density manually
        const densityBoost = THREE.MathUtils.clamp((env.liquidDensityKgM3 - 850) / 1400, -0.08, 0.22);
        liquidMaterial.opacity = THREE.MathUtils.clamp(liquidPreset.opacity + densityBoost, 0.22, 0.68);
        meniscusMat.color.set(liquidPreset.colorHex).lerp(new THREE.Color(0xffffff), 0.45);
      } else {
        const hueNorm = THREE.MathUtils.clamp((env.liquidDensityKgM3 - 800) / 800, 0, 1);
        liquidMaterial.color.setHSL(0.56 - hueNorm * 0.45, 0.78, 0.56);
        liquidMaterial.opacity = THREE.MathUtils.clamp(0.28 + hueNorm * 0.28, 0.24, 0.62);
      }

      // Update Retort Stand & Optical Gate Rings
      const standX = -(cylRadiusWorld + 0.34);
      rodMesh.scale.set(1, (glassHeight + 0.45) / 5.2, 1);
      rodMesh.position.set(standX, (glassHeight + 0.45) / 2 + 0.12, 0);

      markARing.scale.set((cylRadiusWorld + 0.03) / 0.68, (cylRadiusWorld + 0.03) / 0.68, 1);
      markAHitMesh.scale.set((cylRadiusWorld + 0.03) / 0.68, (cylRadiusWorld + 0.03) / 0.68, 1);
      markAClamp.position.set(standX / 2 - cylRadiusWorld * 0.5, 0, 0);
      markAClamp.scale.set(Math.max(0.8, (cylRadiusWorld + 0.34) / 0.6), 1, 1);
      markAKnob.position.set(standX - 0.06, 0, 0);
      markACollarGroup.position.y = metrics.markAY;

      markBRing.scale.set((cylRadiusWorld + 0.03) / 0.68, (cylRadiusWorld + 0.03) / 0.68, 1);
      markBHitMesh.scale.set((cylRadiusWorld + 0.03) / 0.68, (cylRadiusWorld + 0.03) / 0.68, 1);
      markBClamp.position.set(standX / 2 - cylRadiusWorld * 0.5, 0, 0);
      markBClamp.scale.set(Math.max(0.8, (cylRadiusWorld + 0.34) / 0.6), 1, 1);
      markBKnob.position.set(standX - 0.06, 0, 0);
      markBCollarGroup.position.y = metrics.markBY;

      // Update Ruler Strip
      if (Math.abs(metrics.lastHeightMm - env.columnHeightMm) > 0.1) {
        metrics.lastHeightMm = env.columnHeightMm;
        const oldTex = rulerTex;
        rulerTex = createRulerCanvasTexture(env.columnHeightMm);
        rulerTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        rulerMat.map = rulerTex;
        rulerMat.needsUpdate = true;
        oldTex.dispose();
      }
      rulerMesh.scale.set(1, colHeightWorld / 4.2, 1);
      rulerMesh.position.set(cylRadiusWorld + 0.56, metrics.liquidBottomY + colHeightWorld / 2, 0);

      // Update Ball Radius & Material
      ballGroup.scale.setScalar(ballRadiusWorld);
      const ballPreset = BALL_MATERIAL_PRESETS.find((b) => b.id === env.ballMaterial);
      if (ballPreset) {
        sphereMaterial.color.set(ballPreset.colorHex);
        sphereMaterial.metalness = ballPreset.metalness;
        sphereMaterial.roughness = ballPreset.roughness;
      } else {
        const denseNorm = THREE.MathUtils.clamp((env.ballDensityKgM3 - 1000) / 14000, 0, 1);
        sphereMaterial.color.setHSL(0.6, 0.12, 0.85 - denseNorm * 0.4);
        sphereMaterial.metalness = 0.85;
        sphereMaterial.roughness = 0.2;
      }
    };

    syncApparatusGeometry();

    // Scratch math objects (zero GC in render loop)
    const _v3 = new THREE.Vector3();
    const _mat4 = new THREE.Matrix4();
    const _quat = new THREE.Quaternion();
    const _scale = new THREE.Vector3();
    const _camTargetPos = new THREE.Vector3();
    const _camLookTarget = new THREE.Vector3();

    let simTimeS = 0;
    let lastClockMs = performance.now();
    let lastHudEmitMs = 0;
    let cameraTransitionActive = false;
    let gateEnteredAtS: number | null = null;
    let gateCompletedS: number | null = null;
    let prevGateBallY: number | null = null;
    let prevGateTimeS = 0;
    let activeDragMark: 'A' | 'B' | null = null;
    let hoveredMark: 'A' | 'B' | null = null;
    const _raycaster = new THREE.Raycaster();
    const _ndc = new THREE.Vector2();
    const _dragPlane = new THREE.Plane();
    const _planeNormal = new THREE.Vector3();
    const _hitPoint = new THREE.Vector3();
    const markInteractables = [markAHitMesh, markBHitMesh];

    const getCameraPose = (preset: CameraPresetId, ballY: number) => {
      const midY = metrics.liquidBottomY + metrics.colHeightWorld * 0.5;
      const dist = Math.max(5.8, metrics.colHeightWorld * 1.48);
      switch (preset) {
        case 'front':
          return {
            pos: new THREE.Vector3(0, midY + 0.1, dist * 1.18),
            look: new THREE.Vector3(-0.1, midY - 0.15, 0),
          };
        case 'side':
          return {
            pos: new THREE.Vector3(dist * 1.18, midY + 0.1, 0),
            look: new THREE.Vector3(0, midY - 0.15, 0),
          };
        case 'top':
          return {
            pos: new THREE.Vector3(0.4, metrics.liquidTopY + 3.0, 2.5),
            look: new THREE.Vector3(0, metrics.liquidTopY - 0.4, 0),
          };
        case 'follow':
          return {
            pos: new THREE.Vector3(2.2, ballY + 0.4, 3.0),
            look: new THREE.Vector3(0, ballY, 0),
          };
        case 'perspective':
        default:
          return {
            pos: new THREE.Vector3(dist * 0.52, midY + 0.72, dist * 1.12),
            look: new THREE.Vector3(-0.22, midY - 0.16, 0),
          };
      }
    };

    const projectLabel = (
      key: keyof ProjectedLabels,
      worldX: number,
      worldY: number,
      worldZ: number,
      text: string,
      visibleFlag: boolean,
    ) => {
      const el = labelRefs.current[key];
      if (!el) return;
      if (!visibleFlag || !showLabelsRef.current) {
        el.style.opacity = '0';
        return;
      }
      _v3.set(worldX, worldY, worldZ).project(camera);
      if (_v3.z > 1 || _v3.z < -1) {
        el.style.opacity = '0';
        return;
      }
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const px = (_v3.x * 0.5 + 0.5) * w;
      const py = (-_v3.y * 0.5 + 0.5) * h;
      if (px < 10 || px > w - 10 || py < 10 || py > h - 10) {
        el.style.opacity = '0';
        return;
      }
      const hitsTopLeftHud =
        w < 640 ? py < 185 : px < 325 && py < 142;
      const hitsTopRightControls = px > w - 220 && py < 72;
      const hitsBottomDock = !compactPreview && py > h - 120;
      if (hitsTopLeftHud || hitsTopRightControls || hitsBottomDock) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = '1';
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (el.textContent !== text) {
        el.textContent = text;
      }
    };

    const updateSceneFromTime = (t: number, dt: number) => {
      const { env, selectedBall, pedagogicalRamp } = configRef.current;
      const { eta, terminalObservedMs, travelM } = effectivePhysicsRef.current;

      const state = evaluateFallKinematics({
        timeS: t,
        radiusM: selectedBall.radiusM,
        ballDensityKgM3: env.ballDensityKgM3,
        liquidDensityKgM3: env.liquidDensityKgM3,
        gravityMs2: env.gravityMs2,
        terminalObservedVelocityMs: terminalObservedMs,
        effectiveViscosityPas: eta,
        totalTravelM: travelM,
        pedagogicalRamp,
      });

      const ballY =
        state.phase === 'floating'
          ? state.buoyancyCondition === 'neutral'
            ? THREE.MathUtils.lerp(metrics.releaseY, metrics.bottomRestY, 0.5)
            : metrics.liquidTopY - metrics.ballRadiusWorld * 0.2
          : THREE.MathUtils.lerp(metrics.releaseY, metrics.bottomRestY, state.progressFraction);

      ballGroup.position.set(0, ballY, 0);
      if (simStatusRef.current === 'running' && state.velocityMs > 0) {
        ballGroup.rotation.y += dt * 0.65;
      }

      if (t <= 0) {
        gateEnteredAtS = null;
        gateCompletedS = null;
        prevGateBallY = ballY;
        prevGateTimeS = 0;
      } else if (state.phase !== 'floating') {
        if (ballY <= metrics.markAY && gateEnteredAtS === null) {
          if (prevGateBallY !== null && prevGateBallY > metrics.markAY && prevGateBallY > ballY) {
            const frac = (prevGateBallY - metrics.markAY) / (prevGateBallY - ballY);
            gateEnteredAtS = THREE.MathUtils.lerp(prevGateTimeS, t, frac);
          } else {
            gateEnteredAtS = t;
          }
        }
        if (ballY <= metrics.markBY && gateEnteredAtS !== null && gateCompletedS === null) {
          let exitT = t;
          if (prevGateBallY !== null && prevGateBallY > metrics.markBY && prevGateBallY > ballY) {
            const frac = (prevGateBallY - metrics.markBY) / (prevGateBallY - ballY);
            exitT = THREE.MathUtils.lerp(prevGateTimeS, t, frac);
          }
          gateCompletedS = Math.max(0.001, exitT - gateEnteredAtS);
        }
        prevGateBallY = ballY;
        prevGateTimeS = t;
      }

      const gateState: GateTimingState = {
        active: gateEnteredAtS !== null && gateCompletedS === null,
        elapsedS:
          gateCompletedS !== null
            ? gateCompletedS
            : gateEnteredAtS !== null
              ? Math.max(0, t - gateEnteredAtS)
              : 0,
        completedTransitS: gateCompletedS,
      };

      // Highlight Mark A & B rings when ball passes near them or hovered/dragged
      const nearA = Math.abs(ballY - metrics.markAY) < metrics.ballRadiusWorld * 2.2;
      const nearB = Math.abs(ballY - metrics.markBY) < metrics.ballRadiusWorld * 2.2;
      markerRingMatA.emissiveIntensity =
        activeDragMark === 'A' ? 2.4 : hoveredMark === 'A' ? 1.6 : nearA ? 2.2 : 0.55;
      markerRingMatB.emissiveIntensity =
        activeDragMark === 'B' ? 2.4 : hoveredMark === 'B' ? 1.6 : nearB ? 2.2 : 0.55;

      // Update Wake Streamlines
      const showWake = state.velocityMs > 0.0005 && state.phase !== 'completed';
      wakeInstanced.visible = showWake;
      if (showWake) {
        for (let i = 0; i < wakeCount; i++) {
          const frac = (i + 1) / wakeCount;
          const angle = i * 1.7 + t * 2.4;
          const rad = metrics.ballRadiusWorld * (0.4 + frac * 0.7);
          const wy = Math.min(
            metrics.liquidTopY - 0.05,
            ballY + metrics.ballRadiusWorld * 1.1 + frac * 0.55,
          );
          _v3.set(Math.cos(angle) * rad, wy, Math.sin(angle) * rad);
          _scale.setScalar((1 - frac * 0.65) * Math.min(1.4, metrics.ballRadiusWorld * 8));
          _mat4.compose(_v3, _quat, _scale);
          wakeInstanced.setMatrixAt(i, _mat4);
        }
        wakeInstanced.instanceMatrix.needsUpdate = true;
      }

      // Update 3D Force Vector Arrows
      const showVec = showVectorsRef.current;
      arrowsGroup.visible = showVec;
      const maxForce = Math.max(1e-9, state.weightForceN, state.buoyancyForceN);
      const maxArrowLen = Math.min(1.15, metrics.colHeightWorld * 0.26);

      const fgLen = THREE.MathUtils.clamp((state.weightForceN / maxForce) * maxArrowLen, 0.14, maxArrowLen);
      const fbLen = THREE.MathUtils.clamp((state.buoyancyForceN / maxForce) * maxArrowLen, 0.05, maxArrowLen);
      const fdLen = THREE.MathUtils.clamp((state.dragForceN / maxForce) * maxArrowLen, 0.0, maxArrowLen);

      const xOffset = metrics.ballRadiusWorld + 0.12;
      fgArrow.group.position.set(0, ballY - metrics.ballRadiusWorld * 0.9, 0);
      fgArrow.shaft.scale.set(1, Math.max(0.05, fgLen - 0.12), 1);
      fgArrow.head.position.y = Math.max(0.05, fgLen - 0.12);

      fbArrow.group.position.set(-xOffset, ballY, 0);
      fbArrow.shaft.scale.set(1, Math.max(0.02, fbLen - 0.1), 1);
      fbArrow.head.position.y = Math.max(0.02, fbLen - 0.1);
      fbArrow.group.visible = fbLen > 0.03;

      fdArrow.group.position.set(xOffset, ballY, 0);
      fdArrow.shaft.scale.set(1, Math.max(0.001, fdLen - 0.1), 1);
      fdArrow.head.position.y = Math.max(0.001, fdLen - 0.1);
      fdArrow.group.visible = fdLen > 0.035;

      // Update 2D Projected Labels (spaced outward so Fg/Fb/Fd never overlap)
      const fmtForce = (n: number) => (n >= 0.01 ? `${n.toFixed(3)} N` : `${(n * 1000).toFixed(2)} mN`);
      projectLabel('fg', 0.36, ballY - metrics.ballRadiusWorld - fgLen * 0.75, 0, `Fg = ${fmtForce(state.weightForceN)}`, showVec);
      projectLabel('fb', -xOffset - 0.44, ballY + fbLen + 0.14, 0, `Fb = ${fmtForce(state.buoyancyForceN)}`, showVec && fbLen > 0.03);
      projectLabel('fd', xOffset + 0.46, ballY + fdLen + 0.14, 0, `Fd = ${fmtForce(state.dragForceN)}`, showVec && fdLen > 0.035);

      projectLabel(
        'markA',
        -(metrics.cylRadiusWorld + 0.48),
        metrics.markAY,
        0,
        `Mark A (${metrics.markAMm.toFixed(0)} mm)`,
        true,
      );
      projectLabel(
        'markB',
        -(metrics.cylRadiusWorld + 0.48),
        metrics.markBY,
        0,
        `Mark B (${metrics.markBMm.toFixed(0)} mm)`,
        true,
      );
      projectLabel(
        'dimL',
        -(metrics.cylRadiusWorld + 0.56),
        (metrics.markAY + metrics.markBY) / 2,
        0,
        `L = ${selectedBall.lengthMm.toFixed(0)} mm`,
        true,
      );
      projectLabel(
        'dimH',
        metrics.cylRadiusWorld + 0.92,
        metrics.liquidBottomY + metrics.colHeightWorld * 0.85,
        0,
        `H = ${env.columnHeightMm} mm`,
        true,
      );
      projectLabel(
        'dimR',
        metrics.cylRadiusWorld * 0.55,
        metrics.liquidTopY + 0.24,
        0,
        `R = ${(env.cylinderDiameterMm / 2).toFixed(1)} mm`,
        true,
      );

      return { state, ballY, gateState };
    };

    // Initial pose & synchronous first render so frame 0 is always visible immediately
    const initPose = getCameraPose('perspective', metrics.releaseY);
    camera.position.copy(initPose.pos);
    controls.target.copy(initPose.look);
    controls.update();
    updateSceneFromTime(0, 0);
    renderer.render(scene, camera);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let isLoopRunning = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 50);
        return;
      }
      gl.flush();
      let polls = 0;
      const poll = () => {
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED && polls < 12) {
          polls += 1;
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 50);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const requestRender = () => {
      if (isLoopRunning) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const { ballY } = updateSceneFromTime(simTimeS, 0);
        if (cameraPresetRef.current === 'follow' || cameraTransitionActive) {
          const pose = getCameraPose(cameraPresetRef.current, ballY);
          camera.position.lerp(pose.pos, 0.25);
          controls.target.lerp(pose.look, 0.25);
          if (camera.position.distanceTo(pose.pos) < 0.03) {
            cameraTransitionActive = false;
          }
        }
        controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty || cameraTransitionActive) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    const tick = () => {
      const now = performance.now();
      const rawDt = Math.min(0.1, Math.max(0.001, (now - lastClockMs) / 1000));
      lastClockMs = now;

      const running = simStatusRef.current === 'running';
      if (running) {
        simTimeS += rawDt * speedRef.current;
      }

      const { state, ballY, gateState } = updateSceneFromTime(simTimeS, running ? rawDt * speedRef.current : 0);

      if (running && state.phase === 'completed') {
        updateSimStatus('completed');
      }

      if (cameraPresetRef.current === 'follow') {
        const pose = getCameraPose('follow', ballY);
        const alpha = 1 - Math.exp(-6 * rawDt);
        camera.position.lerp(pose.pos, alpha);
        controls.target.lerp(pose.look, alpha);
      } else if (cameraTransitionActive) {
        const pose = getCameraPose(cameraPresetRef.current, ballY);
        const alpha = 1 - Math.exp(-7 * rawDt);
        camera.position.lerp(pose.pos, alpha);
        controls.target.lerp(pose.look, alpha);
        if (camera.position.distanceTo(pose.pos) < 0.03) {
          cameraTransitionActive = false;
        }
      }

      controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
      controls.update();
      renderer.render(scene, camera);

      if (now - lastHudEmitMs >= 85 || !running) {
        lastHudEmitMs = now;
        setHudState(state);
        onSampleRef.current?.(state);
        onGateSampleRef.current?.(gateState);
      }

      const shouldContinueLoop =
        simStatusRef.current === 'running' ||
        (autoRotateRef.current && !isSoftwareGl) ||
        cameraTransitionActive;

      if (shouldContinueLoop) {
        isLoopRunning = true;
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      } else {
        isLoopRunning = false;
      }
    };

    const ensureLoop = () => {
      if (!isLoopRunning) {
        lastClockMs = performance.now();
        isLoopRunning = true;
        frameId = requestAnimationFrame(tick);
      }
    };

    const onControlsStart = () => {
      cameraTransitionActive = false;
    };
    const onControlsChange = () => {
      if (!isLoopRunning) requestRender();
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    const updateNdcFromPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      _ndc.y = -((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const raycastMarks = (ev: PointerEvent): 'A' | 'B' | null => {
      if (compactPreview || !onMarksChangeRef.current) return null;
      updateNdcFromPointer(ev);
      _raycaster.setFromCamera(_ndc, camera);
      const hits = _raycaster.intersectObjects(markInteractables, false);
      if (hits.length === 0) return null;
      return hits[0].object === markAHitMesh ? 'A' : 'B';
    };

    const onPointerDown = (ev: PointerEvent) => {
      const hitMark = raycastMarks(ev);
      if (!hitMark) return;
      activeDragMark = hitMark;
      controls.enabled = false;
      renderer.domElement.style.cursor = 'ns-resize';
      try {
        renderer.domElement.setPointerCapture(ev.pointerId);
      } catch {
        // ignore synthetic events without active pointer
      }
      requestRender();
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!activeDragMark) {
        const hover = raycastMarks(ev);
        if (hover !== hoveredMark) {
          hoveredMark = hover;
          renderer.domElement.style.cursor = hover ? 'ns-resize' : '';
          requestRender();
        }
        return;
      }

      updateNdcFromPointer(ev);
      _raycaster.setFromCamera(_ndc, camera);
      _planeNormal.copy(camera.position).setY(0);
      if (_planeNormal.lengthSq() < 1e-6) {
        _planeNormal.set(0, 0, 1);
      } else {
        _planeNormal.normalize();
      }
      _dragPlane.setFromNormalAndCoplanarPoint(_planeNormal, _v3.set(0, 0, 0));

      if (_raycaster.ray.intersectPlane(_dragPlane, _hitPoint)) {
        const { env } = configRef.current;
        const safeH = Math.max(10, env.columnHeightMm);
        const depthMm = THREE.MathUtils.clamp(
          ((metrics.liquidTopY - _hitPoint.y) / Math.max(0.1, metrics.colHeightWorld)) * safeH,
          0,
          safeH,
        );
        const clamped = clampMarkPositions({
          markAMm: activeDragMark === 'A' ? depthMm : metrics.markAMm,
          markBMm: activeDragMark === 'B' ? depthMm : metrics.markBMm,
          columnHeightMm: safeH,
          changed: activeDragMark,
        });
        metrics.markAMm = clamped.markAMm;
        metrics.markBMm = clamped.markBMm;
        onMarksChangeRef.current?.(clamped.markAMm, clamped.markBMm);
        requestRender();
      }
    };

    const endMarkDrag = (ev: PointerEvent) => {
      if (!activeDragMark) return;
      activeDragMark = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = hoveredMark ? 'ns-resize' : '';
      try {
        if (renderer.domElement.hasPointerCapture(ev.pointerId)) {
          renderer.domElement.releasePointerCapture(ev.pointerId);
        }
      } catch {
        // ignore
      }
      requestRender();
    };

    const onPointerLeave = () => {
      if (!activeDragMark && hoveredMark !== null) {
        hoveredMark = null;
        renderer.domElement.style.cursor = '';
        requestRender();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', endMarkDrag);
    renderer.domElement.addEventListener('pointercancel', endMarkDrag);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const onResize = () => {
      if (!mount) return;
      const w = Math.max(280, mount.clientWidth);
      const h = Math.max(240, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateSceneFromTime(simTimeS, 0);
      renderer.render(scene, camera);
      requestRender();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    simApiRef.current = {
      reset: () => {
        simTimeS = 0;
        gateEnteredAtS = null;
        gateCompletedS = null;
        const { state, gateState } = updateSceneFromTime(0, 0);
        setHudState(state);
        onSampleRef.current?.(state);
        onGateSampleRef.current?.(gateState);
        requestRender();
      },
      zoomBy: (factor: number) => {
        _camTargetPos.copy(camera.position).sub(controls.target).multiplyScalar(factor).add(controls.target);
        const dist = _camTargetPos.distanceTo(controls.target);
        if (dist >= controls.minDistance && dist <= controls.maxDistance) {
          camera.position.copy(_camTargetPos);
        }
        requestRender();
      },
      applyCameraPreset: (preset: CameraPresetId) => {
        cameraPresetRef.current = preset;
        cameraTransitionActive = true;
        const { ballY } = updateSceneFromTime(simTimeS, 0);
        const pose = getCameraPose(preset, ballY);
        _camLookTarget.copy(pose.look);
        ensureLoop();
      },
      syncApparatusGeometry: (resetTime = false) => {
        if (resetTime) {
          simTimeS = 0;
          gateEnteredAtS = null;
          gateCompletedS = null;
        }
        syncApparatusGeometry();
        const { state, gateState } = updateSceneFromTime(simTimeS, 0);
        setHudState(state);
        onSampleRef.current?.(state);
        onGateSampleRef.current?.(gateState);
        requestRender();
      },
      requestRender: () => {
        if (simStatusRef.current === 'running' || (autoRotateRef.current && !isSoftwareGl)) {
          ensureLoop();
        } else {
          requestRender();
        }
      },
    };

    // Start loop if compact preview auto-rotates or initial render
    if (autoRotateRef.current && !isSoftwareGl) {
      ensureLoop();
    } else {
      requestRender();
    }

    return () => {
      isLoopRunning = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', endMarkDrag);
      renderer.domElement.removeEventListener('pointercancel', endMarkDrag);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
      rulerTex.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, [updateSimStatus]);

  const physicsSignature = [
    config.env.liquidPreset,
    config.env.liquidDensityKgM3,
    config.env.ballDensityKgM3,
    config.env.cylinderDiameterMm,
    config.env.columnHeightMm,
    config.env.markAMm ?? 80,
    config.env.markBMm ?? 330,
    config.env.gravityMs2,
    config.selectedBall.id,
    config.selectedBall.radiusMm,
    config.selectedBall.lengthMm,
    config.selectedBall.timeS,
    config.velocitySource,
    config.activeViscosityPas.toFixed(6),
    config.pedagogicalRamp,
  ].join('|');

  const prevPhysicsSigRef = useRef<string | null>(null);

  // React to config / geometry / density / ball changes cleanly without leaving stale animation state
  useEffect(() => {
    const isChanged =
      prevPhysicsSigRef.current !== null && prevPhysicsSigRef.current !== physicsSignature;
    prevPhysicsSigRef.current = physicsSignature;

    if (isChanged) {
      updateSimStatus('ready');
      simApiRef.current?.syncApparatusGeometry(true);
    } else {
      simApiRef.current?.syncApparatusGeometry(false);
    }
  }, [config, physicsSignature, updateSimStatus]);

  useEffect(() => {
    if (externalRunSignal > 0) {
      if (simStatusRef.current === 'completed') {
        simApiRef.current?.reset();
      }
      updateSimStatus('running');
      simApiRef.current?.requestRender();
    }
  }, [externalRunSignal, updateSimStatus]);

  useEffect(() => {
    if (externalStopSignal > 0) {
      if (simStatusRef.current === 'running') {
        updateSimStatus('paused');
      }
    }
  }, [externalStopSignal, updateSimStatus]);

  useEffect(() => {
    if (externalResetSignal > 0) {
      updateSimStatus('ready');
      simApiRef.current?.reset();
    }
  }, [externalResetSignal, updateSimStatus]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleStartOrResume = () => {
    if (simStatus === 'completed') {
      simApiRef.current?.reset();
    }
    updateSimStatus('running');
    simApiRef.current?.requestRender();
  };

  const handlePause = () => {
    updateSimStatus('paused');
  };

  const handleReset = () => {
    updateSimStatus('ready');
    simApiRef.current?.reset();
  };

  const handleToggleFullscreen = async () => {
    const el = stageWrapperRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback if iframe disallows native fullscreen
      setIsFullscreen((prev) => !prev);
    }
  };

  const handlePresetClick = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    simApiRef.current?.applyCameraPreset(preset);
  };

  return (
    <div
      ref={stageWrapperRef}
      data-testid="stokes-3d-stage"
      data-sim-status={simStatus}
      data-ball-radius-mm={config.selectedBall.radiusMm}
      data-mark-a-mm={config.env.markAMm ?? 80}
      data-mark-b-mm={config.env.markBMm ?? 330}
      data-target-v-ms={effectivePhysics.terminalObservedMs.toFixed(6)}
      className={`relative w-full overflow-hidden rounded-xl border border-sky-400/20 bg-[#060b19] ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen rounded-none' : compactPreview ? 'h-[400px] lg:h-[460px]' : 'h-[580px] lg:h-[640px]'
      } ${className}`}
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* Projected 3D Annotations (Sharp HTML DOM layer, pointer-events-none) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          ref={(el) => { labelRefs.current.fg = el; }}
          className="absolute left-0 top-0 rounded bg-rose-950/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-rose-200 border border-rose-500/40 whitespace-nowrap transition-opacity duration-75 opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.fb = el; }}
          className="absolute left-0 top-0 rounded bg-sky-950/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-sky-200 border border-sky-400/40 whitespace-nowrap transition-opacity duration-75 opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.fd = el; }}
          className="absolute left-0 top-0 rounded bg-amber-950/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-200 border border-amber-400/40 whitespace-nowrap transition-opacity duration-75 opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.markA = el; }}
          className="absolute left-0 top-0 rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 border border-cyan-500/40 whitespace-nowrap opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.markB = el; }}
          className="absolute left-0 top-0 rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-300 border border-sky-500/40 whitespace-nowrap opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.dimL = el; }}
          className="absolute left-0 top-0 rounded bg-slate-950/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-200 border border-slate-700 whitespace-nowrap opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.dimH = el; }}
          className="absolute left-0 top-0 rounded bg-slate-950/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-200 border border-slate-700 whitespace-nowrap opacity-0"
        />
        <div
          ref={(el) => { labelRefs.current.dimR = el; }}
          className="absolute left-0 top-0 rounded bg-slate-950/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-200 border border-slate-700 whitespace-nowrap opacity-0"
        />
      </div>

      {webglUnavailable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060b19] p-6 text-center">
          <p className="font-display text-lg font-semibold text-slate-100">
            3D Viewport Ready (Software Fallback Active)
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            WebGL context could not be initialized in this environment. All physics calculations, graphs, and reports remain fully active.
          </p>
        </div>
      )}

      {/* Top-Left Compact Live Telemetry Readout (Solid rgba background, zero backdrop-blur) */}
      <div className="pointer-events-none absolute left-3 right-3 top-14 z-10 sm:right-auto sm:top-3 sm:max-w-[300px]">
        <div className="pointer-events-auto rounded-lg border border-sky-400/20 bg-[#090f1f]/92 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-slate-400">
            <span>{config.selectedBall.label} · r = {config.selectedBall.radiusMm.toFixed(1)} mm</span>
            <span className="text-cyan-300 font-semibold">
              {hudState.phase === 'ready' && 'Ready'}
              {hudState.phase === 'accelerating' && 'Accelerating'}
              {hudState.phase === 'terminal' && 'Terminal'}
              {hudState.phase === 'floating' &&
                (hudState.buoyancyCondition === 'neutral' ? 'Neutral' : 'Floating')}
              {hudState.phase === 'completed' && 'Complete'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                Anim v(t)
              </span>
              <span className="font-mono text-lg font-bold text-cyan-300" data-testid="live-velocity-readout">
                {(hudState.velocityMs * 100).toFixed(2)}
              </span>
              <span className="ml-1 font-mono text-[11px] text-slate-400">cm/s</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                {config.velocitySource === 'live_physics' ? 'Pred v′ (Cyl.)' : 'Obs v′ (L/T)'}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-200" data-testid="target-vprime-readout">
                {(effectivePhysics.terminalObservedMs * 100).toFixed(2)} cm/s
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">t</span>
              <span className="font-mono text-xs font-semibold text-slate-200">
                {hudState.timeS.toFixed(2)} s
              </span>
            </div>
          </div>
          {!compactPreview && (
            <div className="mt-1.5 space-y-1 border-t border-slate-800 pt-1.5 text-[10px] font-mono">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-rose-300">Fg {(hudState.weightForceN * 1000).toFixed(2)}</div>
                <div className="text-sky-300">Fb {(hudState.buoyancyForceN * 1000).toFixed(2)}</div>
                <div className="text-amber-300">Fd {(hudState.dragForceN * 1000).toFixed(2)}</div>
              </div>
              <div className="flex items-center justify-between gap-3 text-[9.5px] text-slate-400">
                <span>
                  Corr v:{' '}
                  <strong className="text-slate-200">
                    {config.selectedBall.netSettlingPossible
                      ? (config.selectedBall.correctedVelocityMs * 100).toFixed(2)
                      : '—'}
                  </strong>{' '}
                  cm/s
                </span>
                <span>
                  Stokes v_th:{' '}
                  <strong className="text-blue-300">
                    {config.selectedBall.theoreticalVelocityMs !== null
                      ? `${(config.selectedBall.theoreticalVelocityMs * 100).toFixed(2)}`
                      : '—'}
                  </strong>{' '}
                  cm/s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-Right Compact Utility Buttons (Fullscreen + Zoom) */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => simApiRef.current?.zoomBy(0.84)}
          aria-label="Zoom in 3D camera"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-[#090f1f]/90 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => simApiRef.current?.zoomBy(1.18)}
          aria-label="Zoom out 3D camera"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-[#090f1f]/90 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen 3D view' : 'Enter fullscreen 3D view'}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#090f1f]/90 px-3 text-xs font-medium text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      {!compactPreview && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 w-[min(940px,96%)] -translate-x-1/2 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            aria-label={dockCollapsed ? 'Show 3D simulation controls' : 'Hide 3D simulation controls'}
            className="pointer-events-auto mb-1 flex items-center gap-1 rounded-t-lg border border-b-0 border-slate-700/80 bg-[#090f1f]/92 px-3 py-0.5 text-[11px] font-medium text-slate-300 hover:text-cyan-300 transition-colors"
          >
            {dockCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{dockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto w-full rounded-xl border border-sky-400/25 bg-[#090f1f]/94 px-2.5 py-2 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                {/* Playback Controls */}
                <div className="flex items-center gap-1.5">
                  {simStatus === 'running' ? (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartOrResume}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>{simStatus === 'paused' ? 'Resume' : simStatus === 'completed' ? 'Replay' : 'Start Fall'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeedMultiplier((prev) => (prev === 0.25 ? 1 : 0.25))}
                    className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      speedMultiplier < 1
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>Slow-Mo</span>
                  </button>
                </div>

                {/* Speed Multiplier */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-1">
                  <SlidersHorizontal className="ml-1.5 h-3.5 w-3.5 text-slate-400" />
                  {[0.25, 0.5, 1, 2, 4].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setSpeedMultiplier(mult)}
                      className={`rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                        speedMultiplier === mult
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {mult}×
                    </button>
                  ))}
                </div>

                {/* Single-Ball Active Sphere Indicator inside 3D Dock */}
                <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 font-mono text-[11px] text-slate-300">
                  <span>Single Sphere:</span>
                  <strong className="text-cyan-300">r = {config.selectedBall.radiusMm.toFixed(1)} mm</strong>
                </div>

                {/* Camera Presets & Toggles */}
                <div className="flex flex-wrap items-center gap-1">
                  <Camera className="mr-1 h-3.5 w-3.5 text-slate-400" />
                  {(['perspective', 'front', 'side', 'top', 'follow'] as CameraPresetId[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className={`rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                        cameraPreset === preset
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAutoRotate((v) => !v);
                      simApiRef.current?.requestRender();
                    }}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      autoRotate ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    Orbit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVectors((v) => !v);
                      simApiRef.current?.requestRender();
                    }}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      showVectors ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    Forces
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLabels((v) => !v);
                      simApiRef.current?.requestRender();
                    }}
                    aria-label="Toggle 3D labels"
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      showLabels ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>Labels</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
