import { ChangeDetectionStrategy, Component, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { UserService } from '../../services/user.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TokenStorageService } from '../../../auth/services/tokenStorage.service';
import { isPlatformBrowser } from '@angular/common';
import { UserRegister } from '../../../../models/interfaces/users/users.interface';
import { nextTick } from 'process';
import { CloudinaryService } from '../../services/cloudinary.service';
import { Toast, ToastrService } from 'ngx-toastr';
import { Spinner } from "../../../../layout/components/spinner/spinner";

@Component({
  selector: 'app-perfil-page',
  imports: [ReactiveFormsModule, Spinner],
  templateUrl: './perfil-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilPageComponent implements OnInit {
  private userService = inject(UserService);
  private tokenStorageService = inject(TokenStorageService);
  private formBuilder = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  private cloudinaryService = inject(CloudinaryService);
  private toastr = inject(ToastrService);

  //usuario actual como computed
  currentUser = computed(() => this.userService.usuario());


  isReadOnly: boolean = true;

  informationForm = this.formBuilder.group({
    nombre: ['', [Validators.minLength(5)]],
    email: ['', [Validators.email]],
    telefono: ['', [Validators.minLength(8)]],
    plan: [''],                // <-- valor “vacío” al inicio
    fechaExpiracion: [''],
    fechaRegistro: ['']
  });

  public isLoadingImage() {
    return this.cloudinaryService.isLoading();
  }

  public changeStateIsLoading() {
    this.cloudinaryService.isLoading.set(!this.cloudinaryService.isLoading());
  }

  switchEdition(): void {
    this.isReadOnly = !this.isReadOnly;
  }



  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
  private toDateValue(iso: string | null | undefined): string {
    return iso ? iso.split('T')[0] : '';
  }
  onSubmit() {
    if (!this.isBrowser) return;
    const id = this.tokenStorageService.getUser()?.id ?? 0;

    // construimos objeto solo con campos no vacíos
    const user: any = {};
    if (this.informationForm.value.nombre) user.nombre = this.informationForm.value.nombre;
    if (this.informationForm.value.email) user.email = this.informationForm.value.email;
    if (this.informationForm.value.plan) user.rol = this.informationForm.value.plan;
    if (this.informationForm.value.fechaExpiracion) user.fecha_expiracion_plan = this.informationForm.value.fechaExpiracion;
    if (this.informationForm.value.fechaRegistro) user.fecha_registro = this.informationForm.value.fechaRegistro;

    this.userService.editUser(id, user).subscribe({
      next: (response: any) => {
        console.log("Usuario actualizado:", response);
      },
      error: (err) => {
        console.error("Error al actualizar:", err);
      }
    });
  }

  onUpdloadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const currentUser = this.tokenStorageService.getUser();
    if (input.files && input.files.length > 0 && currentUser) {
      const file = input.files[0];
      this.changeStateIsLoading();
      this.cloudinaryService.uploadImage(file).subscribe({
        next: (response) => {
          this.toastr.success('Imagen subida con éxito', 'Éxito', { timeOut: 3000 });
          console.log('Imagen subida:', response);
          //actualizaremos al usuario con la nueva urlthis.changeStateIsLoading();
          this.changeStateIsLoading();
          this.userService.editUser(currentUser.id, { url: response.secure_url } as UserRegister).subscribe({
            next: (res) => {
              console.log('Usuario actualizado con nueva imagen:', res);
              // Aquí puedes actualizar el estado del componente si es necesario
            },
            error: (error) => {
              this.toastr.error('Error al actualizar el usuario', error.message, { timeOut: 3000 });
            }
          });
        },
        error: (error) => {
          this.toastr.error('Error al subir la imagen', error.message, { timeOut: 3000 });
          this.changeStateIsLoading();
        }
      });
    }

    input.value = '';
  }


  ngOnInit(): void {
    if (!this.isBrowser) return;
    const id = this.tokenStorageService.getUser()?.id ?? 0;
    this.userService.getUser(id).subscribe(usuario => {
      // parcheamos el formulario con los datos reales:
      this.informationForm.patchValue({
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        // aquí aplicamos el mapeo correctamente:
        plan: usuario.rol,
        fechaExpiracion: usuario.fecha_expiracion_plan?.split('T')[0] ?? '',
        fechaRegistro: usuario.fecha_registro?.split('T')[0] ?? ''
      })
        ;
    });
  }

}
