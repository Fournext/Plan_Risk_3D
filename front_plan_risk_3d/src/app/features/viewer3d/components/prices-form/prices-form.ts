import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialService } from '../../services/material.service';
import { BudgetService } from '../../services/budget.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-prices-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './prices-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricesForm {
  private fb = inject(FormBuilder);
  public materialService = inject(MaterialService);
  public budgetService = inject(BudgetService);

  materialsForm: FormGroup = this.fb.group({});
  //funcion que recibimos del componente padre para cerrar el modal
  action = input<() => void>();


  constructor() {
    // crear controles
    this.materialService.materiales().forEach(mat => {
      this.materialsForm.addControl(
        mat.nombre,
        this.fb.control(mat.precio_unitario, [Validators.required, Validators.min(0.1)])
      );
    });
  }

  ngOnInit() {
    this.materialService.postMaterial(this.materialService.categories(), this.materialService.materiales()).subscribe({
      next: (response) => {
        console.log('Materiales enviados correctamente:', response);
      },
      error: (error) => {
        console.error('Error al enviar materiales:', error);
      }
    });
  }

  actualizarMaterial(nombre: string) {
    const nuevoPrecio = this.materialsForm.get(nombre)?.value;
    this.materialService.materiales.update(mats =>
      mats.map(m => (m.nombre === nombre ? { ...m, precio_unitario: nuevoPrecio } : m))
    );
    console.log('Material actualizado:', nombre, 'Nuevo precio:', nuevoPrecio);
    console.log(this.materialService.materiales());
  }

  cerrarModal() {
    console.log('cerrando modal desde budget form');
    this.action()?.();
  }

  guardarCambios() {
    this.materialService.postMaterial(this.materialService.categories(), this.materialService.materiales()).subscribe({
      next: (response) => {
        console.log('Materiales guardados correctamente:', response);
        this.cerrarModal();
      },
      error: (error) => {
        console.error('Error al guardar materiales:', error);
      }
    });
  }

  isValidField(nombre: string) {
    return !!this.materialsForm.controls[nombre]?.errors;
  }
}
