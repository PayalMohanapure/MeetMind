/**
 * The MeetMind stage: an iridescent "voice orb" with meeting tiles orbiting it.
 * Speech flows from the speaking tile into the orb as glowing particles, and minutes
 * cards drift out of the other side: people → speech → memory → minutes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Environment, Lightformer, Sparkles, Line, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import { useStageStore } from './stageStore';

const VOICES = ['#4C6FFF', '#FF8A3D', '#E255A1', '#7DB52D'];
const PEOPLE = [['AK', 'Asha'], ['RD', 'Rahul'], ['PN', 'Priya'], ['SS', 'You']];

/* ───────────── Orb shaders (simplex noise displacement + iridescent fresnel) ───────────── */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const orbVert = /* glsl */ `
uniform float uTime; uniform float uAmp;
varying vec3 vN; varying vec3 vView; varying float vNoise; varying vec3 vPos;
${NOISE}
void main(){
  float n = snoise(position * 0.9 + vec3(uTime * 0.22));
  float n2 = snoise(position * 2.2 - vec3(uTime * 0.4)) * 0.25;
  float d = (n + n2) * uAmp;
  vec3 p = position + normal * d;
  vNoise = n;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  vPos = p;
  gl_Position = projectionMatrix * mv;
}`;

const orbFrag = /* glsl */ `
uniform float uTime; uniform float uFlash; uniform vec3 uFlashColor; uniform float uDim;
varying vec3 vN; varying vec3 vView; varying float vNoise; varying vec3 vPos;
vec3 palette(float t){
  // cyclic: cobalt -> iris -> magenta -> peach -> sun -> cobalt
  vec3 c0 = vec3(0.24,0.36,1.0);
  vec3 c1 = vec3(0.47,0.36,0.98);
  vec3 c2 = vec3(0.90,0.36,0.66);
  vec3 c3 = vec3(1.0,0.62,0.42);
  vec3 c4 = vec3(1.0,0.80,0.36);
  t = fract(t) * 5.0;
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  if (t < 4.0) return mix(c3, c4, t - 3.0);
  return mix(c4, c0, t - 4.0);
}
void main(){
  vec3 n = normalize(vN);
  float fres = pow(1.0 - max(dot(n, vView), 0.0), 2.4);
  float ang = atan(n.y, n.x) / 6.28318 + vNoise * 0.16 + uTime * 0.045;
  vec3 col = palette(ang);
  // inner swirl
  col = mix(col, palette(ang + 0.35 + vNoise * 0.2), 0.35 * (0.5 + 0.5 * sin(vPos.z * 3.0 + uTime * 0.7)));
  // shading: darker towards bottom-right, deep core
  float shade = smoothstep(-1.2, 0.9, n.y * 0.8 - n.x * 0.25);
  col *= 0.62 + 0.48 * shade;
  col = mix(col, vec3(0.10,0.12,0.40), (1.0 - shade) * 0.25);
  // rim light and highlight
  col += vec3(0.80, 0.78, 1.0) * fres * 0.75;
  vec3 L = normalize(vec3(-0.55, 0.75, 0.6));
  float spec = pow(max(dot(reflect(-L, n), vView), 0.0), 30.0);
  float spot = smoothstep(0.55, 1.0, dot(n, normalize(vec3(-0.45, 0.55, 0.7))));
  col += vec3(1.0) * (spec * 0.7 + spot * 0.35);
  col = mix(col, uFlashColor, uFlash * 0.65);
  col = mix(col, vec3(0.45,0.5,0.75) * (0.6 + fres), uDim);
  gl_FragColor = vec4(col, 1.0);
}`;

