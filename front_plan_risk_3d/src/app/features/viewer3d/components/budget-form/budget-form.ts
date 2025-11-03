import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryInterface, MaterialInterface } from '../../../../models/interfaces/model3D/material.interface';
import { MaterialService } from '../../services/material.service';
import { BudgetService } from '../../services/budget.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalPipe],
  templateUrl: './budget-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetForm {
  private fb = inject(FormBuilder);
  public budgetService = inject(BudgetService);


  //funcion que recibimos del componente padre para cerrar el modal
  action = input<() => void>();


  constructor() { }
  cerrarModal() {
    console.log('cerrando modal desde budget form');
    this.action()?.();
  }

  descargarPDF() {
    const doc = new jsPDF();

    // 🧾 Título
    doc.setFontSize(18);
    doc.text('Presupuesto Detallado', 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(150); // gris suave
    doc.text('Generado por Plan3DRisk', 14, 10);


    // 📊 Tabla de materiales
    const materiales = this.budgetService.categoryAndMaterials().map((item: any) => [
      item.categoria,
      item.material,
      item.total.toFixed(2) + ' USD'
    ]);


    autoTable(doc, {
      head: [['Categoría', 'Material', 'Subtotal']],
      body: materiales,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 11 },
      headStyles: { fillColor: [68, 125, 155] } // azul igual que tu app
    });

    // 💰 Total
    const total = this.budgetService.totalCost().toFixed(2);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text(`TOTAL:  ${total} USD`, 14, finalY);

    // 💾 Descargar PDF
    doc.save('presupuesto.pdf');
  }


}
