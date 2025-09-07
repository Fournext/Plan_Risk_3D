import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  ViewChild,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Modelo3D } from '../../../../models/classes/model3D';


@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class HomePageComponent {
  // --- Inyección y referencias al DOM ---
  private platformId = inject(PLATFORM_ID);
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // --- Host styling ---
  @HostBinding('class') host = 'block min-h-screen bg-slate-50 text-slate-800';

  // --- Estado UI adicional ---
  menuOpen = false;
  year = new Date().getFullYear();

  // --- Three.js: Pivots de escena ---
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  ngAfterViewInit(): void {
    // Ejecutar solo en cliente
    if (!isPlatformBrowser(this.platformId)) return;

    // 1) Preparar renderer y tamaño inicial
    const canvas = this.canvasRef.nativeElement;
    const { clientWidth: w, clientHeight: h } = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0xdddddd);

    // 2) Crear escena y cámara
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // 3) Configurar OrbitControls con damping
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // 4) Añadir helpers y luces
    this.scene.add(new THREE.GridHelper(30, 30));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    //url del modelo
    const url = 'https://cdn.jsdelivr.net/gh/BrayanQuispe24/mis-modelos-3d@main/models/cartoon_cyberpunk_building.glb';

    // 5) Cargar modelo 3D
    const modelo = new Modelo3D(
      this.scene,
      url,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1),
      new THREE.Euler(0, 0, 0),
      () => {
        console.log('Modelo cargado');
      }
    );

    // 6) Loop de animación
    const animate = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.renderer.setAnimationLoop(animate);

    // 7) Responsive: redimensionar al cambiar ventana
    window.addEventListener('resize', () => {
      const { clientWidth, clientHeight } = canvas;
      this.renderer.setSize(clientWidth, clientHeight);
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  scrollTo(event: MouseEvent, id: string) {
    event.preventDefault();                // evita el reload
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