function VoiceOrb({ speakingRef, variant }) {
  const mat = useRef();
  const shell = useRef();
  const group = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 0.02 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color('#E5483A') }, uDim: { value: variant === 'notfound' ? 0.75 : 0 } }), [variant]);
  const error = useStageStore((s) => s.error);
  const success = useStageStore((s) => s.success);
  const flash = useRef({ v: 0, color: '#E5483A' });
  useEffect(() => { if (error) flash.current = { v: 1, color: '#E5483A' }; }, [error]);
  useEffect(() => { if (success) flash.current = { v: 1, color: '#FFE6A8' }; }, [success]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    const talking = speakingRef.current?.energy ?? 0;
    const target = variant === 'notfound' ? 0.01 : 0.014 + talking * 0.026 + Math.sin(t * 7.0) * 0.004 * talking;
    uniforms.uAmp.value = THREE.MathUtils.damp(uniforms.uAmp.value, target, 4, dt);
    flash.current.v = Math.max(0, flash.current.v - dt * 1.4);
    uniforms.uFlash.value = flash.current.v;
    uniforms.uFlashColor.value.set(flash.current.color);
    if (group.current) {
      const s = 1 + flash.current.v * (flash.current.color === '#FFE6A8' ? 0.12 : 0.04);
      group.current.scale.setScalar(s);
      group.current.rotation.y = t * 0.12;
    }
  });
  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.12, 48]} />
        <shaderMaterial ref={mat} vertexShader={orbVert} fragmentShader={orbFrag} uniforms={uniforms} />
      </mesh>
      {/* glass shell for reflections */}
      <mesh ref={shell} scale={1.16}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial transparent opacity={0.1} roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={2.6} color="#E6EAFF" depthWrite={false} />
      </mesh>
      {/* inner glow sprite */}
      <mesh scale={3.6} renderOrder={-1}>
        <planeGeometry />
        <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
          uniforms={{ uC: { value: new THREE.Color(variant === 'notfound' ? '#5B6BB8' : '#7357F6') } }}
          vertexShader={`varying vec2 vUv; void main(){ vUv=uv; vec4 mv = modelViewMatrix * vec4(0.,0.,0.,1.); mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); gl_Position = projectionMatrix * mv; }`}
          fragmentShader={`uniform vec3 uC; varying vec2 vUv; void main(){ float d = distance(vUv, vec2(.5)); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(uC, a*a*.55); }`} />
      </mesh>
    </group>
  );
}

