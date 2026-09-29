"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Decorative WebGL background: floating glass-like solids and a slowly
 * drifting network of connected nodes (the "connected community" idea).
 *
 * - Purely decorative (aria-hidden, pointer-events none).
 * - Renders a single still frame when the user prefers reduced motion.
 * - Pauses when off-screen or when the tab is hidden.
 * - Falls back silently (CSS gradient behind it) if WebGL is unavailable.
 */
export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the gradient behind remains
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = () => mount.clientWidth < 700;

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 6, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0xeba57f, 30, 40);
    rim.position.set(-8, -3, 6);
    scene.add(rim);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(o: T) => (disposables.push(o), o);

    // ---- Floating solids ---------------------------------------------------
    const teal = 0x1f8177;
    const deep = 0x0f524c;
    const clay = 0xc8683b;
    const sand = 0xf8e1d3;
    const specs: { geo: THREE.BufferGeometry; color: number; wire?: boolean; pos: [number, number, number]; scale: number; spin: number }[] = [
      { geo: track(new THREE.IcosahedronGeometry(1.5, 1)), color: teal, pos: [5.2, 1.6, -1], scale: 1, spin: 0.22 },
      { geo: track(new THREE.IcosahedronGeometry(1.5, 1)), color: deep, wire: true, pos: [5.2, 1.6, -1], scale: 1.35, spin: -0.12 },
      { geo: track(new THREE.TorusGeometry(1.1, 0.34, 24, 64)), color: clay, pos: [7.4, -2.4, 0], scale: 1, spin: 0.3 },
      { geo: track(new THREE.OctahedronGeometry(1)), color: sand, pos: [3.2, -3.4, 1.5], scale: 0.9, spin: 0.35 },
      { geo: track(new THREE.SphereGeometry(0.7, 40, 40)), color: teal, pos: [8.4, 3.2, -2], scale: 1, spin: 0.1 },
      { geo: track(new THREE.TorusKnotGeometry(0.75, 0.22, 100, 14)), color: deep, pos: [1.6, 3.6, -3], scale: 0.85, spin: -0.25 },
      { geo: track(new THREE.SphereGeometry(0.4, 32, 32)), color: clay, pos: [-6, -3.2, -2], scale: 1, spin: 0.1 },
      { geo: track(new THREE.OctahedronGeometry(0.6)), color: teal, pos: [-10, 4.6, -4], scale: 1, spin: -0.3 },
    ];
    const solids = specs.map((s) => {
      const mat = track(
        new THREE.MeshStandardMaterial({
          color: s.color,
          roughness: 0.28,
          metalness: 0.15,
          transparent: true,
          opacity: s.wire ? 0.35 : 0.9,
          wireframe: Boolean(s.wire),
        }),
      );
      const mesh = new THREE.Mesh(s.geo, mat);
      mesh.position.set(...s.pos);
      mesh.scale.setScalar(s.scale);
      mesh.userData = { base: mesh.position.clone(), spin: s.spin, phase: Math.random() * Math.PI * 2, opacity: mat.opacity };
      scene.add(mesh);
      return mesh;
    });

    // ---- Connected network -------------------------------------------------
    const NODES = isSmall() ? 38 : 70;
    const LINK = 3.2;
    const positions = new Float32Array(NODES * 3);
    const velocities = new Float32Array(NODES * 3);
    const bounds = { x: 13, y: 7, z: 4 };
    for (let i = 0; i < NODES; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * bounds.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * bounds.y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * bounds.z - 2;
      velocities[i * 3] = (Math.random() - 0.5) * 0.006;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.006;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }
    const pointGeo = track(new THREE.BufferGeometry());
    pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(pointGeo, track(new THREE.PointsMaterial({ color: teal, size: 0.14, transparent: true, opacity: 0.85, sizeAttenuation: true })));
    scene.add(points);

    const maxSegments = NODES * 6;
    const linePos = new Float32Array(maxSegments * 6);
    const lineGeo = track(new THREE.BufferGeometry());
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    lineGeo.setDrawRange(0, 0);
    const lines = new THREE.LineSegments(lineGeo, track(new THREE.LineBasicMaterial({ color: teal, transparent: true, opacity: 0.22 })));
    scene.add(lines);

    function updateNetwork() {
      for (let i = 0; i < NODES; i++) {
        for (let a = 0; a < 3; a++) {
          const idx = i * 3 + a;
          positions[idx] += velocities[idx];
          const limit = a === 0 ? bounds.x : a === 1 ? bounds.y : bounds.z;
          if (Math.abs(positions[idx]) > limit) velocities[idx] *= -1;
        }
      }
      let seg = 0;
      for (let i = 0; i < NODES && seg < maxSegments; i++) {
        for (let j = i + 1; j < NODES && seg < maxSegments; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz < LINK * LINK) {
            linePos.set([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]], seg * 6);
            seg++;
          }
        }
      }
      lineGeo.setDrawRange(0, seg * 2);
      lineGeo.attributes.position.needsUpdate = true;
      pointGeo.attributes.position.needsUpdate = true;
    }

    // ---- Sizing, pointer parallax, loop -----------------------------------
    function resize() {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      // Keep the composition to the right of the text on wide screens; centre it on phones.
      const small = w < 700;
      camera.position.x = small ? 5 : 0;
      camera.position.z = small ? 24 : 14;
      // Softer solids on phones so body text stays legible over them.
      for (const m of solids) (m.material as THREE.MeshStandardMaterial).opacity = small ? 0.4 : m.userData.opacity;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;

    function frame() {
      const t = clock.getElapsedTime();
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      for (const m of solids) {
        const { base, spin, phase } = m.userData as { base: THREE.Vector3; spin: number; phase: number };
        m.rotation.x = t * spin * 0.8 + phase;
        m.rotation.y = t * spin;
        m.position.y = base.y + Math.sin(t * 0.6 + phase) * 0.35;
        m.position.x = base.x + Math.cos(t * 0.4 + phase) * 0.15;
      }
      scene.rotation.y = pointer.x * 0.12;
      scene.rotation.x = pointer.y * 0.06;
      updateNetwork();
      renderer.render(scene, camera);
    }
    function loop() {
      raf = requestAnimationFrame(loop);
      frame();
    }
    function start() {
      if (reduceMotion || raf || !visible || document.hidden) return;
      loop();
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    frame(); // always draw at least one frame
    start();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(mount);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} aria-hidden className="pointer-events-none absolute inset-0" />;
}
