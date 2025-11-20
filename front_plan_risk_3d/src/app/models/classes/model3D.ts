import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelJson } from '../interfaces/model3D/model3D.interface';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';




export class Modelo3D {
  private scene: THREE.Scene;
  public objeto!: THREE.Object3D;
  private onLoadCallbackList: Array<() => void> = [];
  private loader = new THREE.TextureLoader();
  private walls: THREE.Mesh[] = [];
  private doors: THREE.Mesh[] = [];
  private windows: THREE.Mesh[] = [];


  constructor(
    scene: THREE.Scene | null,
    private url: string | null,
    public position = new THREE.Vector3(0, 0, 0),
    public scale = new THREE.Vector3(1, 1, 1),
    public rotation = new THREE.Euler(0, 0, 0),
    private textures: { name: string; url: string }[] = [],
    onLoadCallback?: () => void
  ) {
    // 🔥 Si NO hay escena → creamos una interna
    this.scene = scene ?? new THREE.Scene();

    if (onLoadCallback) this.onLoadCallbackList.push(onLoadCallback);
    this.cargarModelo();
  }

  private async cargarModelo() {
    if (!this.url) {
      console.log("📦 Creando modelo vacío…");

      this.objeto = new THREE.Group();
      this.objeto.name = "ModeloVacio";

      // Se agrega a la escena interna (aunque no se renderice)
      this.scene.add(this.objeto);

      this.onLoadCallbackList.forEach(cb => cb());
      return;
    }

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
    const textureName = this.textures.find(t => t.url === url)?.name ?? 'Personalizado';

    const texture = this.loader.load(url);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.objeto.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const lname = mesh.name.toLowerCase();

      const isWall = lowerName === 'wall_internal' && lname.startsWith('wall_internal');
      const isDoor = lowerName === 'door' && lname.includes('door');
      const isWindow = lowerName === 'window' && lname.includes('window');
      if (!isWall && !isDoor && !isWindow) return;

      // Configura repetición
      if (isWindow) texture.repeat.set(1, 1);
      else if (isDoor) texture.repeat.set(2, 2);
      else texture.repeat.set(2, 2);

      // Asegura UVs
      const geom = mesh.geometry as THREE.BufferGeometry;
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

      // 🎨 Crea material y guarda metadato del nombre
      const newMat = new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide,
        transparent: isWindow,
        opacity: isWindow ? 0.9 : 1.0,
      });

      (newMat as any)._textureName = textureName; // ✅ guarda el nombre explícitamente

      mesh.material = newMat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  exportAsGLB(filename = 'modelo.glb'): Promise<{ blob: Blob, filename: string }> {
    return new Promise((resolve, reject) => {
      if (!this.objeto) return reject('No hay modelo cargado');

      const exporter = new GLTFExporter();
      exporter.parse(
        this.objeto,
        (result) => {
          const blob =
            result instanceof ArrayBuffer
              ? new Blob([result], { type: 'model/gltf-binary' })
              : new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });

          // ✅ Ahora sí el nombre queda emparejado al resultado
          resolve({ blob, filename });
        },
        (err) => reject(err),
        { binary: true }
      );
    });
  }


  /**
   * 🔽 Descarga un blob usando el nombre proporcionado
   */
  downloadBlob(blob: Blob, filename: string) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }


  toJSONSummary() {
    const findMaterialName = (mat?: THREE.Material) => {
      if (!mat) return 'Sin textura';
      const m = mat as any;
      if (m._textureName) return m._textureName; // ✅ leer etiqueta guardada
      if (m.map?.image?.src) {
        const url = m.map.image.src.toLowerCase();
        const tex = this.textures.find(t => url.includes(t.url.toLowerCase()));
        if (tex) return tex.name;
      }
      return 'Personalizado';
    };



    const extractData = (mesh: THREE.Mesh, type: string) => {
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);

      const material = mesh.material as THREE.MeshStandardMaterial;
      const materialName = findMaterialName(material);


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


  createElement(
    type: 'wall' | 'door' | 'window',
    width = 1,
    height = 3,
    depth = 0.4,
    position?: THREE.Vector3
  ) {
    // 1️⃣ Buscar referencia de material según tipo
    let refArray: THREE.Mesh[] = [];
    if (type === 'wall') refArray = this.walls;
    else if (type === 'door') refArray = this.doors;
    else if (type === 'window') refArray = this.windows;

    // 2️⃣ Determinar material base
    let baseMaterial: THREE.MeshStandardMaterial;
    if (refArray.length > 0) {
      baseMaterial = (refArray[0].material as THREE.MeshStandardMaterial).clone();
    } else {
      let color = 0xaaaaaa;
      if (type === 'wall') color = 0x444444;
      if (type === 'door') color = 0x00ff00;
      if (type === 'window') color = 0x0000ff;

      baseMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
    }

    // 3️⃣ Calcular altura base (nivel del suelo)
    let baseY = 0;
    if (this.walls.length > 0) {
      const ref = this.walls[0];
      const box = new THREE.Box3().setFromObject(ref);
      baseY = box.min.y;
    }

    // 4️⃣ Posición del nuevo elemento (sin modificar luego)
    const pos = position ?? new THREE.Vector3(0, 0, 0);
    pos.y = baseY; // base real del suelo

    // 5️⃣ Crear geometría con pivot en la base (crece solo hacia arriba)
    const geometry = new THREE.BoxGeometry(width, height, depth);

    // 👇 Fijamos el pivot abajo (para eje Y como altura)
    geometry.translate(0, height / 2, 0);

    const mesh = new THREE.Mesh(geometry, baseMaterial);
    

    if (type === 'wall') mesh.name = `wall_internal_${Date.now()}`;
    if (type === 'door') mesh.name = `door_${Date.now()}`;
    if (type === 'window') mesh.name = `window_${Date.now()}`;
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 6️⃣ Añadir al grupo y clasificar
    this.objeto.add(mesh);
    if (type === 'wall') this.walls.push(mesh);
    if (type === 'door') this.doors.push(mesh);
    if (type === 'window') this.windows.push(mesh);

    // 7️⃣ Guardar la base del muro
    (mesh.userData as any).baseY = baseY;

    return mesh;
  }

  removeElement(mesh: THREE.Mesh) {
    if (!this.objeto) return;

    // 1. Detach material + geometry (limpia de GPU)
    if (mesh.material) {
      const mat = mesh.material as THREE.Material;
      mat.dispose?.();
    }
    mesh.geometry.dispose();

    // 2. Eliminar del grupo GLTF (REAL)
    this.objeto.remove(mesh);

    // 3. Eliminar de listas internas
    this.walls = this.walls.filter(m => m !== mesh);
    this.doors = this.doors.filter(m => m !== mesh);
    this.windows = this.windows.filter(m => m !== mesh);

    mesh.removeFromParent();
  }
}




