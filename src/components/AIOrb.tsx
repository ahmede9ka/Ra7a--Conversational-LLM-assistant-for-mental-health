"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type AIOrbState = "idle" | "listening" | "thinking" | "speaking";

export const AI_ORB_CONFIG = {
  palette: {
    skyBlue: "#A9D9FF",
    paleCyan: "#C7F4FF",
    softLavender: "#C9B8FF",
    cloudWhite: "#F4F6FF",
    periwinkle: "#C7D4FF",
  },
  animation: {
    stateTransitionDamping: 2.8,
    idleBreathingPeriodSeconds: 6,
    listeningBreathingPeriodSeconds: 5.8,
    thinkingBreathingPeriodSeconds: 6.4,
    speakingBreathingPeriodSeconds: 5.2,
    scaleAmplitude: 0.012,
    floatPeriodSeconds: 12,
    floatAmplitude: 0.035,
    rotationSpeed: 0.045,
    primaryWaveAmplitude: 0.018,
    secondaryWaveAmplitude: 0.009,
    internalFlowSpeed: 0.22,
    cursorRotationRadians: 0.11,
    cursorPositionAmplitude: 0.025,
    cursorDamping: 2.4,
    reducedMotionCursorFactor: 0.35,
    reducedMotionFactor: 0.08,
    stateIntensity: {
      idle: 0.15,
      listening: 0.58,
      thinking: 0.42,
      speaking: 0.76,
    },
  },
} as const;

