import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function ThreeBackground({ isDark = false }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesMeshRef = useRef(null);
  const linesMeshRef = useRef(null);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if already initialized (prevent double init in StrictMode)
    if (sceneRef.current) {
      return;
    }

    // Scene
    sceneRef.current = new THREE.Scene();

    // Camera
    cameraRef.current = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    cameraRef.current.position.z = 400;

    // Renderer
    rendererRef.current = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(rendererRef.current.domElement);

    // Particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 120;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 800;
    }

    particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(posArray, 3)
    );

    const particleColor = isDark ? 0x60a5fa : 0x3b82f6;
    const particlesMaterial = new THREE.PointsMaterial({
      size: 4,
      color: particleColor,
      transparent: true,
      opacity: isDark ? 0.6 : 0.8,
    });

    particlesMeshRef.current = new THREE.Points(particlesGeometry, particlesMaterial);
    sceneRef.current.add(particlesMeshRef.current);

    // Lines
    const linesMaterial = new THREE.LineBasicMaterial({
      color: particleColor,
      transparent: true,
      opacity: isDark ? 0.1 : 0.15,
    });

    const linesGeometry = new THREE.BufferGeometry();
    linesMeshRef.current = new THREE.LineSegments(linesGeometry, linesMaterial);
    sceneRef.current.add(linesMeshRef.current);

    // Animation loop
    const animate = () => {
      // Check if refs still exist
      if (!sceneRef.current || !particlesMeshRef.current || !linesMeshRef.current || 
          !rendererRef.current || !cameraRef.current) {
        return;
      }

      // Request next frame FIRST to ensure continuous animation
      animationIdRef.current = requestAnimationFrame(animate);

      // Rotate particles - increased speed for visible animation
      particlesMeshRef.current.rotation.x += 0.005;
      particlesMeshRef.current.rotation.y += 0.005;

      // Mouse interaction
      cameraRef.current.position.x += (mouseRef.current.x * 0.5 - cameraRef.current.position.x) * 0.05;
      cameraRef.current.position.y += (-mouseRef.current.y * 0.5 - cameraRef.current.position.y) * 0.05;
      cameraRef.current.lookAt(sceneRef.current.position);

      // Update lines
      const positions = particlesMeshRef.current.geometry.attributes.position.array;
      const linePositions = [];
      const particlesCount = positions.length / 3;

      for (let i = 0; i < particlesCount; i++) {
        for (let j = i + 1; j < particlesCount; j++) {
          const x1 = positions[i * 3];
          const y1 = positions[i * 3 + 1];
          const z1 = positions[i * 3 + 2];

          const x2 = positions[j * 3];
          const y2 = positions[j * 3 + 1];
          const z2 = positions[j * 3 + 2];

          const dist = Math.sqrt(
            Math.pow(x1 - x2, 2) + 
            Math.pow(y1 - y2, 2) + 
            Math.pow(z1 - z2, 2)
          );

          if (dist < 120) {
            linePositions.push(x1, y1, z1, x2, y2, z2);
          }
        }
      }

      linesMeshRef.current.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(linePositions, 3)
      );
      linesMeshRef.current.rotation.copy(particlesMeshRef.current.rotation);

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    // Mouse move handler
    const handleMouseMove = (event) => {
      mouseRef.current.x = event.clientX - window.innerWidth / 2;
      mouseRef.current.y = event.clientY - window.innerHeight / 2;
    };

    // Resize handler
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Cleanup function
    return () => {
      
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }

      if (containerRef.current && rendererRef.current && rendererRef.current.domElement) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (e) {
          // Element might already be removed
        }
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      if (particlesMeshRef.current) {
        particlesMeshRef.current.geometry.dispose();
        particlesMeshRef.current.material.dispose();
        particlesMeshRef.current = null;
      }
      
      if (linesMeshRef.current) {
        linesMeshRef.current.geometry.dispose();
        linesMeshRef.current.material.dispose();
        linesMeshRef.current = null;
      }
      
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []); // Empty dependency - only initialize once

  // Update colors when theme changes (without recreating the scene)
  useEffect(() => {
    if (particlesMeshRef.current && linesMeshRef.current) {
      const particleColor = isDark ? 0x60a5fa : 0x3b82f6;
      particlesMeshRef.current.material.color.setHex(particleColor);
      particlesMeshRef.current.material.opacity = isDark ? 0.6 : 0.8;
      linesMeshRef.current.material.color.setHex(particleColor);
      linesMeshRef.current.material.opacity = isDark ? 0.1 : 0.15;
    }
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}

export default ThreeBackground;
