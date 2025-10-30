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
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BudgetForm } from "../../components/budget-form/budget-form";
import { PricesForm } from "../../components/prices-form/prices-form";
import { BudgetService } from '../../services/budget.service';
import { BudgetResponse } from '../../../../models/interfaces/model3D/budget.interface';


@Component({
  selector: 'app-editor-page',
  imports: [DecimalPipe, BudgetForm, PricesForm],
  templateUrl: './editor-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPageComponent {

  // --- Inyección y referencias al DOM ---
  private platformId = inject(PLATFORM_ID);
  private budgetService = inject(BudgetService);
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  // --- Estado UI adicional ---
  menuOpen = false;
  //bandera para abrir el presupuesto
  pricesForm = signal<boolean>(false);
  budgetForm = signal<boolean>(false);


  year = new Date().getFullYear();

  // --- Three.js: Pivots de escena ---
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  //vamos a guardar la instancia del modelo
  private modelo3D!: Modelo3D;
  // --- Selección del objeto ---
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private selectedMesh: THREE.Mesh | null = null;
  private transformControls!: TransformControls;


  // 🔹 Estados del panel de control
  posX = signal<number>(0);
  posY = signal<number>(0);
  posZ = signal<number>(0);
  rotationY = signal<number>(0);
  rotationX = signal<number>(0);
  scale = signal<number>(1);
  color = signal<string>('#ffffff');
  //----
  selectedWidth = signal<number>(1);
  selectedHeight = signal<number>(1);
  selectedDepth = signal<number>(1);
  hasSelection = signal<boolean>(false);


  //-----
  selectedType = signal<'all' | 'wall' | 'door' | 'window'>('all');

  // Texturas precargadas
  textures = [
    { name: 'Ladrillo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1757453080/ladrillo_e3xocf.jpg' },
    { name: 'Piedra', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883265/plaster_brick_pattern_disp_1k_awiqtc.png' },
    { name: 'Cemento', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883245/cracked_concrete_wall_disp_1k_sstfyd.png' },
    { name: 'Madera tajibo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894564/plywood_diff_1k_yle5d5.jpg' },
    { name: 'Madera ochoo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894554/wooden_gate_diff_1k_wjzhjf.jpg' },
    { name: 'Madera roble', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894546/worn_planks_diff_1k_k9xbdg.jpg' },
    { name: 'Vidrio simple', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759888245/depositphotos_153541450-stock-photo-glass-texture-background_ueykra.webp' },
    { name: 'Vidrio escandinavo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1761688251/Ice001_1K-JPG_Color_mcmksd.jpg' },
  ];


  // Selecciones del usuario
  selectedPart = signal<'walls' | 'door' | 'window' | 'wall_internal'>('walls');
  selectedTexture = signal(this.textures[0].url);

  ngAfterViewInit(): void {
    //aqui voy a tener que cargar los materiales guardados en el local storage



    // Ejecutar solo en cliente
    if (!isPlatformBrowser(this.platformId)) return;
    // ✅ Leer modelo desde localStorage
    const modeljson = localStorage.getItem('modelo');
    let model: any = null;

    if (modeljson) {
      try {
        model = JSON.parse(modeljson);
        console.log("✅ Modelo parseado:", model);
      } catch (err) {
        console.error("⚠️ Error al parsear JSON del modelo:", err);
        localStorage.removeItem('modelo'); // limpia si está corrupto
      }
    } else {
      console.warn("⚠️ No hay modelo guardado en localStorage");
      // 🔹 Opción: asignar un modelo por defecto si querés
      // model = { glb_model: '/media/models/mimodelo.glb' };
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
    // --- TransformControls (gizmo para mover/rotar/escalar)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControls as unknown as THREE.Object3D);



    // 🔸 Bloquear OrbitControls mientras se arrastra un objeto
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
    });



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

    const url = `http://localhost:8000${model.glb_model}`;
    // 5) Cargar modelo 3D
    // 🕒 Retraso breve para asegurar que el canvas y la escena estén listos
    setTimeout(() => {
      if (!model || !model.glb_model) {
        console.warn('⚠️ No se encontró modelo en localStorage.');
        return;
      }

      const url = `http://localhost:8000${model.glb_model}`;
      console.log('🧱 Cargando modelo desde:', url);

      this.modelo3D = new Modelo3D(
        this.scene,
        url,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 1, 1),
        new THREE.Euler(0, 0, 0),
        this.textures,
        () => {
          console.log('✅ Modelo cargado correctamente');
          const obj = this.modelo3D.getObject3D();
          this.posX.set(obj.position.x);
          this.posY.set(obj.position.y);
          this.posZ.set(obj.position.z);
        }
      );
    }, 300);


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
    canvas.addEventListener('click', this.onCanvasClick.bind(this));

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
    const val = parseFloat(value);
    this.posX.set(val);
    if (this.selectedMesh) this.selectedMesh.position.x = val;
    else this.modelo3D.setPosition(val, this.posY(), this.posZ());
  }

  onPosYChange(value: string) {
    const val = parseFloat(value);
    this.posY.set(val);
    if (this.selectedMesh) this.selectedMesh.position.y = val;
    else this.modelo3D.setPosition(this.posX(), val, this.posZ());
  }

  onPosZChange(value: string) {
    const val = parseFloat(value);
    this.posZ.set(val);
    if (this.selectedMesh) this.selectedMesh.position.z = val;
    else this.modelo3D.setPosition(this.posX(), this.posY(), val);
  }

  onScaleChange(axis: 'x' | 'y' | 'z', value: string) {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const val = parseFloat(value);
    if (isNaN(val)) return;

    // 🧱 Guardar bounding box antes de escalar
    const boxBefore = new THREE.Box3().setFromObject(mesh);
    const centerBefore = boxBefore.getCenter(new THREE.Vector3());
    const minBefore = boxBefore.min.clone();

    // 🧱 Aplicar escala
    if (axis === 'x') mesh.scale.x = val;
    if (axis === 'y') mesh.scale.y = val;
    if (axis === 'z') mesh.scale.z = val;

    mesh.updateMatrixWorld(true);

    // 🧱 Bounding box después de escalar
    const boxAfter = new THREE.Box3().setFromObject(mesh);
    const centerAfter = boxAfter.getCenter(new THREE.Vector3());
    const minAfter = boxAfter.min.clone();

    // 🧩 Compensar desplazamiento según eje
    if (axis === 'z') {
      // ✅ Crece solo hacia arriba (mantiene base inferior fija)
      const deltaZ = minBefore.z - minAfter.z;
      mesh.position.z += deltaZ;
    } else {
      // ✅ Mantiene el centro para X y Y
      const offset = new THREE.Vector3().subVectors(centerBefore, centerAfter);
      mesh.position.add(offset);
    }

    mesh.updateMatrixWorld(true);

    // 🧩 🔹 Ajustar textura SOLO del objeto seleccionado (si existe)
    const material = mesh.material as THREE.MeshStandardMaterial;
    const matAny = material as any;

    if (material.map) {
      // Clonar material si está compartido
      if (matAny.isShared !== false) {
        const newMat = material.clone() as any;
        if (material.map) {
          newMat.map = material.map.clone();
          newMat.map.needsUpdate = true;
        }
        newMat.isShared = false;
        mesh.material = newMat;
      }

      // 🔥 Ajustar repetición en función de la escala (más escala → más repeticiones)
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.repeat.set(
          mesh.scale.x * 2, // multiplicá por 2 o más para aumentar densidad
          mesh.scale.y * 2
        );
        mat.map.needsUpdate = true;
      }
    }
  }







  onTextureChange(url: string) {
    this.selectedTexture.set(url);
    if (!this.modelo3D) return;

    // 🔹 Traducción interna para coincidir con los nombres reales
    let part = this.selectedPart();
    if (part === 'walls') part = 'wall_internal';

    // 🔹 Aplicar textura solo a esa parte
    this.modelo3D.setTextureByName(part, url);
    console.log(`✅ Textura aplicada a: ${part}`);
  }



  private onCanvasClick(event: MouseEvent) {


    if (!this.modelo3D) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // intersecta solo objetos visibles y con geometría
    const allObjects = [
      ...this.modelo3D.getWalls(),
      ...this.modelo3D.getDoors(),
      ...this.modelo3D.getWindows(),
    ];
    const intersects = this.raycaster.intersectObjects(allObjects, true);


    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      this.selectedMesh = mesh;
      this.hasSelection.set(true); // ✅ ahora Angular sabe que hay selección

      // Calcular tamaño actual
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      this.selectedWidth.set(size.x);
      this.selectedHeight.set(size.y);
      this.selectedDepth.set(size.z);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x333333);

      this.transformControls.attach(mesh);
      console.log("Seleccionado:", mesh.name);
    } else {
      if (this.selectedMesh) {
        const prevMat = this.selectedMesh.material as THREE.MeshStandardMaterial;
        prevMat.emissive.setHex(0x000000);
      }
      this.selectedMesh = null;
      this.transformControls.detach();
      this.hasSelection.set(false); // ✅ sin selección
    }

  }

  onDimensionChange(axis: 'x' | 'y', value: string) {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const newVal = parseFloat(value);
    if (isNaN(newVal)) return;

    // 🧱 Obtener dimensiones originales de la geometría
    const geom = mesh.geometry as THREE.BoxGeometry;
    const params = geom.parameters;

    // 🔹 Si el modelo viene de un GLTF, puede no tener parámetros → estimamos
    const oldX = params.width ?? 1;
    const oldY = params.height ?? 1;
    const oldZ = params.depth ?? 0.1; // ✅ Grosor fijo por defecto

    let newX = oldX;
    let newY = oldY;
    const newZ = oldZ; // 🔒 Z nunca cambia

    if (axis === 'x') newX = newVal;
    if (axis === 'y') newY = newVal;

    // 🧩 Guardar posición y rotación actuales
    const oldPos = mesh.position.clone();
    const oldRot = mesh.rotation.clone();

    // 🧩 Reemplazar geometría
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(newX, newY, newZ);

    // 🧩 Restaurar rotación
    mesh.rotation.copy(oldRot);

    // 🧩 Mantener base en el suelo si cambia Y
    if (axis === 'y') {
      const deltaY = (newY - oldY) / 2;
      mesh.position.set(oldPos.x, oldPos.y + deltaY, oldPos.z);
    } else {
      mesh.position.copy(oldPos);
    }

    // 🧩 Forzar actualización
    (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;

    // 🧩 Actualizar señales
    this.selectedWidth.set(newX);
    this.selectedHeight.set(newY);
    this.selectedDepth.set(newZ);
  }

  onExportModel(dropdown: HTMLDetailsElement) {
    dropdown.removeAttribute('open');
    if (this.modelo3D) {
      this.modelo3D.exportAsGLB('modelo_exportado.glb');
    } else {
      console.warn('⚠️ No hay modelo cargado');
    }
  }

  onGenerateBudget() {
    //implementar el toast y un spinner mientras se genera el presupuesto
    if (!this.modelo3D) return;
    const summary = this.modelo3D.toJSONSummary();//--> aqui obtenemos el modelo en formato json
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'modelo_resumen.json';
    // a.click();
    // URL.revokeObjectURL(url);
    this.budgetService.generateBudget(summary).subscribe({
      next: (response: BudgetResponse) => {
        console.log('Presupuesto generado con éxito:', response);
        this.onShowBudget();
      },
      error: (error) => {
        console.error('No se genero el presupuesto:', error);
      }
    });
  }

  public onUpdatePrices = () => {
    this.pricesForm.set(!this.pricesForm());
  }

  public onShowBudget = () => {
    this.budgetForm.set(!this.budgetForm());
  }





}
