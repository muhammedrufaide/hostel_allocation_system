import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initCanvas } from './canvas.js';

gsap.registerPlugin(ScrollTrigger);

// Initialize Smooth Scroll
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Initial Hero Animation
const tl = gsap.timeline();
tl.to('.main-title', {
  y: 0,
  opacity: 1,
  duration: 1.5,
  ease: 'power4.out',
  delay: 0.5
});

// Scroll Animations for Elements
gsap.utils.toArray('.fade-up').forEach((elem) => {
  gsap.to(elem, {
    scrollTrigger: {
      trigger: elem,
      start: 'top 85%',
      end: 'bottom 20%',
      toggleActions: 'play none none reverse'
    },
    y: 0,
    opacity: 1,
    duration: 1,
    ease: 'power3.out'
  });
});

// Title Parallax Effect
gsap.to('.hero-center', {
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true
  },
  y: 200,
  opacity: 0,
  ease: 'none'
});

// Initialize 3D Canvas
initCanvas(lenis);
