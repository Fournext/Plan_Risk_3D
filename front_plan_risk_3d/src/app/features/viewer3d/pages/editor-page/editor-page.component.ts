import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  ViewChild,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Modelo3D } from '../../../../models/classes/model3D';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-editor-page',
  imports: [DecimalPipe],
  templateUrl: './editor-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPageComponent {
  // --- Inyección y referencias al DOM ---
  private platformId = inject(PLATFORM_ID);
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  // --- Estado UI adicional ---
  menuOpen = false;
  year = new Date().getFullYear();

  // --- Three.js: Pivots de escena ---
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  //vamos a guardar la instancia del modelo
  private modelo3D!: Modelo3D;



  // 🔹 Estados del panel de control
  posX = signal<number>(0);
  posY = signal<number>(0);
  posZ = signal<number>(0);
  rotationY = signal<number>(0);
  rotationX = signal<number>(0);
  scale = signal<number>(1);
  color = signal<string>('#ffffff');
  //----
  selectedType = signal<'all' | 'wall' | 'door' | 'window'>('all');

  // Texturas precargadas
  textures = [
    { name: 'Ladrillo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1757453080/ladrillo_e3xocf.jpg' },
    { name: 'Piedra', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883265/plaster_brick_pattern_disp_1k_awiqtc.png' },
    { name: 'Cemento', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883245/cracked_concrete_wall_disp_1k_sstfyd.png' },
    {name: 'Madera 1', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894564/plywood_diff_1k_yle5d5.jpg' },
    {name: 'Madera 2', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894554/wooden_gate_diff_1k_wjzhjf.jpg' },
    { name: 'Medera 3', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894546/worn_planks_diff_1k_k9xbdg.jpg' },
  ];


  // Selecciones del usuario
  selectedPart = signal<'walls' | 'door' | 'window'>('walls');
  selectedTexture = signal(this.textures[0].url);

  ngAfterViewInit(): void {


    // Ejecutar solo en cliente
    if (!isPlatformBrowser(this.platformId)) return;
    const modeljson = localStorage.getItem('modelo');
    let model: any = null;

    if (modeljson) {
      try {
        model = JSON.parse(modeljson);
        console.log("Modelo parseado:", model);
      } catch (err) {
        console.error("Error al parsear JSON del modelo:", err);
      }
    } else {
      console.warn("No hay modelo guardado en localStorage");
    }


    // 1) Preparar renderer y tamaño inicial
    const canvas = this.canvasRef.nativeElement;
    const { clientWidth: w, clientHeight: h } = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0xdddddd);
    // Corrección de gamma moderna
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;


    // 2) Crear escena y cámara
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.camera.position.set(10, 15, 15);
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
    // Parámetros comunes
    const intensity = 0.6;
    const target = new THREE.Vector3(0, 0, 0);

    // Luz frontal (sobre el eje +Z)
    const lightFront = new THREE.DirectionalLight(0xffffff, intensity);
    lightFront.position.set(0, 10, 10);
    lightFront.target.position.copy(target);
    this.scene.add(lightFront);
    this.scene.add(lightFront.target);

    // Luz trasera (–Z)
    const lightBack = new THREE.DirectionalLight(0xffffff, intensity);
    lightBack.position.set(0, 10, -10);
    lightBack.target.position.copy(target);
    this.scene.add(lightBack);
    this.scene.add(lightBack.target);

    // Luz derecha (+X)
    const lightRight = new THREE.DirectionalLight(0xffffff, intensity);
    lightRight.position.set(10, 10, 0);
    lightRight.target.position.copy(target);
    this.scene.add(lightRight);
    this.scene.add(lightRight.target);

    // Luz izquierda (–X)
    const lightLeft = new THREE.DirectionalLight(0xffffff, intensity);
    lightLeft.position.set(-10, 10, 0);
    lightLeft.target.position.copy(target);
    this.scene.add(lightLeft);
    this.scene.add(lightLeft.target);


    //suelo
    // --- Suelo con textura ---
    const loader = new THREE.TextureLoader();
    const floorTexture = loader.load('https://res.cloudinary.com/diqqfka6g/image/upload/v1757453080/piedra_a4zfx4.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(10, 10);


    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    floorTexture.colorSpace = THREE.SRGBColorSpace;

    const floorGeometry = new THREE.PlaneGeometry(40, 40);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0; // al nivel del grid
    this.scene.add(floor);

    // --- GridHelper encima del suelo ---
    // const grid = new THREE.GridHelper(30, 30, 0x00ff00, 0x555555);
    // (grid.material as THREE.Material).opacity = 0.3;  // medio transparente
    // (grid.material as THREE.Material).transparent = true;
    // this.scene.add(grid);



    //url del modelo
    //const url = 'https://cdn.jsdelivr.net/gh/BrayanQuispe24/mis-modelos-3d@main/models/cartoon_cyberpunk_building.glb';
    const url = `http://localhost:8000${model.glb_model}`;
    // 5) Cargar modelo 3D
    this.modelo3D = new Modelo3D(
      this.scene,
      url,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1),
      new THREE.Euler(0, 0, 0),
      () => {
        console.log('Modelo cargado');
        const obj = this.modelo3D.getObject3D();
        this.posX.set(obj.position.x);
        this.posY.set(obj.position.y);
        this.posZ.set(obj.position.z);
        this.rotationY.set(obj.rotation.y);
        this.rotationX.set(obj.rotation.x);
        this.scale.set(obj.scale.x);
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

  // 🧱 Handlers para sliders
  onRotationYChange(value: string) {
    if (!this.modelo3D) return;
    this.rotationY.set(parseFloat(value));
    this.modelo3D.setRotation(0, this.rotationY(), 0);
  }

  onRotationXChange(value: string) {
    if (!this.modelo3D) return;
    this.rotationX.set(parseFloat(value));
    this.modelo3D.setRotation(0, this.rotationY(), this.rotationX());
  }

  onScaleChange(value: string) {
    if (!this.modelo3D) return;
    this.scale.set(parseFloat(value));
    this.modelo3D.setScale(this.scale(), this.scale(), this.scale());
  }

  onColorChange(value: string) {
    if (!this.modelo3D) return;
    if (this.selectedTexture() !== '') return;
    this.color.set(value);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(value),
      metalness: 0.3,
      roughness: 0.7,
    });

    // 🔸 Nuevo comportamiento
    const type = this.selectedType();
    if (type === 'all') {
      this.modelo3D.setMaterial(mat);
    } else {
      this.modelo3D.setMaterialByName(type, mat);
    }
  }


  onPosXChange(value: string) {
    if (!this.modelo3D) return;
    this.posX.set(parseFloat(value));
    this.modelo3D.setPosition(this.posX(), this.posY(), this.posZ());
  }

  onPosYChange(value: string) {
    if (!this.modelo3D) return;
    this.posY.set(parseFloat(value));
    this.modelo3D.setPosition(this.posX(), this.posY(), this.posZ());
  }

  onPosZChange(value: string) {
    if (!this.modelo3D) return;
    this.posZ.set(parseFloat(value));
    this.modelo3D.setPosition(this.posX(), this.posY(), this.posZ());
  }
  onTextureChange(url: string) {
    this.selectedTexture.set(url);
    if (!this.modelo3D) return;

    const part = this.selectedPart();
      this.modelo3D.setTextureByName(part, url);
  }

}
