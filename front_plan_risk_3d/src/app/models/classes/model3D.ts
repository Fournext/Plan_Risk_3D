import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Modelo3D {
  public objeto!: THREE.Object3D;
  private onLoadCallbackList: Array<() => void> = [];

  constructor(
    private scene: THREE.Scene,
    private url: string,
    private position = new THREE.Vector3(0, 0, 0),
    private scale = new THREE.Vector3(1, 1, 1),
    private rotation = new THREE.Euler(0, 0, 0),
    onLoadCallback?: () => void
  ) {
    if (onLoadCallback) this.onLoadCallbackList.push(onLoadCallback);
    this.cargarModelo();
  }

  private cargarModelo() {
    const loader = new GLTFLoader();

    loader.load(this.url, (gltf) => {
      this.objeto = gltf.scene;

      // 1) Aplico la escala primero
      this.objeto.scale.copy(this.scale);

      // 2) Calculo el bounding box tras la escala
      let box = new THREE.Box3().setFromObject(this.objeto);
      let center = box.getCenter(new THREE.Vector3());

      // 3) Muevo el objeto al origen restando el centro (X, Y y Z)
      this.objeto.position.sub(center);

      // 4) Recalculo el bounding box para obtener la altura tras centrar
      box = new THREE.Box3().setFromObject(this.objeto);
      const height = box.getSize(new THREE.Vector3()).y;
      const halfHeight = height / 2;

      // 5) Elevo la mitad de la altura para que repose sobre Y=0
      this.objeto.position.y += halfHeight;

      // 6) Por último agrego la posición que me pasan por parámetro (offset X,Z,o Y extra si lo deseas)
      this.objeto.position.add(this.position);

      // 7) Copio también la rotación
      this.objeto.rotation.copy(this.rotation);

      // 8) Lo añado a la escena
      this.scene.add(this.objeto);

      // 9) Lanzo todos los callbacks registrados
      this.onLoadCallbackList.forEach(cb => cb());
    });
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

  // ✅ Cambiar solo la textura del material
  setTexture(texture: THREE.Texture) {
    this.objeto.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        const materiales = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];

        materiales.forEach((mat) => {
          if ((mat as THREE.MeshStandardMaterial).map !== undefined) {
            (mat as THREE.MeshStandardMaterial).map = texture;
            (mat as THREE.MeshStandardMaterial).needsUpdate = true;
          }
        });
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
}
