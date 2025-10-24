import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelJson } from '../interfaces/model3D/model3D.interface';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';




export class Modelo3D {
  public objeto!: THREE.Object3D;
  private onLoadCallbackList: Array<() => void> = [];
  private loader = new THREE.TextureLoader();
  private walls: THREE.Mesh[] = [];
  private doors: THREE.Mesh[] = [];
  private windows: THREE.Mesh[] = [];


  constructor(
    private scene: THREE.Scene,
    private url: string,
    public position = new THREE.Vector3(0, 0, 0),
    public scale = new THREE.Vector3(1, 1, 1),
    public rotation = new THREE.Euler(0, 0, 0),
    private textures: { name: string; url: string }[] = [], // ✅ nuevo
    onLoadCallback?: () => void
  ) {
    if (onLoadCallback) this.onLoadCallbackList.push(onLoadCallback);
    this.cargarModelo();
  }



  private async cargarModelo() {
    if (this.url.endsWith('.json')) {
      try {
        const res = await fetch(this.url);
        if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
        const model: ModelJson = await res.json();

        // 👇 Aquí inicializas el grupo
        this.objeto = new THREE.Group();

        const globalScale = 0.01;

        model.points.forEach((p, i) => {
          const w = (p.x2 - p.x1) * globalScale;
          const h = (p.y2 - p.y1) * globalScale;

          const cx = (p.x1 + p.x2) / 2 * globalScale;
          const cy = (p.y1 + p.y2) / 2 * globalScale;

          const cls = model.classes[i]?.name ?? "wall";

          let color = 0xaaaaaa;
          if (cls === "wall") color = 0x444444;
          if (cls === "door") color = 0x00ff00;
          if (cls === "window") color = 0x0000ff;

          const geometry = new THREE.BoxGeometry(w, h, 0.1);
          const material = new THREE.MeshStandardMaterial({ color });
          const mesh = new THREE.Mesh(geometry, material);

          mesh.position.set(cx, -cy, 0);

          // 👇 ahora sí puedes añadir
          this.objeto.add(mesh);
        });

        // Transformaciones globales
        this.objeto.scale.copy(this.scale);
        this.objeto.rotation.copy(this.rotation);
        this.objeto.position.add(this.position);

        this.scene.add(this.objeto);

        this.onLoadCallbackList.forEach(cb => cb());
      } catch (err) {
        console.error("Error cargando modelo JSON:", err);
      }
    }
    else {
      const loader = new GLTFLoader();
      loader.load(this.url, (gltf) => {
        this.objeto = gltf.scene;

        this.objeto.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x888888,
              metalness: 0.2,
              roughness: 0.8,
              side: THREE.DoubleSide,
            });

            mesh.name = child.name || `mesh_${THREE.MathUtils.generateUUID()}`;

            // 🧱 Clasificar por tipo (nombre parcial o palabra clave)
            const lname = mesh.name.toLowerCase();
            if (lname.includes('wall_internal')) this.walls.push(mesh);
            else if (lname.includes('door')) this.doors.push(mesh);
            else if (lname.includes('window')) this.windows.push(mesh);
          }
        });



        // 🔸 2. Centrar, escalar y posicionar como ya hacías
        this.objeto.scale.copy(this.scale);
        let box = new THREE.Box3().setFromObject(this.objeto);
        const center = box.getCenter(new THREE.Vector3());
        this.objeto.position.sub(center);

        box = new THREE.Box3().setFromObject(this.objeto);
        const height = box.getSize(new THREE.Vector3()).y;
        this.objeto.position.y += height / 2;
        this.objeto.position.add(this.position);
        this.objeto.rotation.copy(this.rotation);

        // 🔸 3. Añadir a la escena
        this.scene.add(this.objeto);

        // 🔸 4. Aplicar textura base si querés (opcional)
        this.setTextureByName('wall_internal', 'https://res.cloudinary.com/diqqfka6g/image/upload/v1757453080/ladrillo_e3xocf.jpg');
        this.setTextureByName('door', 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759888108/rosewood_veneer1_diff_1k_utjn4v.jpg');
        this.setTextureByName('window', 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759888245/depositphotos_153541450-stock-photo-glass-texture-background_ueykra.webp');
        this.onLoadCallbackList.forEach(cb => cb());
      });

    }
  }





  // ✅ Modificar posición
  setPosition(x: number, y: number, z: number) {
    this.objeto.position.set(x, y, z);
  }

  // ✅ Modificar escala
  setScale(x: number, y: number, z: number) {
    this.objeto.scale.set(x, y, z);
  }

  // ✅ Modificar rotación
  setRotation(x: number, y: number, z: number) {
    this.objeto.rotation.set(x, y, z);
  }

  // ✅ Cambiar el material completo
  setMaterial(material: THREE.Material) {
    this.objeto.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
      }
    });
  }


  // ✅ Añadir más callbacks después de haber instanciado
  addOnLoadCallback(callback: () => void) {
    this.onLoadCallbackList.push(callback);
  }

  // ✅ Obtener el objeto directamente si se necesita acceso completo
  getObject3D(): THREE.Object3D {
    return this.objeto;
  }
  getWalls(): THREE.Mesh[] { return this.walls; }
  getDoors(): THREE.Mesh[] { return this.doors; }
  getWindows(): THREE.Mesh[] { return this.windows; }


  private buildFromDetections(model: ModelJson) {
    const scale = 0.01; // Escalar píxeles → unidades Three.js

    model.points.forEach((p, i) => {
      const w = (p.x2 - p.x1) * scale;
      const h = (p.y2 - p.y1) * scale;

      // Centro del rectángulo
      const cx = (p.x1 + p.x2) / 2 * scale;
      const cy = (p.y1 + p.y2) / 2 * scale;

      // Clase (wall, door, window)
      const cls = model.classes[i]?.name ?? 'wall';

      let color = 0xaaaaaa;
      if (cls === 'wall') color = 0x444444;
      if (cls === 'door') color = 0x00ff00;
      if (cls === 'window') color = 0x0000ff;

      // Crear un cubo delgado (pared/plano)
      const geometry = new THREE.BoxGeometry(w, h, 0.1);
      const material = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geometry, material);

      // Posicionar en el plano XY
      mesh.position.set(cx, -cy, 0); // Ojo: invertí Y para que no se vea volteado

      this.scene.add(mesh);
    });
  }

  // ✅ Cambiar color o material solo a ciertos objetos por nombre parcial
  setMaterialByName(partialName: string, material: THREE.Material) {
    if (!this.objeto) return;
    this.objeto.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes(partialName.toLowerCase())) {
        (child as THREE.Mesh).material = material;
      }
    });
  }


  setTexture(url: string) {
    if (!this.objeto) return;

    const texture = this.loader.load(url, (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4); // 🔸 ajustá la escala visual de la textura
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    this.objeto.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geom = mesh.geometry as THREE.BufferGeometry;

        // 🧩 Generar UVs tipo proyección plana global (XZ)
        if (!geom.attributes['uv']) {
          geom.computeBoundingBox();
          const bbox = geom.boundingBox!;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const pos = geom.attributes['position'] as THREE.BufferAttribute;

          const uvArray: number[] = [];
          for (let i = 0; i < pos.count; i++) {
            const x = (pos.getX(i) - bbox.min.x) / size.x;
            const z = (pos.getZ(i) - bbox.min.z) / size.z;
            uvArray.push(x, z);
          }
          geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
        }

        // 🎨 Nuevo material con mapa visible
        const newMat = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          metalness: 0.0,
          roughness: 1.0,
          side: THREE.DoubleSide,
        });

        mesh.material = newMat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }






  setTextureByName(partialName: string, url: string) {
    if (!this.objeto) return;

    const lowerName = partialName.toLowerCase();

    const texture = this.loader.load(url, (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

      // 🔸 Repetición según tipo
      if (lowerName.includes('window')) {
        tex.repeat.set(1, 1); // solo una vez
      } else if (lowerName.includes('door')) {
        tex.repeat.set(2, 2);
      } else {
        tex.repeat.set(2, 2); // muros por defecto
      }

      tex.colorSpace = THREE.SRGBColorSpace;
    });

    this.objeto.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const lname = mesh.name.toLowerCase();

      // Detectar tipo específico
      const isWall = lowerName === 'wall_internal' && lname.startsWith('wall_internal');
      const isDoor = lowerName === 'door' && lname.includes('door');
      const isWindow = lowerName === 'window' && lname.includes('window');

      // Solo aplicar si corresponde
      if (isWall || isDoor || isWindow) {
        const geom = mesh.geometry as THREE.BufferGeometry;

        // UVs
        if (!geom.attributes['uv']) {
          geom.computeBoundingBox();
          const bbox = geom.boundingBox!;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const pos = geom.attributes['position'] as THREE.BufferAttribute;

          const uvArray: number[] = [];
          for (let i = 0; i < pos.count; i++) {
            const x = (pos.getX(i) - bbox.min.x) / size.x;
            const z = (pos.getZ(i) - bbox.min.z) / size.z;
            uvArray.push(x, z);
          }
          geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
        }

        // 🎨 Material según tipo
        const newMat = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          metalness: 0.1,
          roughness: 0.9,
          side: THREE.DoubleSide,
          transparent: isWindow,
          opacity: isWindow ? 0.9 : 1.0,
        });

        mesh.material = newMat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

  }

  exportAsGLB(filename = 'modelo.glb') {
    if (!this.objeto) {
      console.warn('⚠️ No hay modelo cargado para exportar.');
      return;
    }

    const exporter = new GLTFExporter();

    exporter.parse(
      this.objeto,
      (result) => {
        // Si es binario (GLB)
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          this.downloadBlob(blob, filename);
        } else {
          // Si es JSON (.gltf)
          const json = JSON.stringify(result, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          this.downloadBlob(blob, filename.replace('.glb', '.gltf'));
        }
      },
      (error) => {
        console.error('❌ Error exportando modelo:', error);
      },
      { binary: true } // 🔸 cambia a false si quieres GLTF JSON
    );
  }

  /**
     * 🔽 Descarga el archivo generado en el navegador
     */
  private downloadBlob(blob: Blob, filename: string) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

toJSONSummary() {
  const findMaterialName = (map?: THREE.Texture | null) => {
    if (!map) return 'Sin textura';
    const url = (map.image?.currentSrc || map.image?.src || '').toLowerCase();
    const tex = this.textures.find(t => url.includes(t.url.toLowerCase()));
    return tex ? tex.name : 'Personalizado';
  };

  const extractData = (mesh: THREE.Mesh, type: string) => {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);

    const material = mesh.material as THREE.MeshStandardMaterial;
    const materialName = findMaterialName(material.map);

    return {
      type,
      name: mesh.name,
      width: size.x,
      height: size.y,
      depth: size.z,
      position: {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      },
      material: {
        name: materialName,
        color: material.color?.getHexString?.(),
      },
    };
  };

  return {
    counts: {
      walls: this.walls.length,
      doors: this.doors.length,
      windows: this.windows.length,
    },
    objects: [
      ...this.walls.map((m) => extractData(m, 'wall')),
      ...this.doors.map((m) => extractData(m, 'door')),
      ...this.windows.map((m) => extractData(m, 'window')),
    ],
  };
}




}




