import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  ViewChild,
  inject,
  PLATFORM_ID,
  signal,
  ChangeDetectorRef,
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
import { ModelsService } from '../../services/models.service';
import { StructuralAnalysisService } from '../../services/structural-analysis.service';
import { StructuralAnalysis } from '../../../../models/interfaces/model3D/structural_analysis.interface';
import { Spinner } from "../../../../layout/components/spinner/spinner";


@Component({
  selector: 'app-editor-page',
  imports: [DecimalPipe, BudgetForm, PricesForm, Spinner],
  templateUrl: './editor-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPageComponent {

  // --- Inyección y referencias al DOM ---
  private platformId = inject(PLATFORM_ID);
  private budgetService = inject(BudgetService);
  private modelService = inject(ModelsService);
  private analysisService = inject(StructuralAnalysisService);
  // ChangeDetectorRef para forzar actualización con ChangeDetectionStrategy.OnPush
  private cdr = inject(ChangeDetectorRef);
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  // --- Estado UI adicional ---
  public menuOpen = false;
  public textureModalOpen = signal<boolean>(false);
  public positionObjectsModalOpen = signal<boolean>(false);
  public transformModalOpen = signal<boolean>(false);
  public createObjectModalOpen = signal<boolean>(false);
  public rotationModalOpen = signal<boolean>(false);

  //bandera para abrir el presupuesto
  public pricesForm = signal<boolean>(false);
  public budgetForm = signal<boolean>(false);
  public chatBoxModal = signal<boolean>(false);//usar en el @if


  year = new Date().getFullYear();
  structuralAnalysis: StructuralAnalysis | null = null;


  //estado de carga del presupuesto, usado para los spinner
  public isLoadingBudget() {
    return this.budgetService.isLoading();
  }

  public changeStateIsLoading() {
    this.budgetService.isLoading.set(!this.budgetService.isLoading());
  }

  //estado de carga del presupuesto, usado para los spinner
  public isLoadingAnalisis() {
    return this.analysisService.isLoading();
  }

  public changeAnalisisIsLoading() {
    this.analysisService.isLoading.set(!this.analysisService.isLoading());
  }

  async analizarModelo() {
    if (!this.modelo3D) return;
    const model = JSON.parse(localStorage.getItem('modelo') || '{}');
    const model3D: { blob: Blob; filename: string } = await this.modelo3D.exportAsGLB(`job_${model.id}.glb`);
    this.changeAnalisisIsLoading();
    this.analysisService.getStructuralAnalysis(new File([model3D.blob], model3D.filename)).subscribe({
      next: (response) => {
        this.structuralAnalysis = response;
        // Forzar detección porque el componente usa OnPush
        this.changeAnalisisIsLoading();
        try {
          this.cdr.markForCheck();
        } catch (e) {
          // no fatal, solo log
          console.warn('No se pudo marcar vista para detección:', e);
        }
      }
    });
  }

  // Devuelve una representación de texto legible del análisis para mostrar en el textarea
  formatStructuralAnalysis(): string {
    if (!this.structuralAnalysis) return 'Sin análisis estructural por el momento...';
    const s = this.structuralAnalysis;
    const anali = s.analisis;
    let out = `Archivo: ${s.nombre_archivo}\n\n`;

    if (anali?.resumen_general) {
      const rg = anali.resumen_general;
      out += `Resumen general:\n- Nivel riesgo global: ${rg.nivel_riesgo_global}\n- Elementos correctos: ${rg.elementos_correctos}\n- Elementos incorrectos: ${rg.elementos_incorrectos}\n- Comentario: ${rg.comentario ?? '-'}\n\n`;
    }

    if (anali?.elementos_bien_hechos && anali.elementos_bien_hechos.length) {
      out += 'Elementos bien hechos:\n';
      anali.elementos_bien_hechos.forEach((e) => {
        out += `- ${e.tipo}: ${e.cantidad} (material: ${e.material_usado})`;
        if (e.por_que_esta_bien) out += ` — ${e.por_que_esta_bien}`;
        out += '\n';
      });
      out += '\n';
    }

    if (anali?.elementos_mal_hechos && anali.elementos_mal_hechos.length) {
      out += 'Elementos mal hechos:\n';
      anali.elementos_mal_hechos.forEach((e) => {
        out += `- ${e.tipo}: ${e.cantidad} (material: ${e.material_usado})`;
        if (e.problema) out += ` — Problema: ${e.problema}`;
        if (e.nivel_riesgo) out += ` — Nivel riesgo: ${e.nivel_riesgo}`;
        out += '\n';
      });
      out += '\n';
    }

    if (anali?.recomendaciones && anali.recomendaciones.length) {
      out += 'Recomendaciones:\n';
      anali.recomendaciones.forEach((r) => {
        out += `- Para ${r.para_elemento} (afectados: ${r.cantidad_afectada}): cambiar ${r.cambiar_de} → ${r.cambiar_a}\n  Razón: ${r.razon}\n  Urgencia: ${r.urgencia ?? '-'}\n`;
      });
      out += '\n';
    }

    return out.trim();
  }

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

  private floor!: THREE.Mesh;
  public isCreatingElement: 'wall' | 'door' | 'window' | null = null;



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

  selectedScaleX = signal<number>(1);
  selectedScaleY = signal<number>(1);
  selectedScaleZ = signal<number>(1);

  selectedRotationX = signal<number>(0);
  selectedRotationY = signal<number>(0);
  selectedRotationZ = signal<number>(0);




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


    // 5) Cargar modelo 3D
    // 🕒 Retraso breve para asegurar que el canvas y la escena estén listos
    setTimeout(() => {
      let url: string = '';
      if (!model || !model.glb_model) {
        console.warn('⚠️ No se encontró modelo en localStorage.');
        url = 'https://res.cloudinary.com/diqqfka6g/image/upload/v1763521878/vacio_wama55.glb';
      } else {
        url = `http://localhost:8000${model.glb_model}`;
      }
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
    this.floor = floor;     // ✔ ahora guardado para raycaster
    this.scene.add(this.floor);


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
    this.selectedScaleX.set(mesh.scale.x);
    this.selectedScaleY.set(mesh.scale.y);
    this.selectedScaleZ.set(mesh.scale.z);


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

    // 🔥 1) Detectar clic en el piso si estamos creando un elemento
    const floorHit = this.raycaster.intersectObject(this.floor, true);
    if (floorHit.length > 0 && this.isCreatingElement) {
      const pt = floorHit[0].point.clone();
      this.spawnElementAt(pt);
      return;
    }
    const intersects = this.raycaster.intersectObjects(allObjects, true);


    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      this.selectedMesh = mesh;
      this.hasSelection.set(true); // ✅ ahora Angular sabe que hay selección
      // 🔥 Actualizar sliders con la posición del objeto seleccionado
      this.posX.set(mesh.position.x);
      this.posY.set(mesh.position.y);
      this.posZ.set(mesh.position.z);


      // Calcular tamaño actual
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      this.selectedWidth.set(size.x);
      this.selectedHeight.set(size.y);
      this.selectedDepth.set(size.z);
      this.selectedScaleX.set(mesh.scale.x);
      this.selectedScaleY.set(mesh.scale.y);
      this.selectedScaleZ.set(mesh.scale.z);

      // 🔹 👉 Aquí agregás la rotación actual del objeto seleccionado
      this.selectedRotationX.set(THREE.MathUtils.radToDeg(mesh.rotation.x));
      this.selectedRotationY.set(THREE.MathUtils.radToDeg(mesh.rotation.y));
      this.selectedRotationZ.set(THREE.MathUtils.radToDeg(mesh.rotation.z));


      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x333333);

      this.transformControls.attach(mesh);
      console.log("Seleccionado:", mesh.name);
    }
    else {
      if (this.selectedMesh) {
        const prevMat = this.selectedMesh.material as THREE.MeshStandardMaterial;
        prevMat.emissive.setHex(0x000000);
      }
      this.selectedMesh = null;
      this.transformControls.detach();
      this.hasSelection.set(false); // ✅ sin selección
      this.selectedMesh = null;
      this.transformControls.detach();
      this.hasSelection.set(false);
      this.selectedScaleX.set(1);
      this.selectedScaleY.set(1);
      this.selectedScaleZ.set(1);
      this.selectedRotationX.set(0);
      this.selectedRotationY.set(0);
      this.selectedRotationZ.set(0);


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

  async onExportModel(dropdown: HTMLDetailsElement) {
    //obtenemos el modelo del local storage para obtener su id
    const model = JSON.parse(localStorage.getItem('modelo') || '{}');

    dropdown.removeAttribute('open');
    if (this.modelo3D) {
      const model3D: { blob: Blob; filename: string } = await this.modelo3D.exportAsGLB(`job_${model.id}.glb`);
      this.modelo3D.downloadBlob(model3D.blob, model3D.filename);
    } else {
      console.warn('⚠️ No hay modelo cargado');
    }
  }

  async onSaveModel(dropdown: HTMLDetailsElement) {
    dropdown.removeAttribute('open');
    //verificamos la existencia del modelo
    if (this.modelo3D) {
      const model = JSON.parse(localStorage.getItem('modelo') || '{}');
      const model3D: { blob: Blob; filename: string } = await this.modelo3D.exportAsGLB(`job_${model.id}.glb`);
      //ahora vamos a actualizar el modelo en el backend
      this.modelService.updateModel(new File([model3D.blob], model3D.filename), model.usuario).subscribe({
        next: (models) => {
          console.log('✅ Modelos actualizados:', models);
          // 🔹 Actualizar el modelo actual en localStorage
          const updated = models.find((m: any) => m.id === model.id);
          if (updated) {
            localStorage.setItem('modelo', JSON.stringify(updated));
          }
        },
        error: (error) => {
          console.error('Error al actualizar el modelo:', error);
        }
      });

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
    this.changeStateIsLoading();
    this.budgetService.generateBudget(summary).subscribe({
      next: (response: BudgetResponse) => {
        console.log('Presupuesto generado con éxito:', response);
        this.onShowBudget();
        this.changeStateIsLoading();
      },
      error: (error) => {
        console.error('No se genero el presupuesto:', error);
        this.changeStateIsLoading();
      }
    });
  }

  public onUpdatePrices = () => {
    this.pricesForm.set(!this.pricesForm());
  }

  public onShowBudget = () => {
    this.budgetForm.set(!this.budgetForm());
  }


  createElement(type: 'wall' | 'door' | 'window') {
    this.isCreatingElement = type;
    console.log('👉 Hacé clic en el piso para colocar el elemento:', type);
  }



  onRotationChange(axis: 'x' | 'y' | 'z', value: string) {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;

    const angleDeg = parseFloat(value);
    const angleRad = THREE.MathUtils.degToRad(angleDeg);

    if (axis === 'x') mesh.rotation.x = angleRad;
    if (axis === 'y') mesh.rotation.y = angleRad;
    if (axis === 'z') mesh.rotation.z = angleRad;

    // Actualizar señales
    this.selectedRotationX.set(THREE.MathUtils.radToDeg(mesh.rotation.x));
    this.selectedRotationY.set(THREE.MathUtils.radToDeg(mesh.rotation.y));
    this.selectedRotationZ.set(THREE.MathUtils.radToDeg(mesh.rotation.z));
  }




  public toggleTextureModal() {
    this.textureModalOpen.set(!this.textureModalOpen());
  }

  public togglePositionObjectsModal() {
    this.positionObjectsModalOpen.set(!this.positionObjectsModalOpen());
  }
  public toggleTransformModal() {
    this.transformModalOpen.set(!this.transformModalOpen());
  }
  public toggleCreateObjectModal() {
    this.createObjectModalOpen.set(!this.createObjectModalOpen());
  }
  public toggleRotationModal() {
    this.rotationModalOpen.set(!this.rotationModalOpen());
  }
  public toggleChatBoxModal() {//usar para el chatbox
    this.chatBoxModal.set(!this.chatBoxModal());
  }

  public resetScale() {
    if (!this.selectedMesh) return;
    this.selectedMesh.scale.set(1, 1, 1);
    this.selectedScaleX.set(1);
    this.selectedScaleY.set(1);
    this.selectedScaleZ.set(1);
  }

  spawnElementAt(point: THREE.Vector3) {
    if (!this.modelo3D || !this.isCreatingElement) return;

    // Sacamos altura del piso desde cualquier muro existente
    const baseY = this.modelo3D.getWalls().length > 0
      ? this.modelo3D.getWalls()[0].position.y
      : 0;

    point.y = baseY;

    const newMesh = this.modelo3D.createElement(
      this.isCreatingElement,
      2,   // ancho por defecto
      3,   // altura por defecto
      0.4, // profundidad muro
      point
    );

    this.selectedMesh = newMesh;
    this.transformControls.attach(newMesh);
    this.hasSelection.set(true);

    // desactivar modo creación
    this.isCreatingElement = null;
  }

  deleteSelected() {
    if (!this.selectedMesh || !this.modelo3D) return;

    // Desconectar gizmo
    this.transformControls.detach();

    // Eliminar realmente el objeto
    this.modelo3D.removeElement(this.selectedMesh);

    // Limpiar selección
    this.selectedMesh = null;
    this.hasSelection.set(false);

    console.log("🗑 Elemento eliminado correctamente");
  }

}
