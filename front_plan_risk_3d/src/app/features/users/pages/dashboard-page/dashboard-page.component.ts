import { Validators } from '@angular/forms';
import { Model3D } from './../../../../models/interfaces/model3D/model3D.interface';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { ModelsService } from '../../../viewer3d/services/models.service';
import { Router } from '@angular/router';



@Component({
  selector: 'app-dashboard-page',
  imports: [],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private model3DService = inject(ModelsService);
  private router = inject(Router);

  listModels = computed(() => this.model3DService.listModelsUser());

  guardarModelo(modelo: Model3D) {
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
}