/* ───────────── Video tiles ───────────── */
function tileTexture(color, initials, name) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  const shade = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();
  const grd = g.createLinearGradient(0, 0, 512, 320);
  grd.addColorStop(0, shade(color, 0.45)); grd.addColorStop(1, shade(color, 0.05));
  g.fillStyle = grd; g.fillRect(0, 0, 512, 320);
  const glow = g.createRadialGradient(380, 40, 10, 380, 40, 300);
  glow.addColorStop(0, 'rgba(255,255,255,.35)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 512, 320);
  g.fillStyle = 'rgba(255,255,255,.96)'; g.beginPath(); g.roundRect(186, 62, 140, 140, 44); g.fill();
  g.fillStyle = color; g.font = '700 60px "Bricolage Grotesque Variable", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials, 256, 136);
  g.fillStyle = 'rgba(20,26,66,.62)'; g.beginPath(); g.roundRect(22, 250, 136, 46, 14); g.fill();
  g.fillStyle = '#fff'; g.font = '600 24px "Instrument Sans Variable", system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(name, 42, 274);
  g.fillStyle = 'rgba(255,255,255,.92)';
  [18, 34, 26, 42, 22].forEach((h, k) => { g.beginPath(); g.roundRect(410 + k * 16, 292 - h, 9, h, 4); g.fill(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function Tile({ index, tileRefs, speakingRef, fontsReady }) {
  const ref = useRef();
  const ring = useRef();
  const tex = useMemo(() => (fontsReady ? tileTexture(VOICES[index], PEOPLE[index][0], PEOPLE[index][1]) : null), [index, fontsReady]);
  useEffect(() => () => tex?.dispose(), [tex]);
  useEffect(() => { tileRefs.current[index] = ref.current; }, [index, tileRefs]);
  useFrame((_, dt) => {
    const on = speakingRef.current?.speaker === index;
    if (ring.current) ring.current.material.opacity = THREE.MathUtils.damp(ring.current.material.opacity, on ? 1 : 0, 6, dt);
  });
  return (
    <group ref={ref}>
      <RoundedBox args={[1.25, 0.8, 0.06]} radius={0.06} smoothness={4}>
        <meshPhysicalMaterial color="#ffffff" roughness={0.55} clearcoat={0.3} sheen={0.5} sheenColor="#ffffff" />
      </RoundedBox>
      {tex && (
        <mesh position={[0, 0, 0.0305]}>
          <planeGeometry args={[1.17, 0.73]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      )}
      <RoundedBox ref={ring} args={[1.36, 0.91, 0.03]} radius={0.09} smoothness={4} position={[0, 0, -0.03]}>
        <meshBasicMaterial color="#FFC53D" transparent opacity={0} toneMapped={false} />
      </RoundedBox>
    </group>
  );
}

/* ───────────── Speech particles (tile → orb) ───────────── */
const MAX_P = 90;
function SpeechParticles({ tileRefs, speakingRef, quality }) {
  const mesh = useRef();
  const parts = useMemo(() => Array.from({ length: MAX_P }, () => ({ t: 1, from: new THREE.Vector3(), ctrl: new THREE.Vector3(), color: new THREE.Color(), speed: 1, size: 1 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const next = useRef(0);
  const acc = useRef(0);
  const burst = useStageStore((s) => s.burst);
  const pending = useRef(0);
  useEffect(() => { if (burst) pending.current += 10; }, [burst]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const rate = quality === 3 ? 16 : 9;

  const spawn = (idx) => {
    const tile = tileRefs.current[idx];
    if (!tile) return;
    const p = parts[next.current]; next.current = (next.current + 1) % MAX_P;
    tile.getWorldPosition(p.from);
    p.from.x += (Math.random() - 0.5) * 0.5; p.from.y += (Math.random() - 0.5) * 0.3;
    p.ctrl.copy(p.from).multiplyScalar(0.45); p.ctrl.y += 0.9 + Math.random() * 0.6; p.ctrl.z += (Math.random() - 0.5) * 0.8;
    p.color.set(VOICES[idx]).lerp(new THREE.Color('#ffffff'), 0.25);
    p.t = 0; p.speed = 0.55 + Math.random() * 0.35; p.size = 0.6 + Math.random() * 0.8;
  };

  useFrame((_, dt) => {
    const sp = speakingRef.current;
    acc.current += dt * rate;
    while (acc.current > 1) { acc.current -= 1; if (sp.speaker !== null) spawn(sp.speaker); }
    while (pending.current > 0) { pending.current -= 1; spawn(sp.speaker ?? 1); }
    for (let i = 0; i < MAX_P; i++) {
      const p = parts[i];
      if (p.t < 1) {
        p.t = Math.min(1, p.t + dt * p.speed);
        const t = p.t, u = 1 - t;
        // quadratic bezier into the orb centre (0,0,0)
        tmp.set(u * u * p.from.x + 2 * u * t * p.ctrl.x, u * u * p.from.y + 2 * u * t * p.ctrl.y, u * u * p.from.z + 2 * u * t * p.ctrl.z);
        dummy.position.copy(tmp);
        const s = 0.045 * p.size * Math.sin(Math.PI * Math.min(1, t * 1.15));
        dummy.scale.setScalar(Math.max(0.0001, s));
      } else {
        dummy.scale.setScalar(0.0001);
      }
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, p.color);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_P]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
    </instancedMesh>
  );
}

/* ───────────── Minutes cards (orb → out) ───────────── */
function MinuteCard({ i, total }) {
  const ref = useRef();
  const mat = useRef([]);
  const phase = i / total;
  useFrame((state) => {
    const t = ((state.clock.elapsedTime * 0.11 + phase) % 1);
    const e = 1 - Math.pow(1 - t, 2);
    ref.current.position.set(0.5 + e * 1.7, -0.45 - e * 0.95 + Math.sin(t * 6 + i) * 0.04, 0.9 + e * 0.9);
    ref.current.rotation.set(-0.25 + e * 0.15, -0.5 + e * 0.25, -0.08 + Math.sin(i) * 0.06);
    const s = Math.min(1, t * 6) * (0.4 + e * 0.32);
    ref.current.scale.setScalar(Math.max(0.0001, s));
    const op = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
    mat.current.forEach((m) => m && (m.opacity = op));
  });
  const set = (k) => (m) => { mat.current[k] = m; };
  return (
    <group ref={ref}>
      <RoundedBox args={[0.9, 0.56, 0.025]} radius={0.04} smoothness={3}>
        <meshPhysicalMaterial ref={set(0)} color="#ffffff" roughness={0.4} clearcoat={0.4} transparent />
      </RoundedBox>
      <mesh position={[-0.43, 0, 0.014]}><planeGeometry args={[0.03, 0.5]} /><meshBasicMaterial ref={set(1)} color={i % 2 ? '#7357F6' : VOICES[i % 4]} transparent toneMapped={false} /></mesh>
      {[0.14, 0.02, -0.1].map((y, k) => (
        <mesh key={k} position={[-0.04 - (k === 2 ? 0.12 : 0), y, 0.014]}><planeGeometry args={[k === 2 ? 0.42 : 0.66, 0.045]} /><meshBasicMaterial ref={set(2 + k)} color={k === 0 ? '#7357F6' : '#D5DAEC'} transparent /></mesh>
      ))}
      <mesh position={[0.3, -0.19, 0.014]}><circleGeometry args={[0.04, 20]} /><meshBasicMaterial ref={set(5)} color="#FFC53D" transparent toneMapped={false} /></mesh>
    </group>
  );
}

/* ───────────── Rig: orbit, speaker rotation, parallax ───────────── */
function Rig({ variant, quality, fontsReady }) {
  const world = useRef();
  const orbit = useRef();
  const tileRefs = useRef([]);
  const speakingRef = useRef({ speaker: 1, energy: 0 });
  const focusSpeaker = useStageStore((s) => s.focusSpeaker);
  const hover = useStageStore((s) => s.hover);
  const hoverT = useRef(0);
  useEffect(() => { if (hover) hoverT.current = 1; }, [hover]);
  const { camera, size } = useThree();
  const speakT = useRef(0);
  const showTiles = variant === 'hero' || variant === 'auth';
  const showCards = variant === 'hero' || variant === 'minutes';
  const solo = !showTiles;
  const R = variant === 'auth' ? 2.45 : 2.6;
  const ellipse = useMemo(() => Array.from({ length: 97 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * 0.5 - 0.05, Math.sin(a) * R * 0.5); }), [R]);

  useEffect(() => {
    const aspect = size.width / size.height;
    const k = aspect < 1.2 ? Math.min(1.2 / aspect, 1.9) : 1;
    const dist = { auth: 11.2, hero: 11.6, mini: 4.6, minutes: 7.2, notfound: 6.2 }[variant] ?? 11.6;
    camera.position.set(0, solo ? 0.3 : 2.1, dist * k);
    camera.lookAt(0, variant === 'hero' ? -0.55 : variant === 'minutes' ? -0.45 : solo ? 0 : -0.2, 0);
  }, [camera, size, variant, solo]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const sp = speakingRef.current;
    speakT.current += dt;
    if (focusSpeaker !== null && focusSpeaker !== undefined) sp.speaker = focusSpeaker;
    else if (speakT.current > 2.8) { speakT.current = 0; sp.speaker = (sp.speaker + 1) % PEOPLE.length; }
    if (!showTiles) sp.speaker = null;
    hoverT.current = Math.max(0, hoverT.current - dt);
    sp.energy = variant !== 'notfound' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 3.1)) * (0.6 + 0.4 * Math.sin(t * 1.3)) + hoverT.current * 0.6 : 0;

    // orbit tiles around the orb; they always face the camera
    const base = t * (variant === 'auth' ? 0.09 : 0.07);
    tileRefs.current.forEach((tile, i) => {
      if (!tile) return;
      const a = base + (i / PEOPLE.length) * Math.PI * 2 + 0.35;
      tile.position.set(Math.cos(a) * R, Math.sin(a) * 0.5 - 0.05 + Math.sin(t * 1.2 + i * 1.7) * 0.04, Math.sin(a) * R * 0.5);
      tile.quaternion.copy(camera.quaternion);
      const front = (Math.sin(a) + 1) / 2; // 0 back, 1 front
      tile.scale.setScalar(0.82 + front * 0.18);
    });
    // inertial parallax
    easing.damp(world.current.rotation, 'y', state.pointer.x * 0.16, 0.6, dt);
    easing.damp(world.current.rotation, 'x', -state.pointer.y * 0.06, 0.6, dt);
    if (orbit.current) orbit.current.rotation.y = 0;
  });

  return (
    <group ref={world}>
      <VoiceOrb speakingRef={speakingRef} variant={variant} />
      {showTiles && (
        <>
          <group ref={orbit}><Line points={ellipse} color="#ffffff" transparent opacity={0.22} lineWidth={1} /></group>
          {PEOPLE.map((_, i) => <Tile key={i} index={i} tileRefs={tileRefs} speakingRef={speakingRef} fontsReady={fontsReady} />)}
          <SpeechParticles tileRefs={tileRefs} speakingRef={speakingRef} quality={quality} />
        </>
      )}
      {showCards && Array.from({ length: 3 }, (_, i) => <MinuteCard key={i} i={i} total={3} />)}
    </group>
  );
}

export default function OrbScene({ variant = 'hero', quality = 3, onReady, active = true }) {
  const [dpr, setDpr] = useState(quality === 3 ? 1.75 : 1.25);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let ok = true;
    Promise.all([document.fonts?.load?.('700 60px "Bricolage Grotesque Variable"'), document.fonts?.load?.('600 24px "Instrument Sans Variable"')]).catch(() => {}).finally(() => ok && setFontsReady(true));
    return () => { ok = false; };
  }, []);
  return (
    <Canvas
      dpr={[1, dpr]}
      frameloop={active ? 'always' : 'never'}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: 30, near: 0.1, far: 60, position: [0, 0.85, 9.2] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.setClearColor(0x000000, 0); requestAnimationFrame(() => onReady?.()); }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <hemisphereLight args={['#ffffff', '#8E9BFF', 0.9]} />
      <directionalLight position={[-4, 6, 5]} intensity={2.0} color="#FFF1DE" />
      <directionalLight position={[5, -2, -4]} intensity={0.8} color="#B9A8FF" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[-3, 4, 4]} scale={[6, 3, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[4, 1, 3]} scale={[3, 4, 1]} color="#C9BEFF" />
        <Lightformer form="ring" intensity={2} position={[0, -3, 5]} scale={4} color="#FFE6A8" />
        <Lightformer form="rect" intensity={1.2} position={[0, 0, -6]} scale={[10, 10, 1]} color="#3150FF" />
      </Environment>
      <Rig variant={variant} quality={quality} fontsReady={fontsReady} />
      {quality === 3 && <Sparkles count={variant === 'mini' ? 24 : 70} scale={variant === 'mini' ? [4, 3, 2] : [11, 6, 5]} size={variant === 'mini' ? 1.6 : 2.2} speed={0.25} opacity={0.55} color="#D9D2FF" />}
    </Canvas>
  );
}
