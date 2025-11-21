import { Validators } from '@angular/forms';
import { Model3D } from './../../../../models/interfaces/model3D/model3D.interface';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ModelsService } from '../../../viewer3d/services/models.service';
import { Router } from '@angular/router';
import { TokenStorageService } from '../../../auth/services/tokenStorage.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { Spinner } from "../../../../layout/components/spinner/spinner";
import { Modelo3D } from '../../../../models/classes/model3D';
import * as THREE from 'three';
import { BlockchainService } from '../../services/blockchain.service';
import { ModalBlockchain } from "../components/modalBlockchain/modalBlockchain";
import { environment } from '../../../../../environments/environment';



@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, Spinner, ModalBlockchain],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private model3DService = inject(ModelsService);
  private blockchainService = inject(BlockchainService);
  private tokenStorageService = inject(TokenStorageService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  public API = environment.endpoint;

  private openModalBlockchain = signal(false);

  listModels = computed(() => this.model3DService.listModelsUser());
  imagePreview = signal<string | null>(null);

  public OpenModalBlockchain(id: number, url: string) {
    console.log({id});
    this.blockchainService.imageToVerify.set({
      id:id ,
      url: url.slice(1)
    });
    this.openModalBlockchain.set(true);
  }

  public closeModalBlockchain = () => {
    this.openModalBlockchain.set(false);
  }

  public getOpenModalBlockchain() {
    return this.openModalBlockchain();
  }


  openModel(modelo: Model3D) {
    localStorage.setItem('modelo', JSON.stringify(modelo));
    this.router.navigate(['private/editor']);
  }

  ngOnInit(): void {
    this.model3DService.getModels().subscribe({
      next: (response: Model3D[]) => {
        console.log({ response });
      }
    })
  }
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const currentUser = this.tokenStorageService.getUser();
    if (input.files && input.files.length > 0 && currentUser) {
      const file = input.files[0];
      //aqui vamos a aplicar el estado para cargar el spinner
      this.changeStateIsLoading();
      this.model3DService.uploadModels(file, currentUser.id).subscribe({
        next: (response) => {
          this.toastr.success('Modelo subido con exito', 'Exito', { timeOut: 3000 });
          console.log('Imagen subido:', response);
          this.changeStateIsLoading();
        },
        error: (error) => {
          this.toastr.error('Error al subir el modelo', error.message, { timeOut: 3000 });
          this.changeStateIsLoading();
        }
      });
    }
    input.value = '';
  }

  onModelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const currentUser = this.tokenStorageService.getUser();
    if (input.files && input.files.length > 0 && currentUser) {
      const file = input.files[0];
      this.changeStateIsLoading();
      this.model3DService.onSaveModel(file, currentUser.id).subscribe({
        next: (response) => {
          this.toastr.success('Modelo 3D subido con exito', 'Exito', { timeOut: 3000 });
          console.log('Modelo subido:', response);
          this.changeStateIsLoading();
        },
        error: (error) => {
          this.toastr.error('Error al subir el modelo 3D', error.message, { timeOut: 3000 });
          this.changeStateIsLoading();
        }
      })
    }
    input.value = '';
  }

  openModalViewer(imagen: string) {
    this.imagePreview.set(imagen);
  }
  closeModalViewer() {
    this.imagePreview.set(null);
  }

  public isLoadingModel() {
    return this.model3DService.isLoading();
  }

  public changeStateIsLoading() {
    this.model3DService.isLoading.set(!this.model3DService.isLoading());
  }


  //metodo para crear un modelo 3d vacio y subirlo al servidor
  onCreateModel() {
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

        // 🔥 Convertir Blob → File
        const file = new File([blob], `job_${numeroAleatorio}.glb`, { type: "model/gltf-binary" });
        const currentUser = this.tokenStorageService.getUser();
        if (currentUser) {
          this.changeStateIsLoading();
          this.model3DService.onSaveModel(file, currentUser.id).subscribe({
            next: (response) => {
              this.toastr.success('Modelo 3D creado con éxito', 'Éxito', { timeOut: 3000 });
              console.log('Modelo subido:', response);
              this.changeStateIsLoading();
            },
            error: (error) => {
              this.toastr.error('Error al crear el modelo 3D', error.message, { timeOut: 3000 });
              this.changeStateIsLoading();
            }
          });
        }
      });
  }

  onVerifyPlan() {

  }


}
