import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { BlockchainService } from '../../../services/blockchain.service';
import { compute } from 'three/src/nodes/TSL.js';
import { environment } from '../../../../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Modelo3D } from '../../../../../models/classes/model3D';
import * as THREE from 'three';
import { blob } from 'stream/consumers';

@Component({
  selector: 'app-modal-blockchain',
  imports: [],
  templateUrl: './modalBlockchain.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalBlockchain {
  private blockchainService = inject(BlockchainService);
  private toastr = inject(ToastrService);
  public API = environment.endpoint;

  action = input<() => void>();

  //imagen original a verificar
  imageOriginal = computed(() => this.blockchainService.imageToVerify());
  //imagen a cargar para verificar
  previewImage = signal<string>('');
  selectedFile = signal<File | undefined>(undefined);
  model3D = signal<File | null>(null);
  jsonFile = signal<File | null>(null);



  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // 🔹 Forzar tipo PNG (mantiene extensión correcta)
    const reader = new FileReader();
    reader.onload = () => {
      const blob = new Blob([reader.result as ArrayBuffer], { type: 'image/png' });
      const fixedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".png"), { type: 'image/png' });

      this.previewImage.set(URL.createObjectURL(fixedFile));
      this.selectedFile.set(fixedFile);
      console.log("✅ Imagen convertida a PNG:", fixedFile);
    };

    // Leer como ArrayBuffer para reconstruir bien el Blob
    reader.readAsArrayBuffer(file);
  }

  //crear jsonVacio
  public crearJsonVacio() {
    let blob: Blob;
    let nombre = '';
    blob = new Blob([JSON.stringify({}, null, 2)], { type: 'application/json' });
    nombre = `archivo_vacio_${Date.now()}.json`;
    const file = new File([blob], nombre, { type: 'application/json' });
    this.jsonFile.set(file);
  }
  //crear un modelo vacio 
  public crearModeloVacio() {
    const numeroAleatorio = Math.floor(Math.random() * 1000);

    const textures = [
      { name: 'Ladrillo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1757453080/ladrillo_e3xocf.jpg' },
      { name: 'Piedra', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883265/plaster_brick_pattern_disp_1k_awiqtc.png' },
      { name: 'Cemento', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883245/cracked_concrete_wall_disp_1k_sstfyd.png' },
      { name: 'Madera tajibo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894564/plywood_diff_1k_yle5d5.jpg' },
      { name: 'Madera ochoo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894554/wooden_gate_diff_1k_wjzhjf.jpg' },
      { name: 'Madera roble', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894546/worn_planks_diff_1k_k9xbdg.jpg' },
      { name: 'Vidrio simple', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759888245/depositphotos_153541450-stock-photo-glass-texture-background_ueykra.webp' },
      { name: 'Vidrio escandinavo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1761688251/Ice001_1K-JPG_Color_mcmksd.jpg' },
    ];
    const nuevoModelo = new Modelo3D(
      null,  // 🔥 SIN ESCENA
      null,  // 🔥 MODELO VACÍO
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1),
      new THREE.Euler(0, 0, 0),
      textures,
      () => console.log("Modelo vacío creado sin escena")
    );

    nuevoModelo.exportAsGLB(`job_${numeroAleatorio}`)
      .then(({ blob }) => {
        // Aquí puedes manejar el blob del modelo 3D vacío
        console.log('Modelo 3D vacío creado:', blob);
        const file = new File([blob], `job_${numeroAleatorio}.glb`, { type: "model/gltf-binary" });
        this.model3D.set(file);
      })
      .catch((error) => {
        console.error('Error al crear el modelo 3D vacío:', error);
      });

  }
  //crear un json vacio
  onVerifyImage() {
    const numeroAleatorio = Math.floor(Math.random() * 1000);

    const textures = [
      { name: 'Ladrillo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1757453080/ladrillo_e3xocf.jpg' },
      { name: 'Piedra', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883265/plaster_brick_pattern_disp_1k_awiqtc.png' },
      { name: 'Cemento', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759883245/cracked_concrete_wall_disp_1k_sstfyd.png' },
      { name: 'Madera tajibo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894564/plywood_diff_1k_yle5d5.jpg' },
      { name: 'Madera ochoo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894554/wooden_gate_diff_1k_wjzhjf.jpg' },
      { name: 'Madera roble', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759894546/worn_planks_diff_1k_k9xbdg.jpg' },
      { name: 'Vidrio simple', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1759888245/depositphotos_153541450-stock-photo-glass-texture-background_ueykra.webp' },
      { name: 'Vidrio escandinavo', url: 'https://res.cloudinary.com/diqqfka6g/image/upload/v1761688251/Ice001_1K-JPG_Color_mcmksd.jpg' },
    ];
    const nuevoModelo = new Modelo3D(
      null,  // 🔥 SIN ESCENA
      null,  // 🔥 MODELO VACÍO
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1),
      new THREE.Euler(0, 0, 0),
      textures,
      () => console.log("Modelo vacío creado sin escena")
    );

    nuevoModelo.exportAsGLB(`job_${numeroAleatorio}`)
      .then(({ blob }) => {
        // Aquí puedes manejar el blob del modelo 3D vacío
        console.log('Modelo 3D vacío creado:', blob);
        const file = new File([blob], `job_${numeroAleatorio}.glb`, { type: "model/gltf-binary" });
        //this.model3D.set(file);//aqui debo hacer la logica de enviar al servidor
        this.crearJsonVacio();
        //this.crearModeloVacio();
        if (!this.selectedFile()) {
          this.toastr.error('Por favor, seleccione una imagen para verificar.', 'Error de Verificación');
          return;
        }
        this.blockchainService.verifyImagen(
          this.selectedFile()!, this.imageOriginal().id, this.jsonFile()!, file
        ).subscribe({
          next: (response) => {
            console.log({ response });
            if (response.details.image.valid) {
              this.toastr.success('La imagen es válida y coincide con la original en la blockchain.', 'Verificación Exitosa');
            } else {
              this.toastr.error('La imagen no coincide con la original en la blockchain.', 'Verificación Fallida');
            }
            //this.action()?.();
          }, error: (error) => {
            console.log({ error });
            this.toastr.error('Ocurrió un error durante la verificación de la imagen.', 'Error de Verificación');
          }
        });
      })
      .catch((error) => {
        console.error('Error al crear el modelo 3D vacío:', error);
      });

  }
}
