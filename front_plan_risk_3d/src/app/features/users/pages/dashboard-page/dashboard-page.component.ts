import { Validators } from '@angular/forms';
import { Model3D } from './../../../../models/interfaces/model3D/model3D.interface';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ModelsService } from '../../../viewer3d/services/models.service';
import { Router } from '@angular/router';
import { TokenStorageService } from '../../../auth/services/tokenStorage.service';
import { ToastrService } from 'ngx-toastr';



@Component({
  selector: 'app-dashboard-page',
  imports: [],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private model3DService = inject(ModelsService);
  private tokenStorageService = inject(TokenStorageService);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  listModels = computed(() => this.model3DService.listModelsUser());
  imagePreview = signal<string | null>(null);

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
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const currentUser = this.tokenStorageService.getUser();
    if (input.files && input.files.length > 0 && currentUser) {
      const file = input.files[0];
      this.model3DService.uploadModels(file, currentUser.id).subscribe({
        next: (response) => {
          this.toastr.success('Modelo subido con exito', 'Exito', { timeOut: 3000 });
          console.log('Modelo subido:', response);
        },
        error: (error) => {
          this.toastr.error('Error al subir el modelo', error.message, { timeOut: 3000 });
        }
      });
    }
    input.value = '';
  }

  openModalViewer(imagen:string){
    this.imagePreview.set(imagen);
  }
  closeModalViewer(){
    this.imagePreview.set(null);
  }
}
