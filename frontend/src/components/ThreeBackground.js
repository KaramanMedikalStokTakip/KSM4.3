import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function ThreeBackground({ isDark = false }) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const hasInitialized = useRef(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    
    // Prevent double initialization in React StrictMode by checking if canvas already exists
    if (containerRef.current.querySelector('canvas')) {
      return;
    }
    
    // Additional check using ref
    if (hasInitialized.current) {
      return;
    }
    
    hasInitialized.current = true;
    isRunningRef.current = true;
    
    let scene, camera, renderer, particlesMesh, linesMesh;

    // Initialize Three.js scene
    const init = () => {
      // Scene
      scene = new THREE.Scene();

      // Camera
      camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        1000
      );
      camera.position.z = 400;

      // Renderer
      renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true 
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
      }

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

      particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particlesMesh);

      // Lines
      const linesMaterial = new THREE.LineBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: isDark ? 0.1 : 0.15,
      });

      const linesGeometry = new THREE.BufferGeometry();
      linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
      scene.add(linesMesh);
    };

    const mousePosition = { x: 0, y: 0 };

    // Animation loop
    const animate = () => {
      if (!isRunningRef.current) {
        console.log('Animation stopped - isRunningRef is false');
        return;
      }

      animationRef.current = requestAnimationFrame(animate);

      if (particlesMesh && linesMesh && renderer && scene && camera) {
        // Rotate particles
        particlesMesh.rotation.x += 0.001;
        particlesMesh.rotation.y += 0.001;

        // Mouse interaction
        camera.position.x += (mousePosition.x * 0.5 - camera.position.x) * 0.05;
        camera.position.y += (-mousePosition.y * 0.5 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        // Update lines
        const positions = particlesMesh.geometry.attributes.position.array;
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

        linesMesh.geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(linePositions, 3)
        );
        linesMesh.rotation.copy(particlesMesh.rotation);

        renderer.render(scene, camera);
      }
    };

    // Mouse move handler
    const handleMouseMove = (event) => {
      mousePosition.x = event.clientX - window.innerWidth / 2;
      mousePosition.y = event.clientY - window.innerHeight / 2;
    };

    // Resize handler
    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    // Initialize and start animation
    init();
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    console.log('ThreeBackground initialized, starting animation...');
    
    // Start animation with a small delay to ensure everything is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        console.log('Animation loop starting now');
        animate();
      });
    });

    // Cleanup
    return () => {
      console.log('ThreeBackground cleanup called');
      isRunningRef.current = false;
      hasInitialized.current = false;
      
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (containerRef.current && renderer && renderer.domElement) {
        try {
          containerRef.current.removeChild(renderer.domElement);
        } catch (e) {
          // Element might already be removed
        }
      }

      if (renderer) {
        renderer.dispose();
      }
      if (particlesMesh) {
        particlesMesh.geometry.dispose();
        particlesMesh.material.dispose();
      }
      if (linesMesh) {
        linesMesh.geometry.dispose();
        linesMesh.material.dispose();
      }
    };
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