type AIOrbProps = {
  state?: AIOrbState;
  size?: number | string;
  className?: string;
  motionEnabled?: boolean;
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uMotion;
  uniform float uPrimaryWaveAmplitude;
  uniform float uSecondaryWaveAmplitude;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vWave;

  void main() {
    vec3 p = position;
    float t = uTime * (0.2 + uIntensity * 0.12) * uMotion;
    float waveA = sin(p.y * 3.2 + p.x * 2.0 + t) * cos(p.z * 2.5 - t * 0.72);
    float waveB = sin(p.z * 4.0 - p.y * 2.0 + t * 0.7) * 0.35;
    float wave = waveA * uPrimaryWaveAmplitude + waveB * uSecondaryWaveAmplitude;
    p += normal * wave * (0.55 + uIntensity * 0.7) * uMotion;
    vWave = waveA;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uMotion;
  uniform float uFlowSpeed;
  uniform vec3 uSkyColor;
  uniform vec3 uCyanColor;
  uniform vec3 uLavenderColor;
  uniform vec3 uCloudColor;
  uniform vec3 uPeriwinkleColor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vWave;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float facing = max(dot(n, viewDir), 0.0);
    float fresnel = pow(1.0 - facing, 2.2);
    float flow = sin(vViewPosition.x * 3.1 + vViewPosition.y * 2.0 + uTime * uFlowSpeed * uMotion)
               * cos(vViewPosition.z * 2.8 - vViewPosition.y * 1.7 - uTime * uFlowSpeed * 0.82 * uMotion);
    float blend = smoothstep(-0.55, 0.62, flow + vWave * 0.2);
    vec3 color = mix(uSkyColor, uLavenderColor, smoothstep(0.06, 0.84, blend));
    color = mix(color, uCyanColor, smoothstep(0.1, 0.86, flow) * 0.72);
    vec3 lightDir = normalize(vec3(-0.42, 0.62, 0.76));
    float diffuse = 0.72 + 0.28 * max(dot(n, lightDir), 0.0);
    float light = 0.94 + 0.07 * sin(uTime * 0.42) + uIntensity * 0.04;
    color *= light * diffuse;
    color += uPeriwinkleColor * fresnel * (0.48 + uIntensity * 0.12);

    // Layer soft, curved studio reflections over the translucent color field.
    vec3 reflectedLight = reflect(-lightDir, n);
    float specular = pow(max(dot(reflectedLight, viewDir), 0.0), 26.0);
    float specularCore = pow(max(dot(reflectedLight, viewDir), 0.0), 110.0);
    float stripAxis = n.x + 0.48 + (n.y - 0.38) * 0.16;
    float studioStrip = exp(-pow(stripAxis / 0.095, 2.0)
                          - pow((n.y - 0.38) / 0.58, 4.0)) * smoothstep(0.0, 0.5, n.z);
    float softbox = exp(-pow((n.x - 0.36) / 0.25, 2.0)
                       - pow((n.y + 0.26) / 0.36, 2.0)) * smoothstep(0.15, 0.65, n.z);
    float glint = exp(-pow((n.x + 0.58) / 0.065, 2.0)
                     - pow((n.y - 0.64) / 0.075, 2.0)) * smoothstep(0.15, 0.55, n.z);
    float rim = pow(1.0 - facing, 2.4);
    color += uCloudColor * (specular * 0.34 + specularCore * 0.46
                          + studioStrip * 1.18 + softbox * 0.38 + glint * 1.1);
    color += uCloudColor * rim * (0.16 + uIntensity * 0.04);
    color += uCyanColor * rim * (0.22 + uIntensity * 0.08);
    float alpha = 0.91 + fresnel * 0.08;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const stateIntensity = AI_ORB_CONFIG.animation.stateIntensity;

function breathPeriodForState(state: AIOrbState) {
  const periods = AI_ORB_CONFIG.animation;
  if (state === "listening") return periods.listeningBreathingPeriodSeconds;
  if (state === "thinking") return periods.thinkingBreathingPeriodSeconds;
  if (state === "speaking") return periods.speakingBreathingPeriodSeconds;
  return periods.idleBreathingPeriodSeconds;
}

function OrbSurface({ state, motionFactor, cursorTarget, cursorActive }: { state: AIOrbState; motionFactor: number; cursorTarget: React.RefObject<THREE.Vector2>; cursorActive: React.RefObject<boolean> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const targetIntensity = useRef<number>(stateIntensity[state]);
  const currentIntensity = useRef<number>(stateIntensity[state]);
  const targetBreathPeriod = useRef<number>(breathPeriodForState(state));
  const currentBreathPeriod = useRef<number>(breathPeriodForState(state));
  const cursor = useRef(new THREE.Vector2());
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: stateIntensity[state] },
    uMotion: { value: 1 },
    uFlowSpeed: { value: AI_ORB_CONFIG.animation.internalFlowSpeed },
    uPrimaryWaveAmplitude: { value: AI_ORB_CONFIG.animation.primaryWaveAmplitude },
    uSecondaryWaveAmplitude: { value: AI_ORB_CONFIG.animation.secondaryWaveAmplitude },
    uSkyColor: { value: new THREE.Color(AI_ORB_CONFIG.palette.skyBlue) },
    uCyanColor: { value: new THREE.Color(AI_ORB_CONFIG.palette.paleCyan) },
    uLavenderColor: { value: new THREE.Color(AI_ORB_CONFIG.palette.softLavender) },
    uCloudColor: { value: new THREE.Color(AI_ORB_CONFIG.palette.cloudWhite) },
    uPeriwinkleColor: { value: new THREE.Color(AI_ORB_CONFIG.palette.periwinkle) },
  }), [state]);

  useEffect(() => {
    targetIntensity.current = stateIntensity[state];
    targetBreathPeriod.current = breathPeriodForState(state);
  }, [state]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const step = Math.min(delta, 0.05);
    const cursorMotion = motionFactor === 0 ? 0 : motionFactor < 1 ? AI_ORB_CONFIG.animation.reducedMotionCursorFactor : 1;
    const targetX = cursorActive.current ? cursorTarget.current.x : 0;
    const targetY = cursorActive.current ? cursorTarget.current.y : 0;
    cursor.current.x = THREE.MathUtils.damp(cursor.current.x, targetX, AI_ORB_CONFIG.animation.cursorDamping, step);
    cursor.current.y = THREE.MathUtils.damp(cursor.current.y, targetY, AI_ORB_CONFIG.animation.cursorDamping, step);
    if (motionFactor === 0) {
      currentIntensity.current = targetIntensity.current;
      currentBreathPeriod.current = targetBreathPeriod.current;
    } else {
      currentIntensity.current = THREE.MathUtils.damp(currentIntensity.current, targetIntensity.current, AI_ORB_CONFIG.animation.stateTransitionDamping, step);
      currentBreathPeriod.current = THREE.MathUtils.damp(currentBreathPeriod.current, targetBreathPeriod.current, AI_ORB_CONFIG.animation.stateTransitionDamping, step);
    }
    if (material.current) {
      material.current.uniforms.uTime.value = elapsed;
      material.current.uniforms.uIntensity.value = currentIntensity.current;
      material.current.uniforms.uMotion.value = motionFactor;
    }
    if (mesh.current) {
      const motionScale = motionFactor;
      const energy = currentIntensity.current;
      const { floatPeriodSeconds, floatAmplitude, rotationSpeed, scaleAmplitude } = AI_ORB_CONFIG.animation;
      mesh.current.position.x = cursor.current.x * AI_ORB_CONFIG.animation.cursorPositionAmplitude * cursorMotion;
      mesh.current.position.y = Math.sin(elapsed * (Math.PI * 2 / floatPeriodSeconds)) * floatAmplitude * motionScale
        + cursor.current.y * AI_ORB_CONFIG.animation.cursorPositionAmplitude * cursorMotion;
      mesh.current.rotation.y = elapsed * rotationSpeed * motionScale
        + cursor.current.x * AI_ORB_CONFIG.animation.cursorRotationRadians * cursorMotion;
      mesh.current.rotation.x = Math.sin(elapsed * (Math.PI * 2 / floatPeriodSeconds) * 0.56) * 0.025 * motionScale
        - cursor.current.y * AI_ORB_CONFIG.animation.cursorRotationRadians * 0.6 * cursorMotion;
      const breath = 1 + Math.sin(elapsed * (Math.PI * 2 / currentBreathPeriod.current)) * scaleAmplitude * (0.9 + energy * 0.2) * motionScale;
      mesh.current.scale.setScalar(breath);
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 96, 96]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

export default function AIOrb({ state = "idle", size = "clamp(250px, 38vw, 350px)", className = "", motionEnabled = true }: AIOrbProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const cursorTarget = useRef(new THREE.Vector2());
  const cursorActive = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!motionEnabled) {
      cursorActive.current = false;
      cursorTarget.current.set(0, 0);
    }
  }, [motionEnabled]);
  const motionFactor = motionEnabled ? (reducedMotion ? AI_ORB_CONFIG.animation.reducedMotionFactor : 1) : 0;
  function trackCursor(event: React.PointerEvent<HTMLDivElement>) {
    if (!motionEnabled || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    cursorTarget.current.set(
      THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(1 - ((event.clientY - bounds.top) / bounds.height) * 2, -1, 1),
    );
    cursorActive.current = true;
  }
  function releaseCursor(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    cursorActive.current = false;
  }

  return (
    <div
      className={`ai-orb ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Animated AI companion orb, ${state}`}
      data-state={state}
      data-motion={motionFactor === 1 ? "full" : motionFactor === 0 ? "off" : "reduced"}
      onPointerMove={trackCursor}
      onPointerLeave={releaseCursor}
      onPointerCancel={releaseCursor}
    >
      <div className="orb-halo" aria-hidden="true" />
        <div className="orb-voice-bars" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
        </div>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={motionFactor === 0 ? "demand" : "always"}
        camera={{ position: [0, 0, 3.3], fov: 38 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        fallback={<div className="orb-fallback" aria-hidden="true" />}
      >
        <Suspense fallback={null}>
          <OrbSurface state={state} motionFactor={motionFactor} cursorTarget={cursorTarget} cursorActive={cursorActive} />
        </Suspense>
      </Canvas>
    </div>
  );
}
